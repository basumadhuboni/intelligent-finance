import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient, Prisma } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();
const router = Router();

// Set monthly budget
const setBudgetSchema = z.object({
  monthlyBudget: z.number().nonnegative(),
});

router.post('/set', requireAuth, async (req: AuthRequest, res) => {
  const parse = setBudgetSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
  
  const { monthlyBudget } = parse.data;
  
  const user = await prisma.user.update({
    where: { id: req.userId! },
    data: { monthlyBudget: new Prisma.Decimal(monthlyBudget) },
    select: { id: true, email: true, name: true, monthlyBudget: true },
  });
  
  res.json({ monthlyBudget: Number(user.monthlyBudget) });
});

// Get monthly budget and current month expenses
router.get('/status', requireAuth, async (req: AuthRequest, res) => {
  // Get user's budget
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { monthlyBudget: true },
  });
  
  const monthlyBudget = Number(user?.monthlyBudget || 0);
  
  // Calculate current month's expenses
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  
  const currentMonthExpenses = await prisma.transaction.aggregate({
    where: {
      userId: req.userId!,
      type: 'EXPENSE',
      date: {
        gte: firstDay,
        lte: lastDay,
      },
    },
    _sum: { amount: true },
  });
  
  const spent = Number(currentMonthExpenses._sum?.amount || 0);
  const remaining = monthlyBudget - spent;
  const percentageUsed = monthlyBudget > 0 ? (spent / monthlyBudget) * 100 : 0;
  
  res.json({
    monthlyBudget,
    spent: Math.round(spent * 100) / 100,
    remaining: Math.round(remaining * 100) / 100,
    percentageUsed: Math.round(percentageUsed * 100) / 100,
    isOverBudget: remaining < 0,
    month: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
  });
});

export default router;