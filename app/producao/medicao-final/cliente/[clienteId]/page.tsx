'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, FileText, Loader2, Plus, RefreshCw, Ruler, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { criarMedicaoDoOrcamento, criarMedicaoManualCliente, verificarFluxoVendaOrcamento, type TipoMedicaoFinal } from '@/lib/medicaoFinal'
import { tokenAtual, usuarioAtual } from '@/lib/auth'
import type { Usuario } from '@/lib/tipos'

type ClienteResumo = { id: string; nome: string; cidade?: string | null }
type OrcamentoItemResumo = {
  id?: string
  tipo_esquadria?: string | null
  tipo_outro_texto?: string | null
  descricao?: string | null
  configuracao_nome?: string | null
  ambiente?: string | null
  largura_mm?: number | null
  altura_mm?: number | null
  quantidade?: number | null
}

type OrcamentoResumo = {
  id: string
  numero?: number | null
  cliente_nome?: string | null
  created_at: string
  status?: string | null
  obra_id?: string | null
  revisao_versao?: number | null
  revisao_atual?: boolean | null
  descricao_livre?: string | null
  itens?: unknown[] | null
  wvetro_fluxo?: { origem?: string | null; numero?: string | null; cliente_nome_wvetro?: string | null } | null
}

type CandidatoItemWVetro = {
  id?: string | null
  nome?: string | null
  linha?: string | null
  modelo?: string | null
  codigo?: string | null
  largura?: string | number | null
  altura?: string | number | null
  ambiente?: string | null
  quantidade?: string | number | null
  valor_total?: string | number | null
  valor_total_alterado?: string | number | null
}

type CandidatoWVetro = {
  historicoId: string
  numeroWvetro: string
  clienteNomeWvetro?: string | null
  tipoRegistro?: string | null
  data?: string | null
  valor?: number | null
  situacao?: string | null
  quantidadeItens?: number
  itens?: CandidatoItemWVetro[]
  tipoCorrespondencia?: 'nome_exato' | 'primeiro_nome' | null
  statusValidacao: 'pendente' | 'aprovado' | 'rejeitado' | 'outro_cliente'
  validadoPor?: string | null
  validadoEm?: string | null
  orcamentoAtlasId?: string | null
}
type MedicaoResumo = {
  id: string
  created_at: string
  status_operacional?: string | null
  orcamento_id?: string | null
  tipo_medicao?: TipoMedicaoFinal | null
}
type HistoricoWVetroResumo = {
  numero_wvetro?: string | null
  tipo_registro?: string | null
  data_emissao?: string | null
  data_venda?: string | null
  valor_total?: number | null
  situacao_wvetro?: string | null
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

function valorBR(v?: string | number | null) {
  if (typeof v === 'number' && Number.isFinite(v)) return v > 0 ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'
  let s = String(v ?? '').trim().replace(/[^0-9,.-]/g, '')
  if (!s) return '—'
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  else if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'
}

export default function AbrirMedidaFinalCliente() {
  const params = useParams()
  const router = useRouter()
  const clienteId = params?.clienteId as string
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [cliente, setCliente] = useState<ClienteResumo | null>(null)
  const [orcamentos, setOrcamentos] = useState<OrcamentoResumo[]>([])
  const [medicoes, setMedicoes] = useState<MedicaoResumo[]>([])
  const [historicosWVetro, setHistoricosWVetro] = useState<HistoricoWVetroResumo[]>([])
  const [candidatosWVetro, setCandidatosWVetro] = useState<CandidatoWVetro[]>([])
  const [sincronizandoWVetro, setSincronizandoWVetro] = useState(false)
  const [candidatoOcupado, setCandidatoOcupado] = useState('')
  const [mensagemSync, setMensagemSync] = useState('')
  const [tipo, setTipo] = useState<TipoMedicaoFinal | null>(null)
  const [orcamentoId, setOrcamentoId] = useState('')
  const [orcamentoAbertoId, setOrcamentoAbertoId] = useState('')
  const [candidatoAbertoId, setCandidatoAbertoId] = useState('')
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

      const [c, o, m, h] = await Promise.all([
        supabase.from('clientes').select('id,nome,cidade').eq('id', clienteId).maybeSingle(),
        supabase
          .from('orcamentos')
          .select('id,numero,cliente_nome,created_at,status,obra_id,revisao_versao,revisao_atual,descricao_livre,itens,wvetro_fluxo')
          .eq('cliente_id', clienteId)
          .or('modo_entrada.is.null,modo_entrada.neq.balcao')
          .order('created_at', { ascending: false }),
        supabase
          .from('medicoes_finais')
          .select('id,created_at,status_operacional,orcamento_id,tipo_medicao')
          .eq('cliente_id', clienteId)
          .order('created_at', { ascending: false }),
        supabase
          .from('wvetro_historico_comercial')
          .select('numero_wvetro,tipo_registro,data_emissao,data_venda,valor_total,situacao_wvetro')
          .eq('cliente_id', clienteId)
          .eq('status_vinculo', 'seguro')
          .eq('somente_historico', true)
          .order('data_emissao', { ascending: false })
          .limit(200),
      ])

      if (c.error || !c.data) throw new Error('Cliente não encontrado.')
      if (o.error) throw o.error
      if (m.error) throw m.error
      if (h.error) throw h.error
      setCliente(c.data as ClienteResumo)
      setOrcamentos((o.data || []) as OrcamentoResumo[])
      setMedicoes((m.data || []) as MedicaoResumo[])
      setHistoricosWVetro((h.data || []) as HistoricoWVetroResumo[])
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
  const candidatosVisiveis = useMemo(
    () => candidatosWVetro.filter(c => c.statusValidacao !== 'rejeitado'),
    [candidatosWVetro]
  )
  const candidatosDescartados = candidatosWVetro.filter(c => c.statusValidacao === 'rejeitado').length

  function numeroExibicao(o: OrcamentoResumo) {
    const numeroWVetro = String(o.wvetro_fluxo?.numero || '').trim()
    return numeroWVetro ? { origem: 'W.Vetro', numero: numeroWVetro } : { origem: 'Atlas', numero: String(o.numero || '—') }
  }

  function selecionarTipo(novoTipo: TipoMedicaoFinal) {
    setTipo(novoTipo)
    setOrcamentoId('')
    setOrcamentoAbertoId('')
    setCandidatoAbertoId('')
  }

  function itensDoOrcamento(o: OrcamentoResumo) {
    return (Array.isArray(o.itens) ? o.itens : []) as OrcamentoItemResumo[]
  }

  function nomeItemOrcamento(item: OrcamentoItemResumo) {
    return item.configuracao_nome || item.descricao || item.tipo_outro_texto || item.tipo_esquadria || 'Tipologia'
  }

  function medicaoExistente(orcId: string, t: TipoMedicaoFinal) {
    return medicoes.find(m => m.orcamento_id === orcId && (m.tipo_medicao || 'tipologia') === t)
  }

  async function sincronizarWVetroCliente() {
    if (sincronizandoWVetro) return
    setSincronizandoWVetro(true)
    setMensagemSync('')
    setErro('')
    try {
      const token = await tokenAtual()
      if (!token) throw new Error('Sessão expirada. Entre novamente no Atlas.')

      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 12000)
      let resposta: Response
      try {
        resposta = await fetch('/api/integracoes/wvetro/orcamentos/candidatos-cliente', {
          method: 'POST',
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ clienteId, acao: 'buscar' }),
        })
      } finally {
        window.clearTimeout(timeout)
      }
      const json = await resposta.json().catch(() => ({}))
      if (!resposta.ok) throw new Error(json?.error || 'Não foi possível consultar os orçamentos do W.Vetro.')

      const candidatos = Array.isArray(json?.candidatos) ? json.candidatos as CandidatoWVetro[] : []
      setCandidatosWVetro(candidatos)
      const pendentes = candidatos.filter(c => c.statusValidacao === 'pendente').length
      const aprovados = candidatos.filter(c => c.statusValidacao === 'aprovado').length
      const rejeitados = candidatos.filter(c => c.statusValidacao === 'rejeitado').length
      setMensagemSync(
        candidatos.length
          ? `Encontramos ${candidatos.length} orçamento(s) W.Vetro pelo nome. ${pendentes} aguardando validação · ${aprovados} validado(s)${rejeitados ? ` · ${rejeitados} descartado(s)` : ''}.`
          : 'Nenhum orçamento W.Vetro com o mesmo primeiro nome foi encontrado.'
      )
    } catch (e) {
      const mensagem = e instanceof DOMException && e.name === 'AbortError'
        ? 'A consulta demorou demais e foi cancelada. A tela foi liberada; tente novamente.'
        : e instanceof Error ? e.message : 'Não foi possível consultar os orçamentos do W.Vetro.'
      setErro(mensagem)
    } finally {
      setSincronizandoWVetro(false)
    }
  }

  async function validarCandidatoWVetro(candidato: CandidatoWVetro, acao: 'aprovar' | 'rejeitar') {
    if (candidatoOcupado) return
    setCandidatoOcupado(candidato.historicoId)
    setErro('')
    try {
      const token = await tokenAtual()
      if (!token) throw new Error('Sessão expirada. Entre novamente no Atlas.')
      const resposta = await fetch('/api/integracoes/wvetro/orcamentos/candidatos-cliente', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clienteId, acao, historicoId: candidato.historicoId }),
      })
      const json = await resposta.json().catch(() => ({}))
      if (!resposta.ok) throw new Error(json?.error || 'Não foi possível validar este orçamento W.Vetro.')
      setCandidatosWVetro(Array.isArray(json?.candidatos) ? json.candidatos : [])
      setMensagemSync(json?.mensagem || (acao === 'aprovar' ? 'Orçamento validado.' : 'Candidato descartado.'))
      if (acao === 'aprovar') await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível validar este orçamento W.Vetro.')
    } finally {
      setCandidatoOcupado('')
    }
  }

  async function usarCandidatoWVetro(candidato: CandidatoWVetro) {
    if (candidatoOcupado || criando) return
    setCandidatoOcupado(candidato.historicoId)
    setErro('')
    try {
      const token = await tokenAtual()
      if (!token) throw new Error('Sessão expirada. Entre novamente no Atlas.')
      const resposta = await fetch('/api/integracoes/wvetro/orcamentos/candidatos-cliente', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clienteId, acao: 'aprovar', historicoId: candidato.historicoId }),
      })
      const json = await resposta.json().catch(() => ({}))
      if (!resposta.ok) throw new Error(json?.error || 'Não foi possível preparar este orçamento W.Vetro para a Medida Final.')
      const id = String(json?.orcamentoAtlasId || candidato.orcamentoAtlasId || '').trim()
      if (!id) throw new Error('O orçamento foi validado, mas o Atlas não conseguiu criar o vínculo operacional.')
      setCandidatosWVetro(Array.isArray(json?.candidatos) ? json.candidatos : [])
      setMensagemSync(`W.Vetro #${candidato.numeroWvetro} selecionado para a Medida Final.`)
      setCandidatoAbertoId('')
      setOrcamentoId(id)
      await continuarOuCriar(id)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível usar este orçamento W.Vetro na Medida Final.')
    } finally {
      setCandidatoOcupado('')
    }
  }

  async function iniciarSemOrcamento() {
    if (!tipo || criando) return
    const existente = medicoes.find(m => !m.orcamento_id && (m.tipo_medicao || 'tipologia') === tipo)
    if (existente) {
      try { localStorage.setItem(`atlas-medicao-cliente-${clienteId}`, existente.id) } catch {}
      router.push(`/producao/medicao-final/${existente.id}`)
      return
    }

    setCriando(true)
    setErro('')
    const medicao = await criarMedicaoManualCliente(clienteId, null, usuario, tipo)
    setCriando(false)
    if (!medicao) {
      setErro('Não foi possível iniciar a medição sem orçamento.')
      return
    }
    try { localStorage.setItem(`atlas-medicao-cliente-${clienteId}`, medicao.id) } catch {}
    router.push(`/producao/medicao-final/${medicao.id}`)
  }

  async function continuarOuCriar(orcamentoEscolhido?: string) {
    const escolhido = orcamentoEscolhido || orcamentoId
    if (!tipo || !escolhido || criando) return
    const existente = medicaoExistente(escolhido, tipo)
    if (existente) {
      try { localStorage.setItem(`atlas-medicao-cliente-${clienteId}`, existente.id) } catch {}
      router.push(`/producao/medicao-final/${existente.id}`)
      return
    }

    const fluxo = await verificarFluxoVendaOrcamento(escolhido)
    if (!fluxo.ativo) {
      router.push(`/vendas/confirmar?orcamento=${encodeURIComponent(escolhido)}&origem=medicao-final`)
      return
    }

    setCriando(true)
    setErro('')
    const medicao = await criarMedicaoDoOrcamento(escolhido, usuario, tipo)
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

  const orcamentoVisualizado = orcamentosAtuais.find(o => o.id === orcamentoAbertoId) || null
  const candidatoVisualizado = candidatosVisiveis.find(c => c.historicoId === candidatoAbertoId) || null

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-start gap-3 px-4 py-5">
          <Link href={`/clientes/${clienteId}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600">
            <ArrowLeft size={19} />
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[.16em] text-blue-600">Medida Final</p>
            <h1 className="mt-1 truncate text-2xl font-black text-slate-900">{cliente?.nome || 'Cliente'}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {!tipo
                ? 'Escolha o tipo de medição para continuar.'
                : orcamentoVisualizado
                  ? 'Confira as tipologias antes de selecionar.'
                  : 'Escolha o orçamento que será usado para a medição.'}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">
        {erro && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}

        {!tipo && (
          <section>
            <h2 className="text-xl font-black text-slate-900">O que você vai medir?</h2>
            <p className="mt-1 text-sm text-slate-500">Escolha o tipo de medição.</p>

            <div className="mt-5 space-y-3">
              <button
                onClick={() => selecionarTipo('contramarco')}
                className="flex w-full items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 text-left shadow-sm transition hover:border-emerald-400"
              >
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-slate-800 shadow-sm">
                  <Ruler size={28} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-black text-slate-900">Contramarco</p>
                  <p className="mt-1 text-sm text-slate-600">Medir os vãos e fabricar os contramarcos.</p>
                </div>
                <ChevronRight size={22} className="text-emerald-600" />
              </button>

              <button
                onClick={() => selecionarTipo('tipologia')}
                className="flex w-full items-center gap-4 rounded-2xl border border-blue-200 bg-blue-50/80 p-5 text-left shadow-sm transition hover:border-blue-400"
              >
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-slate-800 shadow-sm">
                  <FileText size={28} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-black text-slate-900">Tipologia / Esquadria</p>
                  <p className="mt-1 text-sm text-slate-600">Fazer a Medida Final das esquadrias que serão fabricadas.</p>
                </div>
                <ChevronRight size={22} className="text-blue-600" />
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
              <b>São processos separados.</b>
              <p className="mt-1 text-xs">Primeiro faz o contramarco e depois a medida final das esquadrias.</p>
            </div>

            {medicoes.length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-xs font-black uppercase tracking-[.1em] text-slate-400">Medições já iniciadas</p>
                <div className="space-y-2">
                  {medicoes.map(m => (
                    <Link key={m.id} href={`/producao/medicao-final/${m.id}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{tipoLabel(m.tipo_medicao)}</p>
                        <p className="text-xs text-slate-500">{dataBR(m.created_at)} · {statusLabel(m.status_operacional)}</p>
                      </div>
                      <span className="text-xs font-bold text-blue-700">Continuar</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {tipo && !orcamentoVisualizado && !candidatoVisualizado && (
          <section>
            <div className="mb-4 flex items-center justify-between gap-3">
              <button onClick={() => { setTipo(null); setOrcamentoId(''); setOrcamentoAbertoId(''); setCandidatoAbertoId('') }} className="inline-flex items-center gap-1 text-sm font-bold text-slate-500">
                <ChevronLeft size={17} /> Voltar
              </button>
              <button
                onClick={sincronizarWVetroCliente}
                disabled={sincronizandoWVetro}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-black text-blue-700 disabled:opacity-50"
              >
                {sincronizandoWVetro ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {sincronizandoWVetro ? 'Sincronizando...' : 'Sincronizar W.Vetro'}
              </button>
            </div>

            <h2 className="text-xl font-black text-slate-900">Selecionar orçamento</h2>
            <p className="mt-1 text-sm text-slate-500">Lista com as tipologias de cada um.</p>

            {mensagemSync && (
              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">{mensagemSync}</div>
            )}

            {candidatosWVetro.length > 0 && (
              <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/60 p-3">
                <p className="text-sm font-black text-slate-900">Confirmar orçamento do W.Vetro</p>
                <p className="mt-1 text-xs text-slate-500">Valide somente os registros que realmente pertencem a este cliente.</p>
                <div className="mt-3 space-y-2">
                  {candidatosVisiveis.map(candidato => {
                    const ocupado = candidatoOcupado === candidato.historicoId
                    const aprovado = candidato.statusValidacao === 'aprovado'
                    const bloqueado = candidato.statusValidacao === 'outro_cliente'
                    return (
                      <div key={candidato.historicoId} className="rounded-xl border border-violet-100 bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <button type="button" onClick={() => setCandidatoAbertoId(candidato.historicoId)} className="min-w-0 flex-1 text-left">
                            <p className="text-sm font-black text-slate-900">W.Vetro #{candidato.numeroWvetro}</p>
                            <p className="truncate text-xs font-semibold text-slate-600">{candidato.clienteNomeWvetro || 'Nome não informado'}</p>
                            <p className="mt-1 text-[11px] text-slate-400">{dataBR(candidato.data)}{candidato.quantidadeItens ? ` · ${candidato.quantidadeItens} item(ns)` : ''}{candidato.valor ? ` · ${valorBR(candidato.valor)}` : ''}</p>
                            <p className="mt-1 text-[11px] font-black text-blue-700">Ver orçamento e itens ›</p>
                          </button>
                          {aprovado ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700">VALIDADO</span>
                          ) : bloqueado ? (
                            <span className="text-[10px] font-bold text-amber-700">Outro cliente</span>
                          ) : (
                            <div className="flex gap-1">
                              <button onClick={() => void validarCandidatoWVetro(candidato, 'rejeitar')} disabled={!!candidatoOcupado} className="rounded-lg border px-2 py-1.5 text-[11px] font-bold text-slate-500"><XCircle size={12} /></button>
                              <button onClick={() => void validarCandidatoWVetro(candidato, 'aprovar')} disabled={!!candidatoOcupado} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[11px] font-bold text-white">
                                {ocupado ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Validar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="mt-4 space-y-3">
              {orcamentosAtuais.map(o => {
                const itens = itensDoOrcamento(o)
                const exibicao = numeroExibicao(o)
                const existente = medicaoExistente(o.id, tipo)
                return (
                  <div key={o.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-black text-slate-900">#{exibicao.numero}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${exibicao.origem === 'W.Vetro' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {exibicao.origem}
                          </span>
                          {existente && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">JÁ INICIADO</span>}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{dataBR(o.created_at)} · {itens.length} tipologia(s)</p>
                        {o.descricao_livre && <p className="mt-1 truncate text-xs text-slate-500">{o.descricao_livre}</p>}
                      </div>
                      <div className="flex shrink-0 flex-col gap-2">
                        <button onClick={() => setOrcamentoAbertoId(o.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">
                          Ver itens
                        </button>
                        <button onClick={() => void continuarOuCriar(o.id)} disabled={criando} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50">
                          {existente ? 'Continuar' : 'Selecionar'}
                        </button>
                      </div>
                    </div>

                    {itens.length > 0 && (
                      <div className="mt-3 flex items-center gap-1.5 overflow-hidden">
                        {itens.slice(0, 4).map((item, idx) => (
                          <div key={item.id || idx} title={nomeItemOrcamento(item)} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-[10px] font-black text-slate-500">
                            {idx + 1}
                          </div>
                        ))}
                        {itens.length > 4 && <span className="rounded-lg bg-slate-100 px-2 py-2 text-xs font-bold text-slate-500">+{itens.length - 4}</span>}
                      </div>
                    )}
                  </div>
                )
              })}

              {orcamentosAtuais.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
                  <p className="text-sm font-black text-slate-800">Nenhum orçamento operacional selecionado ainda.</p>
                  <p className="mt-1 text-xs text-slate-500">Abra um orçamento W.Vetro acima, confira os itens e escolha qual será usado na Medida Final.</p>
                </div>
              )}
            </div>

            <button
              onClick={iniciarSemOrcamento}
              disabled={criando}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-blue-600 bg-white px-4 py-3 text-sm font-black text-blue-700 disabled:opacity-50"
            >
              {criando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Iniciar sem orçamento
            </button>
            <p className="mt-2 text-center text-[11px] text-amber-700">
              Medição sem orçamento é avulsa e não libera Engenharia, Compras ou Produção automaticamente.
            </p>
          </section>
        )}

        {tipo && candidatoVisualizado && !orcamentoVisualizado && (
          <section>
            <button onClick={() => setCandidatoAbertoId('')} className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-slate-500">
              <ChevronLeft size={17} /> Voltar aos orçamentos
            </button>

            <div className="mb-4 rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black text-slate-900">W.Vetro #{candidatoVisualizado.numeroWvetro}</h2>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black ${candidatoVisualizado.statusValidacao === 'aprovado' ? 'bg-emerald-100 text-emerald-700' : candidatoVisualizado.statusValidacao === 'outro_cliente' ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'}`}>
                      {candidatoVisualizado.statusValidacao === 'aprovado' ? 'VALIDADO' : candidatoVisualizado.statusValidacao === 'outro_cliente' ? 'OUTRO CLIENTE' : 'AGUARDANDO VALIDAÇÃO'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-700">{candidatoVisualizado.clienteNomeWvetro || 'Nome não informado'}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {dataBR(candidatoVisualizado.data)}
                    {candidatoVisualizado.situacao ? ` · ${statusLabel(candidatoVisualizado.situacao)}` : ''}
                    {candidatoVisualizado.quantidadeItens ? ` · ${candidatoVisualizado.quantidadeItens} item(ns)` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-[.1em] text-slate-400">Valor do orçamento</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{valorBR(candidatoVisualizado.valor)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {(candidatoVisualizado.itens || []).map((item, idx) => {
                const nome = item.modelo || item.nome || item.codigo || `Item ${idx + 1}`
                const temMedida = item.largura || item.altura
                const valorItem = item.valor_total_alterado || item.valor_total
                return (
                  <div key={item.id || idx} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-xs font-black text-slate-500">{idx + 1}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-900">{item.ambiente || 'Sem ambiente'}</p>
                      <p className="truncate text-xs text-slate-600">{nome}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {temMedida ? `${item.largura || '—'} × ${item.altura || '—'} mm` : 'Medida não informada'}
                        {item.linha ? ` · Linha ${item.linha}` : ''}
                        {item.codigo ? ` · Cód. ${item.codigo}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-bold text-slate-600">{item.quantidade || 1} un</p>
                      {valorItem ? <p className="mt-1 text-[11px] font-bold text-slate-500">{valorBR(valorItem)}</p> : null}
                    </div>
                  </div>
                )
              })}

              {(candidatoVisualizado.itens || []).length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">
                  O W.Vetro não devolveu os itens detalhados deste orçamento.
                </div>
              )}
            </div>

            {candidatoVisualizado.statusValidacao === 'outro_cliente' ? (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                Este orçamento já está vinculado a outro cliente e não pode ser usado nesta Medida Final.
              </div>
            ) : (
              <button
                onClick={() => void usarCandidatoWVetro(candidatoVisualizado)}
                disabled={!!candidatoOcupado || criando}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-black text-white shadow-sm disabled:opacity-50"
              >
                {(candidatoOcupado === candidatoVisualizado.historicoId || criando) && <Loader2 size={16} className="animate-spin" />}
                {candidatoVisualizado.statusValidacao === 'aprovado' ? 'Usar este orçamento na Medida Final' : 'Validar e usar este orçamento na Medida Final'}
              </button>
            )}
          </section>
        )}

        {tipo && orcamentoVisualizado && (
          <section>
            <button onClick={() => setOrcamentoAbertoId('')} className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-slate-500">
              <ChevronLeft size={17} /> Voltar aos orçamentos
            </button>

            <div className="mb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-black text-slate-900">Orçamento #{numeroExibicao(orcamentoVisualizado).numero}</h2>
                <span className="text-xs font-semibold text-slate-500">{dataBR(orcamentoVisualizado.created_at)}</span>
              </div>
              {orcamentoVisualizado.descricao_livre && <p className="mt-1 text-sm text-slate-500">Obra: {orcamentoVisualizado.descricao_livre}</p>}
            </div>

            <div className="space-y-2">
              {itensDoOrcamento(orcamentoVisualizado).map((item, idx) => (
                <div key={item.id || idx} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-xs font-black text-slate-500">{idx + 1}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-900">{item.ambiente || 'Sem ambiente'}</p>
                    <p className="truncate text-xs text-slate-500">{nomeItemOrcamento(item)}</p>
                    {(item.largura_mm || item.altura_mm) && <p className="mt-1 text-[11px] text-slate-400">{item.largura_mm || '—'} × {item.altura_mm || '—'} mm</p>}
                  </div>
                  <span className="text-xs font-bold text-slate-500">{item.quantidade || 1} un</span>
                </div>
              ))}

              {itensDoOrcamento(orcamentoVisualizado).length === 0 && (
                <div className="rounded-xl border border-dashed p-5 text-center text-sm text-slate-500">
                  Este orçamento ainda não possui tipologias detalhadas. Você poderá adicionar na próxima tela.
                </div>
              )}
            </div>

            <button
              onClick={() => void continuarOuCriar(orcamentoVisualizado.id)}
              disabled={criando}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-black text-white shadow-sm disabled:opacity-50"
            >
              {criando && <Loader2 size={16} className="animate-spin" />}
              Selecionar este orçamento
            </button>
          </section>
        )}
      </main>
    </div>
  )

}
