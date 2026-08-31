'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BadgeDollarSign, CalendarDays, FileText, Plus, ShoppingBag, Timer, Wrench } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ClienteOperacoesProps {
  clienteId: string
  clienteNome: string
}

interface AssistenciaResumo {
  id: string
  created_at: string
  descricao_problema?: string | null
  status?: string | null
  tecnico_nome?: string | null
  duracao_atendimento_segundos?: number | null
}

interface MedicaoVendaResumo {
  id: string
  created_at: string
  orcamento_id?: string | null
}

interface OrcamentoVendaResumo {
  id: string
  numero?: number | null
  created_at: string
  tipo_esquadria?: string | null
  valor_estimado?: number | null
}

function moeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function duracao(segundos?: number | null) {
  if (typeof segundos !== 'number') return null
  const total = Math.max(0, Math.floor(segundos))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  if (h > 0) return `${h}h ${m}min`
  return `${m} min`
}

function statusAssistencia(status?: string | null) {
  if (!status) return 'Aberta'
  const mapa: Record<string, string> = {
    aberto: 'Aberta',
    em_atendimento: 'Em atendimento',
    resolvido: 'Resolvida',
    concluido: 'Concluída',
  }
  return mapa[status] || status.replace(/_/g, ' ')
}

export default function ClienteOperacoes({ clienteId, clienteNome }: ClienteOperacoesProps) {
  const [assistencias, setAssistencias] = useState<AssistenciaResumo[]>([])
  const [medicoes, setMedicoes] = useState<MedicaoVendaResumo[]>([])
  const [orcamentosVenda, setOrcamentosVenda] = useState<Record<string, OrcamentoVendaResumo>>({})
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      setCarregando(true)
      const [{ data: assistenciasData }, { data: medicoesData }] = await Promise.all([
        supabase
          .from('assistencias')
          .select('id, created_at, descricao_problema, status, tecnico_nome, duracao_atendimento_segundos')
          .eq('cliente_id', clienteId)
          .order('created_at', { ascending: false }),
        supabase
          .from('medicoes_finais')
          .select('id, created_at, orcamento_id')
          .eq('cliente_id', clienteId)
          .order('created_at', { ascending: false }),
      ])

      if (!ativo) return

      const listaMedicoes = (medicoesData || []) as MedicaoVendaResumo[]
      setAssistencias((assistenciasData || []) as AssistenciaResumo[])
      setMedicoes(listaMedicoes)

      const idsOrcamentos = Array.from(new Set(listaMedicoes.map(m => m.orcamento_id).filter(Boolean))) as string[]
      if (idsOrcamentos.length > 0) {
        const { data: vendasData } = await supabase
          .from('orcamentos')
          .select('id, numero, created_at, tipo_esquadria, valor_estimado')
          .in('id', idsOrcamentos)

        if (!ativo) return
        const mapa: Record<string, OrcamentoVendaResumo> = {}
        ;((vendasData || []) as OrcamentoVendaResumo[]).forEach(v => { mapa[v.id] = v })
        setOrcamentosVenda(mapa)
      } else {
        setOrcamentosVenda({})
      }

      setCarregando(false)
    }

    void carregar()
    return () => { ativo = false }
  }, [clienteId])

  const vendas = useMemo(() => medicoes.map(m => ({ medicao: m, orcamento: m.orcamento_id ? orcamentosVenda[m.orcamento_id] : undefined })), [medicoes, orcamentosVenda])
  const totalVendido = useMemo(() => vendas.reduce((soma, venda) => soma + (venda.orcamento?.valor_estimado || 0), 0), [vendas])

  return (
    <section className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Central do cliente</h2>
            <p className="text-sm text-slate-500">Vendas, assistências e manutenções ficam vinculadas a este cadastro.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/orcamento-rapido?cliente=${encodeURIComponent(clienteId)}`} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-2 text-xs font-medium text-white hover:bg-brand-navyDark">
              <Plus size={14} /> Orçamento sob medida
            </Link>
            <Link href={`/orcamento/balcao/novo?cliente=${encodeURIComponent(clienteId)}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
              <ShoppingBag size={14} /> Venda balcão
            </Link>
            <Link href={`/assistencia?cliente=${encodeURIComponent(clienteId)}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
              <Wrench size={14} /> Nova assistência / manutenção
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Vendas</p>
            <p className="mt-1 text-xl font-bold text-slate-800">{medicoes.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Total vendido</p>
            <p className="mt-1 text-sm font-bold text-brand-teal">{moeda(totalVendido)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Assistências</p>
            <p className="mt-1 text-xl font-bold text-slate-800">{assistencias.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Cliente</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-800">{clienteNome}</p>
          </div>
        </div>
      </div>

      {carregando ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-400">Carregando histórico operacional...</div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-slate-700">Vendas confirmadas</h3>
                <p className="text-xs text-slate-400">Uma venda entra aqui quando o processo de venda gera a Medição Final.</p>
              </div>
              <BadgeDollarSign size={20} className="text-brand-teal" />
            </div>

            {vendas.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma venda confirmada para este cliente ainda.</p>
            ) : (
              <div className="space-y-2">
                {vendas.map(({ medicao, orcamento }) => (
                  <div key={medicao.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {orcamento?.numero ? `Venda do orçamento #${orcamento.numero}` : 'Venda confirmada'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {orcamento?.tipo_esquadria ? `${orcamento.tipo_esquadria} · ` : ''}{new Date(medicao.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-brand-teal">{orcamento?.valor_estimado != null ? moeda(orcamento.valor_estimado) : 'Valor não informado'}</span>
                      <Link href={`/producao/medicao-final/${medicao.id}`} className="text-xs font-medium text-brand-navy hover:underline">Abrir processo</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-slate-700">Assistências e manutenções</h3>
                <p className="text-xs text-slate-400">Todo chamado vinculado ao cliente fica registrado aqui.</p>
              </div>
              <Wrench size={20} className="text-brand-navy" />
            </div>

            {assistencias.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma assistência ou manutenção registrada.</p>
            ) : (
              <div className="space-y-2">
                {assistencias.map(a => {
                  const tempo = duracao(a.duracao_atendimento_segundos)
                  return (
                    <div key={a.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-slate-800">{a.descricao_problema || 'Assistência / manutenção'}</p>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{statusAssistencia(a.status)}</span>
                          </div>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {new Date(a.created_at).toLocaleDateString('pt-BR')}</span>
                            {a.tecnico_nome && <span>· Técnico: {a.tecnico_nome}</span>}
                            {tempo && <span className="inline-flex items-center gap-1"><Timer size={12} /> {tempo}</span>}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/assistencias/${a.id}/os`} className="inline-flex items-center gap-1 text-xs font-medium text-brand-navy hover:underline"><FileText size={12} /> OS / PDF</Link>
                          <Link href={`/assistencias?cliente=${encodeURIComponent(clienteNome)}`} className="text-xs font-medium text-slate-600 hover:underline">Ver no Kanban</Link>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
