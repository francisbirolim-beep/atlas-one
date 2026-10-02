'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, Settings2, X } from 'lucide-react'
import {
  listarTodasOpcoes,
  listarVariaveisDaTipologia,
  type EngenhariaVariavelOpcao,
  type TipologiaVariavelComVariavel,
} from '@/lib/engenhariaVariaveis'
import { listarTipologias } from '@/lib/tipologias'
import { listarTodasFormulasCorte, type RegistroFormulaCorte } from '@/lib/engenhariaFormulasCorte'
import { supabase } from '@/lib/supabase'
import type { Tipologia } from '@/lib/tipos'
import TipologiaMiniatura from './TipologiaMiniatura'
import type { SelecaoEsquadriaOrcamento } from './SeletorEsquadriaInteligenteV3'

type Props = {
  value: SelecaoEsquadriaOrcamento
  onChange: (patch: Partial<SelecaoEsquadriaOrcamento>) => void
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

type CampoExtra = {
  chave: string
  label: string
  tipo: 'select' | 'number'
  opcoes?: Array<{ chave: string; label: string }>
  defaultValue?: string
}

const CAMPOS_WVETRO: CampoExtra[] = [
  {
    chave: 'wvetro_cor_acessorios',
    label: 'Cor acessórios',
    tipo: 'select',
    defaultValue: 'preto',
    opcoes: [
      { chave: 'preto', label: 'Preto' },
      { chave: 'branco', label: 'Branco' },
      { chave: 'mesma_cor_perfil', label: 'Mesma cor do perfil' },
    ],
  },
  {
    chave: 'wvetro_cor_aluminio',
    label: 'Cor alumínio / perfil',
    tipo: 'select',
    defaultValue: 'preto',
    opcoes: [
      { chave: 'preto', label: 'Preto' },
      { chave: 'branco', label: 'Branco' },
      { chave: 'madeirado', label: 'Amadeirado' },
      { chave: 'outro', label: 'Outra cor' },
    ],
  },
  {
    chave: 'vidro',
    label: 'Vidro',
    tipo: 'select',
    defaultValue: 'incolor_06mm',
    opcoes: [
      { chave: 'incolor_06mm', label: 'Incolor 06 mm' },
      { chave: 'incolor_08mm', label: 'Incolor 08 mm' },
      { chave: 'laminado', label: 'Laminado' },
      { chave: 'miniboreal', label: 'Mini boreal' },
      { chave: 'outro', label: 'Outro' },
    ],
  },
  {
    chave: 'wvetro_tipo_medida_contramarco',
    label: 'Tipo medida contramarco',
    tipo: 'select',
    defaultValue: 'externa',
    opcoes: [
      { chave: 'externa', label: 'Externa' },
      { chave: 'interna', label: 'Interna' },
    ],
  },
  { chave: 'wvetro_ordem', label: 'Ordem', tipo: 'number', defaultValue: '1' },
]

const DEFAULT_PC4_SUPREMA: Record<string, string> = {
  trilho: 'embutir',
  perfil_contramarco: 'cm060',
  montagem_contramarco: 'conexao_cunha',
  arremate: 'face_interna',
  arremate_piso: 'nao',
  montagem: 'todas_moveis',
  perfil_superior_folha: 'su053',
  montante_lateral_movel: 'largo_reforco_aba',
  montante_mao_amigo: 'comum_sem_reforco',
  usa_travessa: 'nao',
  baguete: 'quadrado',
  modo_fechamento: 'fechadura',
  puxador: 'nao',
  roldana: '100kg',
  folga_largura_mm: '4',
  folga_altura_mm: '4',
  folhas: '4',
}

function normalizar(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function folhasDaTipologia(tipologia: Tipologia | null) {
  if (!tipologia) return ''
  const texto = normalizar(`${tipologia.label} ${tipologia.chave}`)
  const match = texto.match(/(?:^|\s)(\d{1,2})\s*folhas?\b/)
  if (!match) return ''
  const numero = Number.parseInt(match[1], 10)
  return Number.isFinite(numero) && numero > 0 ? String(numero) : ''
}

async function carregarReferenciaWVetro(tipologiaId: string): Promise<ReferenciaTipologiaWVetro | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return null
  try {
    const resposta = await fetch('/api/orcamento/wvetro-referencias', {
      method: 'GET',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!resposta.ok) return null
    const json = await resposta.json().catch(() => ({}))
    return (json?.referencias?.[tipologiaId] || null) as ReferenciaTipologiaWVetro | null
  } catch {
    return null
  }
}

function defaultsParaTipologia(tipologia: Tipologia | null) {
  const base = Object.fromEntries(CAMPOS_WVETRO.map(campo => [campo.chave, campo.defaultValue || '']))
  if (!tipologia) return base
  const texto = normalizar(`${tipologia.label} ${tipologia.chave}`)
  if (texto.includes('porta de correr 04 folhas') && texto.includes('suprema')) {
    return { ...base, ...DEFAULT_PC4_SUPREMA }
  }
  return base
}

function valorCompleto(valor?: string | null) {
  return Boolean(String(valor || '').trim())
}

export default function ConfiguradorTecnicoWVetro({ value, onChange }: Props) {
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [tipologia, setTipologia] = useState<Tipologia | null>(null)
  const [variaveis, setVariaveis] = useState<TipologiaVariavelComVariavel[]>([])
  const [opcoes, setOpcoes] = useState<EngenhariaVariavelOpcao[]>([])
  const [referenciaWVetro, setReferenciaWVetro] = useState<ReferenciaTipologiaWVetro | null>(null)
  const [formulaSelecionada, setFormulaSelecionada] = useState<RegistroFormulaCorte | null>(null)
  const [rascunho, setRascunho] = useState<Record<string, string>>({})

  useEffect(() => {
    let ativo = true
    if (!value.tipologiaId) {
      setTipologia(null)
      setVariaveis([])
      setOpcoes([])
      setReferenciaWVetro(null)
      setFormulaSelecionada(null)
      return
    }

    setCarregando(true)
    Promise.all([
      listarTipologias(),
      listarVariaveisDaTipologia(value.tipologiaId),
      listarTodasOpcoes(),
      carregarReferenciaWVetro(value.tipologiaId),
      listarTodasFormulasCorte(),
    ]).then(([tipologias, vars, todasOpcoes, referencia, formulas]) => {
      if (!ativo) return
      const atual = tipologias.find(t => t.id === value.tipologiaId) || null
      setTipologia(atual)
      setVariaveis(vars)
      setOpcoes(todasOpcoes)
      setReferenciaWVetro(referencia)
      const candidatas = formulas
        .filter(formula => formula.tipologia_id === value.tipologiaId && formula.variaveis.length > 0)
        .sort((a, b) => Number(b.ativo) - Number(a.ativo) || (b.status === 'validada' ? 1 : 0) - (a.status === 'validada' ? 1 : 0) || b.variaveis.length - a.variaveis.length || b.versao - a.versao)
      setFormulaSelecionada(candidatas[0] || null)
      setCarregando(false)
    }).catch(() => {
      if (ativo) setCarregando(false)
    })

    return () => { ativo = false }
  }, [value.tipologiaId])

  const folhasDefinidas = useMemo(() => folhasDaTipologia(tipologia), [tipologia])

  const variaveisVisiveis = useMemo(
    () => variaveis.filter(v => !(folhasDefinidas && v.variavel.chave === 'folhas')),
    [variaveis, folhasDefinidas],
  )

  const variaveisFormulaVisiveis = useMemo(() => {
    const chavesFormais = new Set(variaveisVisiveis.map(v => v.variavel.chave))
    return (formulaSelecionada?.variaveis || []).filter(v => {
      if (!v.chave || chavesFormais.has(v.chave)) return false
      if (folhasDefinidas && v.chave === 'folhas') return false
      return !['cor', 'vidro'].includes(v.chave)
    })
  }, [formulaSelecionada, variaveisVisiveis, folhasDefinidas])

  const defaults = useMemo(() => {
    const base = defaultsParaTipologia(tipologia)
    const historico = Object.fromEntries(
      (referenciaWVetro?.variaveis || [])
        .filter(v => v.chave && v.valor)
        .map(v => [v.chave, v.valor]),
    )
    if (folhasDefinidas) historico.folhas = folhasDefinidas
    return { ...base, ...historico }
  }, [tipologia, referenciaWVetro, folhasDefinidas])

  const obrigatorias = useMemo(
    () => variaveisVisiveis.filter(v => v.obrigatorio),
    [variaveisVisiveis],
  )

  const preenchidas = useMemo(
    () => obrigatorias.filter(v => valorCompleto(value.variaveis?.[v.variavel.chave])).length,
    [obrigatorias, value.variaveis],
  )

  const completa = obrigatorias.length > 0 && preenchidas === obrigatorias.length

  function rotuloValor(chave: string, valor: string) {
    const campo = CAMPOS_WVETRO.find(item => item.chave === chave)
    const opcaoCampo = campo?.opcoes?.find(item => item.chave === valor)
    if (opcaoCampo) return opcaoCampo.label
    const variavel = variaveis.find(item => item.variavel.chave === chave)
    const opcao = opcoes.find(item => item.variavel_id === variavel?.variavel_id && item.chave === valor)
    if (opcao) return opcao.label
    return valor.replaceAll('_', ' ')
  }

  function montarResumo(valores: Record<string, string>) {
    const ignorar = new Set(['wvetro_ordem', 'folga_largura_mm', 'folga_altura_mm', 'folhas'])
    return Object.entries(valores)
      .filter(([chave, valor]) => valorCompleto(valor) && !ignorar.has(chave))
      .map(([chave, valor]) => ({
        chave,
        label: CAMPOS_WVETRO.find(item => item.chave === chave)?.label
          || variaveis.find(item => item.variavel.chave === chave)?.variavel.label
          || chave.replaceAll('_', ' '),
        valor: rotuloValor(chave, valor),
      }))
      .slice(0, 14)
  }

  const resumoSalvo = montarResumo(value.variaveis || {})
  const resumoAoVivo = montarResumo(rascunho)

  function abrir() {
    const base = {
      ...defaults,
      ...(value.variaveis || {}),
    }
    setRascunho(base)
    setAberto(true)
  }

  function alterar(chave: string, valor: string) {
    setRascunho(prev => ({ ...prev, [chave]: valor }))
  }

  function confirmar() {
    const obrigatoriasCompletas = obrigatorias.every(v => valorCompleto(rascunho[v.variavel.chave]))
    onChange({
      variaveis: { ...rascunho, ...(folhasDefinidas ? { folhas: folhasDefinidas } : {}) },
      folhas: folhasDefinidas || rascunho.folhas || value.folhas,
      configuracaoPresetId: null,
      configuracaoNome: tipologia?.label || value.configuracaoNome,
      configuracaoValidada: false,
      modoConfiguracao: 'assistido',
      configuracaoStatus: obrigatoriasCompletas ? 'preenchida' : 'pendente',
    })
    setAberto(false)
  }

  if (!value.tipologiaId) return null

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <div className="aspect-[4/3]">
              <TipologiaMiniatura nome={tipologia?.label || value.tipoOutroTexto || value.tipo || 'Esquadria'} />
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-600">Projeto / configuração técnica</p>
                <h3 className="mt-1 text-base font-bold text-slate-900">{tipologia?.label || 'Tipologia selecionada'}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Mesmo conceito do W.Vetro: a tipologia define quais variáveis precisam ser informadas antes do cálculo técnico.
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${completa ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                {carregando ? 'Carregando...' : completa ? 'VARIÁVEIS PREENCHIDAS' : `${preenchidas}/${obrigatorias.length} OBRIGATÓRIAS`}
              </span>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-[10px] uppercase text-slate-400">Linha</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">{value.linhaNome || 'A definir'}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-[10px] uppercase text-slate-400">Folhas</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">{folhasDefinidas || value.variaveis?.folhas || value.folhas || 'A definir'}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-[10px] uppercase text-slate-400">Vidro</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">{value.variaveis?.vidro ? value.variaveis.vidro.replaceAll('_', ' ') : 'A definir'}</p>
              </div>
            </div>

            {resumoSalvo.length > 0 && (
              <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">Configuração atual</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {resumoSalvo.map(item => <span key={item.chave} className="rounded-lg border border-blue-100 bg-white px-2 py-1 text-[11px] text-slate-700"><b>{item.label}:</b> {item.valor}</span>)}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={abrir}
              disabled={carregando}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-navy px-4 py-3 text-sm font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-60 sm:w-auto"
            >
              <Settings2 size={17} />
              {Object.keys(value.variaveis || {}).length ? 'Revisar variáveis' : 'Informar variáveis'}
            </button>
          </div>
        </div>
      </div>

      {aberto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-2 sm:p-4">
          <div className="flex max-h-[96dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between border-b border-slate-200 px-4 py-3 sm:px-5 sm:py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-600">Clone funcional W.Vetro</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">Informe as variáveis</h2>
                <p className="mt-1 text-xs text-slate-500">{tipologia?.label} · {value.linhaNome || 'Linha a definir'}</p>
              </div>
              <button type="button" onClick={() => setAberto(false)} aria-label="Fechar variáveis" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X size={19} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
              <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                <aside className="self-start lg:sticky lg:top-0">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    <div className="aspect-[4/3]">
                      <TipologiaMiniatura nome={tipologia?.label || value.tipo || 'Esquadria'} />
                    </div>
                    <div className="border-t border-slate-200 bg-white p-3">
                      <p className="text-xs font-bold text-slate-800">{tipologia?.label}</p>
                      <p className="mt-1 text-[11px] text-slate-500">As opções abaixo ficam gravadas junto com o item do orçamento e serão a entrada da receita técnica / plano de corte.</p>
                    </div>
                  </div>
                  {resumoAoVivo.length > 0 && (
                    <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">Configuração atual</p>
                      <div className="mt-2 space-y-1.5">
                        {resumoAoVivo.map(item => <div key={item.chave} className="rounded-lg bg-white px-2.5 py-2 text-[11px] text-slate-700"><b>{item.label}:</b> {item.valor}</div>)}
                      </div>
                      <p className="mt-2 text-[10px] text-blue-700">Este resumo muda na hora conforme você altera as variáveis.</p>
                    </div>
                  )}
                </aside>

                <div className="space-y-5">
                  <section>
                    <div className="mb-2">
                      <h3 className="text-sm font-bold text-slate-800">Dados do projeto</h3>
                      <p className="text-[11px] text-slate-500">Campos equivalentes aos que aparecem antes das variáveis no W.Vetro.</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {CAMPOS_WVETRO.map(campo => (
                        <label key={campo.chave} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <span className="mb-1.5 block text-xs font-semibold text-slate-700">{campo.label}</span>
                          {campo.tipo === 'select' ? (
                            <div className="relative">
                              <select
                                value={rascunho[campo.chave] || ''}
                                onChange={e => alterar(campo.chave, e.target.value)}
                                className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-9 text-sm"
                              >
                                <option value="">A definir</option>
                                {(campo.opcoes || []).map(opcao => <option key={opcao.chave} value={opcao.chave}>{opcao.label}</option>)}
                              </select>
                              <ChevronDown size={15} className="pointer-events-none absolute right-3 top-3 text-slate-400" />
                            </div>
                          ) : (
                            <input
                              type="number"
                              value={rascunho[campo.chave] || ''}
                              onChange={e => alterar(campo.chave, e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                            />
                          )}
                        </label>
                      ))}
                    </div>
                  </section>

                  <section>
                    <div className="mb-2 flex items-end justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">Variáveis técnicas da tipologia</h3>
                        <p className="text-[11px] text-slate-500">A lista vem do cadastro técnico do Atlas e os valores históricos disponíveis são carregados da própria referência W.Vetro da tipologia selecionada.</p>
                      </div>
                      <span className="text-[11px] text-slate-500">{obrigatorias.length} obrigatória(s)</span>
                    </div>

                    {variaveisVisiveis.length ? (
                      <div className="space-y-2.5">
                        {variaveisVisiveis.map(item => {
                          const lista = opcoes.filter(opcao => opcao.variavel_id === item.variavel_id)
                          const chave = item.variavel.chave
                          const atual = rascunho[chave] || ''
                          return (
                            <div key={item.id} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,340px)] sm:items-center">
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{item.variavel.label}{item.obrigatorio ? ' *' : ''}</p>
                                <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">{chave}</p>
                              </div>
                              {lista.length ? (
                                <div className="relative">
                                  <select
                                    value={atual}
                                    onChange={e => alterar(chave, e.target.value)}
                                    className={`w-full appearance-none rounded-lg border px-3 py-2.5 pr-9 text-sm ${atual ? 'border-rose-200 bg-rose-50' : 'border-slate-300 bg-white'}`}
                                  >
                                    <option value="">Selecione</option>
                                    {lista.map(opcao => <option key={opcao.id} value={opcao.chave}>{opcao.label}</option>)}
                                  </select>
                                  <ChevronDown size={15} className="pointer-events-none absolute right-3 top-3 text-slate-400" />
                                </div>
                              ) : (
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  value={atual}
                                  onChange={e => alterar(chave, e.target.value)}
                                  placeholder={chave.includes('folga_') ? '4' : 'Informe a medida'}
                                  className={`w-full rounded-lg border px-3 py-2.5 text-sm ${atual ? 'border-rose-200 bg-rose-50' : 'border-slate-300 bg-white'}`}
                                />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : variaveisFormulaVisiveis.length ? null : (
                      <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                        Esta tipologia ainda não possui variáveis técnicas cadastradas.
                      </div>
                    )}

                    {variaveisFormulaVisiveis.length > 0 && (
                      <div className="mt-4 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                          <div>
                            <p className="text-xs font-bold text-amber-900">Variáveis encontradas na receita técnica W.Vetro</p>
                            <p className="mt-0.5 text-[11px] text-amber-800">Preencha para preservar a configuração. Enquanto a receita não estiver validada e ativa, esses campos não são usados automaticamente no cálculo.</p>
                          </div>
                          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-amber-800">{formulaSelecionada?.status === 'validada' && formulaSelecionada?.ativo ? 'VALIDADA' : 'EM VALIDAÇÃO'}</span>
                        </div>
                        {variaveisFormulaVisiveis.map(item => {
                          const atual = rascunho[item.chave] || ''
                          return (
                            <div key={`formula-${item.chave}`} className="grid gap-2 rounded-xl border border-amber-100 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,340px)] sm:items-center">
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                                <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">{item.chave}</p>
                              </div>
                              {item.opcoes?.length ? (
                                <div className="relative">
                                  <select value={atual} onChange={e => alterar(item.chave, e.target.value)} className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-9 text-sm">
                                    <option value="">Selecione</option>
                                    {item.opcoes.map(opcao => <option key={opcao} value={opcao}>{opcao.replaceAll('_', ' ')}</option>)}
                                  </select>
                                  <ChevronDown size={15} className="pointer-events-none absolute right-3 top-3 text-slate-400" />
                                </div>
                              ) : (
                                <input type="text" value={atual} onChange={e => alterar(item.chave, e.target.value)} placeholder="Informe" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm" />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            </div>

            <div className="grid shrink-0 gap-2 border-t border-slate-200 bg-slate-50 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5 sm:py-4">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                {obrigatorias.every(v => valorCompleto(rascunho[v.variavel.chave])) ? (
                  <><CheckCircle2 size={16} className="text-emerald-600" /><span>Variáveis obrigatórias preenchidas.</span></>
                ) : (
                  <span>Preencha todas as variáveis marcadas com * para concluir a configuração.</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <button type="button" onClick={() => setAberto(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Cancelar</button>
                <button
                  type="button"
                  onClick={confirmar}
                  disabled={!obrigatorias.every(v => valorCompleto(rascunho[v.variavel.chave]))}
                  className="rounded-xl bg-brand-navy px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Confirmar variáveis
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
