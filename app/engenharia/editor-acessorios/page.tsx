'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Beaker, Check, Loader2, PackageOpen, Plus, Save, Trash2, Wrench } from 'lucide-react'
import { calcularFormulaCorteIsolada, FormulaCorteError } from '@/lib/formulasCorteEngine'
import {
  listarTodasFormulasCorte,
  salvarFormulaCorte,
  type AcessorioFormulaCorte,
  type RegistroFormulaCorte,
  type StatusFormulaAcessorio,
} from '@/lib/engenhariaFormulasCorte'
import { listarProdutosTecnicos } from '@/lib/engenhariaReceitas'
import { listarLinhasTecnicas, type LinhaTecnica } from '@/lib/linhasTecnicas'
import { listarTipologias, type TipologiaTecnica } from '@/lib/tipologias'
import type { Produto } from '@/lib/tipos'

const STATUS_ACESSORIO: Array<{ value: StatusFormulaAcessorio; label: string }> = [
  { value: 'referencia', label: 'Referência do PDF' },
  { value: 'em_validacao', label: 'Em validação' },
  { value: 'validada', label: 'Validada' },
]

function clonar<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T
}

function formatarNumero(valor: number | null | undefined, casas = 5) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—'
  if (Number.isInteger(valor)) return String(valor)
  return valor.toFixed(casas).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',')
}

function statusClass(status?: StatusFormulaAcessorio) {
  if (status === 'validada') return 'bg-emerald-100 text-emerald-800'
  if (status === 'em_validacao') return 'bg-amber-100 text-amber-800'
  return 'bg-sky-100 text-sky-800'
}

export default function EditorAcessoriosPage() {
  const [registros, setRegistros] = useState<RegistroFormulaCorte[]>([])
  const [linhas, setLinhas] = useState<LinhaTecnica[]>([])
  const [tipologias, setTipologias] = useState<TipologiaTecnica[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [linhaId, setLinhaId] = useState('')
  const [tipologiaId, setTipologiaId] = useState('')
  const [configuracaoId, setConfiguracaoId] = useState('')
  const [rascunho, setRascunho] = useState<RegistroFormulaCorte | null>(null)
  const [largura, setLargura] = useState('2500')
  const [altura, setAltura] = useState('2100')
  const [resultados, setResultados] = useState<Array<{ index: number; valor: number | null; erro?: string }>>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const [formulas, catalogo, linhasTecnicas, tipologiasTecnicas] = await Promise.all([
        listarTodasFormulasCorte(),
        listarProdutosTecnicos(),
        listarLinhasTecnicas(),
        listarTipologias(true),
      ])
      setRegistros(formulas)
      setProdutos(catalogo)
      setLinhas(linhasTecnicas)
      setTipologias(tipologiasTecnicas)

      const pc3 = tipologiasTecnicas.find(t => t.chave === 'l_suprema_porta_de_correr_03_folhas')
      const linhaPc3 = pc3 ? linhasTecnicas.find(l => (l.tipologia_ids || []).includes(pc3.id)) : null
      const tipologiaInicial = pc3 || tipologiasTecnicas.find(t => formulas.some(f => f.tipologia_id === t.id)) || null
      const linhaInicial = linhaPc3 || (tipologiaInicial ? linhasTecnicas.find(l => (l.tipologia_ids || []).includes(tipologiaInicial.id)) : null) || linhasTecnicas[0]

      if (linhaInicial) setLinhaId(linhaInicial.id)
      if (tipologiaInicial) {
        setTipologiaId(tipologiaInicial.id)
        const configuracaoInicial = formulas.find(f => f.tipologia_id === tipologiaInicial.id && f.configuracao_chave === 'legado_wvetro_994')
          || formulas.find(f => f.tipologia_id === tipologiaInicial.id && f.acessorios.length > 0)
          || formulas.find(f => f.tipologia_id === tipologiaInicial.id)
        if (configuracaoInicial) setConfiguracaoId(configuracaoInicial.id)
      }
      setCarregando(false)
    }
    void carregar()
  }, [])

  const linhaSelecionada = useMemo(() => linhas.find(l => l.id === linhaId) || null, [linhas, linhaId])
  const tipologiasDaLinha = useMemo(() => {
    if (!linhaSelecionada) return []
    const ids = new Set(linhaSelecionada.tipologia_ids || [])
    return tipologias.filter(t => ids.has(t.id))
  }, [linhaSelecionada, tipologias])
  const configuracoes = useMemo(() => registros.filter(r => r.tipologia_id === tipologiaId), [registros, tipologiaId])
  const selecionada = useMemo(() => registros.find(r => r.id === configuracaoId) || null, [registros, configuracaoId])
  const acessoriosCatalogo = useMemo(() => produtos.filter(p => p.categoria === 'acessorio' && p.codigo), [produtos])

  useEffect(() => {
    setRascunho(selecionada ? clonar(selecionada) : null)
    setResultados([])
    setMensagem('')
    setErro('')
  }, [selecionada?.id])

  function escolherTipologia(id: string) {
    setTipologiaId(id)
    const configs = registros.filter(r => r.tipologia_id === id)
    const preferida = configs.find(c => c.configuracao_chave === 'legado_wvetro_994')
      || configs.find(c => c.acessorios.length > 0)
      || configs[0]
    setConfiguracaoId(preferida?.id || '')
  }

  function escolherLinha(id: string) {
    setLinhaId(id)
    const linha = linhas.find(l => l.id === id)
    if (!linha) {
      setTipologiaId('')
      setConfiguracaoId('')
      return
    }
    const ids = new Set(linha.tipologia_ids || [])
    const primeira = tipologias.find(t => ids.has(t.id) && registros.some(r => r.tipologia_id === t.id))
      || tipologias.find(t => ids.has(t.id))
    if (primeira) escolherTipologia(primeira.id)
    else {
      setTipologiaId('')
      setConfiguracaoId('')
    }
  }

  function atualizar(index: number, patch: Partial<AcessorioFormulaCorte>) {
    setRascunho(prev => {
      if (!prev) return prev
      const acessorios = prev.acessorios.map((item, i) => i === index ? { ...item, ...patch } : item)
      return { ...prev, acessorios }
    })
  }

  function trocarCodigo(index: number, codigo: string) {
    const normalizado = codigo.toUpperCase()
    const produto = acessoriosCatalogo.find(p => p.codigo?.toUpperCase() === normalizado)
    atualizar(index, {
      codigo: normalizado,
      descricao: produto?.nome ? produto.nome.replace(new RegExp(`^${normalizado}\\s*-?\\s*`, 'i'), '') : undefined,
    })
  }

  function adicionar() {
    setRascunho(prev => prev ? {
      ...prev,
      acessorios: [...prev.acessorios, {
        codigo: '',
        descricao: 'Novo acessório',
        cor: 'PRETO',
        unidade: 'UN',
        formula_quantidade: '1',
        quantidade_referencia: 1,
        status: 'em_validacao',
        composicao_calculo: '',
        fonte: 'Cadastro manual Atlas',
      }],
    } : prev)
  }

  function remover(index: number) {
    setRascunho(prev => prev ? { ...prev, acessorios: prev.acessorios.filter((_, i) => i !== index) } : prev)
  }

  function testar() {
    if (!rascunho) return
    setErro('')
    const L = Number(largura)
    const H = Number(altura)
    if (!Number.isFinite(L) || !Number.isFinite(H) || L <= 0 || H <= 0) {
      setErro('Informe largura e altura válidas.')
      return
    }

    const calculados = rascunho.acessorios.map((item, index) => {
      const formula = item.formula_quantidade?.trim()
      if (!formula) return { index, valor: null }
      try {
        return { index, valor: calcularFormulaCorteIsolada(formula, L, H) }
      } catch (e) {
        return { index, valor: null, erro: e instanceof FormulaCorteError || e instanceof Error ? e.message : 'Fórmula inválida' }
      }
    })
    setResultados(calculados)
  }

  async function salvar() {
    if (!rascunho) return
    setSalvando(true)
    setMensagem('')
    setErro('')
    const salvo = await salvarFormulaCorte(rascunho.id, {
      configuracao_label: rascunho.configuracao_label,
      variaveis: rascunho.variaveis,
      pecas: rascunho.pecas,
      vidro: rascunho.vidro,
      acessorios: rascunho.acessorios,
      status: rascunho.status,
      ativo: rascunho.ativo,
      observacoes: rascunho.observacoes,
    })
    if (!salvo) {
      setErro('Não foi possível salvar os acessórios.')
      setSalvando(false)
      return
    }
    setRegistros(prev => prev.map(item => item.id === salvo.id ? salvo : item))
    setRascunho(clonar(salvo))
    setMensagem(`Acessórios salvos. Versão técnica ${salvo.versao}.`)
    setSalvando(false)
  }

  if (carregando) return <div className="grid min-h-[60vh] place-items-center text-slate-500"><Loader2 className="animate-spin" /></div>

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-7">
      <datalist id="catalogo-acessorios-atlas">
        {acessoriosCatalogo.map(p => <option key={p.id} value={p.codigo || ''}>{p.nome}</option>)}
      </datalist>

      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/engenharia" className="mb-2 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft size={16}/> Engenharia</Link>
            <div className="flex items-center gap-3"><PackageOpen className="text-orange-600"/><div><h1 className="text-2xl font-bold text-slate-900">Editor técnico de acessórios</h1><p className="text-sm text-slate-500">Troque, inclua ou exclua acessórios e deixe visível a fórmula que gerou cada quantidade ou metragem.</p></div></div>
          </div>
          <Link href="/engenharia/editor-tecnico" className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800"><Wrench size={16}/> Editor de perfis</Link>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-xs font-semibold text-slate-600">1. Linha
              <select value={linhaId} onChange={e => escolherLinha(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">
                <option value="">Selecione</option>
                {linhas.map(l => <option key={l.id} value={l.id}>{l.nome}{l.ativo ? '' : ' — INATIVA'}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">2. Tipologia
              <select value={tipologiaId} onChange={e => escolherTipologia(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">
                <option value="">Selecione</option>
                {tipologiasDaLinha.map(t => <option key={t.id} value={t.id}>{t.label}{t.ativo ? '' : ' — INATIVA'}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">3. Configuração
              <select value={configuracaoId} onChange={e => setConfiguracaoId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">
                <option value="">Selecione</option>
                {configuracoes.map(c => <option key={c.id} value={c.id}>{c.configuracao_label} · v{c.versao}</option>)}
              </select>
            </label>
          </div>
        </section>

        {!rascunho ? (
          <section className="grid min-h-[360px] place-items-center rounded-2xl border border-slate-200 bg-white text-slate-400">Escolha Linha → Tipologia → Configuração.</section>
        ) : (
          <section className="space-y-5">
            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-950">
              <strong>{rascunho.configuracao_label}</strong> · {rascunho.acessorios.length} acessório(s). Itens marcados como <strong>Referência do PDF</strong> ainda não possuem fórmula geométrica comprovada. Itens <strong>Em validação</strong> podem ser testados, mas precisam de comparação com outra medida antes de virar regra de produção.
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-lg font-bold text-slate-900">Acessórios e fórmulas</h2><p className="text-xs text-slate-500">L/H = medida informada · LF/HF = medida − 4 mm. Para metragem, a fórmula pode dividir por 1000.</p></div>
                <div className="flex gap-2"><button type="button" onClick={adicionar} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"><Plus size={15}/> Acrescentar</button><button type="button" disabled={salvando} onClick={() => void salvar()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{salvando ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Salvar alterações</button></div>
              </div>

              {rascunho.acessorios.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Nenhum acessório cadastrado nesta configuração. Clique em <strong>Acrescentar</strong>.</div>}

              <div className="space-y-3">
                {rascunho.acessorios.map((item, index) => (
                  <article key={`${index}-${item.codigo}`} className="rounded-xl border border-slate-200 p-4">
                    <div className="grid gap-3 md:grid-cols-12">
                      <label className="text-xs font-semibold text-slate-500 md:col-span-2">Código
                        <input list="catalogo-acessorios-atlas" value={item.codigo} onChange={e => trocarCodigo(index, e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm font-semibold"/>
                      </label>
                      <label className="text-xs font-semibold text-slate-500 md:col-span-4">Descrição
                        <input value={item.descricao || ''} onChange={e => atualizar(index, { descricao: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"/>
                      </label>
                      <label className="text-xs font-semibold text-slate-500 md:col-span-2">Cor
                        <input value={item.cor || ''} onChange={e => atualizar(index, { cor: e.target.value.toUpperCase() })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"/>
                      </label>
                      <label className="text-xs font-semibold text-slate-500 md:col-span-1">UN
                        <input value={item.unidade || ''} onChange={e => atualizar(index, { unidade: e.target.value.toUpperCase() })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"/>
                      </label>
                      <label className="text-xs font-semibold text-slate-500 md:col-span-2">Status
                        <select value={item.status || 'referencia'} onChange={e => atualizar(index, { status: e.target.value as StatusFormulaAcessorio })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs">{STATUS_ACESSORIO.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
                      </label>
                      <button type="button" onClick={() => remover(index)} className="mt-5 grid h-9 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 md:col-span-1"><Trash2 size={16}/></button>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <label className="text-xs font-semibold text-slate-500">Fórmula da quantidade / metragem
                        <input value={item.formula_quantidade || ''} onChange={e => atualizar(index, { formula_quantidade: e.target.value })} placeholder="Ex.: 2 * 3 ou 4 * ((HF - 42) / 1000)" className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs"/>
                      </label>
                      <label className="text-xs font-semibold text-slate-500">Quantidade de referência do PDF
                        <input type="number" step="any" value={item.quantidade_referencia ?? ''} onChange={e => atualizar(index, { quantidade_referencia: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"/>
                      </label>
                      <div className="flex items-end"><span className={`mb-0.5 rounded-full px-3 py-2 text-xs font-semibold ${statusClass(item.status)}`}>{STATUS_ACESSORIO.find(s => s.value === (item.status || 'referencia'))?.label}</span></div>
                    </div>

                    <label className="mt-3 block text-xs font-semibold text-slate-500">Como chegou nessa quantidade / origem do cálculo
                      <textarea rows={2} value={item.composicao_calculo || ''} onChange={e => atualizar(index, { composicao_calculo: e.target.value })} placeholder="Ex.: 2 roldanas por folha × 3 folhas = 6 un" className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"/>
                    </label>
                    <label className="mt-3 block text-xs font-semibold text-slate-500">Fonte / referência
                      <input value={item.fonte || ''} onChange={e => atualizar(index, { fonte: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 p-2 text-xs text-slate-600"/>
                    </label>
                  </article>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><Beaker size={18} className="text-emerald-600"/><h2 className="font-bold text-slate-900">Testar fórmulas de acessórios</h2></div>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <label className="text-xs font-semibold text-slate-500">Largura (mm)<input type="number" value={largura} onChange={e => setLargura(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"/></label>
                <label className="text-xs font-semibold text-slate-500">Altura (mm)<input type="number" value={altura} onChange={e => setAltura(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"/></label>
                <div className="md:col-span-2 flex items-end"><button type="button" onClick={testar} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white"><Beaker size={15}/> Calcular teste</button></div>
              </div>

              {erro && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
              {mensagem && <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><Check size={15}/>{mensagem}</div>}

              {resultados.length > 0 && (
                <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">Código</th><th className="p-3">Fórmula</th><th className="p-3 text-right">Calculado</th><th className="p-3 text-right">Referência PDF</th><th className="p-3">Conferência</th></tr></thead>
                    <tbody>{resultados.map(r => {
                      const item = rascunho.acessorios[r.index]
                      const ref = item?.quantidade_referencia
                      const bate = r.valor !== null && ref !== undefined && Math.abs(r.valor - ref) < 0.0001
                      return <tr key={`${r.index}-${item?.codigo}`} className="border-t border-slate-100"><td className="p-3 font-semibold">{item?.codigo}</td><td className="p-3 font-mono text-xs">{item?.formula_quantidade || 'Sem fórmula validada'}</td><td className="p-3 text-right font-semibold">{r.erro ? <span className="text-red-600">Erro</span> : r.valor === null ? '—' : `${formatarNumero(r.valor)} ${item?.unidade || ''}`}</td><td className="p-3 text-right">{ref === undefined ? '—' : `${formatarNumero(ref)} ${item?.unidade || ''}`}</td><td className="p-3">{r.erro ? <span className="text-xs text-red-600">{r.erro}</span> : r.valor === null ? <span className="text-xs text-sky-700">Somente referência</span> : bate ? <span className="text-xs font-semibold text-emerald-700">Bate com a referência</span> : <span className="text-xs font-semibold text-amber-700">Diferente da referência</span>}</td></tr>
                    })}</tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
