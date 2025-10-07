import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient, Prisma, TransactionType } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();
const router = Router();

const createSchema = z.object({
  type: z.nativeEnum(TransactionType),
  amount: z.number().positive(),
  category: z.string().min(1),
  description: z.string().optional(),
  date: z.string().transform((s) => new Date(s)),
});

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
  const data = parse.data;
  const tx = await prisma.transaction.create({
    data: {
      userId: req.userId!,
      type: data.type,
      amount: new Prisma.Decimal(data.amount),
      category: data.category,
      description: data.description || null,
      date: data.date,
    },
  });
  res.json(tx);
});

const listQuery = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  type: z.nativeEnum(TransactionType).optional(),
  category: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const parse = listQuery.safeParse(req.query);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
  const { from, to, type, category, page, pageSize } = parse.data;
  const where: any = { userId: req.userId };
  if (from) where.date = { ...(where.date || {}), gte: new Date(from) };
  if (to) where.date = { ...(where.date || {}), lte: new Date(to) };
  if (type) where.type = type;
  if (category) where.category = category;
  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.transaction.count({ where }),
  ]);
  res.json({ items, page, pageSize, total });
});

router.get('/summary', requireAuth, async (req: AuthRequest, res) => {
  const { from, to } = req.query as any;
  const where: any = { userId: req.userId };
  if (from) where.date = { ...(where.date || {}), gte: new Date(from) };
  if (to) where.date = { ...(where.date || {}), lte: new Date(to) };
  
  const byType = await prisma.transaction.groupBy({
    by: ['type'],
    where,
    _sum: { amount: true },
  });
  
  // Only get expense categories for spending pie chart
  const byExpenseCategory = await prisma.transaction.groupBy({
    by: ['category'],
    where: { ...where, type: 'EXPENSE' },
    _sum: { amount: true },
  });
  
  res.json({ byType, byCategory: byExpenseCategory });
});

// Monthly trends endpoint
router.get('/trends', requireAuth, async (req: AuthRequest, res) => {
  const { from, to } = req.query as any;
  const where: any = { userId: req.userId };
  if (from) where.date = { ...(where.date || {}), gte: new Date(from) };
  if (to) where.date = { ...(where.date || {}), lte: new Date(to) };
  
  // Get transactions grouped by month
  const transactions = await prisma.transaction.findMany({
    where,
    select: {
      amount: true,
      type: true,
      date: true,
    },
    orderBy: { date: 'asc' },
  });
  
  // Group by month
  const monthlyTrends: { [key: string]: { month: string; income: number; expense: number } } = {};
  
  transactions.forEach(tx => {
    const month = tx.date.toISOString().substring(0, 7); // YYYY-MM format
    if (!monthlyTrends[month]) {
      monthlyTrends[month] = { month, income: 0, expense: 0 };
    }
    
    if (tx.type === 'INCOME') {
      monthlyTrends[month].income += Number(tx.amount);
    } else {
      monthlyTrends[month].expense += Number(tx.amount);
    }
  });
  
  const trendsArray = Object.values(monthlyTrends).sort((a, b) => a.month.localeCompare(b.month));
  
  res.json({ monthlyTrends: trendsArray });
});

// Summary statistics endpoint - NOW RESPECTS DATE RANGE FILTERS
router.get('/stats', requireAuth, async (req: AuthRequest, res) => {
  const { from, to } = req.query as any;
  const where: any = { userId: req.userId };
  
  // Use the date range from query params, or default to all time
  if (from) where.date = { ...(where.date || {}), gte: new Date(from) };
  if (to) where.date = { ...(where.date || {}), lte: new Date(to) };
  
  const [totalIncome, totalExpense, biggestCategory, transactions] = await Promise.all([
    // Total income in selected range
    prisma.transaction.aggregate({
      where: { ...where, type: 'INCOME' },
      _sum: { amount: true },
    }),
    
    // Total expenses in selected range
    prisma.transaction.aggregate({
      where: { ...where, type: 'EXPENSE' },
      _sum: { amount: true },
    }),
    
    // Biggest expense category in selected range
    prisma.transaction.groupBy({
      by: ['category'],
      where: { ...where, type: 'EXPENSE' },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 1,
    }),
    
    // Get all transactions in range to calculate date span
    prisma.transaction.findMany({
      where,
      select: { date: true },
      orderBy: { date: 'asc' },
    }),
  ]);
  
  const income = Number(totalIncome._sum?.amount || 0);
  const expense = Number(totalExpense._sum?.amount || 0);
  const savings = income - expense;
  const savingsRate = income > 0 ? ((savings / income) * 100) : 0;
  
  // Calculate average daily spending based on actual date range
  let avgDailySpending = 0;
  if (transactions.length > 0 && expense > 0) {
    const firstDate = transactions[0].date;
    const lastDate = transactions[transactions.length - 1].date;
    const daysDiff = Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    avgDailySpending = expense / Math.max(daysDiff, 1);
  }
  
  res.json({
    totalIncome: Math.round(income * 100) / 100,
    totalExpense: Math.round(expense * 100) / 100,
    netSavings: Math.round(savings * 100) / 100,
    savingsRate: Math.round(savingsRate * 100) / 100,
    biggestExpenseCategory: biggestCategory[0]?.category || 'N/A',
    averageDailySpending: Math.round(avgDailySpending * 100) / 100,
  });
});

export default router;