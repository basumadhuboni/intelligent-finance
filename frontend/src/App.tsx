import { Outlet, Link, useNavigate } from 'react-router-dom';
import { getToken, logout } from './lib/api';


export default function App() {
  const token = getToken();
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-200 to-blue-300 relative">
      {/* subtle noise/texture overlay for stronger glass feel */}
      <div className="pointer-events-none fixed inset-0 opacity-10 mix-blend-overlay bg-[radial-gradient(circle_at_1px_1px,_rgba(255,255,255,0.8)_1px,_transparent_1.2px)] [background-size:8px_8px]" />
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent hover:from-blue-700 hover:to-blue-900 transition-all">
            Personal Finance
          </Link>
          <nav className="flex gap-1 text-sm items-center">
            {token ? (
              <>
                <Link to="/dashboard" className="px-5 py-2.5 rounded-lg text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-all font-medium">
                  Dashboard
                </Link>
                <Link to="/transactions" className="px-5 py-2.5 rounded-lg text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-all font-medium">
                  Transactions
                </Link>
                <Link to="/upload" className="px-5 py-2.5 rounded-lg text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-all font-medium">
                  Import
                </Link>
                <Link to="/chatbot" className="px-5 py-2.5 rounded-lg text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-all font-medium">
                  Chatbot
                </Link>
                <button 
                  className="ml-3 px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all font-medium"
                  onClick={() => logout()}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <button 
                  className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all font-medium"
                  onClick={() => navigate('/login')}
                >
                  Login
                </button>
                <button 
                  className="ml-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg font-medium"
                  onClick={() => navigate('/register')}
                >
                  Register
                </button>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
