import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { PrismaClient, TransactionType } from '@prisma/client';

// For OCR and PDF parsing we will use tesseract.js and pdf-parse
import * as Tesseract from 'tesseract.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pdf: (input: Buffer) => Promise<{ text: string }> = require('pdf-parse');

const prisma = new PrismaClient();
const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Enhanced POS receipt line parser: finds lines like "$12.34" and categories via simple keywords
function extractTransactionsFromText(text: string) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const results: Array<{ amount: number; category: string; description?: string; date: Date; type: TransactionType }>= [];
  const now = new Date();
  
  // Look for various amount patterns
  const amountPatterns = [
    /(?:\$)?([0-9]+(?:\.[0-9]{2})?)/,  // $12.34 or 12.34
    /([0-9]+(?:\.[0-9]{2})?)\s*(?:USD|usd)/,  // 12.34 USD
    /total[:\s]*(?:\$)?([0-9]+(?:\.[0-9]{2})?)/i,  // Total: $12.34
    /amount[:\s]*(?:\$)?([0-9]+(?:\.[0-9]{2})?)/i,  // Amount: $12.34
  ];
  
  for (const line of lines) {
    let amount = 0;
    let matched = false;
    
    // Try each pattern
    for (const pattern of amountPatterns) {
      const match = line.match(pattern);
      if (match) {
        amount = parseFloat(match[1]);
        if (isFinite(amount) && amount > 0) {
          matched = true;
          break;
        }
      }
    }
    
    if (!matched) continue;
    
    // Determine category based on keywords
    let category = 'Uncategorized';
    const l = line.toLowerCase();
    
    if (l.includes('grocery') || l.includes('market') || l.includes('food') || l.includes('supermarket') || l.includes('store')) {
      category = 'Groceries';
    } else if (l.includes('fuel') || l.includes('gas') || l.includes('petrol') || l.includes('station')) {
      category = 'Fuel';
    } else if (l.includes('pharmacy') || l.includes('medicine') || l.includes('drug') || l.includes('health')) {
      category = 'Health';
    } else if (l.includes('restaurant') || l.includes('cafe') || l.includes('dining') || l.includes('food')) {
      category = 'Dining';
    } else if (l.includes('transport') || l.includes('taxi') || l.includes('uber') || l.includes('bus')) {
      category = 'Transportation';
    } else if (l.includes('entertainment') || l.includes('movie') || l.includes('cinema') || l.includes('game')) {
      category = 'Entertainment';
    }
    
    results.push({ 
      amount, 
      category, 
      description: line || '', 
      date: now, 
      type: 'EXPENSE' 
    });
  }
  
  return results;
}

router.post('/receipt', requireAuth, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const mime = req.file.mimetype;
    let text = '';
    
    if (mime === 'application/pdf') {
      try {
        const data = await pdf(req.file.buffer);
        text = data.text;
      } catch (error) {
        console.error('PDF parsing error:', error);
        return res.status(500).json({ error: 'Failed to parse PDF file' });
      }
    } else {
      try {
        // Initialize Tesseract worker with proper configuration
        const worker = await Tesseract.createWorker('eng', 1, {
          logger: m => console.log(m)
        });
        
        const { data: { text: ocrText } } = await worker.recognize(req.file.buffer as any);
        await worker.terminate();
        text = ocrText;
      } catch (error) {
        console.error('OCR processing error:', error);
        return res.status(500).json({ error: 'Failed to process image with OCR' });
      }
    }
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'No text could be extracted from the file' });
    }
    
    const items = extractTransactionsFromText(text);
    if (items.length === 0) {
      return res.json({ imported: 0, items: [], extractedText: text });
    }
    
    const created = await prisma.$transaction(
      items.map((i) =>
        prisma.transaction.create({
          data: {
            userId: req.userId!,
            type: i.type,
            amount: i.amount,
            category: i.category,
            description: i.description,
            date: i.date,
          },
        })
      )
    );
    
    res.json({ imported: created.length, items: created });
  } catch (error) {
    console.error('Receipt upload error:', error);
    res.status(500).json({ error: 'Internal server error during receipt processing' });
  }
});

// Enhanced PDF statement parser for tabular data
// Expected format: date description category amount type
// Supports multiple separators and intelligently extracts the 5 required fields
function parseStatementLine(line: string): { date: string; description: string; category: string; amount: string; type: string } | null {
  // Remove extra whitespace and split by any whitespace
  const parts = line.trim().split(/\s+/).filter(Boolean);
  
  // Need at least 5 parts
  if (parts.length < 5) {
    return null;
  }
  
  // Last part should be type (INCOME or EXPENSE)
  const type = parts[parts.length - 1].toUpperCase();
  if (type !== 'INCOME' && type !== 'EXPENSE') {
    return null;
  }
  
  // Second to last should be amount (numeric)
  const amount = parts[parts.length - 2];
  const cleanAmount = amount.replace(/[^0-9.\-]/g, '');
  if (isNaN(parseFloat(cleanAmount))) {
    return null;
  }
  
  // First part should be date
  const date = parts[0];
  if (!/\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(date)) {
    return null;
  }
  
  // Third to last should be category
  const category = parts[parts.length - 3];
  
  // Everything between date and category is description
  const description = parts.slice(1, parts.length - 3).join(' ');
  
  // If description is empty, something is wrong
  if (!description) {
    return null;
  }
  
  return {
    date,
    description,
    category,
    amount: cleanAmount,
    type
  };
}

router.post('/statement', requireAuth, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF files are supported for statement import' });
    }
    
    let data;
    try {
      data = await pdf(req.file.buffer);
    } catch (error) {
      console.error('PDF parsing error:', error);
      return res.status(500).json({ error: 'Failed to parse PDF file' });
    }
    
    const extractedText = data.text;
    console.log('📄 Extracted PDF text length:', extractedText.length);
    
    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ error: 'No text could be extracted from PDF' });
    }
    
    const lines = extractedText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    console.log('📊 Total lines:', lines.length);
    
    const parsed: Array<{ date: Date; description: string; category: string; amount: number; type: TransactionType }> = [];
    const errors: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Debug: Log first 10 lines to see the actual format
      if (i < 10) {
        console.log(`Line ${i + 1}: "${line}"`);
      }
      
      const result = parseStatementLine(line);
      
      if (result) {
        try {
          const parsedDate = new Date(result.date);
          const parsedAmount = parseFloat(result.amount);
          
          if (isNaN(parsedDate.getTime())) {
            errors.push(`Line ${i + 1}: Invalid date format`);
            continue;
          }
          
          if (isNaN(parsedAmount)) {
            errors.push(`Line ${i + 1}: Invalid amount`);
            continue;
          }
          
          parsed.push({
            date: parsedDate,
            description: result.description,
            category: result.category,
            amount: parsedAmount,
            type: result.type as TransactionType
          });
        } catch (error) {
          errors.push(`Line ${i + 1}: Parse error - ${error}`);
        }
      }
    }
    
    console.log('✅ Successfully parsed:', parsed.length, 'transactions');
    if (errors.length > 0) {
      console.log('⚠️ Errors:', errors);
    }
    
    if (parsed.length === 0) {
      return res.status(400).json({ 
        error: 'No valid transactions found in PDF',
        details: 'Expected format: date    description    category    amount    type',
        example: '2024-01-15    Coffee Shop    Dining    12.50    EXPENSE',
        extractedLines: lines.slice(0, 5),
        totalLines: lines.length
      });
    }
    
    const created = await prisma.$transaction(
      parsed.map((transaction) =>
        prisma.transaction.create({
          data: {
            userId: req.userId!,
            type: transaction.type,
            amount: transaction.amount,
            category: transaction.category,
            description: transaction.description,
            date: transaction.date,
          },
        })
      )
    );
    
    res.json({ 
      imported: created.length,
      skipped: lines.length - parsed.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined
    });
  } catch (error) {
    console.error('Statement upload error:', error);
    res.status(500).json({ error: 'Internal server error during statement processing' });
  }
});

// AI Receipt Analyzer - Extract text and analyze with Gemini
router.post('/ai-receipt', requireAuth, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const mime = req.file.mimetype;
    let text = '';
    
    // Extract text from file (same logic as receipt endpoint)
    if (mime === 'application/pdf') {
      try {
        const data = await pdf(req.file.buffer);
        text = data.text;
      } catch (error) {
        console.error('PDF parsing error:', error);
        return res.status(500).json({ error: 'Failed to parse PDF file' });
      }
    } else {
      try {
        const worker = await Tesseract.createWorker('eng', 1, {
          logger: m => console.log(m)
        });
        
        const { data: { text: ocrText } } = await worker.recognize(req.file.buffer as any);
        await worker.terminate();
        text = ocrText;
      } catch (error) {
        console.error('OCR processing error:', error);
        return res.status(500).json({ error: 'Failed to process image with OCR' });
      }
    }
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'No text could be extracted from the file' });
    }
    
    console.log('📄 Extracted text for AI analysis:', text.substring(0, 200));
    
    // Call Gemini API to analyze the receipt
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured in environment variables' });
    }
    
    const prompt = `You are a receipt parser. Extract transaction fields and return ONLY a JSON array, no other text.

Each transaction must have these exact fields:
- date: ISO date string (YYYY-MM-DD format). If no date found, use today's date: ${new Date().toISOString().split('T')[0]}
- description: Brief description of the purchase/merchant
- category: One of: Groceries, Dining, Transportation, Entertainment, Health, Utilities, Shopping, Fuel, Housing, Salary, Freelance, or Uncategorized
- amount: Number (just the number, no currency symbols)
- type: Either "INCOME" or "EXPENSE" (most receipts are EXPENSE)

Return ONLY valid JSON array format like this:
[{"date":"2025-01-15","description":"Coffee Shop","category":"Dining","amount":12.50,"type":"EXPENSE"}]

Receipt text:
"""
${text}
"""`;

    try {
      const modelName = 'gemini-2.0-flash-exp';
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Gemini API error:', errorData);
        return res.status(500).json({ error: 'Failed to analyze receipt with AI' });
      }
      
      const result = await response.json();
      console.log('🤖 Gemini response:', JSON.stringify(result, null, 2));
      
      const aiText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!aiText) {
        return res.status(500).json({ error: 'No response from AI' });
      }
      
      console.log('🧩 Gemini raw output:', aiText);
      
      // Extract JSON from the response (Gemini sometimes wraps it in markdown)
      let jsonText = aiText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }
      
      const transactions = JSON.parse(jsonText);
      
      if (!Array.isArray(transactions)) {
        return res.status(500).json({ error: 'AI returned invalid format' });
      }
      
      // Validate and format transactions
      const validatedTransactions = transactions.map((t: any) => ({
        date: t.date || new Date().toISOString().split('T')[0],
        description: String(t.description || 'Unknown'),
        category: String(t.category || 'Uncategorized'),
        amount: parseFloat(t.amount) || 0,
        type: (t.type === 'INCOME' || t.type === 'EXPENSE') ? t.type : 'EXPENSE'
      }));
      
      // Return extracted transactions for user review
      res.json({ 
        extractedText: text,
        transactions: validatedTransactions
      });
      
    } catch (error) {
      console.error('AI analysis error:', error);
      return res.status(500).json({ error: 'Failed to parse AI response: ' + (error as Error).message });
    }
    
  } catch (error) {
    console.error('AI receipt upload error:', error);
    res.status(500).json({ error: 'Internal server error during AI receipt processing' });
  }
});

// Confirm AI-analyzed transactions
const confirmSchema = z.object({
  transactions: z.array(z.object({
    date: z.string().transform((s) => new Date(s)),
    description: z.string(),
    category: z.string(),
    amount: z.number().positive(),
    type: z.enum(['INCOME', 'EXPENSE'])
  }))
});

router.post('/ai-receipt/confirm', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parse = confirmSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
    
    const { transactions } = parse.data;
    
    const created = await prisma.$transaction(
      transactions.map((t) =>
        prisma.transaction.create({
          data: {
            userId: req.userId!,
            type: t.type as TransactionType,
            amount: t.amount,
            category: t.category,
            description: t.description,
            date: t.date,
          },
        })
      )
    );
    
    res.json({ imported: created.length, items: created });
  } catch (error) {
    console.error('AI confirm error:', error);
    res.status(500).json({ error: 'Failed to save transactions' });
  }
});

export default router;