import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import authRoutes from './routes/auth';
import transactionRoutes from './routes/transactions';
import uploadRoutes from './routes/uploads';
import chatbotRoutes from './routes/chatbot';
import budgetRoutes from './routes/budget'; // NEW LINE

dotenv.config();

const app = express();
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/budget', budgetRoutes); // NEW LINE

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  
  console.log(`API server listening on http://localhost:${port}`);
});