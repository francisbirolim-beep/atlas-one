'use client'
import { useState } from 'react'

export default function AtendimentoPage() {
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('Todas')

  return (
    <main className="min-h-screen bg-slate-100 p-3">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border bg-white shadow-sm">
        <header className="border-b p-4">
          <h1 className="text-xl font-bold">Central de Conversas</h1>
          <p className="text-sm text-slate-500">Teste 2 · somente interface React</p>
        </header>
        <div className="flex gap-2 overflow-x-auto border-b p-3">
          {['Todas','Aguardando','Em atendimento','Finalizadas'].map(item => (
            <button key={item} onClick={() => setFiltro(item)} className={'whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold '+(filtro===item?'bg-emerald-100 text-emerald-800':'bg-slate-100 text-slate-600')}>
              {item}
            </button>
          ))}
        </div>
        <div className="p-4">
          <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar conversas..." className="w-full rounded-xl border px-4 py-3 text-sm outline-none" />
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <b className="text-emerald-900">Interface React carregada.</b>
            <p className="mt-1 text-sm text-emerald-800">Sem Supabase, realtime, autenticação, ícones ou lógica de atendimento.</p>
          </div>
        </div>
      </div>
    </main>
  )
}
