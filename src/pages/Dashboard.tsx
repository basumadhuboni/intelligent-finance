import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LineChart, Line } from 'recharts'
import { api } from '../lib/api'

export default function Dashboard() {
  const [range, setRange] = useState<{ from?: string; to?: string }>({})
  
  // Summary data query
  const { data, isLoading, isError } = useQuery({
    queryKey: ['summary', range],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (range.from) params.set('from', range.from)
      if (range.to) params.set('to', range.to)
      const res = await api.get(`/api/transactions/summary?${params.toString()}`)
      return res.data as { byType: Array<{ type: string; _sum: { amount: string } }>; byCategory: Array<{ category: string; _sum: { amount: string } }> }
    },
  })

  // Monthly trends query
  const { data: trendsData, isLoading: trendsLoading } = useQuery({
    queryKey: ['trends', range],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (range.from) params.set('from', range.from)
      if (range.to) params.set('to', range.to)
      const res = await api.get(`/api/transactions/trends?${params.toString()}`)
      return res.data as { monthlyTrends: Array<{ month: string; income: number; expense: number }> }
    },
  })

  // Summary stats query
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['stats', range],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (range.from) params.set('from', range.from)
      if (range.to) params.set('to', range.to)
      const res = await api.get(`/api/transactions/stats?${params.toString()}`)
      return res.data as {
        totalIncome: number
        totalExpense: number
        netSavings: number
        savingsRate: number
        biggestExpenseCategory: string
        averageDailySpending: number
      }
    },
  })

  const pieData = useMemo(() => {
    if (!data) return [] as Array<{ name: string; value: number }>
    // Now byCategory only contains expense categories from the backend
    return data.byCategory.map((category) => ({ name: category.category, value: Number(category._sum.amount) }))
  }, [data])

  const typeData = useMemo(() => {
    if (!data) return [] as Array<{ name: string; value: number }>
    return data.byType.map((t) => ({ name: t.type, value: Number(t._sum.amount) }))
  }, [data])

  const barData = useMemo(() => {
    if (!data) return [] as Array<{ category: string; amount: number }>
    return data.byCategory.map((c) => ({ category: c.category, amount: Number(c._sum.amount) }))
  }, [data])

  // Format monthly trends data for line chart
  const lineData = useMemo(() => {
    if (!trendsData?.monthlyTrends) return []
    return trendsData.monthlyTrends.map(trend => ({
      month: new Date(trend.month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      income: trend.income,
      expense: trend.expense,
      net: trend.income - trend.expense
    }))
  }, [trendsData])

  const isLoadingAny = isLoading || trendsLoading || statsLoading

  return (
    <div className="space-y-8">
      <div className="bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-slate-200/50 p-8">
        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
          <span className="w-1.5 h-8 bg-gradient-to-b from-blue-600 to-blue-800 rounded-full"></span>
          Date Range Filter
        </h2>
        <div className="flex gap-6">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-slate-700 mb-3">From Date</label>
            <input 
              type="date" 
              className="w-full px-5 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all bg-white text-slate-900" 
              value={range.from || ''} 
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} 
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-semibold text-slate-700 mb-3">To Date</label>
            <input 
              type="date" 
              className="w-full px-5 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all bg-white text-slate-900" 
              value={range.to || ''} 
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} 
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {statsData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SummaryCard
            title="Total Income"
            value={`$${statsData.totalIncome.toLocaleString()}`}
            color="text-emerald-600"
            bgColor="bg-gradient-to-br from-emerald-50 to-emerald-100"
            borderColor="border-emerald-200"
          />
          <SummaryCard
            title="Total Expenses"
            value={`$${statsData.totalExpense.toLocaleString()}`}
            color="text-rose-600"
            bgColor="bg-gradient-to-br from-rose-50 to-rose-100"
            borderColor="border-rose-200"
          />
          <SummaryCard
            title="Net Savings"
            value={`$${statsData.netSavings.toLocaleString()}`}
            color={statsData.netSavings >= 0 ? "text-emerald-600" : "text-rose-600"}
            bgColor={statsData.netSavings >= 0 ? "bg-gradient-to-br from-emerald-50 to-emerald-100" : "bg-gradient-to-br from-rose-50 to-rose-100"}
            borderColor={statsData.netSavings >= 0 ? "border-emerald-200" : "border-rose-200"}
          />
          <SummaryCard
            title="Savings Rate"
            value={`${statsData.savingsRate}%`}
            color="text-blue-600"
            bgColor="bg-gradient-to-br from-blue-50 to-blue-100"
            borderColor="border-blue-200"
          />
          <SummaryCard
            title="Biggest Expense"
            value={statsData.biggestExpenseCategory}
            color="text-indigo-600"
            bgColor="bg-gradient-to-br from-indigo-50 to-indigo-100"
            borderColor="border-indigo-200"
          />
          <SummaryCard
            title="Avg Daily Spending"
            value={`$${statsData.averageDailySpending.toFixed(2)}`}
            color="text-amber-600"
            bgColor="bg-gradient-to-br from-amber-50 to-amber-100"
            borderColor="border-amber-200"
          />
        </div>
      )}

      {isLoadingAny ? (
        <div className="bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-slate-200/50 p-16 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <div className="text-slate-600 font-medium">Loading analytics...</div>
        </div>
      ) : isError ? (
        <div className="bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200 rounded-2xl p-6 text-red-700 font-medium shadow-lg">
          Failed to load summary data. Please try again.
        </div>
      ) : (
        <div className="space-y-8">
          {/* Charts Grid */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* Income vs Expense Pie Chart */}
            <div className="bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-slate-200/50 p-8">
              <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                <span className="w-1.5 h-8 bg-gradient-to-b from-blue-600 to-blue-800 rounded-full"></span>
                Income vs Expense
              </h2>
              {typeData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-slate-500 font-medium">No data available for selected range</div>
              ) : (
                <div style={{ width: '100%', height: '300px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={typeData} dataKey="value" nameKey="name" outerRadius={110} label>
                        {typeData.map((_, i) => (
                          <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Spending by Category Pie Chart */}
            <div className="bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-slate-200/50 p-8">
              <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                <span className="w-1.5 h-8 bg-gradient-to-b from-blue-600 to-blue-800 rounded-full"></span>
                Spending by Category
              </h2>
              {pieData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-slate-500 font-medium">No data available for selected range</div>
              ) : (
                <div style={{ width: '100%', height: '300px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={110} label>
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Monthly Spending Trend Line Chart */}
          <div className="bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-slate-200/50 p-8">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
              <span className="w-1.5 h-8 bg-gradient-to-b from-blue-600 to-blue-800 rounded-full"></span>
              Monthly Spending Trend
            </h2>
            {lineData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-500 font-medium">No data available for selected range</div>
            ) : (
              <div style={{ width: '100%', height: '350px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '2px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend />
                    <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={3} name="Income" />
                    <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={3} name="Expense" />
                    <Line type="monotone" dataKey="net" stroke="#3b82f6" strokeWidth={3} name="Net" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Category Comparison Bar Chart */}
          <div className="bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-slate-200/50 p-8">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
              <span className="w-1.5 h-8 bg-gradient-to-b from-blue-600 to-blue-800 rounded-full"></span>
              Category Comparison
            </h2>
            {barData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-500 font-medium">No data available for selected range</div>
            ) : (
              <div style={{ width: '100%', height: '350px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="category" angle={-30} textAnchor="end" interval={0} height={60} stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '2px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="amount" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const COLORS = ['#3b82f6', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b']
const TYPE_COLORS = ['#10b981', '#ef4444']

// Summary Card Component
function SummaryCard({ title, value, color, bgColor, borderColor }: {
  title: string
  value: string
  color: string
  bgColor: string
  borderColor: string
}) {
  return (
    <div className={`${bgColor} rounded-2xl border-2 ${borderColor} p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1`}>
      <div className="flex flex-col">
        <p className="text-sm font-bold text-slate-600 mb-2 uppercase tracking-wide">{title}</p>
        <p className={`text-3xl font-bold ${color}`}>{value}</p>
      </div>
    </div>
  )
}