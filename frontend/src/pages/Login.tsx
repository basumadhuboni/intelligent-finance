import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

const schema = z.object({
  email: z.string().trim().min(6, 'Email must be at least 6 characters').email('Invalid email address'),
  password: z.string().min(6)
})
type Form = z.infer<typeof schema>

export default function Login() {
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<Form>({ resolver: zodResolver(schema) })
  return (
    <div className="max-w-md mx-auto mt-20">
      <div className="bg-white/90 backdrop-blur rounded-3xl shadow-2xl border border-slate-200/50 p-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent mb-3">Welcome Back</h1>
          <p className="text-slate-600">Sign in to continue to your account</p>
        </div>
        <form className="space-y-6" onSubmit={handleSubmit(async (v) => {
          try {
            const res = await api.post('/api/auth/login', v)
            localStorage.setItem('token', res.data.token)
            navigate('/dashboard')
          } catch {
            setError('password', { message: 'Invalid email or password' })
          }
        })}>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-3">Email Address</label>
            <input 
              placeholder="you@example.com" 
              className="w-full px-5 py-4 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all bg-white text-slate-900 font-medium" 
              {...register('email')} 
            />
            {errors.email && <div className="text-red-600 text-sm mt-2 font-medium">{errors.email.message}</div>}
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-3">Password</label>
            <input 
              type="password" 
              placeholder="Enter your password" 
              className="w-full px-5 py-4 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all bg-white text-slate-900 font-medium" 
              {...register('password')} 
            />
            {errors.password && <div className="text-red-600 text-sm mt-2 font-medium">{errors.password.message}</div>}
          </div>
          <button 
            disabled={isSubmitting} 
            className="w-full px-5 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold hover:from-blue-700 hover:to-blue-800 disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 duration-300"
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}