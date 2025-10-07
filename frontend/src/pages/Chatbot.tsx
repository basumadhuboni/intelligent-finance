import { useState } from 'react'
import { api } from '../lib/api'

type Txn = { date: string; category: string; description: string; amount: number }

export default function Chatbot() {
  const [messages, setMessages] = useState<{ role: 'user'|'assistant'; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Txn[] | null>(null)

  const send = async () => {
    const text = input.trim()
    if (!text) return
    setMessages(m => [...m, { role: 'user', content: text }])
    setInput('')
    setLoading(true)
    try {
      const res = await api.post('/api/chatbot/query', { message: text })
      const reply: string = res.data.reply
      const txns: Txn[] | null = res.data.transactions ?? null
      setMessages(m => [...m, { role: 'assistant', content: reply }])
      setResults(txns)
    } catch (e: any) {
      setMessages(m => [...m, { role: 'assistant', content: e?.response?.data?.error || 'Something went wrong' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/50 p-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent mb-2">Chatbot</h1>
        <p className="text-slate-600 mb-4">Ask questions about your spending and budget. Example: "How much did I spend last week?"</p>
        <div className="space-y-3 max-h-80 overflow-auto pr-1">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
              <div className={`inline-block px-4 py-2 rounded-2xl ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && <div className="text-slate-500 text-sm">Thinking…</div>}
        </div>
        <div className="mt-4 flex gap-2">
          <input
            className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none bg-white"
            placeholder="Type your question…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send() }}
          />
          <button onClick={send} disabled={loading} className="px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold disabled:from-slate-400 disabled:to-slate-500">
            Send
          </button>
        </div>
      </div>

      {results && results.length > 0 && (
        <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/50 p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-3">Relevant Transactions</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="text-slate-600">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Description</th>
                  <th className="py-2 pr-4">Amount</th>
                </tr>
              </thead>
              <tbody>
                {results.map((t, i) => (
                  <tr key={i} className="border-t border-slate-200/70">
                    <td className="py-2 pr-4">{new Date(t.date).toLocaleDateString()}</td>
                    <td className="py-2 pr-4">{t.category}</td>
                    <td className="py-2 pr-4">{t.description}</td>
                    <td className="py-2 pr-4">₹{t.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}


