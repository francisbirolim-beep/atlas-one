'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, ChevronDown, RotateCcw, Settings2, ShieldCheck } from 'lucide-react'
import { listarTodasOpcoes, listarVariaveisDaTipologia, type EngenhariaVariavelOpcao, type TipologiaVariavelComVariavel } from '@/lib/engenhariaVariaveis'
import { supabase } from '@/lib/supabase'
import type { SelecaoEsquadriaOrcamento } from './SeletorEsquadriaInteligenteV4'

type Props = {
  value: SelecaoEsquadriaOrcamento
  onChange: (patch: Partial<SelecaoEsquadriaOrcamento>) => void
}

type ReferenciaVariavel = {
  id: string
  variavelId: string | null
  chave: string
  label: string
  valor: string
  valorRaw: string | null
  evidencia: string | null
}

type Referencia = {
  referenciaId: string
  tipologiaId: string
  linha: string
  modelo: string
  imagemUrl: string | null
  ocorrencias: number
  variaveis: ReferenciaVariavel[]
  resumoComponentes?: {
    perfis: number
    acessorios: number
    vidros: number
    mapeados: number
  }
}

const GRUPOS: Array<{ titulo: string; chaves: string[] }> = [
  {
    titulo: 'Estrutura e montagem',
    chaves: ['folhas', 'trilho', 'perfil_contramarco', 'montagem_contramarco', 'arremate', 'arremate_piso', 'montagem'],
  },
  {
    titulo: 'Folhas, montantes e reforços',
    chaves: ['perfil_superior_folha', 'montante_lateral_movel', 'montante_mao_amigo', 'usa_travessa', 'baguete'],
  },
  {
    titulo: 'Ferragens',
    chaves: ['modo_fechamento', 'puxador', 'roldana'],
  },
  {
    titulo: 'Folgas de fabricação',
    chaves: ['folga_largura_mm', 'folga_altura_mm'],
  },
]

function normalizarNumero(valor: string) {
  return valor.replace(',', '.').replace(/[^0-9.-]/g, '')
}

export default function ConfiguradorTecnicoWvetro({ value, onChange }: Props) {
  const [variaveis, setVariaveis] = useState<TipologiaVariavelComVariavel[]>([])
  const [opcoes, setOpcoes] = useState<EngenhariaVariavelOpcao[]>([])
  const [referencia, setReferencia] = useState<Referencia | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [aberto, setAberto] = useState(true)
  const inicializadoRef = useRef<string | null>(null)

  useEffect(() => {
    let ativo = true
    const tipologiaId = value.tipologiaId
    if (!tipologiaId) {
      setVariaveis([])
      setReferencia(null)
      inicializadoRef.current = null
      return
    }

    setCarregando(true)
    void (async () => {
      const [vars, todasOpcoes, sessao] = await Promise.all([
        listarVariaveisDaTipologia(tipologiaId),
        listarTodasOpcoes(),
        supabase.auth.getSession(),
      ])
      if (!ativo) return
      setVariaveis(vars)
      setOpcoes(todasOpcoes)

      let ref: Referencia | null = null
      const token = sessao.data.session?.access_token
      if (token) {
        try {
          const resposta = await fetch('/api/orcamento/wvetro-referencias', {
            cache: 'no-store',
            headers: { Authorization: `Bearer ${token}` },
          })
          if (resposta.ok) {
            const json = await resposta.json()
            ref = (json?.referencias?.[tipologiaId] || null) as Referencia | null
          }
        } catch {
          ref = null
        }
      }

      if (!ativo) return
      setReferencia(ref)
      setCarregando(false)
      setAberto(true)

      if (vars.length > 0 && inicializadoRef.current !== tipologiaId) {
        inicializadoRef.current = tipologiaId
        const atuais = value.variaveis || {}
        const defaults: Record<string, string> = { ...atuais }

        for (const v of ref?.variaveis || []) {
          if (!defaults[v.chave] && v.valor) defaults[v.chave] = v.valor
        }

        if (!defaults.folhas && value.folhas) defaults.folhas = value.folhas

        const obrigatorias = vars.filter(v => v.obrigatorio).map(v => v.variavel.chave)
        const completas = obrigatorias.every(chave => Boolean(defaults[chave]))
        onChange({
          modoConfiguracao: 'assistido',
          configuracaoValidada: false,
          configuracaoPresetId: null,
          configuracaoNome: null,
          configuracaoStatus: completas ? 'preenchida' : 'pendente',
          variaveis: defaults,
          folhas: defaults.folhas || value.folhas,
        })
      }
    })()

    return () => { ativo = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.tipologiaId])

  const referenciasPorChave = useMemo(() => {
    const mapa = new Map<string, ReferenciaVariavel>()
    for (const item of referencia?.variaveis || []) mapa.set(item.chave, item)
    return mapa
  }, [referencia])

  const porChave = useMemo(() => {
    const mapa = new Map<string, TipologiaVariavelComVariavel>()
    for (const item of variaveis) mapa.set(item.variavel.chave, item)
    return mapa
  }, [variaveis])

  const grupos = useMemo(() => {
    const usados = new Set<string>()
    const resultado = GRUPOS.map(grupo => {
      const itens = grupo.chaves.map(chave => porChave.get(chave)).filter(Boolean) as TipologiaVariavelComVariavel[]
      itens.forEach(item => usados.add(item.variavel.chave))
      return { titulo: grupo.titulo, itens }
    }).filter(grupo => grupo.itens.length > 0)

    const outros = variaveis.filter(item => !usados.has(item.variavel.chave))
    if (outros.length) resultado.push({ titulo: 'Outras variáveis', itens: outros })
    return resultado
  }, [porChave, variaveis])

  const obrigatorias = variaveis.filter(v => v.obrigatorio)
  const preenchidas = obrigatorias.filter(v => Boolean(value.variaveis?.[v.variavel.chave])).length
  const completo = obrigatorias.length > 0 && preenchidas === obrigatorias.length

  function mudar(chave: string, valor: string) {
    const novos = { ...(value.variaveis || {}), [chave]: valor }
    const completas = obrigatorias.every(v => Boolean(novos[v.variavel.chave]))
    onChange({
      variaveis: novos,
      folhas: chave === 'folhas' ? valor : value.folhas,
      modoConfiguracao: 'assistido',
      configuracaoValidada: false,
      configuracaoPresetId: null,
      configuracaoNome: null,
      configuracaoStatus: completas ? 'preenchida' : 'pendente',
    })
  }

  function aplicarPadrao() {
    if (!referencia) return
    const novos = { ...(value.variaveis || {}) }
    for (const ref of referencia.variaveis) if (ref.valor) novos[ref.chave] = ref.valor
    const completas = obrigatorias.every(v => Boolean(novos[v.variavel.chave]))
    onChange({
      variaveis: novos,
      folhas: novos.folhas || value.folhas,
      modoConfiguracao: 'assistido',
      configuracaoStatus: completas ? 'preenchida' : 'pendente',
      configuracaoValidada: false,
      configuracaoPresetId: null,
      configuracaoNome: null,
    })
  }

  if (!value.tipologiaId) return null
  if (carregando) return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
      Carregando configuração técnica da tipologia...
    </div>
  )
  if (!variaveis.length) return null

  return (
    <section className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setAberto(v => !v)}
        className="flex w-full items-center justify-between gap-3 border-b border-blue-100 bg-blue-50/70 px-4 py-3 text-left"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="rounded-xl bg-blue-600 p-2 text-white"><Settings2 size={18}/></span>
          <div className="min-w-0">
            <p className="font-bold text-slate-900">Configuração técnica da esquadria</p>
            <p className="truncate text-[11px] text-slate-600">
              {referencia ? `Padrão de referência W.Vetro · ${referencia.linha} · ${referencia.modelo}` : 'Variáveis técnicas cadastradas no Atlas'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${completo ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
            {preenchidas}/{obrigatorias.length}
          </span>
          <ChevronDown size={17} className={`transition ${aberto ? 'rotate-180' : ''}`}/>
        </div>
      </button>

      {aberto && (
        <div className="space-y-4 p-4">
          {referencia && (
            <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-800">
                  <ShieldCheck size={15}/> Padrão capturado do W.Vetro
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-blue-700">
                  Os valores de referência entram preenchidos como no W.Vetro e podem ser alterados para esta peça.
                </p>
                {referencia.resumoComponentes && (
                  <p className="mt-1 text-[10px] text-blue-600">
                    Referência histórica: {referencia.resumoComponentes.perfis} perfis · {referencia.resumoComponentes.acessorios} acessórios · {referencia.resumoComponentes.vidros} vidro(s).
                  </p>
                )}
              </div>
              <button type="button" onClick={aplicarPadrao} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100">
                <RotateCcw size={14}/> Restaurar padrão W.Vetro
              </button>
            </div>
          )}

          {grupos.map(grupo => (
            <div key={grupo.titulo} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">{grupo.titulo}</p>
              <div className="grid gap-3 md:grid-cols-2">
                {grupo.itens.map(item => {
                  const chave = item.variavel.chave
                  const valor = value.variaveis?.[chave] || ''
                  const lista = opcoes.filter(o => o.variavel_id === item.variavel_id)
                  const ref = referenciasPorChave.get(chave)
                  const usaReferencia = Boolean(ref?.valor && valor === ref.valor)

                  return (
                    <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="mb-1.5 flex items-start justify-between gap-2">
                        <label className="text-xs font-semibold leading-snug text-slate-700">
                          {item.variavel.label}{item.obrigatorio ? ' *' : ''}
                        </label>
                        {usaReferencia && <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[8px] font-bold text-blue-700">WVETRO</span>}
                      </div>

                      {lista.length ? (
                        <select
                          value={valor}
                          onChange={e => mudar(chave, e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm"
                        >
                          <option value="">Selecione</option>
                          {lista.map(opcao => <option key={opcao.id} value={opcao.chave}>{opcao.label}</option>)}
                        </select>
                      ) : (
                        <input
                          type="number"
                          inputMode="decimal"
                          value={valor}
                          onChange={e => mudar(chave, normalizarNumero(e.target.value))}
                          placeholder="Informe o valor"
                          className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm"
                        />
                      )}

                      {ref?.valorRaw && (
                        <p className="mt-1.5 text-[9px] text-slate-400">Referência W.Vetro: {ref.valorRaw}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold ${completo ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            <CheckCircle2 size={15}/>
            {completo
              ? 'Configuração técnica completa. Esta peça pode seguir para o orçamento.'
              : `Faltam ${Math.max(0, obrigatorias.length - preenchidas)} variável(is) obrigatória(s).`}
          </div>
        </div>
      )}
    </section>
  )
}
