'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, ArrowLeft, Check, ChevronLeft, ChevronRight, FileText, Loader2, Menu,
  Pencil, Plus, Ruler, Send, ShieldCheck, Trash2, X
} from 'lucide-react'
import type { MedicaoFinal, MedicaoItem, TipoEsquadria, Tipologia, Usuario } from '@/lib/tipos'
import {
  adicionarItemMedicao,
  definirUsoContramarco,
  editarItemMedicao,
  removerItemMedicao,
  salvarMedidaItem as salvarMedidaItemApi,
  verificarFluxoVendaOrcamento,
  type DadosMedidaItem,
} from '@/lib/medicaoFinal'
import { listarTipologias } from '@/lib/tipologias'
import { gerarPdfMedicaoFinal } from '@/lib/medicaoFinalPdf'
import { supabase } from '@/lib/supabase'
import { tokenAtual } from '@/lib/auth'

type Tela = 'lista' | 'medicao' | 'resumo'

function nomeTipo(item: MedicaoItem, tipos: Tipologia[]) {
  if (item.tipo_esquadria === 'outro') return item.tipo_outro_texto || item.descricao || 'Outro'
  return tipos.find(t => t.chave === item.tipo_esquadria)?.label || item.descricao || item.tipo_esquadria
}

function IconeTipologia({ tipo }: { tipo: string }) {
  return (
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
      <svg viewBox="0 0 36 36" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="30" height="30" rx="2" />
        {tipo.includes('correr') ? (
          <>
            <line x1="18" y1="3" x2="18" y2="33" />
            <path d="M10 18H5m0 0 3-3m-3 3 3 3M26 18h5m0 0-3-3m3 3-3 3" />
          </>
        ) : tipo.includes('porta') ? (
          <>
            <line x1="7" y1="3" x2="7" y2="33" />
            <path d="M7 4 29 30" strokeDasharray="2 2" />
          </>
        ) : (
          <>
            <line x1="18" y1="3" x2="18" y2="33" />
            <line x1="3" y1="18" x2="33" y2="18" />
          </>
        )}
      </svg>
    </div>
  )
}

export default function ContramarcoFlow({
  medicao,
  itensIniciais,
  usuario,
  embedded = false,
}: {
  medicao: MedicaoFinal
  itensIniciais: MedicaoItem[]
  usuario: Usuario | null
  embedded?: boolean
}) {
  const [itens, setItens] = useState<MedicaoItem[]>(itensIniciais)
  const [tipos, setTipos] = useState<Tipologia[]>([])
  const [tela, setTela] = useState<Tela>(
    medicao.status_operacional === 'aguardando_conferencia' || medicao.status_operacional === 'contramarco_aprovado'
      ? 'resumo'
      : 'lista'
  )
  const [indice, setIndice] = useState(0)
  const [orcamentoNumero, setOrcamentoNumero] = useState<string>('')
  const [fluxoVendaAtivo, setFluxoVendaAtivo] = useState<boolean | null>(medicao.orcamento_id ? null : true)
  const [colunaComercial, setColunaComercial] = useState<string | null>(null)
  const [statusOperacional, setStatusOperacional] = useState(String(medicao.status_operacional || ''))
  const [processandoFluxo, setProcessandoFluxo] = useState(false)
  const [mensagemFluxo, setMensagemFluxo] = useState('')
  const [erroFluxo, setErroFluxo] = useState('')

  const [modalItem, setModalItem] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [formTipo, setFormTipo] = useState<TipoEsquadria>('porta_correr')
  const [formTipoOutro, setFormTipoOutro] = useState('')
  const [formAmbiente, setFormAmbiente] = useState('')
  const [formDescricao, setFormDescricao] = useState('')
  const [formQuantidade, setFormQuantidade] = useState(1)
  const [salvandoItem, setSalvandoItem] = useState(false)

  const [vaoLargura, setVaoLargura] = useState('')
  const [vaoAltura, setVaoAltura] = useState('')
  const [folgaLargura, setFolgaLargura] = useState('')
  const [folgaAltura, setFolgaAltura] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [salvandoMedida, setSalvandoMedida] = useState(false)
  const [salvandoUso, setSalvandoUso] = useState<string | null>(null)
  const [decisaoUso, setDecisaoUso] = useState<'sim' | 'nao' | ''>('')

  useEffect(() => setItens(itensIniciais), [itensIniciais])

  useEffect(() => {
    void listarTipologias().then(setTipos)
    if (!medicao.orcamento_id) return

    void verificarFluxoVendaOrcamento(medicao.orcamento_id).then(fluxo => {
      setFluxoVendaAtivo(fluxo.ativo)
      setColunaComercial(fluxo.colunaComercial)
    })

    void supabase
      .from('orcamentos')
      .select('numero,wvetro_fluxo')
      .eq('id', medicao.orcamento_id)
      .maybeSingle()
      .then(({ data }) => {
        const numeroWvetro = String((data as any)?.wvetro_fluxo?.numero || '').trim()
        setOrcamentoNumero(numeroWvetro || String((data as any)?.numero || ''))
      })
  }, [medicao.orcamento_id])

  const atual = itens[indice] || null
  const revisados = itens.filter(i => i.medido).length
  const comContramarco = itens.filter(i => i.medido && i.contramarco !== 'nao' && i.producao_largura_mm && i.producao_altura_mm).length
  const semContramarco = itens.filter(i => i.medido && i.contramarco === 'nao').length
  const pendentes = itens.length - revisados
  const producaoLargura = Math.max(0, (Number(vaoLargura) || 0) - (Number(folgaLargura) || 0))
  const producaoAltura = Math.max(0, (Number(vaoAltura) || 0) - (Number(folgaAltura) || 0))
  const origemLabel = orcamentoNumero ? `Orçamento #${orcamentoNumero}` : 'Sem orçamento'
  const fluxoVendaBloqueado = Boolean(medicao.orcamento_id) && fluxoVendaAtivo === false
  const aguardandoConferencia = statusOperacional === 'aguardando_conferencia' || itens.some(i => i.status_medicao === 'aguardando_conferencia')
  const contramarcoAprovado = statusOperacional === 'contramarco_aprovado'
  const master = usuario?.role === 'master'
  const voltarHref = medicao.cliente_id
    ? `/producao/medicao-final/cliente/${medicao.cliente_id}`
    : '/producao/medicao-final'

  function carregarPosicao(pos: number) {
    const item = itens[pos]
    if (!item) return
    setIndice(pos)
    setVaoLargura(item.vao_largura_mm != null ? String(item.vao_largura_mm) : '')
    setVaoAltura(item.vao_altura_mm != null ? String(item.vao_altura_mm) : '')
    setFolgaLargura(item.folga_largura_mm != null ? String(item.folga_largura_mm) : '')
    setFolgaAltura(item.folga_altura_mm != null ? String(item.folga_altura_mm) : '')
    setObservacoes(item.observacoes_medicao || '')
    setDecisaoUso(item.contramarco === 'nao' ? 'nao' : item.contramarco === 'sim' || (item.producao_largura_mm && item.producao_altura_mm) ? 'sim' : '')
    setTela('medicao')
  }

  function iniciarMedicao() {
    if (!itens.length) return
    const pendente = itens.findIndex(i => !i.medido)
    if (pendente < 0) {
      setTela('resumo')
      return
    }
    carregarPosicao(pendente)
  }

  function abrirNovo() {
    setEditandoId(null)
    setFormTipo('porta_correr')
    setFormTipoOutro('')
    setFormAmbiente('')
    setFormDescricao('')
    setFormQuantidade(1)
    setModalItem(true)
  }

  function abrirEditar(item: MedicaoItem) {
    setEditandoId(item.id)
    setFormTipo(item.tipo_esquadria as TipoEsquadria)
    setFormTipoOutro(item.tipo_outro_texto || '')
    setFormAmbiente(item.ambiente || '')
    setFormDescricao(item.descricao || '')
    setFormQuantidade(item.quantidade || 1)
    setModalItem(true)
  }

  async function salvarItem() {
    if (!formAmbiente.trim()) {
      alert('Informe o ambiente.')
      return
    }
    if (formTipo === 'outro' && !formTipoOutro.trim()) {
      alert('Informe qual é a tipologia.')
      return
    }

    setSalvandoItem(true)
    const outro = formTipo === 'outro' ? formTipoOutro.trim() : null
    const descricao = formDescricao.trim() || (formTipo === 'outro'
      ? formTipoOutro.trim()
      : tipos.find(t => t.chave === formTipo)?.label || String(formTipo))

    if (editandoId) {
      const ok = await editarItemMedicao(editandoId, {
        tipo_esquadria: formTipo,
        tipo_outro_texto: outro,
        ambiente: formAmbiente.trim(),
        descricao,
        quantidade: Math.max(1, formQuantidade),
      })
      if (ok) {
        setItens(prev => prev.map(i => i.id === editandoId ? {
          ...i,
          tipo_esquadria: formTipo,
          tipo_outro_texto: outro,
          ambiente: formAmbiente.trim(),
          descricao,
          quantidade: Math.max(1, formQuantidade),
        } : i))
      }
    } else {
      const criado = await adicionarItemMedicao(
        medicao.id,
        formTipo,
        outro,
        descricao,
        Math.max(1, formQuantidade),
        formAmbiente.trim(),
      )
      if (criado) setItens(prev => [...prev, criado])
    }
    setSalvandoItem(false)
    setModalItem(false)
  }

  async function excluir(item: MedicaoItem) {
    if (!window.confirm(`Remover ${item.ambiente || 'esta posição'} da medição?`)) return
    if (await removerItemMedicao(item.id)) {
      setItens(prev => prev.filter(i => i.id !== item.id))
    }
  }

  function avancarDepois(pos: number, novos: MedicaoItem[]) {
    if (pos < novos.length - 1) {
      const prox = pos + 1
      const item = novos[prox]
      setIndice(prox)
      setVaoLargura(item.vao_largura_mm != null ? String(item.vao_largura_mm) : '')
      setVaoAltura(item.vao_altura_mm != null ? String(item.vao_altura_mm) : '')
      setFolgaLargura(item.folga_largura_mm != null ? String(item.folga_largura_mm) : '')
      setFolgaAltura(item.folga_altura_mm != null ? String(item.folga_altura_mm) : '')
      setObservacoes(item.observacoes_medicao || '')
      setDecisaoUso(item.contramarco === 'nao' ? 'nao' : item.contramarco === 'sim' || (item.producao_largura_mm && item.producao_altura_mm) ? 'sim' : '')
      setTela('medicao')
    } else {
      setTela('resumo')
    }
  }

  async function escolherUso(item: MedicaoItem, pos: number, usar: boolean, avancar = false) {
    if (salvandoUso) return
    setSalvandoUso(item.id)
    const ok = await definirUsoContramarco(item.id, usar, usuario)
    setSalvandoUso(null)
    if (!ok) {
      alert('Não foi possível salvar a decisão de contramarco.')
      return
    }

    const atualizado: MedicaoItem = usar
      ? {
          ...item,
          contramarco: 'sim',
          medido: false,
          status_medicao: 'rascunho',
          medido_em: null,
          medido_por_id: null,
          medido_por_nome: null,
        }
      : {
          ...item,
          contramarco: 'nao',
          vao_largura_mm: null,
          vao_altura_mm: null,
          folga_largura_mm: null,
          folga_altura_mm: null,
          producao_largura_mm: null,
          producao_altura_mm: null,
          medido: true,
          status_medicao: 'concluida',
          medido_em: new Date().toISOString(),
          medido_por_id: usuario?.id || null,
          medido_por_nome: usuario?.nome || null,
        }

    const novos = itens.map(i => i.id === item.id ? atualizado : i)
    setItens(novos)
    setIndice(pos)
    setDecisaoUso(usar ? 'sim' : 'nao')

    if (usar) {
      setVaoLargura(atualizado.vao_largura_mm != null ? String(atualizado.vao_largura_mm) : '')
      setVaoAltura(atualizado.vao_altura_mm != null ? String(atualizado.vao_altura_mm) : '')
      setFolgaLargura(atualizado.folga_largura_mm != null ? String(atualizado.folga_largura_mm) : '')
      setFolgaAltura(atualizado.folga_altura_mm != null ? String(atualizado.folga_altura_mm) : '')
      setObservacoes(atualizado.observacoes_medicao || '')
      setTela('medicao')
    } else if (avancar) {
      avancarDepois(pos, novos)
    }
  }

  async function salvarEAvancar() {
    if (!atual || salvandoMedida) return
    if (decisaoUso !== 'sim') {
      alert('Selecione “Usar contramarco” para informar as medidas, ou “Não usar” para pular este item.')
      return
    }
    const vaoL = Number(vaoLargura)
    const vaoA = Number(vaoAltura)
    const folgaL = Number(folgaLargura)
    const folgaA = Number(folgaAltura)

    if (!Number.isFinite(vaoL) || vaoL <= 0 || !Number.isFinite(vaoA) || vaoA <= 0) {
      alert('Informe a largura e a altura do vão.')
      return
    }
    if (folgaLargura === '' || folgaAltura === '' || folgaL < 0 || folgaA < 0) {
      alert('Informe a folga da largura e da altura. Use 0 quando não houver folga.')
      return
    }
    if (producaoLargura <= 0 || producaoAltura <= 0) {
      alert('A folga não pode ser maior ou igual à medida do vão.')
      return
    }

    const dados: DadosMedidaItem = {
      largura_baixo_mm: null,
      largura_meio_mm: null,
      largura_cima_mm: null,
      altura_direita_mm: null,
      altura_meio_mm: null,
      altura_esquerda_mm: null,
      vao_largura_mm: vaoL,
      vao_altura_mm: vaoA,
      folga_largura_mm: folgaL,
      folga_altura_mm: folgaA,
      producao_largura_mm: producaoLargura,
      producao_altura_mm: producaoAltura,
      referencia_vista: null,
      contramarco: 'sim',
      cadeirinha: null,
      observacoes_medicao: observacoes.trim() || null,
      foto_larguras_url: null,
      foto_alturas_url: null,
      campos_extras: {},
    }

    setSalvandoMedida(true)
    const ok = await salvarMedidaItemApi(atual.id, dados, usuario)
    setSalvandoMedida(false)
    if (!ok) {
      alert('Não foi possível salvar esta medida.')
      return
    }

    const atualizado: MedicaoItem = {
      ...atual,
      ...dados,
      medido: true,
      status_medicao: 'concluida',
      medido_em: new Date().toISOString(),
      medido_por_nome: usuario?.nome || null,
    }
    const novos = itens.map(i => i.id === atual.id ? atualizado : i)
    setItens(novos)

    avancarDepois(indice, novos)
  }

  async function chamarConferencia(action: 'enviar' | 'aprovar' | 'sincronizar_contramarco', itemId?: string) {
    const token = await tokenAtual()
    if (!token) return { ok: false, error: 'Sua sessão expirou. Entre novamente no Atlas.' }

    const resp = await fetch(`/api/medicao-final/${medicao.id}/conferencia`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, itemId }),
    })
    const json = await resp.json().catch(() => ({}))
    return { ...json, ok: resp.ok && json?.ok !== false }
  }

  async function enviarParaConferencia() {
    if (processandoFluxo || pendentes > 0) return
    if (fluxoVendaBloqueado) {
      setErroFluxo('Confirme a venda e envie o orçamento para o fluxo Vendido antes de enviar os contramarcos.')
      return
    }
    if (!window.confirm('Enviar a medição de contramarcos para conferência e liberação?')) return

    setProcessandoFluxo(true)
    setErroFluxo('')
    setMensagemFluxo('')
    const r = await chamarConferencia('enviar')
    setProcessandoFluxo(false)

    if (!r.ok) {
      setErroFluxo(r.error || 'Não foi possível enviar a medição de contramarcos.')
      return
    }

    setItens(prev => prev.map(item => (
      item.medido && item.status_medicao === 'concluida'
        ? { ...item, status_medicao: 'aguardando_conferencia' }
        : item
    )))
    setStatusOperacional('aguardando_conferencia')
    setMensagemFluxo('Medição enviada. Ela está aguardando conferência/liberação.')
    setTela('resumo')
    window.setTimeout(() => { window.location.href = '/producao/medicao-final' }, 650)
  }

  async function aprovarContramarcos() {
    if (!master || processandoFluxo) return
    const paraAprovar = itens.filter(item => item.medido && item.status_medicao === 'aguardando_conferencia')
    if (!paraAprovar.length) return
    if (!window.confirm(`Aprovar ${paraAprovar.length} posição(ões) de contramarco e liberar as ordens de produção quando o Projeto já estiver conferido?`)) return

    setProcessandoFluxo(true)
    setErroFluxo('')
    setMensagemFluxo('')

    for (const item of paraAprovar) {
      const r = await chamarConferencia('aprovar', item.id)
      if (!r.ok) {
        setProcessandoFluxo(false)
        setErroFluxo(r.error || `Não foi possível aprovar ${item.ambiente || item.descricao || 'uma posição'}.`)
        return
      }
    }

    setItens(prev => prev.map(item => (
      item.medido && item.status_medicao === 'aguardando_conferencia'
        ? { ...item, status_medicao: 'aprovada' }
        : item
    )))
    setStatusOperacional('contramarco_aprovado')

    const sincronizacao = await chamarConferencia('sincronizar_contramarco')
    setProcessandoFluxo(false)

    if (sincronizacao.ok) {
      setMensagemFluxo(`Contramarcos aprovados e Produção atualizada: ${sincronizacao.liberadas || 0} ordem(ns) liberada(s).`)
    } else if (sincronizacao.code === 'PROJETO_NAO_CONFERIDO') {
      setMensagemFluxo('Contramarcos aprovados. O card de Produção será ligado assim que o Projeto for conferido.')
    } else {
      setErroFluxo(sincronizacao.error || 'Contramarcos aprovados, mas a sincronização com Produção ficou pendente.')
    }
  }

  const resumo = useMemo(() => itens.map((item, pos) => ({
    item,
    pos,
    tipo: nomeTipo(item, tipos),
  })), [itens, tipos])

  return (
    <div className={embedded ? 'bg-transparent pb-6' : 'min-h-screen bg-slate-50 pb-24'}>
      {!embedded && (
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
            <button
              type="button"
              onClick={() => {
                if (tela === 'lista') window.location.href = voltarHref
                else setTela('lista')
              }}
              className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600"
            >
              <ArrowLeft size={19} />
            </button>
            <div className="flex flex-1 items-center gap-2">
              <img src="/logo.png" alt="" className="h-7 w-7 object-contain" />
              <div className="min-w-0">
                <p className="truncate text-xs font-bold uppercase tracking-[.12em] text-slate-400">Esquadrifácio</p>
                <h1 className="truncate text-lg font-black text-slate-900">
                  {tela === 'resumo' ? 'Resumo da medição de contramarcos' : 'Contramarco'}
                </h1>
              </div>
            </div>
            <Menu size={20} className="text-slate-600" />
          </div>
        </header>
      )}

      {embedded && (
        <div className="mx-auto max-w-3xl px-4 pt-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
            <p className="text-xs font-black uppercase tracking-[.12em] text-emerald-700">Medição de Contramarco</p>
            <p className="mt-1 text-sm font-bold text-slate-900">1 largura + 1 altura do vão, com desconto das folgas.</p>
            <p className="mt-1 text-xs text-slate-600">Este fluxo não usa 3 larguras, 3 alturas, foto da trena ou croqui técnico.</p>
          </div>
        </div>
      )}

      {tela === 'lista' && (
        <main className="mx-auto max-w-3xl px-4 py-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-700">{origemLabel}</p>
              <p className="text-xs text-slate-500">Para cada item, informe se será usado contramarco.</p>
            </div>
            <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{revisados}/{itens.length} definidos</span>
          </div>

          {fluxoVendaBloqueado && medicao.orcamento_id && (
            <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-sm font-black text-amber-900">
                    <AlertTriangle size={16} /> Fora do fluxo Vendido
                  </p>
                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    Este orçamento ainda não possui uma Venda operacional no Atlas
                    {colunaComercial ? ` e está em “${colunaComercial}”` : ''}.
                    A medição fica preservada, mas não libera Produção até a venda ser confirmada.
                  </p>
                </div>
                <Link
                  href={`/vendas/confirmar?orcamento=${encodeURIComponent(medicao.orcamento_id)}&origem=medicao-final`}
                  className="inline-flex shrink-0 items-center justify-center rounded-xl bg-amber-900 px-4 py-2.5 text-xs font-black text-white"
                >
                  Enviar para o fluxo / Vendido
                </Link>
              </div>
            </div>
          )}

          <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
            <b>Revise item por item.</b>
            <p className="mt-1 text-xs">Se usar contramarco, informe as medidas do vão e as folgas. Se não usar, marque “Não usar” e siga para o próximo.</p>
          </div>

          {fluxoVendaBloqueado && medicao.orcamento_id && (
            <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
              <p className="flex items-center gap-2 text-sm font-black text-amber-900"><AlertTriangle size={16} /> Falta confirmar a venda</p>
              <p className="mt-1 text-xs text-amber-800">As medidas estão salvas. Para enviar ao Kanban de liberação e liberar Produção, coloque este orçamento no fluxo Vendido.</p>
              <Link href={`/vendas/confirmar?orcamento=${encodeURIComponent(medicao.orcamento_id)}&origem=medicao-final`} className="mt-3 inline-flex rounded-xl bg-amber-900 px-4 py-2.5 text-xs font-black text-white">Enviar para o fluxo / Vendido</Link>
            </div>
          )}

          {mensagemFluxo && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">{mensagemFluxo}</div>}
          {erroFluxo && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{erroFluxo}</div>}

          {aguardandoConferencia && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-black text-amber-900">Aguardando conferência/liberação</p>
              <p className="mt-1 text-xs text-amber-800">A medição já foi enviada. Um usuário Master pode conferir e liberar os contramarcos.</p>
            </div>
          )}

          {contramarcoAprovado && (
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-black text-emerald-900">Contramarcos aprovados</p>
              <p className="mt-1 text-xs text-emerald-800">As ordens de Produção usam as medidas aprovadas quando o Projeto já estiver conferido.</p>
            </div>
          )}

          <div className="mb-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-2 py-2">
              <p className="text-lg font-black text-emerald-700">{comContramarco}</p>
              <p className="text-[10px] font-bold uppercase text-emerald-700">Medidos</p>
            </div>
            <div className="rounded-xl border border-red-100 bg-red-50 px-2 py-2">
              <p className="text-lg font-black text-red-700">{semContramarco}</p>
              <p className="text-[10px] font-bold uppercase text-red-700">Não usam</p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-2 py-2">
              <p className="text-lg font-black text-amber-700">{pendentes}</p>
              <p className="text-[10px] font-bold uppercase text-amber-700">Pendentes</p>
            </div>
          </div>

          <button
            onClick={abrirNovo}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm"
          >
            <Plus size={17} /> Adicionar tipologia
          </button>

          <div className="space-y-3">
            {itens.map((item, pos) => {
              const usa = item.contramarco === 'sim'
              const naoUsa = item.contramarco === 'nao'
              const medidoComContramarco = Boolean(item.medido && usa && item.producao_largura_mm && item.producao_altura_mm)
              const temMedidaOrcamento = Number(item.orcamento_largura_mm) > 0 || Number(item.orcamento_altura_mm) > 0
              return (
                <div key={item.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${medidoComContramarco ? 'border-emerald-200' : naoUsa ? 'border-red-200' : 'border-slate-200'}`}>
                  <div className="flex items-start gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-blue-200 bg-blue-50 text-xs font-black text-blue-700">
                      {pos + 1}
                    </span>
                    <IconeTipologia tipo={item.tipo_esquadria} />
                    <button onClick={() => carregarPosicao(pos)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-black text-slate-900">{nomeTipo(item, tipos)}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">Ambiente: {item.ambiente || '—'}</p>
                      <p className="text-xs text-slate-500">Quantidade: {item.quantidade || 1} unidade{(item.quantidade || 1) > 1 ? 's' : ''}</p>
                    </button>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => abrirEditar(item)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><Pencil size={14} /></button>
                      <button onClick={() => excluir(item)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Medidas no orçamento</p>
                    <p className="mt-1 text-xs font-bold text-slate-600">
                      {temMedidaOrcamento
                        ? `Largura: ${item.orcamento_largura_mm || '—'} mm · Altura: ${item.orcamento_altura_mm || '—'} mm`
                        : 'Medida não informada no orçamento'}
                    </p>
                  </div>

                  {medidoComContramarco && (
                    <button onClick={() => carregarPosicao(pos)} className="mt-3 flex w-full items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-left">
                      <span>
                        <span className="block text-[10px] font-black uppercase text-emerald-700">Contramarco medido</span>
                        <span className="mt-0.5 block text-xs font-semibold text-emerald-800">Produção: {item.producao_largura_mm} × {item.producao_altura_mm} mm</span>
                      </span>
                      <ChevronRight size={17} className="text-emerald-700" />
                    </button>
                  )}

                  {naoUsa && (
                    <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5">
                      <p className="text-xs font-black text-red-700">Não usa contramarco</p>
                      <p className="mt-0.5 text-[11px] text-red-600">Esta posição foi revisada e será pulada na produção de contramarcos.</p>
                    </div>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        carregarPosicao(pos)
                        setDecisaoUso('sim')
                      }}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-black ${usa && !naoUsa ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'}`}
                    >
                      <Check size={14} /> Usar contramarco
                    </button>
                    <button
                      onClick={() => void escolherUso(item, pos, false, false)}
                      disabled={salvandoUso === item.id}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-black disabled:opacity-50 ${naoUsa ? 'border-red-300 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-600'}`}
                    >
                      {salvandoUso === item.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Não usar
                    </button>
                  </div>
                </div>
              )
            })}

            {!itens.length && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <Ruler size={28} className="mx-auto text-slate-300" />
                <p className="mt-3 text-sm font-bold text-slate-700">Nenhuma tipologia adicionada</p>
                <p className="mt-1 text-xs text-slate-500">Cadastre ambiente, tipologia e quantidade para começar.</p>
              </div>
            )}
          </div>

          <button
            onClick={iniciarMedicao}
            disabled={!itens.length}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-black text-white shadow-sm disabled:opacity-40"
          >
            {pendentes > 0 ? 'Continuar revisão dos itens' : 'Ver resumo e gerar PDF'} <ChevronRight size={17} />
          </button>
        </main>
      )}

      {tela === 'medicao' && atual && (
        <main className="mx-auto max-w-3xl px-4 py-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <IconeTipologia tipo={atual.tipo_esquadria} />
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900">{nomeTipo(atual, tipos)}</p>
                <p className="truncate text-xs text-slate-500">Ambiente: {atual.ambiente || '—'} · Quantidade: {atual.quantidade || 1}</p>
              </div>
            </div>
            <span className="shrink-0 text-xs font-bold text-slate-500">{indice + 1} de {itens.length}</span>
          </div>

          <div className="mb-4 rounded-xl bg-slate-100 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Medidas no orçamento</p>
            <p className="mt-1 text-sm font-bold text-slate-700">
              {Number(atual.orcamento_largura_mm) > 0 || Number(atual.orcamento_altura_mm) > 0
                ? `Largura: ${atual.orcamento_largura_mm || '—'} mm · Altura: ${atual.orcamento_altura_mm || '—'} mm`
                : 'Medida não informada no orçamento'}
            </p>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-black text-slate-900">Uso de contramarco</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => setDecisaoUso('sim')}
                className={`rounded-xl border p-4 text-left ${decisaoUso === 'sim' ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-300' : 'border-slate-200 bg-white'}`}
              >
                <div className="flex items-center gap-2 text-sm font-black text-slate-900"><Check size={16} className="text-emerald-600" /> Usar contramarco</div>
                <p className="mt-1 text-xs text-slate-500">Informar as medidas do vão e a folga para calcular a medida de produção.</p>
              </button>
              <button
                onClick={() => setDecisaoUso('nao')}
                className={`rounded-xl border p-4 text-left ${decisaoUso === 'nao' ? 'border-red-400 bg-red-50 ring-1 ring-red-200' : 'border-slate-200 bg-white'}`}
              >
                <div className="flex items-center gap-2 text-sm font-black text-slate-900"><X size={16} className="text-red-600" /> Não usar contramarco</div>
                <p className="mt-1 text-xs text-slate-500">Esta tipologia não terá contramarco e será pulada nesta medição.</p>
              </button>
            </div>
          </section>

          {decisaoUso === 'nao' && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-black text-amber-800">A medição de contramarco será pulada para este item.</p>
              <p className="mt-1 text-xs text-amber-700">Ao salvar, essa decisão fica registrada para quando você abrir a medição novamente.</p>
            </div>
          )}

          {decisaoUso === 'sim' && (
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-black text-slate-900">Medidas do vão e folga</h2>

              <div className="mt-4">
                <p className="mb-2 text-xs font-black uppercase tracking-[.08em] text-slate-500">Largura</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-slate-500">
                    Largura do vão (mm)
                    <input
                      type="number"
                      inputMode="decimal"
                      value={vaoLargura}
                      onChange={e => setVaoLargura(e.target.value)}
                      placeholder="Ex.: 3000"
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base font-semibold text-slate-900"
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    Folga da largura (mm)
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={folgaLargura}
                      onChange={e => setFolgaLargura(e.target.value)}
                      placeholder="Ex.: 20"
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base font-semibold text-slate-900"
                    />
                  </label>
                </div>
                <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                  <div className="flex items-end justify-between gap-3">
                    <p className="text-xs font-bold text-emerald-700">Largura para produzir</p>
                    <p className="text-2xl font-black text-emerald-700">{producaoLargura > 0 ? `${producaoLargura} mm` : '—'}</p>
                  </div>
                  {vaoLargura && folgaLargura !== '' && (
                    <p className="mt-1 text-right text-[11px] text-emerald-600">{vaoLargura} − {folgaLargura || '0'} = {producaoLargura} mm</p>
                  )}
                </div>
              </div>

              <div className="mt-5">
                <p className="mb-2 text-xs font-black uppercase tracking-[.08em] text-slate-500">Altura</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-slate-500">
                    Altura do vão (mm)
                    <input
                      type="number"
                      inputMode="decimal"
                      value={vaoAltura}
                      onChange={e => setVaoAltura(e.target.value)}
                      placeholder="Ex.: 2200"
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base font-semibold text-slate-900"
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    Folga da altura (mm)
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={folgaAltura}
                      onChange={e => setFolgaAltura(e.target.value)}
                      placeholder="Ex.: 20"
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base font-semibold text-slate-900"
                    />
                  </label>
                </div>
                <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                  <div className="flex items-end justify-between gap-3">
                    <p className="text-xs font-bold text-emerald-700">Altura para produzir</p>
                    <p className="text-2xl font-black text-emerald-700">{producaoAltura > 0 ? `${producaoAltura} mm` : '—'}</p>
                  </div>
                  {vaoAltura && folgaAltura !== '' && (
                    <p className="mt-1 text-right text-[11px] text-emerald-600">{vaoAltura} − {folgaAltura || '0'} = {producaoAltura} mm</p>
                  )}
                </div>
              </div>

              <label className="mt-5 block text-xs text-slate-500">
                Observações
                <textarea
                  value={observacoes}
                  onChange={e => setObservacoes(e.target.value)}
                  rows={2}
                  placeholder="Opcional"
                  className="mt-1 w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </section>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                if (indice > 0) carregarPosicao(indice - 1)
                else setTela('lista')
              }}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600"
            >
              <ChevronLeft size={17} /> Anterior
            </button>
            <button
              onClick={() => {
                if (decisaoUso === 'nao') void escolherUso(atual, indice, false, true)
                else void salvarEAvancar()
              }}
              disabled={!decisaoUso || salvandoMedida || salvandoUso === atual.id}
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:opacity-40"
            >
              {(salvandoMedida || salvandoUso === atual.id) && <Loader2 size={16} className="animate-spin" />}
              {indice === itens.length - 1 ? 'Finalizar' : 'Salvar e próximo'} <ChevronRight size={17} />
            </button>
          </div>
        </main>
      )}

      {tela === 'resumo' && (
        <main className="mx-auto max-w-3xl px-4 py-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{origemLabel}</span>
            <span className={`rounded-lg px-2.5 py-1 text-xs font-black ${pendentes === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {pendentes === 0 ? 'Revisão concluída' : `${pendentes} pendente(s)`}
            </span>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-2 py-2">
              <p className="text-lg font-black text-emerald-700">{comContramarco}</p>
              <p className="text-[10px] font-bold uppercase text-emerald-700">Produzir</p>
            </div>
            <div className="rounded-xl border border-red-100 bg-red-50 px-2 py-2">
              <p className="text-lg font-black text-red-700">{semContramarco}</p>
              <p className="text-[10px] font-bold uppercase text-red-700">Sem contramarco</p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-2 py-2">
              <p className="text-lg font-black text-amber-700">{pendentes}</p>
              <p className="text-[10px] font-bold uppercase text-amber-700">Pendentes</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="hidden grid-cols-[1.35fr_.8fr_.7fr_1fr_.35fr] gap-2 border-b bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-500 sm:grid">
              <span>Ambiente / Tipologia</span>
              <span>Vão (mm)</span>
              <span>Folga (mm)</span>
              <span>Resultado</span>
              <span>Qtd</span>
            </div>
            {resumo.map(({ item, pos, tipo }) => {
              const naoUsa = item.contramarco === 'nao'
              const medido = Boolean(item.medido && item.producao_largura_mm && item.producao_altura_mm)
              return (
                <div key={item.id} className="border-b border-slate-100 p-3 last:border-b-0 sm:grid sm:grid-cols-[1.35fr_.8fr_.7fr_1fr_.35fr] sm:items-center sm:gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900">{item.ambiente || 'Sem ambiente'}</p>
                    <p className="text-xs text-slate-500">{tipo}</p>
                    {(item.orcamento_largura_mm || item.orcamento_altura_mm) && (
                      <p className="mt-0.5 text-[10px] text-slate-400">Orçamento: {item.orcamento_largura_mm || '—'} × {item.orcamento_altura_mm || '—'} mm</p>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-slate-600 sm:mt-0">{naoUsa ? '—' : `${item.vao_largura_mm || '—'} × ${item.vao_altura_mm || '—'}`}</p>
                  <p className="text-xs text-slate-600">{naoUsa ? '—' : `${item.folga_largura_mm ?? '—'} × ${item.folga_altura_mm ?? '—'}`}</p>
                  <button
                    onClick={() => carregarPosicao(pos)}
                    className={`mt-2 rounded-lg px-2 py-1.5 text-left text-xs font-black sm:mt-0 ${naoUsa ? 'bg-red-50 text-red-700' : medido ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}
                  >
                    {naoUsa
                      ? 'Não usa'
                      : medido
                        ? `${item.producao_largura_mm} × ${item.producao_altura_mm}`
                        : 'Pendente'}
                  </button>
                  <p className="text-xs font-bold text-slate-600">{item.quantidade || 1}</p>
                </div>
              )
            })}
          </div>

          <button
            onClick={abrirNovo}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-600 bg-white px-4 py-3 text-sm font-bold text-blue-700"
          >
            <Plus size={16} /> Adicionar tipologia
          </button>

          {pendentes > 0 && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Revise os {pendentes} item(ns) pendente(s) antes de gerar o PDF final para produção.
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-3">
            <button onClick={() => setTela('lista')} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600">
              Voltar
            </button>
            <button
              onClick={() => gerarPdfMedicaoFinal(medicao, itens)}
              disabled={pendentes > 0 || comContramarco === 0}
              className="flex items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-white px-4 py-3 text-sm font-black text-emerald-700 disabled:opacity-40"
            >
              <FileText size={16} /> Gerar PDF
            </button>
          </div>

          {!aguardandoConferencia && !contramarcoAprovado && (
            <button
              onClick={() => void enviarParaConferencia()}
              disabled={pendentes > 0 || comContramarco === 0 || fluxoVendaBloqueado || processandoFluxo}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3.5 text-sm font-black text-white disabled:opacity-40"
            >
              {processandoFluxo ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Enviar medição de contramarcos para liberação
            </button>
          )}

          {aguardandoConferencia && master && (
            <button
              onClick={() => void aprovarContramarcos()}
              disabled={processandoFluxo}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3.5 text-sm font-black text-white disabled:opacity-40"
            >
              {processandoFluxo ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              Aprovar e liberar contramarcos
            </button>
          )}
        </main>
      )}

      {modalItem && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.12em] text-blue-600">Contramarco</p>
                <h3 className="text-lg font-black text-slate-900">{editandoId ? 'Editar posição' : 'Adicionar posição'}</h3>
              </div>
              <button onClick={() => setModalItem(false)} className="rounded-lg p-2 text-slate-400"><X size={19} /></button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-slate-600">
                Ambiente
                <input
                  value={formAmbiente}
                  onChange={e => setFormAmbiente(e.target.value)}
                  placeholder="Ex.: Sala"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Tipologia
                <select
                  value={formTipo}
                  onChange={e => setFormTipo(e.target.value as TipoEsquadria)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"
                >
                  {tipos.map(t => <option key={t.chave} value={t.chave}>{t.label}</option>)}
                </select>
              </label>
              {formTipo === 'outro' && (
                <label className="block text-xs font-semibold text-slate-600">
                  Qual tipologia?
                  <input value={formTipoOutro} onChange={e => setFormTipoOutro(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" />
                </label>
              )}
              <label className="block text-xs font-semibold text-slate-600">
                Quantidade
                <input
                  type="number"
                  min={1}
                  value={formQuantidade}
                  onChange={e => setFormQuantidade(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Descrição (opcional)
                <input value={formDescricao} onChange={e => setFormDescricao(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" />
              </label>
            </div>

            <button
              onClick={salvarItem}
              disabled={salvandoItem}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              <Check size={17} /> {salvandoItem ? 'Salvando...' : 'Salvar posição'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
