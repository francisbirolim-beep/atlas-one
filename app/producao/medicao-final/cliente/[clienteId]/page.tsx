'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, FileText, Loader2, Ruler } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { criarMedicaoDoOrcamento, type TipoMedicaoFinal } from '@/lib/medicaoFinal'
import { usuarioAtual } from '@/lib/auth'
import type { Usuario } from '@/lib/tipos'

type ClienteResumo = { id: string; nome: string; cidade?: string | null }
type OrcamentoResumo = {
  id: string
  numero?: number | null
  created_at: string
  status?: string | null
  obra_id?: string | null
  revisao_versao?: number | null
  revisao_atual?: boolean | null
  descricao_livre?: string | null
  itens?: unknown[] | null
}
type MedicaoResumo = {
  id: string
  created_at: string
  status_operacional?: string | null
  orcamento_id?: string | null
  tipo_medicao?: TipoMedicaoFinal | null
}

function dataBR(v?: string | null) {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}

function statusLabel(v?: string | null) {
  return v ? v.replaceAll('_', ' ').replace(/^./, x => x.toUpperCase()) : '—'
}

function tipoLabel(tipo?: TipoMedicaoFinal | null) {
  return tipo === 'contramarco' ? 'Contramarco' : 'Tipologia / fabricação de peça'
}

export default function AbrirMedidaFinalCliente() {
  const params = useParams()
  const router = useRouter()
  const clienteId = params?.clienteId as string
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [cliente, setCliente] = useState<ClienteResumo | null>(null)
  const [orcamentos, setOrcamentos] = useState<OrcamentoResumo[]>([])
  const [medicoes, setMedicoes] = useState<MedicaoResumo[]>([])
  const [tipo, setTipo] = useState<TipoMedicaoFinal | null>(null)
  const [orcamentoId, setOrcamentoId] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    void usuarioAtual().then(setUsuario)
    if (clienteId) void carregar()
  }, [clienteId])

  async function carregar() {
    setCarregando(true)
    setErro('')
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const ultima = localStorage.getItem(`atlas-medicao-cliente-${clienteId}`)
        if (ultima) {
          router.replace(`/producao/medicao-final/${ultima}`)
          return
        }
        setErro('Sem internet. Abra este cliente uma vez conectado para iniciar uma nova Medida Final.')
        return
      }

      const [c, o, m] = await Promise.all([
        supabase.from('clientes').select('id,nome,cidade').eq('id', clienteId).maybeSingle(),
        supabase
          .from('orcamentos')
          .select('id,numero,created_at,status,obra_id,revisao_versao,revisao_atual,descricao_livre,itens')
          .eq('cliente_id', clienteId)
          .or('modo_entrada.is.null,modo_entrada.neq.balcao')
          .order('created_at', { ascending: false }),
        supabase
          .from('medicoes_finais')
          .select('id,created_at,status_operacional,orcamento_id,tipo_medicao')
          .eq('cliente_id', clienteId)
          .order('created_at', { ascending: false }),
      ])

      if (c.error || !c.data) throw new Error('Cliente não encontrado.')
      if (o.error) throw o.error
      if (m.error) throw m.error
      setCliente(c.data as ClienteResumo)
      setOrcamentos((o.data || []) as OrcamentoResumo[])
      setMedicoes((m.data || []) as MedicaoResumo[])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar a Medida Final deste cliente.')
    } finally {
      setCarregando(false)
    }
  }

  const orcamentosAtuais = useMemo(
    () => orcamentos.filter(o => o.revisao_atual !== false),
    [orcamentos]
  )

  function selecionarTipo(novoTipo: TipoMedicaoFinal) {
    setTipo(novoTipo)
    setOrcamentoId('')
  }

  function medicaoExistente(orcId: string, t: TipoMedicaoFinal) {
    return medicoes.find(m => m.orcamento_id === orcId && (m.tipo_medicao || 'tipologia') === t)
  }

  async function continuarOuCriar() {
    if (!tipo || !orcamentoId || criando) return
    const existente = medicaoExistente(orcamentoId, tipo)
    if (existente) {
      try { localStorage.setItem(`atlas-medicao-cliente-${clienteId}`, existente.id) } catch {}
      router.push(`/producao/medicao-final/${existente.id}`)
      return
    }

    setCriando(true)
    setErro('')
    const medicao = await criarMedicaoDoOrcamento(orcamentoId, usuario, tipo)
    setCriando(false)
    if (!medicao) {
      setErro('Não foi possível criar a Medida Final. Confira o orçamento e tente novamente.')
      return
    }
    try { localStorage.setItem(`atlas-medicao-cliente-${clienteId}`, medicao.id) } catch {}
    router.push(`/producao/medicao-final/${medicao.id}`)
  }

  if (carregando) {
    return <div className="min-h-[70vh] grid place-items-center text-slate-500"><Loader2 className="animate-spin" /></div>
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-4xl px-4 py-5">
          <div className="flex items-start gap-3">
            <Link href={`/clientes/${clienteId}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><ArrowLeft size={19} /></Link>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Cliente 360 · Medida Final</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">{cliente?.nome || 'Cliente'}</h1>
              <p className="mt-1 text-sm text-slate-500">Escolha primeiro o tipo de medição e depois o orçamento correto.</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
        {erro && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}

        {medicoes.length > 0 && (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-800">Medições já iniciadas</h2>
            <p className="mt-1 text-xs text-slate-500">Continue uma medição existente sem criar duplicidade.</p>
            <div className="mt-3 space-y-2">
              {medicoes.map(m => (
                <Link key={m.id} href={`/producao/medicao-final/${m.id}`} className="flex items-center justify-between gap-3 rounded-xl border p-3 hover:border-brand-navy">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{tipoLabel(m.tipo_medicao)}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{dataBR(m.created_at)} · {statusLabel(m.status_operacional)}</p>
                  </div>
                  <span className="text-xs font-bold text-brand-navy">Continuar</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-brand-navy text-sm font-bold text-white">1</div>
            <div>
              <h2 className="font-bold text-slate-900">O que será medido?</h2>
              <p className="text-xs text-slate-500">Cada opção cria um processo separado para o mesmo orçamento.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <button onClick={() => selecionarTipo('contramarco')} className={`rounded-2xl border p-4 text-left transition ${tipo === 'contramarco' ? 'border-brand-navy bg-blue-50 ring-1 ring-brand-navy' : 'hover:border-slate-400'}`}>
              <div className="flex items-center gap-2 font-bold text-slate-900"><Ruler size={18} /> Contramarco</div>
              <p className="mt-2 text-sm text-slate-500">Seleciona as tipologias do orçamento para medir os vãos e fabricar os contramarcos.</p>
            </button>
            <button onClick={() => selecionarTipo('tipologia')} className={`rounded-2xl border p-4 text-left transition ${tipo === 'tipologia' ? 'border-brand-navy bg-blue-50 ring-1 ring-brand-navy' : 'hover:border-slate-400'}`}>
              <div className="flex items-center gap-2 font-bold text-slate-900"><FileText size={18} /> Tipologia / fabricação de peça</div>
              <p className="mt-2 text-sm text-slate-500">Faz a Medida Final das esquadrias que serão efetivamente fabricadas.</p>
            </button>
          </div>
        </section>

        {tipo && (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-brand-navy text-sm font-bold text-white">2</div>
              <div>
                <h2 className="font-bold text-slate-900">Escolha o orçamento</h2>
                <p className="text-xs text-slate-500">Mesmo quando houver apenas um orçamento, confirme qual será usado.</p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {orcamentosAtuais.map(o => {
                const existente = medicaoExistente(o.id, tipo)
                const selecionado = orcamentoId === o.id
                const qtdItens = Array.isArray(o.itens) ? o.itens.length : 0
                return (
                  <button key={o.id} onClick={() => setOrcamentoId(o.id)} className={`w-full rounded-xl border p-4 text-left transition ${selecionado ? 'border-brand-navy bg-blue-50 ring-1 ring-brand-navy' : 'hover:border-slate-400'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-slate-900">Orçamento #{o.numero || '—'} · V{o.revisao_versao || 1}</p>
                          {existente && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700"><CheckCircle2 size={11} /> Já iniciado</span>}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{dataBR(o.created_at)} · {statusLabel(o.status)}{qtdItens ? ` · ${qtdItens} tipologia(s)` : ''}</p>
                        {o.descricao_livre && <p className="mt-1 text-xs text-slate-400">{o.descricao_livre}</p>}
                      </div>
                      {selecionado && <CheckCircle2 size={19} className="text-brand-navy" />}
                    </div>
                  </button>
                )
              })}
              {orcamentosAtuais.length === 0 && <div className="rounded-xl border border-dashed p-5 text-center text-sm text-slate-500">Este cliente não possui orçamento disponível para selecionar.</div>}
            </div>

            <button onClick={continuarOuCriar} disabled={!orcamentoId || criando} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-navy px-4 py-3 text-sm font-bold text-white disabled:opacity-40">
              {criando && <Loader2 size={16} className="animate-spin" />}
              {orcamentoId && medicaoExistente(orcamentoId, tipo) ? 'Continuar medição existente' : tipo === 'contramarco' ? 'Iniciar medição dos contramarcos' : 'Iniciar Medida Final das tipologias'}
            </button>
          </section>
        )}
      </main>
    </div>
  )
}
