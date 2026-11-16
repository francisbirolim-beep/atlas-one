'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock3, History, Loader2, PauseCircle, PlayCircle, Search, ChevronRight, FileDown, Trash2 } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'
import { buscarMedicao, listarItensMedicao } from '@/lib/medicaoFinal'
import { lerAcessoUsuarioConfig } from '@/lib/acessoUsuario'
import { listarPermissoesUsuario, listarSetores } from '@/lib/setores'
import { camposDoItemV2, carregarChecklistMedicaoV2, statusItemChecklistV2, valorRespostaItemV2 } from '@/lib/medicaoChecklistV2'
import { valorValidoChecklist } from '@/lib/medicaoChecklistRegras'
import { medicaoComprovada } from '@/lib/medicaoComprovacao'
import { gerarPdfMedicaoFinal } from '@/lib/medicaoFinalPdf'
import type { MedicaoItem, Usuario } from '@/lib/tipos'
import {
  carregarEstadoParcialMedicao,
  retomarMedicaoParcial,
  salvarMedicaoParcial,
  type EventoHistoricoMedicao,
} from '@/lib/medicaoParcial'

type PecaResumo = {
  id: string
  descricao: string
  tipologia: string
  ambiente: string
  medido: boolean
  iniciado: boolean
  comRegistro: boolean
  pendencias: string[]
  tipoEsquadria: string
  folhas: string
  larguraOrcada: number | null
  alturaOrcada: number | null
  quantidade: number
  ordem: number
  medidoPor: string
  atualizadoEm: string
  status: 'pendente' | 'em_andamento' | 'concluida'
}

function formatarDuracao(ms: number) {
  const totalSegundos = Math.max(0, Math.floor(ms / 1000))
  const horas = Math.floor(totalSegundos / 3600)
  const minutos = Math.floor((totalSegundos % 3600) / 60)
  const segundos = totalSegundos % 60
  return [horas, minutos, segundos].map(valor => String(valor).padStart(2, '0')).join(':')
}

function formatarData(valor: string) {
  return new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function rotuloEvento(evento: EventoHistoricoMedicao) {
  if (evento.tipo === 'inicio') return 'Medição iniciada'
  if (evento.tipo === 'parcial') return 'Medição salva como parcial'
  if (evento.tipo === 'envio') return 'Medição enviada para conferência'
  return 'Medição retomada'
}

function separarDescricao(descricao: string) {
  const partes = descricao.split(/\s+[—–]\s+/)
  if (partes.length < 2) return { tipologia: descricao, ambiente: 'Não informado' }
  return { tipologia: partes.slice(0, -1).join(' — '), ambiente: partes.at(-1) || 'Não informado' }
}

// Miniatura referencial baseada EXCLUSIVAMENTE no tipo e nas folhas do item vendido.
 // Não representa detalhe de montagem nem substitui o croqui técnico aberto na peça.
function MiniCroquiTipologia({ peca }: { peca: PecaResumo }) {
  const texto = `${peca.tipoEsquadria} ${peca.tipologia}`.toLocaleLowerCase('pt-BR')
  const folhasInformadas = peca.folhas.match(/\d+/)?.[0] || peca.descricao.match(/(\d+)\s*folhas?/i)?.[1]
  const folhas = folhasInformadas ? Number(folhasInformadas) : 0
  const qtdFolhas = Number.isInteger(folhas) && folhas >= 1 && folhas <= 8 ? folhas : 0
  const correr = /correr/.test(texto)
  const abrir = !correr && /abrir|pivotante|giro/.test(texto)
  const maximAr = !correr && /maxim|basculante|projetante/.test(texto)
  const dimensoes = peca.larguraOrcada && peca.alturaOrcada
    ? `${peca.larguraOrcada} × ${peca.alturaOrcada} mm · orçamento`
    : qtdFolhas ? `${qtdFolhas} folha(s) cadastrada(s)` : 'Referência da tipologia'
  return (
    <span className="flex w-[88px] shrink-0 flex-col items-center gap-0.5" title="Esquema referencial do item vendido; consulte o croqui técnico ao abrir a peça">
      <svg role="img" aria-label={`Esquema referencial de ${peca.tipologia}, sem escala`}
        viewBox="0 0 88 54" className="h-[48px] w-[84px] rounded-md border border-slate-200 bg-white">
        <rect x="8" y="7" width="72" height="39" fill="#f8fafc" stroke="#475569" strokeWidth="2" />
        {qtdFolhas > 1 && Array.from({ length: qtdFolhas - 1 }, (_, i) =>
          <line key={i} x1={8 + 72 * (i + 1) / qtdFolhas} y1="7" x2={8 + 72 * (i + 1) / qtdFolhas} y2="46" stroke="#64748b" strokeWidth="1.2" />
        )}
        {correr && <><path d="M32 28 H14 M14 28 l5 -4 M14 28 l5 4" stroke="#2563eb" strokeWidth="1.6" fill="none" /><path d="M55 28 H74 M74 28 l-5 -4 M74 28 l-5 4" stroke="#2563eb" strokeWidth="1.6" fill="none" /></>}
        {abrir && <path d="M10 9 L77 44" stroke="#2563eb" strokeWidth="1.4" strokeDasharray="3 2" />}
        {maximAr && <path d="M10 10 L44 34 L78 10" stroke="#2563eb" strokeWidth="1.4" fill="none" />}
        {!qtdFolhas && !correr && !abrir && !maximAr && <text x="44" y="34" fontSize="17" fill="#64748b" textAnchor="middle">?</text>}
      </svg>
      <span className="text-center text-[9px] leading-3 text-slate-500">{dimensoes}</span>
    </span>
  )
}

function itemIniciado(item: MedicaoItem) {
  const medidas = [
    item.largura_baixo_mm, item.largura_meio_mm, item.largura_cima_mm,
    item.altura_direita_mm, item.altura_meio_mm, item.altura_esquerda_mm,
  ]
  return Boolean(
    item.medido ||
    medidas.some(valor => Number(valor) > 0) ||
    item.foto_larguras_url ||
    item.foto_alturas_url ||
    item.observacoes_medicao ||
    (item.campos_extras && Object.keys(item.campos_extras).length > 0)
  )
}

export default function MedicaoParcialPanel({ medicaoId, onSelecionarPeca, modo = 'completo', embedded = false }: { medicaoId: string; onSelecionarPeca?: (itemId: string) => void; modo?: 'completo' | 'controle' | 'lista'; embedded?: boolean }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [pecas, setPecas] = useState<PecaResumo[]>([])
  const [eventos, setEventos] = useState<EventoHistoricoMedicao[]>([])
  const [parcial, setParcial] = useState(false)
  const [encerrada, setEncerrada] = useState(false)
  const [tempoZerado, setTempoZerado] = useState(false)
  const [tempoBase, setTempoBase] = useState(0)
  const [carregadoEm, setCarregadoEm] = useState(Date.now())
  const [agora, setAgora] = useState(Date.now())
  const [carregando, setCarregando] = useState(true)
  const [processando, setProcessando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const [mostrarHistorico, setMostrarHistorico] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroAmbiente, setFiltroAmbiente] = useState('todos')
  const [filtroTipologia, setFiltroTipologia] = useState('todas')
  const [podeRemoverItem, setPodeRemoverItem] = useState(false)
  const [removendoId, setRemovendoId] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const [estado, checklist] = await Promise.all([
      carregarEstadoParcialMedicao(medicaoId),
      carregarChecklistMedicaoV2(medicaoId),
    ])
    const itens = checklist.itens

    const instante = Date.now()
    setEventos(estado.eventos)
    setParcial(estado.parcial)
    setEncerrada(estado.encerrada)
    setTempoZerado(estado.tempoZerado)
    setTempoBase(estado.tempoAtivoMs)
    setCarregadoEm(instante)
    setAgora(instante)
    setPecas(itens.map(item => {
      const descricao = item.descricao || item.tipo_outro_texto || item.tipo_esquadria || 'Peça'
      const partes = separarDescricao(descricao)
      const status = statusItemChecklistV2(item, checklist.campos, checklist.respostas)
      const comRegistro = medicaoComprovada(item)
      const pendencias = camposDoItemV2(checklist.campos, item, checklist.respostas)
        .filter(campo => campo.obrigatorio && !valorValidoChecklist(campo, valorRespostaItemV2(item, campo, checklist.respostas)))
        .map(campo => campo.nome)
      if (!comRegistro) pendencias.unshift('Medidas ou fotos da trena')
      return {
        id: item.id,
        descricao,
        tipologia: partes.tipologia,
        ambiente: item.ambiente?.trim() || partes.ambiente,
        medido: status === 'concluida',
        iniciado: status !== 'pendente',
        comRegistro,
        pendencias,
        tipoEsquadria: item.tipo_esquadria || '',
        folhas: item.folhas || '',
        larguraOrcada: Number(item.orcamento_largura_mm) > 0 ? Number(item.orcamento_largura_mm) : null,
        alturaOrcada: Number(item.orcamento_altura_mm) > 0 ? Number(item.orcamento_altura_mm) : null,
        quantidade: Math.max(1, Number(item.quantidade || 1)),
        ordem: Number(item.ordem || 0),
        medidoPor: item.medido_por_nome || '',
        atualizadoEm: item.medido_em || item.updated_at || '',
        status,
      }
    }))
    setCarregando(false)
  }, [medicaoId])

  useEffect(() => {
    let ativo = true
    void usuarioAtual().then(async usr => {
      if (!ativo) return
      setUsuario(usr)
      if (!usr) {
        setPodeRemoverItem(false)
        return
      }
      if (usr.role === 'master') {
        setPodeRemoverItem(true)
        return
      }
      const [setores, permissoes, config] = await Promise.all([
        listarSetores(),
        listarPermissoesUsuario(usr.id),
        lerAcessoUsuarioConfig(usr),
      ])
      if (!ativo) return
      const setor = setores.find(s => s.rota === '/producao/medicao-final')
      const nivelSetor = setor ? permissoes[setor.id] : 'oculto'
      setPodeRemoverItem(
        nivelSetor === 'edicao' &&
        config.acoes?.['producao.medida_final.remover_item'] === 'edicao'
      )
    }).catch(()=>{if(ativo)setPodeRemoverItem(false)})
    void carregar()
    return () => { ativo = false }
  }, [carregar])

  useEffect(() => {
    const timer = window.setInterval(() => setAgora(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const atualizar = () => void carregar()
    window.addEventListener('atlas-medicao-atualizada', atualizar)
    const timer = window.setInterval(atualizar, 10000)
    return () => { window.clearInterval(timer); window.removeEventListener('atlas-medicao-atualizada', atualizar) }
  }, [carregar])

  const tempoExibido = tempoZerado ? 0 : parcial || !eventos.some(evento => evento.tipo === 'inicio') ? tempoBase : tempoBase + Math.max(0, agora - carregadoEm)
  const feitas = pecas.filter(peca => peca.status === 'concluida').length
  const registradas = pecas.filter(peca => peca.comRegistro).length
  const emAndamento = pecas.filter(peca => peca.status === 'em_andamento').length
  const pendentes = pecas.filter(peca => peca.status === 'pendente').length
  const ultimoEnvioParcial = [...eventos].reverse().find(evento => evento.tipo === 'envio' && evento.pecasMedidas != null)
  const envioParcialAtual = eventos.at(-1)?.tipo === 'envio' && ultimoEnvioParcial?.id === eventos.at(-1)?.id
  const iniciada = eventos.some(evento => evento.tipo === 'inicio')
  const ambientes = useMemo(() => [...new Set(pecas.map(p => p.ambiente))].sort(), [pecas])
  const tipologias = useMemo(() => [...new Set(pecas.map(p => p.tipologia))].sort(), [pecas])
  const pecasFiltradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    return pecas.filter(peca =>
      (!termo || `${peca.tipologia} ${peca.ambiente}`.toLocaleLowerCase('pt-BR').includes(termo)) &&
      (filtroAmbiente === 'todos' || peca.ambiente === filtroAmbiente) &&
      (filtroTipologia === 'todas' || peca.tipologia === filtroTipologia)
    )
  }, [pecas, busca, filtroAmbiente, filtroTipologia])

  async function removerPeca(peca: PecaResumo) {
    if (!podeRemoverItem || removendoId || peca.medido || peca.iniciado) return
    const motivo = window.prompt(
      `Por que “${peca.tipologia}” deve ser removido desta Medição Final?\n\nExemplo: item não foi vendido.`,
      'Item não foi vendido',
    )?.trim() || ''
    if (motivo.length < 3) return
    if (!window.confirm(
      `Remover “${peca.tipologia}” desta Medição Final?\n\nO orçamento/venda original não será apagado. O motivo e o item serão preservados no histórico.`,
    )) return

    setRemovendoId(peca.id)
    setMensagem('')
    setErro('')
    try {
      const token = await tokenAtual()
      const resp = await fetch(`/api/medicao-final/${medicaoId}/itens/${peca.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({ motivo }),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        setErro(json?.error || 'Não foi possível remover o item da Medição Final.')
        return
      }
      setMensagem(json?.mensagem || 'Item removido da Medição Final.')
      await carregar()
      window.dispatchEvent(new CustomEvent('atlas-medicao-atualizada', { detail: { medicaoId } }))
    } catch (e) {
      console.error('Erro ao remover item da Medição Final:', e)
      setErro('Não foi possível remover o item da Medição Final.')
    } finally {
      setRemovendoId(null)
    }
  }

  async function alternarParcial() {
    if (processando || encerrada) return
    setProcessando(true)
    setMensagem('')
    setErro('')
    const resultado = parcial
      ? await retomarMedicaoParcial(medicaoId, usuario)
      : await salvarMedicaoParcial(medicaoId, usuario)
    setProcessando(false)
    if (!resultado.ok) {
      setErro(resultado.mensagem || 'Não foi possível atualizar a medição.')
      return
    }
    setMensagem(parcial
      ? 'Medição retomada. As medidas e fotos registradas continuam salvas.'
      : 'Medição pausada, com medidas e fotos preservadas. Para avisar os responsáveis, use Enviar parcial para conferência no painel de execução.')
    await carregar()
  }

  if (carregando) {
    return <section className={embedded ? "w-full" : "mx-auto w-full max-w-6xl px-3 pt-3 md:px-4"}><div className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" /></section>
  }

  if (modo === 'controle' && embedded) {
    return (
      <section className="h-full">
        <div className="flex h-full min-h-[210px] flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Controle da medição</p>
          <div className="mt-3 flex items-center gap-2">
            <Clock3 size={17} className="text-slate-500" />
            <span className="text-xl font-bold tabular-nums text-slate-900">{formatarDuracao(tempoExibido)}</span>
          </div>
          {tempoZerado && <p className="mt-1 text-[10px] text-slate-500">Cronômetro zerado após o envio. Tempo trabalhado registrado: {formatarDuracao(tempoBase)}.</p>}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-emerald-50 px-2 py-2 text-center"><p className="text-lg font-bold text-emerald-700">{feitas}</p><p className="text-[10px] font-medium text-emerald-700">Concluídas</p></div>
            <div className="rounded-lg bg-blue-50 px-2 py-2 text-center"><p className="text-lg font-bold text-blue-700">{registradas}</p><p className="text-[10px] font-medium text-blue-700">Com registro</p></div>
            <div className="rounded-lg bg-slate-100 px-2 py-2 text-center"><p className="text-lg font-bold text-slate-700">{pendentes}</p><p className="text-[10px] font-medium text-slate-600">Pendentes</p></div>
          </div>
          {envioParcialAtual && ultimoEnvioParcial && <p role="status" className="mt-2 text-[11px] font-medium text-emerald-700">
            Parcial enviada para conferência: {ultimoEnvioParcial.pecasMedidas} peça(s) registradas · {ultimoEnvioParcial.pecasAbertas ?? '—'} em aberto.
          </p>}
          {parcial && !envioParcialAtual && <p className="mt-2 text-[11px] text-amber-700">
            Medição pausada. A pausa não envia as peças: use "Enviar parcial para conferência" no painel de execução.
          </p>}
          <div className="mt-auto pt-4">
            <button type="button" onClick={() => void alternarParcial()} disabled={processando || !iniciada || encerrada} className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 ${parcial ? 'bg-blue-700 hover:bg-blue-800' : 'bg-amber-600 hover:bg-amber-700'}`}>
              {processando ? <Loader2 size={14} className="animate-spin" /> : parcial ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
              {encerrada ? 'Medição enviada' : parcial ? 'Retomar medição' : 'Salvar medição parcial'}
            </button>
            {!iniciada && <p className="mt-1.5 text-[10px] text-slate-500">Inicie a medição antes de salvar como parcial.</p>}
          </div>
          <details className="pt-3"><summary className="cursor-pointer text-xs font-semibold text-slate-500">Histórico da medição</summary>
            <div className="mt-2">
              <button type="button" onClick={() => setMostrarHistorico(valor => !valor)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                <History size={14} /> {mostrarHistorico ? 'Ocultar histórico' : 'Ver histórico'}
              </button>
            </div>
            {mostrarHistorico && <div className="mt-2 space-y-2">{[...eventos].reverse().map(evento => <p key={evento.id} className="text-xs text-slate-600">{rotuloEvento(evento)} · {formatarData(evento.data)} · {evento.usuario || "—"}</p>)}</div>}
          </details>
          {mensagem && <p role="status" className="mt-2 text-xs text-emerald-700">{mensagem}</p>}
          {erro && <p role="alert" className="mt-2 text-xs text-red-700">{erro}</p>}
        </div>
      </section>
    )
  }

  return (
    <>
      {modo !== 'lista' && <section className={embedded ? "w-full" : "mx-auto w-full max-w-6xl px-3 pt-3 md:px-4"}>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="p-3 md:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Controle da medição</p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900"><Clock3 size={16} /> {formatarDuracao(tempoExibido)}</span>
                  <span className="text-xs text-emerald-700">✓ {feitas} concluída(s)</span>
                  <span className="text-xs text-blue-700">◐ {emAndamento} em andamento</span>
                  <span className="text-xs text-slate-500">○ {pendentes} pendente(s)</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">O relógio zera quando a medição é enviada, mas o tempo trabalhado fica no histórico.{tempoZerado ? ` Total registrado: ${formatarDuracao(tempoBase)}.` : ''}</p>
                {ultimoEnvioParcial && <p className="mt-1 text-xs font-medium text-emerald-700">Último envio parcial: {ultimoEnvioParcial.pecasMedidas} peça(s) documentada(s) e {ultimoEnvioParcial.pecasAbertas ?? '—'} em aberto · {formatarData(ultimoEnvioParcial.data)}</p>}
                {parcial && !envioParcialAtual && <p className="mt-1 text-xs text-amber-700">Pausada, mas ainda não enviada aos responsáveis. Encaminhe pelo painel de execução.</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setMostrarHistorico(valor => !valor)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                  <History size={14} /> Histórico
                </button>
                <button type="button" onClick={() => void alternarParcial()} disabled={processando || !iniciada || encerrada} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 ${parcial ? 'bg-blue-700 hover:bg-blue-800' : 'bg-amber-600 hover:bg-amber-700'}`}>
                  {processando ? <Loader2 size={14} className="animate-spin" /> : parcial ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
                  {encerrada ? 'Medição enviada' : parcial ? 'Retomar medição' : 'Salvar medição parcial'}
                </button>
              </div>
            </div>
            {parcial && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">Medição parcial: o que já foi medido está preservado. Quando o restante for liberado, clique em “Retomar medição”.</div>}
            {mostrarHistorico && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Histórico da medição</p>
                <div className="mt-2 space-y-2">
                  {[...eventos].reverse().map(evento => (
                    <div key={evento.id} className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-slate-700">{rotuloEvento(evento)}</p><span className="text-[10px] text-slate-400">{formatarData(evento.data)}</span></div>
                      {(evento.pecasMedidas != null || evento.pecasAbertas != null) && <p className="mt-0.5 text-[11px] text-slate-500">{evento.pecasMedidas ?? 0} feita(s) · {evento.pecasAbertas ?? 0} em aberto</p>}
                      {evento.usuario && <p className="text-[10px] text-slate-400">Por {evento.usuario}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {mensagem && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{mensagem}</p>}
            {erro && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>}
          </div>
        </div>
      </section>}

      {modo !== 'controle' && <section className="mx-auto w-full max-w-6xl px-3 pt-3 md:px-4">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="p-3 md:p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.04em] text-slate-800">Lista de tipologias da obra</p>
                <p className="mt-0.5 text-xs text-slate-500">Visualize e acesse o checklist técnico de cada tipologia</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-medium text-slate-500">{pecas.length} tipologia(s) · {registradas} com medição registrada · {feitas} checklist(s) concluído(s) · {pendentes} pendente(s)</span>
                <button type="button" onClick={async () => {
                  const medicao = await buscarMedicao(medicaoId)
                  if (!medicao) {
                    setErro('Não foi possível carregar a Medição Final para gerar o PDF.')
                    return
                  }
                  await gerarPdfMedicaoFinal(medicao, await listarItensMedicao(medicaoId))
                }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <FileDown size={14} /> Exportar PDF da Medição
                </button>
              </div>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_180px_180px]">
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"><Search size={15} className="text-slate-400" /><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar tipologia, ambiente..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
              <select value={filtroAmbiente} onChange={e => setFiltroAmbiente(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><option value="todos">Todos os ambientes</option>{ambientes.map(a => <option key={a} value={a}>{a}</option>)}</select>
              <select value={filtroTipologia} onChange={e => setFiltroTipologia(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><option value="todas">Todas as tipologias</option>{tipologias.map(t => <option key={t} value={t}>{t}</option>)}</select>
            </div>

            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
              <div className="hidden min-w-[860px] grid-cols-[46px_1.7fr_1fr_90px_130px_140px_24px] items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 md:grid"><span>#</span><span>Croqui / tipologia</span><span>Ambiente</span><span className="text-center">Quantidade</span><span>Status</span><span>Medido por / atualização</span><span /></div>
              {pecasFiltradas.map((peca) => {
                const status = peca.medido ? 'Concluída' : peca.comRegistro ? 'Registrada · conferir' : peca.iniciado ? 'Em andamento' : 'Pendente'
                const podeRemoverPeca = podeRemoverItem && !peca.medido && !peca.iniciado
                return (
                  <div key={peca.id} className="relative border-b border-slate-100 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => onSelecionarPeca?.(peca.id)}
                      className={`grid w-full min-w-0 grid-cols-[38px_1fr_auto] items-center gap-2 px-3 py-3 text-left transition hover:bg-slate-50 md:grid-cols-[46px_1.7fr_1fr_90px_130px_140px_24px] ${podeRemoverPeca ? 'pr-14 md:pr-14' : ''}`}
                    >
                      <span className="text-xs font-bold text-slate-500">{String(pecas.findIndex(p => p.id === peca.id) + 1).padStart(2, '0')}</span>
                      <span className="flex min-w-0 items-center gap-2">
                        <MiniCroquiTipologia peca={peca} />
                        <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-800">{peca.tipologia}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-slate-400">{peca.descricao !== peca.tipologia ? peca.descricao : ''}</span>
                        {peca.pendencias.length > 0 && <span title={peca.pendencias.join(', ')} className="mt-0.5 block truncate text-[11px] text-amber-700">Falta conferir: {peca.pendencias.join(', ')}</span>}
                        <span className="block text-[11px] text-slate-400 md:hidden">{peca.ambiente}</span></span>
                      </span>
                      <span className="hidden text-xs text-slate-600 md:block">{peca.ambiente}</span>
                      <span className="hidden text-center text-xs text-slate-600 md:block">{peca.quantidade}</span>
                      <span className={`hidden w-fit rounded-full px-2 py-1 text-[11px] font-semibold md:inline-flex ${peca.medido ? 'bg-emerald-50 text-emerald-700' : peca.comRegistro ? 'bg-amber-50 text-amber-800' : peca.iniciado ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{status}</span>
                      <span className="hidden text-xs text-slate-500 md:block">{peca.medidoPor ? <><span className="font-medium text-slate-700">{peca.medidoPor}</span>{peca.atualizadoEm && <span className="block text-[10px] text-slate-400">{formatarData(peca.atualizadoEm)}</span>}</> : '—'}</span>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold md:hidden ${peca.medido ? 'bg-emerald-50 text-emerald-700' : peca.comRegistro ? 'bg-amber-50 text-amber-800' : peca.iniciado ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{status}</span>
                      <ChevronRight size={16} className="hidden text-slate-400 md:block" />
                    </button>
                    {podeRemoverPeca && (
                      <button
                        type="button"
                        title="Remover item da Medição Final"
                        aria-label={`Remover ${peca.tipologia} da Medição Final`}
                        disabled={Boolean(removendoId)}
                        onClick={e => { e.stopPropagation(); void removerPeca(peca) }}
                        className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-lg border border-red-200 bg-white p-2 text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50"
                      >
                        {removendoId === peca.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      </button>
                    )}
                  </div>
                )
              })}
              {pecasFiltradas.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-400">Nenhuma tipologia encontrada com estes filtros.</p>}
            </div>
          </div>
        </div>
      </section>}
    </>
  )
}
