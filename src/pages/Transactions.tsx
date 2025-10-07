import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../lib/api'

type Tx = {
  id: string
  type: 'INCOME' | 'EXPENSE'
  amount: number
  category: string
  description?: string
  date: string
}

export default function Transactions() {
  const [filters, setFilters] = useState({ from: '', to: '', type: '', category: '', page: 1, pageSize: 10 })
  const qc = useQueryClient()
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['transactions', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.from) params.set('from', filters.from)
      if (filters.to) params.set('to', filters.to)
      if (filters.type) params.set('type', filters.type)
      if (filters.category) params.set('category', filters.category)
      params.set('page', String(filters.page))
      params.set('pageSize', String(filters.pageSize))
      const res = await api.get(`/api/transactions?${params.toString()}`)
      return res.data as { items: Tx[]; total: number; page: number; pageSize: number }
    },
  })

  const create = useMutation({
    mutationFn: async (payload: Omit<Tx, 'id'>) => {
      const res = await api.post('/api/transactions', payload)
      return res.data as Tx
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  })

  return (
    <div className="space-y-8">
      <div className="bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-slate-200/50 p-8">
        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
          <span className="w-1.5 h-8 bg-gradient-to-b from-blue-600 to-blue-800 rounded-full"></span>
          Filter Transactions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">From Date</label>
            <input 
              type="date" 
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all bg-white" 
              value={filters.from} 
              onChange={(e) => setFilters({ ...filters, from: e.target.value, page: 1 })} 
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">To Date</label>
            <input 
              type="date" 
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all bg-white" 
              value={filters.to} 
              onChange={(e) => setFilters({ ...filters, to: e.target.value, page: 1 })} 
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Type</label>
            <select 
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all bg-white font-medium" 
              value={filters.type} 
              onChange={(e) => setFilters({ ...filters, type: e.target.value, page: 1 })}
            >
              <option value="">All Types</option>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Category</label>
            <input 
              placeholder="Filter by category" 
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all bg-white" 
              value={filters.category} 
              onChange={(e) => setFilters({ ...filters, category: e.target.value, page: 1 })} 
            />
          </div>
          <div className="flex items-end">
            <button 
              className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg" 
              onClick={() => qc.invalidateQueries({ queryKey: ['transactions'] })}
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      <AddForm onAdd={(payload) => create.mutate(payload as any)} />

      {create.isError && (
        <div className="bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200 rounded-2xl p-5 text-red-700 font-medium shadow-lg">
          Failed to add transaction. Please check your inputs and try again.
        </div>
      )}

      {isLoading ? (
        <div className="bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-slate-200/50 p-16 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <div className="text-slate-600 font-medium">Loading transactions...</div>
        </div>
      ) : isError ? (
        <div className="bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200 rounded-2xl p-5 text-red-700 font-medium shadow-lg">
          Failed to load transactions. Please try again.
        </div>
      ) : (
        <div className="bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-slate-200/50 overflow-hidden">
          {data && data.items.length === 0 ? (
            <div className="p-16 text-center text-slate-500 font-medium">
              No transactions found for the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-50 to-blue-50 border-b-2 border-slate-200">
                    <th className="text-left p-5 text-sm font-bold text-slate-700 uppercase tracking-wide">Date</th>
                    <th className="text-left p-5 text-sm font-bold text-slate-700 uppercase tracking-wide">Type</th>
                    <th className="text-left p-5 text-sm font-bold text-slate-700 uppercase tracking-wide">Category</th>
                    <th className="text-right p-5 text-sm font-bold text-slate-700 uppercase tracking-wide">Amount</th>
                    <th className="text-left p-5 text-sm font-bold text-slate-700 uppercase tracking-wide">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((tx) => (
                    <tr key={tx.id} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                      <td className="p-5 text-sm text-slate-700 font-medium">{new Date(tx.date).toLocaleDateString()}</td>
                      <td className="p-5">
                        <span className={`inline-flex px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                          tx.type === 'INCOME' ? 'bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-800' : 'bg-gradient-to-r from-rose-100 to-rose-200 text-rose-800'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="p-5 text-sm text-slate-700 font-medium">{tx.category}</td>
                      <td className="p-5 text-right text-sm font-bold text-slate-900">
                        ${(tx as any).amount?.toFixed ? (tx as any).amount.toFixed(2) : Number((tx as any).amount).toFixed(2)}
                      </td>
                      <td className="p-5 text-sm text-slate-600">{tx.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between p-6 bg-gradient-to-r from-slate-50 to-blue-50 border-t-2 border-slate-200">
            <div className="text-sm text-slate-600 font-medium">
              Page {data?.page} of {data ? Math.ceil(data.total / data.pageSize) : 1} · Total: {data?.total || 0} transactions
            </div>
            <div className="flex gap-3">
              <button 
                className="px-5 py-2.5 rounded-xl border-2 border-slate-300 text-slate-700 hover:bg-white hover:border-slate-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-bold shadow-sm" 
                disabled={(data?.page ?? 1) <= 1} 
                onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
              >
                Previous
              </button>
              <button 
                className="px-5 py-2.5 rounded-xl border-2 border-slate-300 text-slate-700 hover:bg-white hover:border-slate-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-bold shadow-sm" 
                disabled={data ? data.page >= Math.ceil(data.total / data.pageSize) : true} 
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AddForm({ onAdd }: { onAdd: (tx: Omit<Tx, 'id'>) => void }) {
  const [form, setForm] = useState<Omit<Tx, 'id'>>({ type: 'EXPENSE', amount: 0, category: '', description: '', date: new Date().toISOString().slice(0, 10) } as any)
  return (
    <div className="bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-slate-200/50 p-8">
      <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
        <span className="w-1.5 h-8 bg-gradient-to-b from-emerald-600 to-emerald-800 rounded-full"></span>
        Add New Transaction
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-5">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-3">Date</label>
          <input 
            type="date" 
            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all bg-white" 
            value={form.date as any} 
            onChange={(e) => setForm({ ...form, date: e.target.value as any })} 
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-3">Type</label>
          <select 
            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all bg-white font-medium" 
            value={form.type} 
            onChange={(e) => setForm({ ...form, type: e.target.value as any })}
          >
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expense</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-3">Category</label>
          <input 
            placeholder="e.g., Food" 
            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all bg-white" 
            value={form.category} 
            onChange={(e) => setForm({ ...form, category: e.target.value })} 
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-3">Amount</label>
          <input 
            placeholder="0.00" 
            type="number" 
            step="0.01" 
            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all bg-white" 
            value={form.amount as any} 
            onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} 
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-3">Description</label>
          <input 
            placeholder="Optional" 
            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all bg-white" 
            value={form.description || ''} 
            onChange={(e) => setForm({ ...form, description: e.target.value })} 
          />
        </div>
        <div className="flex items-end">
          <button 
            className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-bold hover:from-emerald-700 hover:to-emerald-800 transition-all shadow-md hover:shadow-lg" 
            onClick={() => onAdd({ ...form, date: new Date(form.date as any).toISOString() })}
          >
            Add Transaction
          </button>
        </div>
      </div>
    </div>
  )
}