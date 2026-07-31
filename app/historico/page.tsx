'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Search, FileText, Camera, Clock } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface OrcamentoResumo {
  id: string
  created_at: string
  cliente_nome: string
  tipo_esquadria: string
  valor_estimado: number | null
  status: string
  modo_entrada: string
  orcamento_iniciado_em: string | null
  orcamento_finalizado_em: string | null
}

function formatarDuracao(inicioIso: string, fimIso: string): string {
  const ms = Math.max(0, new Date(fimIso).getTime() - new Date(inicioIso).getTime())
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}min`
  return `${h}h${m > 0 ? ` ${m}min` : ''}`
}

const statusLabels: Record<string, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  convertido: 'Convertido',
}

const statusColors: Record<string, string> = {
  rascunho: 'bg-slate-100 text-slate-600',
  enviado: 'bg-blue-100 text-blue-600',
  aprovado: 'bg-emerald-100 text-emerald-600',
  recusado: 'bg-red-100 text-red-600',
  convertido: 'bg-purple-100 text-purple-600',
}

const tipoLabels: Record<string, string> = {
  porta_correr: 'Porta de Correr',
  porta_pivotante: 'Porta Pivotante',
  janela_correr: 'Janela de Correr',
  janela_maximiar: 'Janela Maximiar',
  vitro: 'Vitrô',
  fachada: 'Fachada',
  box: 'Box',
}

export default function Historico() {
  const [orcamentos, setOrcamentos] = useState<OrcamentoResumo[]>([])
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const { data } = await supabase
      .from('orcamentos')
      .select('id, created_at, cliente_nome, tipo_esquadria, valor_estimado, status, modo_entrada, orcamento_iniciado_em, orcamento_finalizado_em')
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) setOrcamentos(data as OrcamentoResumo[])
    setCarregando(false)
  }

  const filtrados = orcamentos.filter(o => {
    const matchBusca = !busca || o.cliente_nome.toLowerCase().includes(busca.toLowerCase())
    const matchStatus = filtroStatus === 'todos' || o.status === filtroStatus
    return matchBusca && matchStatus
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Histórico de Orçamentos</h1>
            <p className="text-sm text-slate-500">{orcamentos.length} orçamentos registrados</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por cliente..."
              className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm"
            />
          </div>
          <select
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value)}
            className="border border-slate-300 rounded-xl px-4 py-2.5 text-sm"
          >
            <option value="todos">Todos os status</option>
            <option value="rascunho">Rascunho</option>
            <option value="enviado">Enviado</option>
            <option value="aprovado">Aprovado</option>
            <option value="recusado">Recusado</option>
            <option value="convertido">Convertido</option>
          </select>
        </div>

        {carregando ? (
          <div className="text-center py-12 text-slate-400">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            Nenhum orçamento encontrado
          </div>
        ) : (
          <div className="space-y-2">
            {filtrados.map(o => (
              <div key={o.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between hover:shadow-sm transition">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${o.modo_entrada === 'detalhado' ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                    {o.modo_entrada === 'detalhado'
                      ? <Camera size={18} className="text-emerald-600" />
                      : <FileText size={18} className="text-blue-600" />
                    }
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{o.cliente_nome}</p>
                    <p className="text-sm text-slate-500">
                      {tipoLabels[o.tipo_esquadria] || o.tipo_esquadria} — {new Date(o.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-bold text-slate-800">
                      {o.valor_estimado != null ? `R$ ${o.valor_estimado.toFixed(2)}` : 'Aguardando orçamento'}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[o.status]}`}>
                      {statusLabels[o.status]}
                    </span>
                    {o.orcamento_iniciado_em && o.orcamento_finalizado_em && (
                      <p className="text-xs text-slate-400 flex items-center justify-end gap-1 mt-1">
                        <Clock size={11} /> Levou {formatarDuracao(o.orcamento_iniciado_em, o.orcamento_finalizado_em)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
