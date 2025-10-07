import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../lib/api'

type AITransaction = {
  date: string
  description: string
  category: string
  amount: number
  type: 'INCOME' | 'EXPENSE'
}

export default function Upload() {
  const [tab, setTab] = useState<'receipt' | 'statement' | 'ai'>('receipt')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [aiTransactions, setAiTransactions] = useState<AITransaction[]>([])
  const [showAiReview, setShowAiReview] = useState(false)
  
  const receipt = useMutation({
    mutationFn: async (file: File) => {
      setErrorMessage('')
      const form = new FormData()
      form.append('file', file)
      const res = await api.post('/api/uploads/receipt', form)
      return res.data as { imported: number }
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error || error?.message || 'Unknown error'
      setErrorMessage(`Receipt upload failed: ${msg}`)
      console.error('Receipt upload error:', error)
    }
  })
  const statement = useMutation({
    mutationFn: async (file: File) => {
      setErrorMessage('')
      const form = new FormData()
      form.append('file', file)
      const res = await api.post('/api/uploads/statement', form)
      return res.data as { imported: number }
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error || error?.message || 'Unknown error'
      setErrorMessage(`Statement upload failed: ${msg}`)
      console.error('Statement upload error:', error)
    }
  })

  const aiReceipt = useMutation({
    mutationFn: async (file: File) => {
      setErrorMessage('')
      setShowAiReview(false)
      const form = new FormData()
      form.append('file', file)
      const res = await api.post('/api/uploads/ai-receipt', form)
      return res.data as { extractedText: string; transactions: AITransaction[] }
    },
    onSuccess: (data) => {
      setAiTransactions(data.transactions)
      setShowAiReview(true)
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error || error?.message || 'Unknown error'
      setErrorMessage(`AI receipt analysis failed: ${msg}`)
      console.error('AI receipt error:', error)
    }
  })

  const confirmAi = useMutation({
    mutationFn: async (transactions: AITransaction[]) => {
      const res = await api.post('/api/uploads/ai-receipt/confirm', { transactions })
      return res.data as { imported: number }
    },
    onSuccess: () => {
      setShowAiReview(false)
      setAiTransactions([])
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error || error?.message || 'Unknown error'
      setErrorMessage(`Failed to save transactions: ${msg}`)
      console.error('Confirm error:', error)
    }
  })

  const handleUpdateTransaction = (index: number, field: keyof AITransaction, value: string | number) => {
    const updated = [...aiTransactions]
    updated[index] = { ...updated[index], [field]: value }
    setAiTransactions(updated)
  }

  const handleDeleteTransaction = (index: number) => {
    setAiTransactions(aiTransactions.filter((_, i) => i !== index))
  }

  const handleConfirm = () => {
    confirmAi.mutate(aiTransactions)
  }

  const handleCancel = () => {
    setShowAiReview(false)
    setAiTransactions([])
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-slate-200/50 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent mb-3">Import Transactions</h1>
          <p className="text-slate-600 font-medium">Upload receipts or bank statements to automatically import your transactions</p>
        </div>
        
        <div className="flex gap-3 mb-8">
          <button 
            className={`flex-1 px-6 py-4 rounded-xl font-bold transition-all duration-300 ${
              tab === 'receipt' 
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            onClick={() => setTab('receipt')}
          >
            Receipt OCR
          </button>
          <button 
            className={`flex-1 px-6 py-4 rounded-xl font-bold transition-all duration-300 ${
              tab === 'statement' 
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            onClick={() => setTab('statement')}
          >
            Statement PDF
          </button>
          <button 
            className={`flex-1 px-6 py-4 rounded-xl font-bold transition-all duration-300 ${
              tab === 'ai' 
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            onClick={() => setTab('ai')}
          >
            AI Analyzer
          </button>
        </div>

        {tab === 'receipt' ? (
          <FileBox 
            onFile={(f) => receipt.mutate(f)} 
            label="Upload Receipt Image or PDF" 
            description="Supports JPG, PNG, and PDF formats"
          />
        ) : tab === 'statement' ? (
          <FileBox 
            onFile={(f) => statement.mutate(f)} 
            label="Upload Bank Statement PDF" 
            description="PDF format from your bank"
          />
        ) : (
          <FileBox 
            onFile={(f) => aiReceipt.mutate(f)} 
            label="Upload Receipt for AI Analysis" 
            description="AI will extract and categorize transactions"
          />
        )}
      </div>

      {/* AI Review Modal */}
      {showAiReview && aiTransactions.length > 0 && (
        <div className="bg-white/90 backdrop-blur rounded-2xl shadow-2xl border border-slate-200/50 p-8">
          <h2 className="text-2xl font-bold text-slate-800 mb-3">Review Extracted Transactions</h2>
          <p className="text-slate-600 mb-6 font-medium">Please review and edit the transactions before adding them</p>
          
          <div className="space-y-5 mb-8">
            {aiTransactions.map((transaction, index) => (
              <div key={index} className="border-2 border-slate-300 rounded-xl p-6 bg-gradient-to-br from-slate-50 to-blue-50 hover:shadow-md transition-all">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Date</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none bg-white"
                      value={transaction.date}
                      onChange={(e) => handleUpdateTransaction(index, 'date', e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Type</label>
                    <select 
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none bg-white font-medium"
                      value={transaction.type}
                      onChange={(e) => handleUpdateTransaction(index, 'type', e.target.value)}
                    >
                      <option value="EXPENSE">Expense</option>
                      <option value="INCOME">Income</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Category</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none bg-white"
                      value={transaction.category}
                      onChange={(e) => handleUpdateTransaction(index, 'category', e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Amount</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none bg-white"
                      value={transaction.amount}
                      onChange={(e) => handleUpdateTransaction(index, 'amount', parseFloat(e.target.value))}
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none bg-white"
                      value={transaction.description}
                      onChange={(e) => handleUpdateTransaction(index, 'description', e.target.value)}
                    />
                  </div>
                </div>
                
                <button 
                  className="mt-4 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-100 to-rose-100 text-red-700 hover:from-red-200 hover:to-rose-200 transition-all font-bold border-2 border-red-200"
                  onClick={() => handleDeleteTransaction(index)}
                >
                  Delete Transaction
                </button>
              </div>
            ))}
          </div>
          
          <div className="flex gap-4">
            <button 
              className="flex-1 px-6 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl font-bold"
              onClick={handleConfirm}
              disabled={confirmAi.isPending}
            >
              {confirmAi.isPending ? 'Saving...' : `Add ${aiTransactions.length} Transaction${aiTransactions.length !== 1 ? 's' : ''}`}
            </button>
            <button 
              className="px-8 py-4 rounded-xl border-2 border-slate-300 text-slate-700 hover:bg-slate-100 transition-all font-bold"
              onClick={handleCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {errorMessage && (
          <div className="bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200 rounded-2xl p-5 text-red-700 font-medium shadow-lg">
            {errorMessage}
            <div className="text-sm mt-2 text-red-600">Check the browser console for more details.</div>
          </div>
        )}
        
        {receipt.isPending && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-5 text-blue-700 font-medium shadow-lg">
            Processing receipt... This may take a moment.
          </div>
        )}
        {receipt.data && (
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-2xl p-5 text-emerald-700 font-medium shadow-lg">
            Successfully imported {receipt.data.imported} transaction{receipt.data.imported !== 1 ? 's' : ''} from receipt
          </div>
        )}
        
        {statement.isPending && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-5 text-blue-700 font-medium shadow-lg">
            Processing statement... This may take a moment.
          </div>
        )}
        {statement.data && (
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-2xl p-5 text-emerald-700 font-medium shadow-lg">
            Successfully imported {statement.data.imported} transaction{statement.data.imported !== 1 ? 's' : ''} from statement
          </div>
        )}
        
        {aiReceipt.isPending && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-5 text-blue-700 font-medium shadow-lg">
            Analyzing receipt with AI... This may take a moment.
          </div>
        )}
        
        {confirmAi.data && (
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-2xl p-5 text-emerald-700 font-medium shadow-lg">
            Successfully added {confirmAi.data.imported} transaction{confirmAi.data.imported !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )
}

function FileBox({ onFile, label, description }: { onFile: (f: File) => void; label: string; description: string }) {
  const [isDragging, setIsDragging] = useState(false)
  
  return (
    <label 
      className={`border-2 border-dashed rounded-2xl px-8 py-20 block text-center cursor-pointer transition-all duration-300 ${
        isDragging 
          ? 'border-blue-500 bg-blue-50 shadow-lg scale-102' 
          : 'border-slate-300 bg-gradient-to-br from-slate-50 to-blue-50 hover:border-blue-400 hover:bg-blue-50 hover:shadow-md'
      }`}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragging(false)
        if (e.dataTransfer.files?.[0]) {
          onFile(e.dataTransfer.files[0])
        }
      }}
    >
      <div className="text-6xl mb-5">📁</div>
      <div className="text-xl font-bold text-slate-800 mb-3">{label}</div>
      <div className="text-sm text-slate-600 mb-5 font-medium">{description}</div>
      <div className="text-sm text-slate-500 font-medium">Click to browse or drag and drop</div>
      <input 
        type="file" 
        className="hidden" 
        onChange={(e) => e.target.files && onFile(e.target.files[0])} 
      />
    </label>
  )
}