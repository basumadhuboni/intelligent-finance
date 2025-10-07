import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import Protected from './components/Protected.tsx';

const Dashboard = React.lazy(() => import('./pages/Dashboard.tsx'));
const Transactions = React.lazy(() => import('./pages/Transactions.tsx'));
const Upload = React.lazy(() => import('./pages/Upload.tsx'));
const Chatbot = React.lazy(() => import('./pages/Chatbot.tsx'));
const Login = React.lazy(() => import('./pages/Login.tsx'));
const Register = React.lazy(() => import('./pages/Register.tsx'));

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        element: <Protected />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'dashboard', element: <Dashboard /> },
          { path: 'transactions', element: <Transactions /> },
          { path: 'upload', element: <Upload /> },
          { path: 'chatbot', element: <Chatbot /> },
        ],
      },
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
    ],
  },
]);

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <React.Suspense fallback={<div className="p-8 text-center">Loading…</div>}>
        <RouterProvider router={router} />
      </React.Suspense>
      <Toaster />
      <Sonner />
    </QueryClientProvider>
  </StrictMode>,
);
