'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, Search, Settings2, Sparkles } from 'lucide-react'
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

type Catalogo = {
  linhas: LinhaTecnica[]
  tipologias: Tipologia[]
  produtos: Produto[]
  configuracoes: ConfiguracaoOrcamento[]
  opcoes: EngenhariaVariavelOpcao[]
}

let catalogoCache: Catalogo | null = null
let catalogoPromise: Promise<Catalogo> | null = null

function carregarCatalogo(): Promise<Catalogo> {
  if (catalogoCache) return Promise.resolve(catalogoCache)
  if (!catalogoPromise) {
    catalogoPromise = Promise.all([
      listarLinhasTecnicas(),
      listarTipologias(),
      listarProdutos(true),
      listarConfiguracoesValidadasOrcamento(),
      listarTodasOpcoes(),
    ]).then(([linhas, tipologias, produtos, configuracoes, opcoes]) => {
      catalogoCache = {
        linhas: linhas.filter(l => l.ativo),
        tipologias,
        produtos: produtos.filter(p => Boolean(p.unidade?.trim()) && (p.categoria === 'porta_janela_padrao' || p.categoria === 'produto')),
        configuracoes,
        opcoes,
      }
      return catalogoCache
    })
  }
  return catalogoPromise
}

function normalizar(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export default function SeletorEsquadriaInteligente({ value, onChange }: Props) {
  const [catalogo, setCatalogo] = useState<Catalogo>({ linhas: [], tipologias: [], produtos: [], configuracoes: [], opcoes: [] })
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [focoBusca, setFocoBusca] = useState(false)
  const [variaveisTipologia, setVariaveisTipologia] = useState<TipologiaVariavelComVariavel[]>([])

  useEffect(() => {
    carregarCatalogo().then(c => { setCatalogo(c); setCarregando(false) })
  }, [])

  useEffect(() => {
    let ativo = true
    if (!value.tipologiaId) { setVariaveisTipologia([]); return }
    listarVariaveisDaTipologia(value.tipologiaId).then(lista => { if (ativo) setVariaveisTipologia(lista) })
    return () => { ativo = false }
  }, [value.tipologiaId])

  const linha = catalogo.linhas.find(l => l.id === value.linhaId) || null
  const tipologiaAtual = catalogo.tipologias.find(t => t.id === value.tipologiaId) || null
  const produtoAtual = catalogo.produtos.find(p => p.id === value.produtoId) || null

  const configuracoesCompativeis = useMemo(() => catalogo.configuracoes.filter(c => {
    if (!linha) return true
    if (c.produto_id) return Boolean(linha.produto_ids?.includes(c.produto_id))
    return Boolean(linha.tipologia_ids?.includes(c.tipologia_id))
  }), [catalogo.configuracoes, linha])

  const produtosCompativeis = useMemo(() => {
    if (!linha) return catalogo.produtos
    return catalogo.produtos.filter(p => Boolean(linha.produto_ids?.includes(p.id)))
  }, [catalogo.produtos, linha])

  const tipologiasCompativeis = useMemo(() => {
    if (!linha) return catalogo.tipologias
    return catalogo.tipologias.filter(t => Boolean(linha.tipologia_ids?.includes(t.id)))
  }, [catalogo.tipologias, linha])

  const q = normalizar(busca)
  const configsEncontradas = useMemo(() => {
    if (!q) return []
    return configuracoesCompativeis.filter(c => {
      const t = catalogo.tipologias.find(x => x.id === c.tipologia_id)
      const p = catalogo.produtos.find(x => x.id === c.produto_id)
      return normalizar(`${c.nome} ${t?.label || ''} ${p?.nome || ''}`).includes(q)
    }).slice(0, 8)
  }, [q, configuracoesCompativeis, catalogo.tipologias, catalogo.produtos])

  const produtosEncontrados = useMemo(() => {
    if (!q) return []
    return produtosCompativeis.filter(p => normalizar(`${p.nome} ${p.descricao || ''}`).includes(q)).slice(0, 6)
  }, [q, produtosCompativeis])

  const tipologiasEncontradas = useMemo(() => {
    if (!q) return []
    return tipologiasCompativeis.filter(t => normalizar(t.label).includes(q)).slice(0, 6)
  }, [q, tipologiasCompativeis])

  function selecionarLinha(id: string) {
    const novaLinha = catalogo.linhas.find(l => l.id === id) || null
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
      tipo: '',
      tipoOutroTexto: '',
      modoOrigem: 'manual',
    })
    setBusca('')
  }

  function selecionarConfiguracao(config: ConfiguracaoOrcamento) {
    const tipologia = catalogo.tipologias.find(t => t.id === config.tipologia_id)
    const produto = catalogo.produtos.find(p => p.id === config.produto_id)
    const folhas = config.valores?.folhas || value.folhas
    onChange({
      tipologiaId: tipologia?.id || null,
      tipo: tipologia?.chave || 'outro',
      tipoOutroTexto: tipologia ? '' : (produto?.nome || config.nome),
      modoOrigem: produto ? 'produto' : 'manual',
      produtoId: produto?.id || null,
      precoUnit: produto?.preco ?? null,
      largura: produto?.largura_mm ? String(produto.largura_mm) : value.largura,
      altura: produto?.altura_mm ? String(produto.altura_mm) : value.altura,
      folhas,
      configuracaoPresetId: config.id,
      configuracaoNome: config.nome,
      configuracaoValidada: true,
      configuracaoStatus: 'validada',
      modoConfiguracao: 'rapido',
      variaveis: { ...(config.valores || {}) },
    })
    setBusca(config.nome)
    setFocoBusca(false)
  }

  function selecionarTipologia(tipologia: Tipologia) {
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
      variaveis: {},
    })
    setBusca(tipologia.label)
    setFocoBusca(false)
  }

  function selecionarProduto(produto: Produto) {
    onChange({
      tipo: 'outro',
      tipoOutroTexto: produto.nome,
      tipologiaId: null,
      modoOrigem: 'produto',
      produtoId: produto.id,
      precoUnit: produto.preco,
      largura: produto.largura_mm ? String(produto.largura_mm) : value.largura,
      altura: produto.altura_mm ? String(produto.altura_mm) : value.altura,
      configuracaoPresetId: null,
      configuracaoNome: null,
      configuracaoValidada: false,
      configuracaoStatus: 'pendente',
      modoConfiguracao: 'rapido',
      variaveis: {},
    })
    setBusca(produto.nome)
    setFocoBusca(false)
  }

  function usarTextoLivre() {
    const texto = busca.trim()
    if (!texto) return
    onChange({
      tipo: 'outro',
      tipoOutroTexto: texto,
      tipologiaId: null,
      modoOrigem: 'manual',
      produtoId: null,
      precoUnit: null,
      configuracaoPresetId: null,
      configuracaoNome: null,
      configuracaoValidada: false,
      configuracaoStatus: 'pendente',
      modoConfiguracao: 'rapido',
      variaveis: {},
    })
    setFocoBusca(false)
  }

  function mudarModo(modo: 'rapido' | 'assistido') {
    if (modo === 'rapido') {
      onChange({ modoConfiguracao: 'rapido', configuracaoStatus: value.configuracaoValidada ? 'validada' : 'pendente' })
      return
    }
    onChange({ modoConfiguracao: 'assistido', configuracaoStatus: value.configuracaoValidada ? 'validada' : 'pendente' })
  }

  function mudarVariavel(chave: string, valor: string) {
    const novos = { ...(value.variaveis || {}), [chave]: valor }
    const obrigatorias = variaveisTipologia.filter(v => v.obrigatorio).map(v => v.variavel.chave)
    const completas = obrigatorias.every(k => Boolean(novos[k]))
    onChange({
      variaveis: novos,
      folhas: chave === 'folhas' && valor ? valor : value.folhas,
      configuracaoPresetId: null,
      configuracaoNome: null,
      configuracaoValidada: false,
      configuracaoStatus: completas && Object.keys(novos).some(k => Boolean(novos[k])) ? 'preenchida' : 'pendente',
      modoConfiguracao: 'assistido',
    })
  }

  const selecionado = Boolean(value.tipo || value.produtoId || value.configuracaoPresetId)
  const mostrarResultados = focoBusca && Boolean(q)

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-[220px_1fr] gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Linha (opcional)</label>
          <div className="relative">
            <select value={value.linhaId || ''} onChange={e => selecionarLinha(e.target.value)} className="w-full appearance-none border border-slate-300 rounded-lg p-2.5 pr-8 text-sm bg-white">
              <option value="">Todas / A definir</option>
              {catalogo.linhas.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-3 text-slate-400"/>
          </div>
        </div>

        <div className="relative">
          <label className="block text-xs text-slate-500 mb-1">Tipologia, configuração ou produto *</label>
          <Search size={15} className="absolute left-3 top-[33px] text-slate-400"/>
          <input
            value={busca}
            onFocus={() => setFocoBusca(true)}
            onChange={e => { setBusca(e.target.value); setFocoBusca(true) }}
            placeholder={carregando ? 'Carregando catálogo...' : 'Ex: porta 3 folhas reforço interno'}
            className="w-full border border-slate-300 rounded-lg py-2.5 pl-9 pr-3 text-sm"
          />

          {mostrarResultados && (
            <div className="absolute z-30 mt-1 w-full max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl p-2 space-y-2">
              {configsEncontradas.length > 0 && <div><p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-600">Configurações validadas</p>{configsEncontradas.map(c => {
                const t = catalogo.tipologias.find(x => x.id === c.tipologia_id)
                return <button type="button" key={c.id} onMouseDown={e => e.preventDefault()} onClick={() => selecionarConfiguracao(c)} className="w-full text-left rounded-lg px-3 py-2 hover:bg-emerald-50"><span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><CheckCircle2 size={14} className="text-emerald-600"/>{c.nome}</span><span className="block text-xs text-slate-500 mt-0.5">{t?.label || 'Tipologia'} · validada pela Engenharia</span></button>
              })}</div>}

              {tipologiasEncontradas.length > 0 && <div><p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Tipologias</p>{tipologiasEncontradas.map(t => <button type="button" key={t.id} onMouseDown={e => e.preventDefault()} onClick={() => selecionarTipologia(t)} className="w-full text-left rounded-lg px-3 py-2 hover:bg-slate-50"><span className="text-sm font-medium text-slate-700">{t.label}</span><span className="block text-xs text-slate-400">Escolher e decidir se quer preencher as variáveis</span></button>)}</div>}

              {produtosEncontrados.length > 0 && <div><p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Produtos cadastrados</p>{produtosEncontrados.map(p => <button type="button" key={p.id} onMouseDown={e => e.preventDefault()} onClick={() => selecionarProduto(p)} className="w-full text-left rounded-lg px-3 py-2 hover:bg-slate-50"><span className="text-sm font-medium text-slate-700">{p.nome}</span><span className="block text-xs text-slate-400">Produto cadastrado{p.preco ? ` · R$ ${p.preco.toFixed(2)}` : ''}</span></button>)}</div>}

              {linha && configsEncontradas.length === 0 && tipologiasEncontradas.length === 0 && produtosEncontrados.length === 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Nenhum cadastro vinculado à linha {linha.nome} corresponde à busca. Você ainda pode seguir com texto livre, sem criar vínculo técnico falso.</div>
              )}
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={usarTextoLivre} className="w-full text-left rounded-lg border border-dashed border-slate-200 px-3 py-2 hover:bg-slate-50"><span className="text-xs text-slate-500">Não encontrou? Usar exatamente:</span><span className="block text-sm font-medium text-slate-700">“{busca.trim()}”</span></button>
            </div>
          )}
        </div>
      </div>

      {selecionado && (
        <div className={`rounded-xl border p-3 ${value.configuracaoValidada ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex flex-wrap items-center gap-2">
            {value.linhaNome && <span className="text-xs rounded-full bg-white border border-slate-200 px-2 py-1">Linha: {value.linhaNome}</span>}
            {tipologiaAtual && <span className="text-xs rounded-full bg-white border border-slate-200 px-2 py-1">{tipologiaAtual.label}</span>}
            {produtoAtual && <span className="text-xs rounded-full bg-white border border-slate-200 px-2 py-1">Produto vinculado</span>}
            {value.configuracaoValidada && <span className="text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700 px-2 py-1 flex items-center gap-1"><CheckCircle2 size={12}/> {value.configuracaoNome}</span>}
          </div>

          {value.tipologiaId && !value.configuracaoValidada && (
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div><p className="text-xs font-semibold text-slate-700">Quer preencher as variáveis técnicas agora?</p><p className="text-[11px] text-slate-500">Rápido deixa para o orçamentista conferir. Assistido já leva a configuração preenchida.</p></div>
              <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden self-start">
                <button type="button" onClick={() => mudarModo('rapido')} className={`px-3 py-2 text-xs ${value.modoConfiguracao === 'rapido' ? 'bg-brand-navy text-white' : 'text-slate-600'}`}>Seguir rápido</button>
                <button type="button" onClick={() => mudarModo('assistido')} className={`px-3 py-2 text-xs flex items-center gap-1 ${value.modoConfiguracao === 'assistido' ? 'bg-brand-navy text-white' : 'text-slate-600'}`}><Settings2 size={12}/> Configurar variáveis</button>
              </div>
            </div>
          )}

          {value.configuracaoValidada && (
            <div className="mt-2 flex items-center gap-2 text-xs text-emerald-700"><Sparkles size={13}/> Combinação pronta: as variáveis validadas já foram carregadas.</div>
          )}
        </div>
      )}

      {value.tipologiaId && value.modoConfiguracao === 'assistido' && !value.configuracaoValidada && (
        <div className="grid sm:grid-cols-2 gap-3 rounded-xl border border-brand-navy/15 bg-brand-navyLight/40 p-3">
          {variaveisTipologia.length === 0 && <p className="sm:col-span-2 text-xs text-slate-500">Essa tipologia ainda não possui variáveis técnicas cadastradas. Você pode seguir rápido e o orçamentista confere depois.</p>}
          {variaveisTipologia.map(v => {
            const opcoes = catalogo.opcoes.filter(o => o.variavel_id === v.variavel_id)
            return <div key={v.id}><label className="block text-xs text-slate-500 mb-1">{v.variavel.label}{v.obrigatorio ? ' *' : ''}</label><select value={value.variaveis?.[v.variavel.chave] || ''} onChange={e => mudarVariavel(v.variavel.chave, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white"><option value="">A definir</option>{opcoes.map(o => <option key={o.id} value={o.chave}>{o.label}</option>)}</select></div>
          })}
          {variaveisTipologia.length > 0 && <div className="sm:col-span-2 text-[11px] text-slate-500">Status: {value.configuracaoStatus === 'preenchida' ? <span className="text-emerald-700 font-semibold">variáveis obrigatórias preenchidas</span> : <span className="text-amber-700 font-semibold">há variáveis obrigatórias pendentes ou configuração parcial</span>}</div>}
        </div>
      )}
    </div>
  )
}
