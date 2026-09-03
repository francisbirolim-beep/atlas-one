'use client'

import { useEffect, useMemo, useState } from 'react'
import { ImageIcon, Search, X } from 'lucide-react'
import { listarTipologias } from '@/lib/tipologias'
import { listarLinhasTecnicas, type LinhaTecnica } from '@/lib/linhasTecnicas'
import type { Tipologia } from '@/lib/tipos'
import type { SelecaoEsquadriaOrcamento, StatusConfiguracaoOrcamento } from './SeletorEsquadriaInteligenteV3'

export type { SelecaoEsquadriaOrcamento, StatusConfiguracaoOrcamento }

type Props = {
  value: SelecaoEsquadriaOrcamento
  onChange: (patch: Partial<SelecaoEsquadriaOrcamento>) => void
}

type LinhaBusca = LinhaTecnica & { virtualBox?: boolean }

function normalizar(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function ehBox(t: Tipologia) {
  return normalizar(String((t as any).categoria || '')).includes('box') || normalizar(`${t.label} ${t.chave}`).includes('box')
}

function ehBoxCantoTexto(texto: string) {
  const q = normalizar(texto)
  return q.includes('box') && (q.includes('canto') || q.includes('angulo'))
}

function imagemTipologia(t: Tipologia) {
  const item = t as any
  return String(item.foto_url || item.imagem_url || item.desenho_url || item.thumbnail_url || '').trim() || null
}

export default function SeletorEsquadriaInteligenteV4({ value, onChange }: Props) {
  const [tipologias, setTipologias] = useState<Tipologia[]>([])
  const [linhas, setLinhas] = useState<LinhaTecnica[]>([])
  const [carregando, setCarregando] = useState(true)
  const [buscaTipologia, setBuscaTipologia] = useState('')
  const [buscaLinha, setBuscaLinha] = useState(value.linhaNome || '')
  const [linhaFocada, setLinhaFocada] = useState(false)
  const [tipologiaFocada, setTipologiaFocada] = useState(false)
  const [linhaSelecionadaId, setLinhaSelecionadaId] = useState<string | null>(value.linhaId)

  useEffect(() => {
    let ativo = true
    Promise.all([listarTipologias(), listarLinhasTecnicas()]).then(([ts, ls]) => {
      if (!ativo) return
      setTipologias(ts.filter((t: any) => t.ativo !== false))
      setLinhas(ls.filter(l => l.ativo))
      setCarregando(false)
    })
    return () => { ativo = false }
  }, [])

  const tipologiasBox = useMemo(() => tipologias.filter(ehBox), [tipologias])
  const temLinhaBoxReal = useMemo(() => linhas.some(l => normalizar(`${l.nome} ${l.chave}`).includes('box')), [linhas])

  const linhasDisponiveis = useMemo<LinhaBusca[]>(() => {
    const base: LinhaBusca[] = [...linhas]
    if (!temLinhaBoxReal && tipologiasBox.length) {
      base.push({
        id: '__box__',
        chave: 'box',
        nome: 'BOX',
        fabricante: null,
        descricao: 'Linha comercial de boxes',
        apelidos: ['BOX'],
        ativo: true,
        ordem: 900,
        tipologia_ids: tipologiasBox.map(t => t.id),
        produto_ids: [],
        virtualBox: true,
      })
    }
    return base.sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [linhas, temLinhaBoxReal, tipologiasBox])

  const linhaSelecionada = useMemo(() => {
    if (linhaSelecionadaId) return linhasDisponiveis.find(l => l.id === linhaSelecionadaId) || null
    if (value.linhaId) return linhasDisponiveis.find(l => l.id === value.linhaId) || null
    if (normalizar(value.linhaNome || '') === 'box') return linhasDisponiveis.find(l => normalizar(l.nome) === 'box') || null
    return null
  }, [linhaSelecionadaId, linhasDisponiveis, value.linhaId, value.linhaNome])

  const tipologiasDaLinha = useMemo(() => {
    if (!linhaSelecionada) return tipologias
    const ids = new Set(linhaSelecionada.tipologia_ids || [])
    if (linhaSelecionada.virtualBox) return tipologiasBox
    return tipologias.filter(t => ids.has(t.id))
  }, [linhaSelecionada, tipologias, tipologiasBox])

  const linhasFiltradas = useMemo(() => {
    const q = normalizar(buscaLinha)
    if (!q) return linhasDisponiveis.slice(0, 12)
    return linhasDisponiveis.filter(l => normalizar(`${l.nome} ${l.chave} ${(l.apelidos || []).join(' ')}`).includes(q)).slice(0, 12)
  }, [buscaLinha, linhasDisponiveis])

  const pesquisaTipologia = useMemo(() => {
    const q = normalizar(buscaTipologia)
    if (!q) return []
    return tipologiasDaLinha
      .filter(t => normalizar(`${t.label} ${t.chave} ${(t as any).categoria || ''}`).includes(q))
      .slice(0, 20)
  }, [buscaTipologia, tipologiasDaLinha])

  const tipologiaAtual = tipologias.find(t => t.id === value.tipologiaId) || null
  const boxCanto = Boolean(
    (tipologiaAtual && ehBoxCantoTexto(`${tipologiaAtual.label} ${tipologiaAtual.chave}`)) ||
    ehBoxCantoTexto(value.tipoOutroTexto || '') ||
    value.variaveis?.atlas_medida_layout === 'box_canto'
  )

  function linhaDaTipologia(t: Tipologia) {
    return linhaSelecionada
      || linhasDisponiveis.find(l => (l.tipologia_ids || []).includes(t.id))
      || (ehBox(t) ? linhasDisponiveis.find(l => normalizar(l.nome) === 'box') : null)
  }

  function mudarDescricaoLivre(texto: string) {
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
      modoOrigem: 'manual',
      variaveis: ehBoxCantoTexto(texto) ? { ...value.variaveis, atlas_medida_layout: 'box_canto' } : {},
    })
  }

  function selecionarLinha(linha: LinhaBusca) {
    setLinhaSelecionadaId(linha.id)
    setBuscaLinha(linha.nome)
    setLinhaFocada(false)
    setBuscaTipologia('')
    setTipologiaFocada(false)
    onChange({
      linhaId: linha.virtualBox ? null : linha.id,
      linhaNome: linha.nome,
      tipologiaId: null,
      produtoId: null,
      precoUnit: null,
      configuracaoPresetId: null,
      configuracaoNome: null,
      configuracaoValidada: false,
      configuracaoStatus: 'pendente',
      modoConfiguracao: 'rapido',
      modoOrigem: 'manual',
      variaveis: {},
    })
  }

  function limparLinha() {
    setLinhaSelecionadaId(null)
    setBuscaLinha('')
    setLinhaFocada(false)
    setBuscaTipologia('')
    onChange({
      linhaId: null,
      linhaNome: null,
      tipologiaId: null,
      produtoId: null,
      precoUnit: null,
      configuracaoPresetId: null,
      configuracaoNome: null,
      configuracaoValidada: false,
      configuracaoStatus: 'pendente',
      modoConfiguracao: 'rapido',
      modoOrigem: 'manual',
      variaveis: {},
    })
  }

  function selecionarTipologia(t: Tipologia) {
    const linhaReal = linhaDaTipologia(t)
    const canto = ehBoxCantoTexto(`${t.label} ${t.chave}`)

    if (linhaReal) {
      setLinhaSelecionadaId(linhaReal.id)
      setBuscaLinha(linhaReal.nome)
    }
    setBuscaTipologia(t.label)
    setTipologiaFocada(false)

    onChange({
      linhaId: linhaReal?.virtualBox ? null : (linhaReal?.id || value.linhaId || null),
      linhaNome: linhaReal?.nome || value.linhaNome || null,
      tipologiaId: t.id,
      tipo: t.chave || 'outro',
      tipoOutroTexto: value.tipoOutroTexto,
      modoOrigem: 'manual',
      produtoId: null,
      precoUnit: null,
      configuracaoPresetId: null,
      configuracaoNome: null,
      configuracaoValidada: false,
      configuracaoStatus: 'pendente',
      modoConfiguracao: 'rapido',
      variaveis: canto ? { ...value.variaveis, atlas_medida_layout: 'box_canto' } : {},
    })
  }

  function alterarMedidaBox(chave: 'esquerda' | 'direita' | 'altura', valor: string) {
    if (chave === 'esquerda') {
      onChange({ largura: valor, variaveis: { ...value.variaveis, atlas_medida_layout: 'box_canto', largura_esquerda_mm: valor } })
      return
    }
    if (chave === 'direita') {
      onChange({ variaveis: { ...value.variaveis, atlas_medida_layout: 'box_canto', largura_direita_mm: valor } })
      return
    }
    onChange({ altura: valor, variaveis: { ...value.variaveis, atlas_medida_layout: 'box_canto', altura_mm: valor } })
  }

  return (
    <div className={`atlas-orcamento-selector-v4 space-y-4 ${boxCanto ? 'atlas-box-canto-selector' : ''}`}>
      <style jsx global>{`
        .atlas-orcamento-selector-v4 + div:has(> label) { display: none; }
        .atlas-box-canto-selector + div + div.grid.grid-cols-3.gap-3 { display: none; }
      `}</style>

      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3">
        <label className="mb-1 block text-xs font-semibold text-slate-700">2. Descrição livre da esquadria <span className="font-normal text-slate-400">(opcional)</span></label>
        <input
          type="text"
          value={value.tipoOutroTexto || ''}
          onChange={e => mudarDescricaoLivre(e.target.value)}
          placeholder="Ex.: Porta de correr 3 folhas - Com reforço"
          className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm"
        />
        <p className="mt-1.5 text-[11px] text-blue-800">Você pode seguir somente com esta descrição. Linha e tipologia cadastradas são opcionais.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
        <label className="mb-1 block text-xs font-semibold text-slate-700">3. Linha <span className="font-normal text-slate-400">(opcional)</span></label>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input
            value={buscaLinha}
            onChange={e => {
              setBuscaLinha(e.target.value)
              setLinhaFocada(true)
              setLinhaSelecionadaId(null)
              onChange({ linhaId: null, linhaNome: null, tipologiaId: null })
            }}
            onFocus={() => setLinhaFocada(true)}
            placeholder="Digite: Suprema, Linha 30, Linha 42, BOX..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-9 text-sm"
          />
          {buscaLinha && <button type="button" onClick={limparLinha} className="absolute right-2.5 top-2.5 p-1 text-slate-400"><X size={15}/></button>}
          {linhaFocada && (
            <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
              {linhasFiltradas.map(l => (
                <button key={l.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => selecionarLinha(l)} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50">
                  <span className="block text-sm font-semibold text-slate-800">{l.nome}</span>
                  {l.fabricante && <span className="text-[11px] text-slate-500">{l.fabricante}</span>}
                </button>
              ))}
              {!linhasFiltradas.length && <div className="p-3 text-xs text-slate-500">Nenhuma linha encontrada. Você pode deixar a linha em branco.</div>}
            </div>
          )}
        </div>
        {linhaSelecionada && <p className="mt-1.5 text-[11px] text-slate-500">A pesquisa abaixo mostrará somente tipologias vinculadas à linha <strong>{linhaSelecionada.nome}</strong>.</p>}
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
        <label className="mb-1 block text-xs font-semibold text-slate-700">4. Pesquisar tipologia <span className="font-normal text-slate-400">(opcional)</span></label>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input
            value={buscaTipologia}
            onChange={e => { setBuscaTipologia(e.target.value); setTipologiaFocada(true) }}
            onFocus={() => setTipologiaFocada(true)}
            placeholder={linhaSelecionada ? `Pesquisar somente em ${linhaSelecionada.nome}...` : 'Digite: porta giro, correr 3, box de canto, maxim-ar...'}
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-9 text-sm"
          />
          {buscaTipologia && <button type="button" onClick={() => setBuscaTipologia('')} className="absolute right-2.5 top-2.5 p-1 text-slate-400"><X size={15}/></button>}
          {tipologiaFocada && buscaTipologia.trim() && (
            <div className="absolute z-50 mt-1 max-h-[420px] w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
              {pesquisaTipologia.length ? pesquisaTipologia.map(t => {
                const linhaResultado = linhaDaTipologia(t)
                const imagem = imagemTipologia(t)
                return (
                  <button key={t.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => selecionarTipologia(t)} className="mb-1 flex w-full items-center gap-3 rounded-xl border border-transparent px-2 py-2 text-left hover:border-emerald-200 hover:bg-emerald-50">
                    <span className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      {imagem ? (
                        <img src={imagem} alt={`Desenho de ${t.label}`} className="h-full w-full object-contain" />
                      ) : (
                        <span className="flex flex-col items-center gap-1 px-1 text-center text-[9px] leading-tight text-slate-400"><ImageIcon size={18}/><span>Desenho pendente</span></span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-800">{t.label}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-500">{(t as any).categoria || 'Tipologia'}</span>
                      <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{linhaResultado?.nome || 'Linha não vinculada'}</span>
                    </span>
                  </button>
                )
              }) : (
                <div className="p-3 text-xs text-slate-500">
                  {linhaSelecionada
                    ? `Nenhuma tipologia encontrada na linha ${linhaSelecionada.nome}. Você pode continuar pela descrição livre ou limpar a linha.`
                    : 'Nenhuma tipologia encontrada. Você pode continuar pela descrição livre.'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {boxCanto && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3">
          <p className="mb-2 text-xs font-semibold text-violet-800">Medidas do Box de Canto</p>
          <div className="grid gap-3 sm:grid-cols-4">
            <div><label className="mb-1 block text-xs text-slate-600">Largura esquerda (mm)</label><input type="number" value={value.variaveis?.largura_esquerda_mm || value.largura || ''} onChange={e => alterarMedidaBox('esquerda', e.target.value)} placeholder="900" className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm"/></div>
            <div><label className="mb-1 block text-xs text-slate-600">Largura direita (mm)</label><input type="number" value={value.variaveis?.largura_direita_mm || ''} onChange={e => alterarMedidaBox('direita', e.target.value)} placeholder="1200" className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm"/></div>
            <div><label className="mb-1 block text-xs text-slate-600">Altura (mm)</label><input type="number" value={value.altura || ''} onChange={e => alterarMedidaBox('altura', e.target.value)} placeholder="2000" className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm"/></div>
            <div className="flex items-end"><div className="w-full rounded-lg border border-violet-100 bg-white px-3 py-2.5 text-xs text-violet-700">Somente Box de Canto usa duas larguras.</div></div>
          </div>
        </div>
      )}

      {carregando && <p className="text-[11px] text-slate-400">Carregando catálogo...</p>}
    </div>
  )
}
