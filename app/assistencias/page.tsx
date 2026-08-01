'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Search, Wrench, ChevronDown, ChevronUp, Phone, MapPin } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Assistencia, StatusAssistencia } from '@/lib/tipos'

const statusLabels: Record<StatusAssistencia, string> = {
  aberto: 'Aberto',
  em_atendimento: 'Em atendimento',
  resolvido: 'Resolvido',
}

const statusColors: Record<StatusAssistencia, string> = {
  aberto: 'bg-red-100 text-red-600',
  em_atendimento: 'bg-amber-100 text-amber-700',
  resolvido: 'bg-brand-tealLight text-brand-teal',
}

export default function Assistencias() {
  const [lista, setLista] = useState<Assistencia[]>([])
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<StatusAssistencia | 'todos'>('todos')
  const [expandido, setExpandido] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState<string | null>(null)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const { data } = await supabase
      .from('assistencias')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) setLista(data as Assistencia[])
    setCarregando(false)
  }

  async function mudarStatus(id: string, status: StatusAssistencia) {
    setAtualizando(id)
    await supabase
      .from('assistencias')
      .update({ status, atualizado_em: new Date().toISOString() })
      .eq('id', id)
    setLista(prev => prev.map(a => (a.id === id ? { ...a, status } : a)))
    setAtualizando(null)
  }

  const filtrados = lista.filter(a => {
    const alvo = `${a.cliente_nome} ${a.cidade || ''} ${a.endereco || ''} ${a.numero || ''} ${a.bairro || ''} ${a.descricao_problema} ${a.criado_por_nome || ''}`.toLowerCase()
    const matchBusca = !busca || alvo.includes(busca.toLowerCase())
    const matchStatus = filtroStatus === 'todos' || a.status === filtroStatus
    return matchBusca && matchStatus
  })

  function enderecoCompleto(a: Assistencia): string {
    const partes = [a.endereco, a.numero, a.bairro].filter(Boolean)
    return partes.join(', ')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-mark.png" alt="" className="w-8 h-8" />
          <div>
            <h1 className="text-lg font-bold text-slate-800">Assistências Técnicas</h1>
            <p className="text-sm text-slate-500">{lista.length} chamados registrados</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex gap-3 mb-6 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por cliente, cidade, endereço..."
              className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm"
            />
          </div>
          <select
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value as StatusAssistencia | 'todos')}
            className="border border-slate-300 rounded-xl px-4 py-2.5 text-sm"
          >
            <option value="todos">Todos os status</option>
            <option value="aberto">Aberto</option>
            <option value="em_atendimento">Em atendimento</option>
            <option value="resolvido">Resolvido</option>
          </select>
        </div>

        {carregando ? (
          <div className="text-center py-12 text-slate-400">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12 text-slate-400 flex flex-col items-center gap-2">
            <Wrench size={28} className="text-slate-300" />
            Nenhuma assistência encontrada
          </div>
        ) : (
          <div className="space-y-2">
            {filtrados.map(a => {
              const aberto = expandido === a.id
              return (
                <div key={a.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => setExpandido(aberto ? null : a.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition text-left"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="p-2 bg-brand-tealLight rounded-lg shrink-0">
                        <Wrench size={18} className="text-brand-teal" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">{a.cliente_nome}</p>
                        <p className="text-sm text-slate-500 truncate">
                          {a.cidade ? `${a.cidade} — ` : ''}{new Date(a.created_at).toLocaleDateString('pt-BR')}
                          {a.criado_por_nome ? ` — por ${a.criado_por_nome}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[a.status]}`}>
                        {statusLabels[a.status]}
                      </span>
                      {aberto ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                    </div>
                  </button>

                  {aberto && (
                    <div className="border-t border-slate-100 p-4 space-y-4">
                      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                        {a.cliente_whatsapp && (
                          <span className="flex items-center gap-1.5"><Phone size={14} className="text-slate-400" /> {a.cliente_whatsapp}</span>
                        )}
                        {enderecoCompleto(a) && (
                          <span className="flex items-center gap-1.5"><MapPin size={14} className="text-slate-400" /> {enderecoCompleto(a)}</span>
                        )}
                        {a.criado_por_nome && (
                          <span className="text-slate-400">Registrado por <span className="font-medium text-slate-600">{a.criado_por_nome}</span></span>
                        )}
                      </div>

                      <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">
                        {a.descricao_problema}
                      </p>

                      {a.fotos_urls && a.fotos_urls.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {a.fotos_urls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="Foto do problema" className="w-20 h-20 object-cover rounded-lg border border-slate-200" />
                            </a>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        {(['aberto', 'em_atendimento', 'resolvido'] as StatusAssistencia[]).map(s => (
                          <button
                            key={s}
                            onClick={() => mudarStatus(a.id, s)}
                            disabled={atualizando === a.id}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition disabled:opacity-50 ${
                              a.status === s
                                ? 'border-brand-teal bg-brand-tealLight text-brand-teal'
                                : 'border-slate-200 text-slate-500 hover:border-slate-300'
                            }`}
                          >
                            {statusLabels[s]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
