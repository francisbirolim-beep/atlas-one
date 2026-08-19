'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, Image as ImageIcon, Search, Settings2, Sparkles } from 'lucide-react'
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

export default function SeletorEsquadriaInteligente({ value, onChange }: Props) {
  const [catalogo, setCatalogo] = useState<Catalogo>({ linhas: [], tipologias: [], produtos: [], configuracoes: [], opcoes: [] })
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [focoBusca, setFocoBusca] = useState(false)
  const [variaveisTipologia, setVariaveisTipologia] = useState<TipologiaVariavelComVariavel[]>([])

  async function carregarCatalogo() {
    setCarregando(true)
    const [linhas, tipologias, produtos, configuracoes, opcoes] = await Promise.all([
      listarLinhasTecnicas(),
      listarTipologias(),
      listarProdutos(true),
      listarConfiguracoesValidadasOrcamento(),
      listarTodasOpcoes(),
    ])
    setCatalogo({
      linhas: linhas.filter(l => l.ativo),
      tipologias,
      produtos: produtos.filter(p => Boolean(p.unidade?.trim()) && (p.categoria === 'porta_janela_padrao' || p.categoria === 'produto')),
      configuracoes,
      opcoes,
    })
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

  const linha = catalogo.linhas.find(l => l.id === value.linhaId) || null
  const tipologiaAtual = catalogo.tipologias.find(t => t.id === value.tipologiaId) || null
  const produtoAtual = catalogo.produtos.find(p => p.id === value.produtoId) || null

  const tipologiasCompativeis = useMemo(() => {
    if (!linha) return []
    const ids = new Set(linha.tipologia_ids || [])
    return catalogo.tipologias.filter(t => ids.has(t.id)).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  }, [catalogo.tipologias, linha])

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

  const q = normalizar(busca)
  const tipologiasEncontradas = useMemo(() => {
    if (!q) return []
    return tipologiasCompativeis.filter(t => normalizar(t.label).includes(q)).slice(0, 8)
  }, [q, tipologiasCompativeis])

  const configuracoesEncontradas = useMemo(() => {
    if (!q) return []
    return configuracoesCompativeis.filter(c => {
      const t = catalogo.tipologias.find(x => x.id === c.tipologia_id)
      return normalizar(`${c.nome} ${t?.label || ''}`).includes(q)
    }).slice(0, 8)
  }, [q, configuracoesCompativeis, catalogo.tipologias])

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
      folhas: '',
      tipo: '',
      tipoOutroTexto: '',
      modoOrigem: 'manual',
    })
    setBusca('')
  }

  function selecionarTipologia(tipologiaId: string) {
    const tipologia = catalogo.tipologias.find(t => t.id === tipologiaId)
    if (!tipologia) return
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
      folhas: '',
      variaveis: {},
    })
    setBusca('')
    setFocoBusca(false)
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
    })
    setBusca('')
    setFocoBusca(false)
  }

  function mudarModo(modo: 'rapido' | 'assistido') {
    onChange({ modoConfiguracao: modo, configuracaoStatus: value.configuracaoValidada ? 'validada' : 'pendente' })
  }

  function mudarVariavel(chave: string, valor: string) {
    const novos = { ...(value.variaveis || {}), [chave]: valor }
    const obrigatorias = variaveisTipologia.filter(v => v.obrigatorio).map(v => v.variavel.chave)
    const completas = obrigatorias.every(k => Boolean(novos[k]))
    onChange({
      variaveis: novos,
      configuracaoPresetId: null,
      configuracaoNome: null,
      configuracaoValidada: false,
      configuracaoStatus: completas && Object.keys(novos).some(k => Boolean(novos[k])) ? 'preenchida' : 'pendente',
      modoConfiguracao: 'assistido',
    })
  }

  const mostrarResultados = focoBusca && Boolean(q) && Boolean(linha)

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">1. Linha</label>
          <div className="relative">
            <select value={value.linhaId || ''} onChange={e => selecionarLinha(e.target.value)} className="w-full appearance-none border border-slate-300 rounded-lg p-2.5 pr-8 text-sm bg-white">
              <option value="">Selecione a linha</option>
              {catalogo.linhas.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-3 text-slate-400" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">2. Modelo / Tipologia</label>
          <div className="relative">
            <select
              value={value.tipologiaId || ''}
              onChange={e => selecionarTipologia(e.target.value)}
              disabled={carregando || !linha || tipologiasCompativeis.length === 0}
              className="w-full appearance-none border border-slate-300 rounded-lg p-2.5 pr-8 text-sm bg-white disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">{carregando ? 'Carregando...' : !linha ? 'Selecione primeiro a linha' : tipologiasCompativeis.length ? 'Selecione o modelo' : 'Nenhum modelo disponível'}</option>
              {tipologiasCompativeis.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-3 text-slate-400" />
          </div>
          {linha && <p className="mt-1 text-[11px] text-slate-400">{tipologiasCompativeis.length} modelo(s) vinculados à linha {linha.nome}.</p>}
        </div>
      </div>

      {linha && (
        <div className="relative">
          <label className="block text-xs text-slate-500 mb-1">Pesquisar modelo ou configuração</label>
          <Search size={15} className="absolute left-3 top-[33px] text-slate-400" />
          <input
            value={busca}
            onFocus={() => setFocoBusca(true)}
            onChange={e => { setBusca(e.target.value); setFocoBusca(true) }}
            placeholder="Ex.: porta de correr 3 folhas"
            className="w-full border border-slate-300 rounded-lg py-2.5 pl-9 pr-3 text-sm"
          />
          {mostrarResultados && (
            <div className="absolute z-30 mt-1 w-full max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl p-2 space-y-2">
              {tipologiasEncontradas.map(t => (
                <button key={t.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => selecionarTipologia(t.id)} className="w-full text-left rounded-lg px-3 py-2 hover:bg-slate-50">
                  <span className="text-sm font-medium text-slate-700">{t.label}</span>
                </button>
              ))}
              {configuracoesEncontradas.map(c => (
                <button key={c.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => selecionarConfiguracao(c)} className="w-full text-left rounded-lg px-3 py-2 hover:bg-emerald-50">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><CheckCircle2 size={14} className="text-emerald-600" />{c.nome}</span>
                </button>
              ))}
              {tipologiasEncontradas.length === 0 && configuracoesEncontradas.length === 0 && <p className="px-3 py-2 text-xs text-slate-500">Nenhum resultado nessa linha.</p>}
            </div>
          )}
        </div>
      )}

      {value.tipologiaId && (
        <div>
          <div className="flex items-end justify-between gap-3 mb-2">
            <div>
              <p className="text-xs font-semibold text-slate-600">3. Escolha o projeto / configuração</p>
              <p className="text-[11px] text-slate-400">Todas as configurações validadas para o modelo selecionado.</p>
            </div>
            {configuracoesDoModelo.length > 0 && <span className="text-[11px] rounded-full bg-slate-100 px-2 py-1 text-slate-500">{configuracoesDoModelo.length} opção(ões)</span>}
          </div>

          {configuracoesDoModelo.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {configuracoesDoModelo.map(config => {
                const produto = catalogo.produtos.find(p => p.id === config.produto_id)
                const imagemCard = config.imagem_url || imagemPadraoConfiguracao(config.nome) || produto?.foto_url || null
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
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Este modelo ainda não possui configuração validada liberada para orçamento.</div>
          )}
        </div>
      )}

      {value.tipologiaId && !value.configuracaoValidada && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-slate-700">Configuração técnica</p>
              <p className="text-[11px] text-slate-500">Use um projeto validado acima ou configure as variáveis de forma assistida.</p>
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
        <div className="grid sm:grid-cols-2 gap-3 rounded-xl border border-brand-navy/15 bg-brand-navyLight/40 p-3">
          {variaveisTipologia.length === 0 && <p className="sm:col-span-2 text-xs text-slate-500">Essa tipologia ainda não possui variáveis técnicas cadastradas.</p>}
          {variaveisTipologia.map(v => {
            const opcoes = catalogo.opcoes.filter(o => o.variavel_id === v.variavel_id)
            return (
              <div key={v.id}>
                <label className="block text-xs text-slate-500 mb-1">{v.variavel.label}{v.obrigatorio ? ' *' : ''}</label>
                <select value={value.variaveis?.[v.variavel.chave] || ''} onChange={e => mudarVariavel(v.variavel.chave, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white">
                  <option value="">A definir</option>
                  {opcoes.map(o => <option key={o.id} value={o.chave}>{o.label}</option>)}
                </select>
              </div>
            )
          })}
        </div>
      )}

      {(tipologiaAtual || produtoAtual) && <div className="hidden" aria-hidden="true" />}
    </div>
  )
}
