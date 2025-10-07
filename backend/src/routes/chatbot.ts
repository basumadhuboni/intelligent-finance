import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import type { AuthRequest } from '../middleware/auth';
import { requireAuth } from '../middleware/auth';

const prisma = new PrismaClient();
const router = Router();

const querySchema = z.object({
  message: z.string().min(1),
});

function toStartOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toEndOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function parseUserDateRange(message: string, now: Date): { start?: Date; end?: Date; kind?: string } {
  const m = message.toLowerCase();
  const todayStart = toStartOfDay(now);
  const todayEnd = toEndOfDay(now);

  if (/(today|todays|to\s*day)/.test(m)) return { start: todayStart, end: todayEnd, kind: 'today' };
  if (/(yesterday|yester\s*day)/.test(m)) {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return { start: toStartOfDay(y), end: toEndOfDay(y), kind: 'yesterday' };
  }
  if (/last\s*week/.test(m)) {
    const end = toEndOfDay(now);
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    return { start, end, kind: 'last_week' };
  }
  if (/(this\s*month|current\s*month)/.test(m)) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = toEndOfDay(now);
    return { start, end, kind: 'this_month' };
  }
  if (/last\s*month/.test(m)) {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { start, end, kind: 'last_month' };
  }
  if (/(this\s*year|current\s*year)/.test(m)) {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    return { start, end, kind: 'this_year' };
  }
  if (/last\s*year/.test(m)) {
    const y = now.getFullYear() - 1;
    const start = new Date(y, 0, 1);
    const end = new Date(y, 11, 31, 23, 59, 59, 999);
    return { start, end, kind: 'last_year' };
  }

  // Try explicit date formats like 7/10/2025 or 2025-10-07
  const dateMatch = m.match(/(\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b|\b\d{4}[\-\/]\d{1,2}[\-\/]\d{1,2}\b)/);
  if (dateMatch) {
    const raw = dateMatch[1];
    let d: Date | null = null;
    if (/^\d{4}[\-\/]\d{1,2}[\-\/]\d{1,2}$/.test(raw)) {
      // ISO-like yyyy-mm-dd
      d = new Date(raw);
    } else {
      // Assume dd/mm/yyyy or mm/dd/yyyy; prefer dd/mm/yyyy if day > 12
      const parts = raw.split(/[\/-]/).map(n => parseInt(n, 10));
      const [a, b, c] = parts;
      if (c >= 100) {
        const dayFirst = a > 12;
        const day = dayFirst ? a : b;
        const month = dayFirst ? b : a;
        d = new Date(c, month - 1, day);
      }
    }
    if (d && !isNaN(d.getTime())) {
      return { start: toStartOfDay(d), end: toEndOfDay(d), kind: 'specific_day' };
    }
  }

  return {};
}

const categoryAliases: Record<string, string> = {
  dining: 'Dining',
  restaurant: 'Dining',
  food: 'Dining',
  groceries: 'Groceries',
  grocery: 'Groceries',
  fuel: 'Fuel',
  gas: 'Fuel',
  transportation: 'Transportation',
  taxi: 'Transportation',
  uber: 'Transportation',
  entertainment: 'Entertainment',
  health: 'Health',
  shopping: 'Shopping',
  utilities: 'Utilities',
  salary: 'Salary',
  freelance: 'Freelance',
};

function detectIntent(message: string):
  | { kind: 'count_category'; category: string }
  | { kind: 'sum_category'; category: string }
  | { kind: 'sum_total' }
  | { kind: 'budget_survivability' }
  | { kind: 'recommendations' }
  | null {
  const m = message.toLowerCase();

  // how many times did i go for dining ... count of category
  if (/how\s+many\s+times/.test(m)) {
    for (const key of Object.keys(categoryAliases)) {
      if (m.includes(key)) return { kind: 'count_category', category: categoryAliases[key] };
    }
  }

  // how much did i spend on <category>
  if (/how\s+much\s+did\s+i\s+spend/.test(m)) {
    for (const key of Object.keys(categoryAliases)) {
      if (m.includes(key)) return { kind: 'sum_category', category: categoryAliases[key] };
    }
    return { kind: 'sum_total' };
  }

  // budget survivability and recommendations
  if (/(survive|within\s+my\s+budget|under\s+budget|over\s+budget|can\s+i\s+make\s+it\s+this\s+month)/.test(m)) {
    return { kind: 'budget_survivability' };
  }
  if (/(recommend|suggest|advice|how\s+to\s+save|tips)/.test(m)) {
    return { kind: 'recommendations' };
  }

  return null;
}

async function fetchUserContext(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const [recent, monthStats, totalStats] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 200, // cap context
    }),
    prisma.transaction.groupBy({
      by: ['type'],
      where: { userId, date: { gte: startOfMonth, lte: now } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ['type'],
      where: { userId },
      _sum: { amount: true },
    }),
  ]);

  const lastWeek = recent.filter(t => t.date >= sevenDaysAgo);

  const sumByType = (rows: Array<{ type: string; _sum: { amount: number | null } }>) => {
    return rows.reduce(
      (acc, r) => {
        const v = r._sum.amount ?? 0;
        if (r.type === 'EXPENSE') acc.expense += v;
        else if (r.type === 'INCOME') acc.income += v;
        return acc;
      },
      { income: 0, expense: 0 }
    );
  };

  const month = sumByType(monthStats as any);
  const total = sumByType(totalStats as any);

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const avgExpensePerDayThisMonth = dayOfMonth > 0 ? month.expense / dayOfMonth : 0;
  const projectedExpenseThisMonth = avgExpensePerDayThisMonth * daysInMonth;

  return {
    now: now.toISOString(),
    lastWeek,
    recent,
    month: { ...month, start: startOfMonth.toISOString(), end: now.toISOString() },
    totals: total,
    insights: {
      avgExpensePerDayThisMonth,
      projectedExpenseThisMonth,
      dayOfMonth,
      daysInMonth,
    },
  };
}

router.post('/query', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parse = querySchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
    const { message } = parse.data;

    const userId = req.userId!;
    const context = await fetchUserContext(userId);

    // Try to infer a concrete date range and compute totals & items first
    const inferred = parseUserDateRange(message, new Date());
    let rangeData: any = null;
    if (inferred.start && inferred.end) {
      const [items, totals] = await Promise.all([
        prisma.transaction.findMany({
          where: { userId, date: { gte: inferred.start, lte: inferred.end } },
          orderBy: { date: 'desc' },
          take: 50,
        }),
        prisma.transaction.groupBy({
          by: ['type'],
          where: { userId, date: { gte: inferred.start, lte: inferred.end } },
          _sum: { amount: true },
        }),
      ]);
      const sum = totals.reduce((acc, r) => {
        const v = r._sum.amount ?? 0;
        if (r.type === 'EXPENSE') acc.expense += v;
        else if (r.type === 'INCOME') acc.income += v;
        return acc;
      }, { income: 0, expense: 0 });
      rangeData = {
        range: { start: inferred.start.toISOString(), end: inferred.end.toISOString(), kind: inferred.kind },
        totals: sum,
        transactions: items.map(t => ({ id: t.id, date: t.date.toISOString(), type: t.type, amount: t.amount, category: t.category, description: t.description })),
      };
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    const modelName = 'gemini-2.0-flash-exp';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;

    const prompt = `You are a personal finance assistant. Answer ONLY using the provided JSON data.\n` +
`Be concise and specific. If the user asks for time ranges like "last week" or "this month", use now from context.\n\n` +
`Rules:\n` +
`- If the user asks "how much did I spend last week", compute sum of EXPENSE in lastWeek.\n` +
`- If asked "can I survive this month within my budget", use insights.avgExpensePerDayThisMonth and projectedExpenseThisMonth; if budget is not provided, explain using the projection and suggest a safe daily budget equal to remaining-days based adjustment.\n` +
`- When listing transactions, return at most 10 items, most recent first, with date, category, description, amount.\n` +
`- If a concrete RANGE is provided below, DO NOT ask clarifying questions; answer directly using RANGE_TOTALS and RANGE_TRANSACTIONS.\n` +
`- If the question is unclear AND no concrete RANGE is provided, ask one brief clarifying question.\n\n` +
`Return a single JSON object with keys:\n` +
`{ "reply": string, "transactions": Array<{date: string, category: string, description: string, amount: number}> | null }\n\n` +
`NOW:\n${context.now}\n\n` +
`CONTEXT:\n${JSON.stringify({
      month: context.month,
      totals: context.totals,
      insights: context.insights,
      lastWeek: context.lastWeek
        .slice(0, 100)
        .map(t => ({ id: t.id, date: t.date.toISOString(), type: t.type, amount: t.amount, category: t.category, description: t.description }))
    })}\n\n` +
`${rangeData ? `RANGE:\n${JSON.stringify(rangeData.range)}\nRANGE_TOTALS:\n${JSON.stringify(rangeData.totals)}\nRANGE_TRANSACTIONS:\n${JSON.stringify(rangeData.transactions.slice(0, 20))}\n\n` : ''}` +
`USER_MESSAGE:\n${message}`;

    const payload = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ]
    } as any;

    // If we can answer locally for common intents, do it now and return without AI
    const intent = detectIntent(message);
    if (intent) {
      const inferred = parseUserDateRange(message, new Date());
      const where: any = { userId };
      if (inferred.start && inferred.end) where.date = { gte: inferred.start, lte: inferred.end };
      if (intent.kind === 'count_category' || intent.kind === 'sum_category') where.category = intent.category;

      if (intent.kind === 'count_category') {
        const count = await prisma.transaction.count({ where });
        const rangeLabel = inferred.kind ? inferred.kind.replace('_', ' ') : 'all time';
        return res.json({ reply: `You went for ${intent.category} ${count} time(s) ${rangeLabel}.`, transactions: null });
      }

      if (intent.kind === 'sum_category') {
        const rows = await prisma.transaction.groupBy({ by: ['type'], where, _sum: { amount: true } });
        const sum = rows.find(r => r.type === 'EXPENSE')?._sum.amount ?? 0;
        const rangeLabel = inferred.kind ? inferred.kind.replace('_', ' ') : 'all time';
        return res.json({ reply: `You spent ₹${sum.toFixed(2)} on ${intent.category} ${rangeLabel}.`, transactions: null });
      }

      if (intent.kind === 'sum_total') {
        const rows = await prisma.transaction.groupBy({ by: ['type'], where, _sum: { amount: true } });
        const sum = rows.find(r => r.type === 'EXPENSE')?._sum.amount ?? 0;
        const rangeLabel = inferred.kind ? inferred.kind.replace('_', ' ') : 'all time';
        return res.json({ reply: `You spent a total of ₹${sum.toFixed(2)} ${rangeLabel}.`, transactions: null });
      }

      if (intent.kind === 'budget_survivability' || intent.kind === 'recommendations') {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const [user, agg] = await Promise.all([
          prisma.user.findUnique({ where: { id: userId }, select: { monthlyBudget: true } }),
          prisma.transaction.aggregate({
            where: { userId, type: 'EXPENSE', date: { gte: start, lte: end } },
            _sum: { amount: true },
          }),
        ]);

        const monthlyBudget = Number(user?.monthlyBudget ?? 0);
        const spent = Number(agg._sum.amount ?? 0);
        const remaining = Math.max(0, monthlyBudget - spent);
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const dayOfMonth = now.getDate();
        const daysLeft = Math.max(0, daysInMonth - dayOfMonth);
        const avgPerDaySoFar = dayOfMonth > 0 ? spent / dayOfMonth : 0;
        const neededPerDay = daysLeft > 0 ? remaining / daysLeft : 0;
        const canSurvive = monthlyBudget > 0 ? (spent <= monthlyBudget) : false;

        if (intent.kind === 'budget_survivability') {
          const reply = monthlyBudget > 0
            ? `This month you've spent ₹${spent.toFixed(2)} of your ₹${monthlyBudget.toFixed(2)} budget. ${canSurvive ? 'Yes' : 'No'}, you ${canSurvive ? 'are currently within' : 'are over'} budget. To stay within budget, target about ₹${neededPerDay.toFixed(2)} per day for the remaining ${daysLeft} day(s).`
            : `You haven't set a monthly budget yet. So far this month you've spent ₹${spent.toFixed(2)}.`;
          return res.json({ reply, transactions: null });
        }

        if (intent.kind === 'recommendations') {
          const tips: string[] = [];
          if (monthlyBudget > 0) {
            tips.push(`Target ≤ ₹${neededPerDay.toFixed(2)} per day for the remaining ${daysLeft} day(s).`);
          }
          if (avgPerDaySoFar > 0) {
            tips.push(`Your average daily spend so far is ₹${avgPerDaySoFar.toFixed(2)}. Cut discretionary categories by 10–15% to meet target.`);
          }
          tips.push('Review top categories and reduce the largest 1–2 by setting weekly caps.');
          tips.push('Delay non-urgent purchases to next month.');
          const reply = `Suggestions based on your data: ${tips.join(' ')}`;
          return res.json({ reply, transactions: null });
        }
      }
    }

    // Fall back to AI
    let response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    // Simple retry once on 503 overload
    if (!response.ok && response.status === 503) {
      await new Promise(r => setTimeout(r, 600));
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify(payload),
      });
    }

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini chatbot error:', err);
      return res.status(500).json({ error: 'AI request failed' });
    }

    const result = await response.json();
    const aiText = result.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
    if (!aiText) return res.status(500).json({ error: 'Empty AI response' });

    let jsonText = aiText.trim();
    if (jsonText.startsWith('```json')) jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    else if (jsonText.startsWith('```')) jsonText = jsonText.replace(/```\n?/g, '');

    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      parsed = { reply: aiText, transactions: null };
    }

    // Optional: If AI returns transaction ids or criteria, we could fetch; for now trust parsed.transactions if present
    return res.json({ reply: parsed.reply ?? aiText, transactions: parsed.transactions ?? null });
  } catch (e) {
    console.error('Chatbot error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
});

export default router;


