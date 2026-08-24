'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  Image as ImageIcon,
  Maximize2,
  Search,
  Settings2,
  Sparkles,
  X,
} from 'lucide-react'
import { listarProdutos } from '@/lib/produtos'
import { listarTipologias } from '@/lib/tipologias'
import { listarLinhasTecnicas, type LinhaTecnica } from '@/lib/linhasTecnicas'
import {
  listarTodasOpcoes,
  listarVariaveisDaTipologia,
  type EngenhariaVariavelOpcao,
  type TipologiaVariavelComVariavel,
} from '@/lib/engenhariaVariaveis'
import { listarConfiguracoesValidadasOrcamento, type ConfiguracaoOrcamento } from '@/lib/orcamentoConfiguracoes'
import { listarStatusTipologiasOrcamento, rotuloStatusTipologia, type StatusTipologiaOrcamento } from '@/lib/statusTipologiasOrcamento'
import { supabase } from '@/lib/supabase'
import type { Produto, Tipologia } from '@/lib/tipos'

export type StatusConfiguracaoOrcamento = 'pendente' | 'preenchida' | 'validada'

export type SelecaoEsquadriaOrcamento = {
  modoOrigem: 'manual' | 'produto'
  produtoId: string | null
  precoUnit: number | null
  tipo: string
  tipoOutroTexto: string
  folhas: string
  largura: string
  altura: string
  linhaId: string | null
  linhaNome: string | null
  tipologiaId: string | null
  configuracaoPresetId: string | null
  configuracaoNome: string | null
  configuracaoValidada: boolean
  modoConfiguracao: 'rapido' | 'assistido'
  configuracaoStatus: StatusConfiguracaoOrcamento
  variaveis: Record<string, string>
}

type Props = {
  value: SelecaoEsquadriaOrcamento
  onChange: (patch: Partial<SelecaoEsquadriaOrcamento>) => void
}

type TipologiaVisual = Tipologia & {
  ativo?: boolean
  foto_url?: string | null
  origem_referencia?: 'atlas' | 'wvetro' | 'misto' | string | null
  linha_origem_wvetro?: string | null
  modelo_origem_wvetro?: string | null
  wvetro_ocorrencias?: number | null
}

type ReferenciaVariavelWVetro = {
  id: string
  variavelId: string | null
  chave: string
  label: string
  valor: string
  valorRaw: string | null
  origemTipo: string
  confianca: number
  evidencia: string | null
  statusMapeamento: string
}

type ReferenciaTipologiaWVetro = {
  referenciaId: string
  tipologiaId: string
  linha: string
  modelo: string
  imagemUrl: string | null
  ocorrencias: number
  statusMapeamento: string
  variaveis: ReferenciaVariavelWVetro[]
}

type Catalogo = {
  linhas: LinhaTecnica[]
  tipologias: TipologiaVisual[]
  produtos: Produto[]
  configuracoes: ConfiguracaoOrcamento[]
  opcoes: EngenhariaVariavelOpcao[]
}

type FiltroVisual = 'todos' | 'validados' | 'validacao' | 'wvetro' | 'com_imagem' | 'sem_imagem'

const IMAGENS_PC3_VALIDADAS: Record<string, string> = {
  '*SUCB-PC3-01EF': '/configuracoes/pc3/SUCB-PC3-01EF.png',
  '*SUCB-PC3-02-EF': '/configuracoes/pc3/SUCB-PC3-02-EF.png',
  '*SUCB-PC3-03-EF': '/configuracoes/pc3/SUCB-PC3-03-EF.png',
  '*SUCB-PC3-04-EF': '/configuracoes/pc3/SUCB-PC3-04-EF.png',
}

function normalizar(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function imagemPadraoConfiguracao(nome: string) {
  return IMAGENS_PC3_VALIDADAS[nome.trim()] || null
}

function classeStatus(status?: StatusTipologiaOrcamento | null) {
  if (status?.status === 'validada_atlas') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status?.status === 'em_validacao_atlas') return 'border-amber-200 bg-amber-50 text-amber-800'
  if (status?.status === 'referencia_wvetro') return 'border-blue-200 bg-blue-50 text-blue-700'
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

function prioridadeStatus(status?: StatusTipologiaOrcamento | null) {
  if (status?.status === 'validada_atlas') return 1
  if (status?.status === 'em_validacao_atlas') return status.origem === 'atlas' ? 2 : 3
  if (status?.status === 'cadastrada_atlas') return 4
  if (status?.status === 'referencia_wvetro') return 5
  return 6
}

async function carregarReferenciasWVetro(): Promise<Record<string, ReferenciaTipologiaWVetro>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return {}
  try {
    const resposta = await fetch('/api/orcamento/wvetro-referencias', {
      method: 'GET',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!resposta.ok) return {}
    const json = await resposta.json().catch(() => ({}))
    return (json?.referencias || {}) as Record<string, ReferenciaTipologiaWVetro>
  } catch {
    return {}
  }
}

export default function SeletorEsquadriaInteligenteV2({ value, onChange }: Props) {
  const [catalogo, setCatalogo] = useState<Catalogo>({ linhas: [], tipologias: [], produtos: [], configuracoes: [], opcoes: [] })
  const [statusTipologias, setStatusTipologias] = useState<Record<string, StatusTipologiaOrcamento>>({})
  const [referenciasWVetro, setReferenciasWVetro] = useState<Record<string, ReferenciaTipologiaWVetro>>({})
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<FiltroVisual>('todos')
  const [variaveisTipologia, setVariaveisTipologia] = useState<TipologiaVariavelComVariavel[]>([])
  const [imagemAmpliada, setImagemAmpliada] = useState<{ url: string; nome: string; origem: string } | null>(null)

  async function carregarCatalogo() {
    setCarregando(true)
    const [linhas, tipologias, produtos, configuracoes, opcoes, statuses, referencias] = await Promise.all([
      listarLinhasTecnicas(),
      listarTipologias(),
      listarProdutos(true),
      listarConfiguracoesValidadasOrcamento(),
      listarTodasOpcoes(),
      listarStatusTipologiasOrcamento(),
      carregarReferenciasWVetro(),
    ])
    setCatalogo({
      linhas: linhas.filter(l => l.ativo),
      tipologias: tipologias as TipologiaVisual[],
      produtos: produtos.filter(p => Boolean(p.unidade?.trim()) && (p.categoria === 'porta_janela_padrao' || p.categoria === 'produto')),
      configuracoes,
      opcoes,
    })
    setStatusTipologias(statuses)
    setReferenciasWVetro(referencias)
    setCarregando(false)
  }

  useEffect(() => {
    carregarCatalogo()
  }, [])

  useEffect(() => {
    let ativo = true
    if (!value.tipologiaId) {
      setVariaveisTipologia([])
      return
    }
    listarVariaveisDaTipologia(value.tipologiaId).then(lista => { if (ativo) setVariaveisTipologia(lista) })
    return () => { ativo = false }
  }, [value.tipologiaId])

  useEffect(() => {
    if (!imagemAmpliada) return
    const fechar = (e: KeyboardEvent) => { if (e.key === 'Escape') setImagemAmpliada(null) }
    window.addEventListener('keydown', fechar)
    return () => window.removeEventListener('keydown', fechar)
  }, [imagemAmpliada])

  const linha = catalogo.linhas.find(l => l.id === value.linhaId) || null
  const tipologiaAtual = catalogo.tipologias.find(t => t.id === value.tipologiaId) || null
  const produtoAtual = catalogo.produtos.find(p => p.id === value.produtoId) || null
  const statusTipologiaAtual = value.tipologiaId ? statusTipologias[value.tipologiaId] || null : null
  const referenciaAtual = value.tipologiaId ? referenciasWVetro[value.tipologiaId] || null : null

  const tipologiasCompativeis = useMemo(() => {
    if (!linha) return []
    const ids = new Set(linha.tipologia_ids || [])
    return catalogo.tipologias
      .filter(t => ids.has(t.id))
      .sort((a, b) => {
        const pa = prioridadeStatus(statusTipologias[a.id])
        const pb = prioridadeStatus(statusTipologias[b.id])
        if (pa !== pb) return pa - pb
        const oa = referenciasWVetro[a.id]?.ocorrencias || a.wvetro_ocorrencias || 0
        const ob = referenciasWVetro[b.id]?.ocorrencias || b.wvetro_ocorrencias || 0
        if (oa !== ob) return ob - oa
        return a.label.localeCompare(b.label, 'pt-BR')
      })
  }, [catalogo.tipologias, linha, statusTipologias, referenciasWVetro])

  const configuracoesCompativeis = useMemo(() => {
    if (!linha) return []
    const tipologiaIds = new Set(linha.tipologia_ids || [])
    const produtoIds = new Set(linha.produto_ids || [])
    return catalogo.configuracoes.filter(c => {
      if (c.produto_id && produtoIds.has(c.produto_id)) return true
      return tipologiaIds.has(c.tipologia_id)
    })
  }, [catalogo.configuracoes, linha])

  const configuracoesDoModelo = useMemo(() => {
    if (!value.tipologiaId) return []
    return configuracoesCompativeis.filter(c => c.tipologia_id === value.tipologiaId)
  }, [configuracoesCompativeis, value.tipologiaId])

  function imagemConfiguracao(config: ConfiguracaoOrcamento) {
    const produto = catalogo.produtos.find(p => p.id === config.produto_id)
    return config.imagem_url || imagemPadraoConfiguracao(config.nome) || produto?.foto_url || null
  }

  function imagemTipologia(tipologia: TipologiaVisual) {
    if (tipologia.foto_url) return { url: tipologia.foto_url, origem: 'Atlas' }
    const configComImagem = catalogo.configuracoes.find(c => c.tipologia_id === tipologia.id && Boolean(imagemConfiguracao(c)))
    if (configComImagem) return { url: imagemConfiguracao(configComImagem), origem: 'Configuração Atlas' }
    const referencia = referenciasWVetro[tipologia.id]
    if (referencia?.imagemUrl) return { url: referencia.imagemUrl, origem: 'W.Vetro' }
    return { url: null, origem: 'Sem imagem' }
  }

  const q = normalizar(busca)
  const tipologiasVisiveis = useMemo(() => {
    return tipologiasCompativeis.filter(t => {
      const status = statusTipologias[t.id]
      const imagem = imagemTipologia(t).url
      const configs = catalogo.configuracoes.filter(c => c.tipologia_id === t.id)
      const texto = normalizar(`${t.label} ${t.chave} ${linha?.nome || ''} ${configs.map(c => c.nome).join(' ')}`)
      if (q && !texto.includes(q)) return false
      if (filtro === 'validados' && status?.status !== 'validada_atlas') return false
      if (filtro === 'validacao' && status?.status !== 'em_validacao_atlas') return false
      if (filtro === 'wvetro' && status?.origem !== 'wvetro' && status?.origem !== 'misto') return false
      if (filtro === 'com_imagem' && !imagem) return false
      if (filtro === 'sem_imagem' && imagem) return false
      return true
    })
  }, [tipologiasCompativeis, q, filtro, statusTipologias, catalogo.configuracoes, linha, referenciasWVetro])

  const variaveisUnificadas = useMemo(() => {
    const mapa = new Map<string, {
      id: string
      variavelId: string | null
      chave: string
      label: string
      obrigatorio: boolean
      atlas: boolean
      referencia: ReferenciaVariavelWVetro | null
    }>()

    for (const item of variaveisTipologia) {
      mapa.set(item.variavel.chave, {
        id: item.id,
        variavelId: item.variavel_id,
        chave: item.variavel.chave,
        label: item.variavel.label,
        obrigatorio: item.obrigatorio,
        atlas: true,
        referencia: null,
      })
    }

    for (const ref of referenciaAtual?.variaveis || []) {
      const atual = mapa.get(ref.chave)
      if (atual) atual.referencia = ref
      else {
        mapa.set(ref.chave, {
          id: `wvetro-${ref.id}`,
          variavelId: ref.variavelId,
          chave: ref.chave,
          label: ref.label,
          obrigatorio: false,
          atlas: false,
          referencia: ref,
        })
      }
    }

    const ordem = new Map<string, number>([
      ['montagem', 1], ['trilho', 2], ['contramarco', 3], ['arremate', 4], ['fechadura', 5],
      ['puxador', 6], ['mao_amiga', 7], ['reforco', 8], ['roldana', 9], ['folhas', 10],
    ])
    return Array.from(mapa.values()).sort((a, b) => (ordem.get(a.chave) || 999) - (ordem.get(b.chave) || 999) || a.label.localeCompare(b.label, 'pt-BR'))
  }, [variaveisTipologia, referenciaAtual])

  function mudarTipoLivre(texto: string) {
    const preenchido = Boolean(texto.trim())
    onChange({
      tipo: preenchido ? 'outro' : '',
      tipoOutroTexto: texto,
      tipologiaId: null,
      produtoId: null,
      precoUnit: null,
      configuracaoPresetId: null,
      configuracaoNome: null,
      configuracaoValidada: false,
      configuracaoStatus: 'pendente',
      modoConfiguracao: 'rapido',
      variaveis: {},
      folhas: '',
      modoOrigem: 'manual',
    })
    setBusca('')
    setFiltro('todos')
  }

  function selecionarLinha(id: string) {
    const novaLinha = catalogo.linhas.find(l => l.id === id) || null
    const manterTipoLivre = value.tipo === 'outro' && Boolean(value.tipoOutroTexto.trim())
    onChange({
      linhaId: novaLinha?.id || null,
      linhaNome: novaLinha?.nome || null,
      tipologiaId: null,
      produtoId: null,
      precoUnit: null,
      configuracaoPresetId: null,
      configuracaoNome: null,
      configuracaoValidada: false,
      configuracaoStatus: 'pendente',
      variaveis: {},
      folhas: '',
      tipo: manterTipoLivre ? 'outro' : '',
      tipoOutroTexto: manterTipoLivre ? value.tipoOutroTexto : '',
      modoOrigem: 'manual',
    })
    setBusca('')
    setFiltro('todos')
  }

  function selecionarTipologia(tipologiaId: string) {
    const tipologia = catalogo.tipologias.find(t => t.id === tipologiaId)
    if (!tipologia) return
    const ref = referenciasWVetro[tipologiaId]
    const folhasReferencia = ref?.variaveis.find(v => v.chave === 'folhas')?.valor || ''
    onChange({
      tipo: tipologia.chave,
      tipoOutroTexto: '',
      tipologiaId: tipologia.id,
      modoOrigem: 'manual',
      produtoId: null,
      precoUnit: null,
      configuracaoPresetId: null,
      configuracaoNome: null,
      configuracaoValidada: false,
      configuracaoStatus: 'pendente',
      modoConfiguracao: 'rapido',
      folhas: folhasReferencia,
      variaveis: {},
    })
  }

  function selecionarConfiguracao(config: ConfiguracaoOrcamento) {
    const tipologia = catalogo.tipologias.find(t => t.id === config.tipologia_id)
    const produto = catalogo.produtos.find(p => p.id === config.produto_id)
    onChange({
      tipologiaId: tipologia?.id || null,
      tipo: tipologia?.chave || 'outro',
      tipoOutroTexto: tipologia ? '' : (produto?.nome || config.nome),
      modoOrigem: produto ? 'produto' : 'manual',
      produtoId: produto?.id || null,
      precoUnit: produto?.preco ?? null,
      largura: produto?.largura_mm ? String(produto.largura_mm) : value.largura,
      altura: produto?.altura_mm ? String(produto.altura_mm) : value.altura,
      configuracaoPresetId: config.id,
      configuracaoNome: config.nome,
      configuracaoValidada: true,
      configuracaoStatus: 'validada',
      modoConfiguracao: 'rapido',
      variaveis: { ...(config.valores || {}) },
      folhas: config.valores?.folhas || value.folhas,
    })
  }

  function mudarModo(modo: 'rapido' | 'assistido') {
    if (modo === 'rapido') {
      onChange({ modoConfiguracao: modo, configuracaoStatus: value.configuracaoValidada ? 'validada' : 'pendente' })
      return
    }

    const novos = { ...(value.variaveis || {}) }
    for (const ref of referenciaAtual?.variaveis || []) {
      if (!novos[ref.chave] && ref.valor) novos[ref.chave] = ref.valor
    }
    const obrigatorias = variaveisTipologia.filter(v => v.obrigatorio).map(v => v.variavel.chave)
    const completas = obrigatorias.every(chave => Boolean(novos[chave]))
    const temValores = Object.values(novos).some(Boolean)
    onChange({
      modoConfiguracao: 'assistido',
      variaveis: novos,
      folhas: novos.folhas || value.folhas,
      configuracaoStatus: completas && temValores ? 'preenchida' : 'pendente',
    })
  }

  function mudarVariavel(chave: string, valor: string) {
    const novos = { ...(value.variaveis || {}), [chave]: valor }
    const obrigatorias = variaveisTipologia.filter(v => v.obrigatorio).map(v => v.variavel.chave)
    const completas = obrigatorias.every(k => Boolean(novos[k]))
    onChange({
      variaveis: novos,
      folhas: chave === 'folhas' ? valor : value.folhas,
      configuracaoPresetId: null,
      configuracaoNome: null,
      configuracaoValidada: false,
      configuracaoStatus: completas && Object.keys(novos).some(k => Boolean(novos[k])) ? 'preenchida' : 'pendente',
      modoConfiguracao: 'assistido',
    })
  }

  const filtros: Array<{ id: FiltroVisual; label: string }> = [
    { id: 'todos', label: 'Todos' },
    { id: 'validados', label: 'Validados Atlas' },
    { id: 'validacao', label: 'Em validação' },
    { id: 'wvetro', label: 'W.Vetro' },
    { id: 'com_imagem', label: 'Com imagem' },
    { id: 'sem_imagem', label: 'Sem imagem' },
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
        <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de esquadria / descrição livre</label>
        <input
          type="text"
          value={value.tipo === 'outro' ? value.tipoOutroTexto : ''}
          onChange={e => mudarTipoLivre(e.target.value)}
          placeholder="Ex.: Porta de correr 3 folhas - Linha Suprema"
          className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white"
        />
        <p className="mt-1.5 text-[11px] text-emerald-800">Use este campo quando a esquadria ainda não estiver cadastrada. Linha e Modelo abaixo são opcionais.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">1. Linha <span className="font-normal text-slate-400">(opcional)</span></label>
          <div className="relative">
            <select value={value.linhaId || ''} onChange={e => selecionarLinha(e.target.value)} className="w-full appearance-none border border-slate-300 rounded-lg p-2.5 pr-8 text-sm bg-white">
              <option value="">Selecione a linha (opcional)</option>
              {catalogo.linhas.map(l => <option key={l.id} value={l.id}>{l.nome}{(l as any).origem_referencia === 'wvetro' ? ' · WVETRO' : ''}</option>)}
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-3 text-slate-400" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">2. Modelo / Tipologia <span className="font-normal text-slate-400">(lista rápida)</span></label>
          <div className="relative">
            <select
              value={value.tipologiaId || ''}
              onChange={e => selecionarTipologia(e.target.value)}
              disabled={carregando || !linha || tipologiasCompativeis.length === 0}
              className="w-full appearance-none border border-slate-300 rounded-lg p-2.5 pr-8 text-sm bg-white disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">{carregando ? 'Carregando...' : !linha ? 'Selecione uma linha primeiro' : tipologiasCompativeis.length ? 'Selecione pela lista ou pelos cards abaixo' : 'Nenhum modelo cadastrado'}</option>
              {tipologiasCompativeis.map(t => <option key={t.id} value={t.id}>{t.label} — {rotuloStatusTipologia(statusTipologias[t.id])}</option>)}
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-3 text-slate-400" />
          </div>
          {linha && <p className="mt-1 text-[11px] text-slate-400">{tipologiasCompativeis.length} modelo(s) em {linha.nome}. A escolha visual abaixo é o fluxo principal.</p>}
        </div>
      </div>

      {linha && tipologiasCompativeis.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">Escolha visual da tipologia</p>
              <p className="text-[11px] text-slate-500">Veja o modelo antes de selecionar. Imagens Atlas têm prioridade; W.Vetro aparece como referência.</p>
            </div>
            <span className="text-[11px] text-slate-500">{tipologiasVisiveis.length} de {tipologiasCompativeis.length} modelo(s)</span>
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Pesquisar: porta de correr 4 folhas, maxim-ar..."
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {filtros.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFiltro(item.id)}
                className={`rounded-full border px-2.5 py-1.5 text-[11px] transition ${filtro === item.id ? 'border-brand-navy bg-brand-navy text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tipologiasVisiveis.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {tipologiasVisiveis.map(t => {
                const imagem = imagemTipologia(t)
                const status = statusTipologias[t.id]
                const selecionada = value.tipologiaId === t.id
                const configs = catalogo.configuracoes.filter(c => c.tipologia_id === t.id)
                const referencia = referenciasWVetro[t.id]
                return (
                  <div key={t.id} className={`relative overflow-hidden rounded-xl border transition ${selecionada ? 'border-emerald-500 ring-2 ring-emerald-100 bg-emerald-50' : 'border-slate-200 bg-white hover:border-brand-navy hover:shadow-sm'}`}>
                    <button type="button" onClick={() => selecionarTipologia(t.id)} className="w-full text-left">
                      <div className="aspect-[4/3] border-b border-slate-100 bg-slate-50 flex items-center justify-center overflow-hidden">
                        {imagem.url ? (
                          <img src={imagem.url} alt={t.label} className="h-full w-full object-contain" />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-slate-300 px-3 text-center">
                            <ImageIcon size={38} />
                            <span className="text-[10px]">Imagem ainda não cadastrada</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-snug text-slate-800">{t.label}</p>
                          {selecionada && <CheckCircle2 size={17} className="shrink-0 text-emerald-600" />}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">{linha.nome}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${classeStatus(status)}`}>{rotuloStatusTipologia(status)}</span>
                          {configs.length > 0 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">{configs.length} config. Atlas</span>}
                        </div>
                        {referencia && <p className="mt-2 text-[10px] text-blue-700">Referência histórica W.Vetro{referencia.ocorrencias > 0 ? ` · ${referencia.ocorrencias} ocorrência(s)` : ''}</p>}
                        {imagem.url && <p className="mt-1 text-[9px] text-slate-400">Imagem: {imagem.origem}</p>}
                      </div>
                    </button>
                    {imagem.url && (
                      <button
                        type="button"
                        aria-label={`Ampliar imagem de ${t.label}`}
                        onClick={() => setImagemAmpliada({ url: imagem.url!, nome: t.label, origem: imagem.origem })}
                        className="absolute right-2 top-2 rounded-lg border border-white/70 bg-white/90 p-1.5 text-slate-600 shadow-sm hover:text-brand-navy"
                      >
                        <Maximize2 size={15} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">Nenhuma tipologia corresponde à busca/filtro. Limpe a busca ou use a descrição livre.</div>
          )}
        </div>
      )}

      {tipologiaAtual && (
        <div className={`flex flex-wrap items-center gap-2 rounded-xl border p-3 text-xs ${classeStatus(statusTipologiaAtual)}`}>
          <span className="font-bold">{rotuloStatusTipologia(statusTipologiaAtual)}</span>
          <span className="opacity-80">{statusTipologiaAtual?.status === 'validada_atlas' ? 'A configuração técnica validada do Atlas tem prioridade.' : statusTipologiaAtual?.status === 'em_validacao_atlas' ? 'Já está sendo tratada no Atlas, mas ainda exige validação técnica.' : statusTipologiaAtual?.status === 'referencia_wvetro' ? 'Modelo trazido do W.Vetro; pode ser usado como referência enquanto tratamos a receita no Atlas.' : 'Tipologia cadastrada no Atlas.'}</span>
        </div>
      )}

      {value.tipologiaId && (
        <div>
          <div className="flex items-end justify-between gap-3 mb-2">
            <div>
              <p className="text-xs font-semibold text-slate-600">3. Escolha o projeto / configuração</p>
              <p className="text-[11px] text-slate-400">Configurações Atlas validadas para o modelo selecionado.</p>
            </div>
            {configuracoesDoModelo.length > 0 && <span className="text-[11px] rounded-full bg-slate-100 px-2 py-1 text-slate-500">{configuracoesDoModelo.length} opção(ões)</span>}
          </div>

          {configuracoesDoModelo.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {configuracoesDoModelo.map(config => {
                const imagemCard = imagemConfiguracao(config)
                const ativo = value.configuracaoPresetId === config.id
                return (
                  <button type="button" key={config.id} onClick={() => selecionarConfiguracao(config)} className={`overflow-hidden rounded-xl border text-left transition ${ativo ? 'border-emerald-500 ring-2 ring-emerald-100 bg-emerald-50' : 'border-slate-200 bg-white hover:border-brand-navy hover:shadow-sm'}`}>
                    <div className="aspect-[4/3] bg-slate-50 border-b border-slate-100 flex items-center justify-center overflow-hidden">
                      {imagemCard ? <img src={imagemCard} alt={config.nome} className="w-full h-full object-contain" /> : <div className="flex flex-col items-center gap-2 text-slate-300"><ImageIcon size={34} /><span className="text-[10px]">Imagem ainda não cadastrada</span></div>}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-semibold text-slate-800 leading-snug">{config.nome}</p>
                      <p className="mt-2 text-[11px] text-emerald-700">Configuração validada pela Engenharia</p>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Este modelo ainda não possui configuração Atlas validada. Você pode seguir rápido ou abrir as variáveis de referência.</div>
          )}
        </div>
      )}

      {value.tipologiaId && !value.configuracaoValidada && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-slate-700">Configuração técnica</p>
              <p className="text-[11px] text-slate-500">Atlas validado sempre tem prioridade. Na falta dele, o W.Vetro entra somente como referência explícita.</p>
            </div>
            <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden self-start">
              <button type="button" onClick={() => mudarModo('rapido')} className={`px-3 py-2 text-xs ${value.modoConfiguracao === 'rapido' ? 'bg-brand-navy text-white' : 'text-slate-600'}`}>Seguir rápido</button>
              <button type="button" onClick={() => mudarModo('assistido')} className={`px-3 py-2 text-xs flex items-center gap-1 ${value.modoConfiguracao === 'assistido' ? 'bg-brand-navy text-white' : 'text-slate-600'}`}><Settings2 size={12} /> Configurar variáveis</button>
            </div>
          </div>
        </div>
      )}

      {value.configuracaoValidada && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 flex items-center gap-2"><Sparkles size={13} /> Configuração selecionada: <strong>{value.configuracaoNome}</strong></div>
      )}

      {value.tipologiaId && value.modoConfiguracao === 'assistido' && !value.configuracaoValidada && (
        <div className="space-y-3 rounded-xl border border-brand-navy/15 bg-brand-navyLight/40 p-3">
          {(referenciaAtual?.variaveis.length || 0) > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-[11px] text-blue-800">
              <strong>{referenciaAtual?.variaveis.length} variável(is) explícita(s) carregada(s) do W.Vetro.</strong> São referências de origem, não validação da receita Atlas. Você pode alterar os valores antes de continuar.
            </div>
          )}

          {variaveisUnificadas.length === 0 ? (
            <p className="text-xs text-slate-500">Essa tipologia ainda não possui variáveis técnicas no Atlas e o W.Vetro não trouxe variável explícita mapeável. Continue em modo rápido ou use a descrição livre.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {variaveisUnificadas.map(v => {
                const opcoes = v.variavelId ? catalogo.opcoes.filter(o => o.variavel_id === v.variavelId) : []
                const atual = value.variaveis?.[v.chave] || ''
                const refAtiva = Boolean(v.referencia?.valor && atual === v.referencia.valor)
                const possuiOpcaoRef = Boolean(v.referencia?.valor && opcoes.some(o => o.chave === v.referencia?.valor))
                return (
                  <div key={v.id} className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
                      <label className="text-xs text-slate-600">{v.label}{v.obrigatorio ? ' *' : ''}</label>
                      <div className="flex gap-1">
                        {v.atlas && <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[8px] font-bold text-emerald-700">ATLAS</span>}
                        {refAtiva && <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[8px] font-bold text-blue-700">WVETRO REFERÊNCIA</span>}
                        {v.referencia && atual && !refAtiva && <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[8px] font-bold text-amber-700">AJUSTADA</span>}
                      </div>
                    </div>
                    <select value={atual} onChange={e => mudarVariavel(v.chave, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white">
                      <option value="">A definir</option>
                      {!possuiOpcaoRef && v.referencia?.valor && <option value={v.referencia.valor}>{v.referencia.valor} · W.Vetro</option>}
                      {opcoes.map(o => <option key={o.id} value={o.chave}>{o.label}</option>)}
                    </select>
                    {v.referencia?.evidencia && <p className="mt-1.5 text-[9px] text-blue-600">Origem: {v.referencia.evidencia}</p>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {imagemAmpliada && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4" onMouseDown={() => setImagemAmpliada(null)}>
          <div className="relative max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl" onMouseDown={e => e.stopPropagation()}>
            <button type="button" onClick={() => setImagemAmpliada(null)} className="absolute right-3 top-3 z-10 rounded-full bg-white p-2 text-slate-700 shadow"><X size={18} /></button>
            <div className="flex max-h-[75vh] items-center justify-center bg-slate-50 p-4">
              <img src={imagemAmpliada.url} alt={imagemAmpliada.nome} className="max-h-[70vh] max-w-full object-contain" />
            </div>
            <div className="border-t border-slate-100 p-4">
              <p className="font-semibold text-slate-800">{imagemAmpliada.nome}</p>
              <p className="mt-1 text-xs text-slate-500">Origem da imagem: {imagemAmpliada.origem}</p>
            </div>
          </div>
        </div>
      )}

      {(tipologiaAtual || produtoAtual) && <div className="hidden" aria-hidden="true" />}
    </div>
  )
}
