'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, CloudDownload, FileText, Loader2, RefreshCw, Ruler, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { criarMedicaoDoOrcamento, type TipoMedicaoFinal } from '@/lib/medicaoFinal'
import { tokenAtual, usuarioAtual } from '@/lib/auth'
import type { Usuario } from '@/lib/tipos'

type ClienteResumo = { id: string; nome: string; cidade?: string | null }
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

type CandidatoWVetro = {
  historicoId: string
  numeroWvetro: string
  clienteNomeWvetro?: string | null
  tipoRegistro?: string | null
  data?: string | null
  valor?: number | null
  situacao?: string | null
  quantidadeItens?: number
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

      const resposta = await fetch('/api/integracoes/wvetro/orcamentos/candidatos-cliente', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clienteId, acao: 'buscar' }),
      })
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
      setErro(e instanceof Error ? e.message : 'Não foi possível consultar os orçamentos do W.Vetro.')
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-brand-navy text-sm font-bold text-white">2</div>
                <div>
                  <h2 className="font-bold text-slate-900">Escolha o orçamento</h2>
                  <p className="text-xs text-slate-500">Mesmo quando houver apenas um orçamento, confirme qual será usado.</p>
                </div>
              </div>
              <button
                onClick={sincronizarWVetroCliente}
                disabled={sincronizandoWVetro}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-800 disabled:opacity-50"
              >
                {sincronizandoWVetro ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {sincronizandoWVetro ? 'Sincronizando...' : 'Sincronizar W.Vetro'}
              </button>
            </div>

            {historicosWVetro.length > 0 && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-800">
                <CloudDownload size={17} className="mt-0.5 shrink-0" />
                <div>
                  <b>Já existem {historicosWVetro.length} registro(s) W.Vetro validados para este cliente.</b>
                  <p className="mt-1 text-xs">Para localizar outros orçamentos com nome igual ou parecido, toque em “Sincronizar W.Vetro” e valide um por um.</p>
                </div>
              </div>
            )}
            {mensagemSync && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{mensagemSync}</div>}

            {candidatosWVetro.length > 0 && (
              <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/50 p-3">
                <div className="mb-3">
                  <p className="text-sm font-bold text-slate-900">Conferir candidatos do W.Vetro</p>
                  <p className="mt-1 text-xs text-slate-600">Confira o nome e o número. Valide somente os que realmente pertencem a {cliente?.nome || 'este cliente'}.</p>
                </div>
                <div className="space-y-2">
                  {candidatosVisiveis.map(candidato => {
                    const ocupado = candidatoOcupado === candidato.historicoId
                    const aprovado = candidato.statusValidacao === 'aprovado'
                    const bloqueado = candidato.statusValidacao === 'outro_cliente'
                    return (
                      <div key={candidato.historicoId} className={`rounded-xl border bg-white p-3 ${aprovado ? 'border-emerald-200' : bloqueado ? 'border-amber-200' : 'border-violet-100'}`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <b className="text-sm text-slate-900">W.Vetro #{candidato.numeroWvetro}</b>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${candidato.tipoCorrespondencia === 'nome_exato' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {candidato.tipoCorrespondencia === 'nome_exato' ? 'NOME EXATO' : 'MESMO PRIMEIRO NOME'}
                              </span>
                              {aprovado && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">VALIDADO</span>}
                            </div>
                            <p className="mt-1 text-sm font-semibold text-slate-700">{candidato.clienteNomeWvetro || 'Nome não informado'}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {dataBR(candidato.data)}
                              {candidato.valor ? ` · ${Number(candidato.valor).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}` : ''}
                              {candidato.quantidadeItens ? ` · ${candidato.quantidadeItens} item(ns)` : ''}
                            </p>
                          </div>
                          {!aprovado && !bloqueado && (
                            <div className="flex shrink-0 gap-2">
                              <button
                                onClick={() => void validarCandidatoWVetro(candidato, 'rejeitar')}
                                disabled={!!candidatoOcupado}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-bold text-slate-600 disabled:opacity-50"
                              >
                                {ocupado ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                                Não é
                              </button>
                              <button
                                onClick={() => void validarCandidatoWVetro(candidato, 'aprovar')}
                                disabled={!!candidatoOcupado}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-2 text-xs font-bold text-white disabled:opacity-50"
                              >
                                {ocupado ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                                Validar
                              </button>
                            </div>
                          )}
                          {bloqueado && <span className="text-xs font-bold text-amber-700">Já vinculado a outro cliente</span>}
                        </div>
                      </div>
                    )
                  })}
                  {candidatosVisiveis.length === 0 && <p className="rounded-lg bg-white p-3 text-xs text-slate-500">Todos os candidatos encontrados foram descartados para este cliente.</p>}
                </div>
                {candidatosDescartados > 0 && <p className="mt-2 text-[11px] text-slate-500">{candidatosDescartados} candidato(s) descartado(s) não aparecem mais na lista de validação.</p>}
              </div>
            )}

            <div className="mt-4 space-y-2">
              {orcamentosAtuais.map(o => {
                const existente = medicaoExistente(o.id, tipo)
                const selecionado = orcamentoId === o.id
                const qtdItens = Array.isArray(o.itens) ? o.itens.length : 0
                const exibicao = numeroExibicao(o)
                const ehWVetro = exibicao.origem === 'W.Vetro'
                return (
                  <button key={o.id} onClick={() => setOrcamentoId(o.id)} className={`w-full rounded-xl border p-4 text-left transition ${selecionado ? 'border-brand-navy bg-blue-50 ring-1 ring-brand-navy' : 'hover:border-slate-400'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-slate-900">{exibicao.origem} #{exibicao.numero}{ehWVetro && o.numero ? ` · Atlas #${o.numero}` : ''}</p>
                          {ehWVetro && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">W.VETRO</span>}
                          {existente && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700"><CheckCircle2 size={11} /> Já iniciado</span>}
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-700">{o.wvetro_fluxo?.cliente_nome_wvetro || o.cliente_nome || cliente?.nome || 'Cliente'}</p>
                        <p className="mt-1 text-xs text-slate-500">{dataBR(o.created_at)} · {statusLabel(o.status)}{qtdItens ? ` · ${qtdItens} tipologia(s)` : ''}</p>
                        {o.descricao_livre && <p className="mt-1 text-xs text-slate-400">{o.descricao_livre}</p>}
                      </div>
                      {selecionado && <CheckCircle2 size={19} className="text-brand-navy" />}
                    </div>
                  </button>
                )
              })}
              {orcamentosAtuais.length === 0 && (
                <div className="rounded-xl border border-dashed p-5 text-center">
                  <p className="text-sm font-semibold text-slate-700">
                    {historicosWVetro.length > 0
                      ? 'Há histórico no W.Vetro, mas ainda não existe orçamento operacional vinculado no Atlas.'
                      : 'Este cliente não possui orçamento disponível para selecionar.'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {historicosWVetro.length > 0
                      ? 'Sincronize o W.Vetro acima e a lista será atualizada automaticamente.'
                      : 'Se realmente não existir orçamento, crie um novo orçamento e depois volte para a Medida Final.'}
                  </p>
                  {historicosWVetro.length === 0 && (
                    <Link
                      href={`/orcamento-rapido?cliente=${clienteId}&modo=sob-medida&novo=1&origem=medida-final`}
                      className="mt-3 inline-flex items-center justify-center rounded-lg border border-brand-navy px-3 py-2 text-xs font-bold text-brand-navy"
                    >
                      Criar orçamento para Medida Final
                    </Link>
                  )}
                </div>
              )}
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
