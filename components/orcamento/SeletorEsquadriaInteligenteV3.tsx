'use client'

import { useEffect, useMemo, useState } from 'react'
import { Box, Search, X } from 'lucide-react'
import SeletorV2, {
  type SelecaoEsquadriaOrcamento,
  type StatusConfiguracaoOrcamento,
} from './SeletorEsquadriaInteligenteV2'
import TipologiaMiniatura from './TipologiaMiniatura'
import { listarTipologias } from '@/lib/tipologias'
import { listarLinhasTecnicas, type LinhaTecnica } from '@/lib/linhasTecnicas'
import { listarProdutos } from '@/lib/produtos'
import type { Produto, Tipologia } from '@/lib/tipos'

export type { SelecaoEsquadriaOrcamento, StatusConfiguracaoOrcamento }

type Props = {
  value: SelecaoEsquadriaOrcamento
  onChange: (patch: Partial<SelecaoEsquadriaOrcamento>) => void
}

type ResultadoBusca =
  | { tipo: 'tipologia'; id: string; titulo: string; subtitulo: string; tipologia: Tipologia }
  | { tipo: 'produto'; id: string; titulo: string; subtitulo: string; produto: Produto }

function normalizar(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export default function SeletorEsquadriaInteligenteV3({ value, onChange }: Props) {
  const [busca, setBusca] = useState('')
  const [focado, setFocado] = useState(false)
  const [tipologias, setTipologias] = useState<Tipologia[]>([])
  const [linhas, setLinhas] = useState<LinhaTecnica[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    Promise.all([listarTipologias(), listarLinhasTecnicas(), listarProdutos(true)]).then(([ts, ls, ps]) => {
      if (!ativo) return
      setTipologias(ts)
      setLinhas(ls.filter(l => l.ativo))
      setProdutos(ps.filter((p: any) => p.ativo !== false))
      setCarregando(false)
    })
    return () => { ativo = false }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || value.tipologiaId || carregando) return
    const raw = window.sessionStorage.getItem('atlas_orcamento_tipologia_inicial')
    if (!raw) return
    try {
      const inicial = JSON.parse(raw) as { tipologiaId?: string; linhaId?: string; linhaNome?: string }
      const tipologia = tipologias.find(t => t.id === inicial.tipologiaId)
      if (tipologia) {
        const linha = linhas.find(l => l.id === inicial.linhaId) || linhas.find(l => (l.tipologia_ids || []).includes(tipologia.id)) || null
        onChange({
          linhaId: linha?.id || null,
          linhaNome: linha?.nome || null,
          tipologiaId: tipologia.id,
          tipo: tipologia.chave,
          tipoOutroTexto: '',
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
      }
    } catch {
      // seleção inicial inválida é ignorada; o usuário continua normalmente.
    } finally {
      window.sessionStorage.removeItem('atlas_orcamento_tipologia_inicial')
    }
  }, [carregando, linhas, onChange, tipologias, value.tipologiaId])

  const resultados = useMemo<ResultadoBusca[]>(() => {
    const q = normalizar(busca)
    if (!q) return []

    const ts: ResultadoBusca[] = tipologias
      .filter(t => normalizar(`${t.label} ${t.chave} ${(t as any).categoria || ''}`).includes(q))
      .slice(0, 8)
      .map(t => {
        const linha = linhas.find(l => (l.tipologia_ids || []).includes(t.id))
        return {
          tipo: 'tipologia',
          id: `t-${t.id}`,
          titulo: t.label,
          subtitulo: linha?.nome ? `Tipologia · ${linha.nome}` : 'Tipologia',
          tipologia: t,
        }
      })

    const ps: ResultadoBusca[] = produtos
      .filter((p: any) => normalizar(`${p.nome || ''} ${p.codigo || ''} ${p.categoria || ''}`).includes(q))
      .slice(0, 6)
      .map((p: any) => ({
        tipo: 'produto',
        id: `p-${p.id}`,
        titulo: p.nome || p.codigo || 'Produto',
        subtitulo: `${p.codigo ? `${p.codigo} · ` : ''}Produto cadastrado`,
        produto: p,
      }))

    return [...ts, ...ps].slice(0, 12)
  }, [busca, linhas, produtos, tipologias])

  function selecionarTipologia(t: Tipologia) {
    const linha = linhas.find(l => (l.tipologia_ids || []).includes(t.id)) || null
    onChange({
      linhaId: linha?.id || null,
      linhaNome: linha?.nome || null,
      tipologiaId: t.id,
      tipo: t.chave,
      tipoOutroTexto: '',
      modoOrigem: 'manual',
      produtoId: null,
      precoUnit: null,
      configuracaoPresetId: null,
      configuracaoNome: null,
      configuracaoValidada: false,
      configuracaoStatus: 'pendente',
      modoConfiguracao: 'rapido',
      variaveis: {},
      folhas: '',
    })
    setBusca('')
    setFocado(false)
  }

  function selecionarProduto(p: Produto) {
    const produto = p as any
    const linha = linhas.find(l => (l.produto_ids || []).includes(p.id)) || null
    const tipologia = produto.tipologia_id ? tipologias.find(t => t.id === produto.tipologia_id) : null
    onChange({
      linhaId: linha?.id || null,
      linhaNome: linha?.nome || null,
      tipologiaId: tipologia?.id || null,
      tipo: tipologia?.chave || produto.tipo_esquadria || 'outro',
      tipoOutroTexto: tipologia ? '' : (produto.nome || ''),
      modoOrigem: 'produto',
      produtoId: p.id,
      precoUnit: produto.preco ?? null,
      largura: produto.largura_mm ? String(produto.largura_mm) : value.largura,
      altura: produto.altura_mm ? String(produto.altura_mm) : value.altura,
      configuracaoPresetId: null,
      configuracaoNome: null,
      configuracaoValidada: false,
      configuracaoStatus: 'pendente',
      modoConfiguracao: 'rapido',
      variaveis: {},
    })
    setBusca('')
    setFocado(false)
  }

  const tipologiaAtual = tipologias.find(t => t.id === value.tipologiaId) || null
  const linhaAtual = linhas.find(l => l.id === value.linhaId) || null

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-800">Pesquisar tipologia ou produto</p>
            <p className="text-[11px] text-slate-500">Digite como na busca de clientes. A lista filtra enquanto você escreve.</p>
          </div>
          {carregando && <span className="text-[10px] text-slate-400">Carregando catálogo...</span>}
        </div>

        <div className="relative">
          <Search size={17} className="absolute left-3 top-3 text-slate-400" />
          <input
            value={busca}
            onChange={e => { setBusca(e.target.value); setFocado(true) }}
            onFocus={() => setFocado(true)}
            placeholder="Ex.: porta correr, janela maxim-ar, painel ripado, código do produto..."
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          {busca && (
            <button type="button" onClick={() => setBusca('')} className="absolute right-3 top-2.5 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <X size={16} />
            </button>
          )}

          {focado && busca.trim() && (
            <div className="absolute z-50 mt-2 max-h-96 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
              {resultados.length ? resultados.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => r.tipo === 'tipologia' ? selecionarTipologia(r.tipologia) : selecionarProduto(r.produto)}
                  className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left hover:bg-blue-50"
                >
                  <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    {r.tipo === 'tipologia' ? <TipologiaMiniatura nome={r.titulo} /> : (
                      <div className="flex h-full w-full items-center justify-center text-slate-400"><Box size={24} /></div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{r.titulo}</p>
                    <p className="truncate text-[11px] text-slate-500">{r.subtitulo}</p>
                  </div>
                </button>
              )) : (
                <div className="p-4 text-center text-xs text-slate-500">Nenhuma tipologia ou produto encontrado.</div>
              )}
            </div>
          )}
        </div>

        {tipologiaAtual && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-blue-200 bg-white p-2.5">
            <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-200">
              <TipologiaMiniatura nome={tipologiaAtual.label} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Selecionada</p>
              <p className="truncate text-sm font-bold text-slate-800">{tipologiaAtual.label}</p>
              <p className="truncate text-[11px] text-slate-500">{linhaAtual?.nome || 'Linha a definir'}</p>
            </div>
          </div>
        )}
      </div>

      <SeletorV2 value={value} onChange={onChange} />
    </div>
  )
}
