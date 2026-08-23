'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Beaker, Check, ChevronDown, Loader2, PackageOpen, Pencil, Plus, RefreshCw, Save, Trash2, Wrench } from 'lucide-react'
import { calcularFormulasCorte, FormulaCorteError } from '@/lib/formulasCorteEngine'
import { calcularAcessoriosTecnicos, FormulaAcessorioError, type ResultadoAcessorioFormula } from '@/lib/formulasAcessoriosEngine'
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

function clonar<T>(valor: T): T { return JSON.parse(JSON.stringify(valor)) as T }
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
function extrairFolhas(texto: string) {
  const match = texto.match(/(\d+)\s*folhas?/i)
  return match ? Number(match[1]) : 1
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
  const [largura, setLargura] = useState('2000')
  const [altura, setAltura] = useState('2100')
  const [resultados, setResultados] = useState<ResultadoAcessorioFormula[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const [acessorioAberto, setAcessorioAberto] = useState<number | null>(null)
  const [substituindoIndex, setSubstituindoIndex] = useState<number | null>(null)

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const [formulas, catalogo, linhasTecnicas, tipologiasTecnicas] = await Promise.all([
        listarTodasFormulasCorte(), listarProdutosTecnicos(), listarLinhasTecnicas(), listarTipologias(true),
      ])
      setRegistros(formulas); setProdutos(catalogo); setLinhas(linhasTecnicas); setTipologias(tipologiasTecnicas)

      const pc2 = tipologiasTecnicas.find(t => t.chave === 'l_suprema_porta_de_correr_02_folhas')
      const linhaPc2 = pc2 ? linhasTecnicas.find(l => (l.tipologia_ids || []).includes(pc2.id)) : null
      const tipologiaInicial = pc2 || tipologiasTecnicas.find(t => formulas.some(f => f.tipologia_id === t.id && f.acessorios.length > 0)) || null
      const linhaInicial = linhaPc2 || (tipologiaInicial ? linhasTecnicas.find(l => (l.tipologia_ids || []).includes(tipologiaInicial.id)) : null) || linhasTecnicas[0]
      if (linhaInicial) setLinhaId(linhaInicial.id)
      if (tipologiaInicial) {
        setTipologiaId(tipologiaInicial.id)
        const config = formulas.find(f => f.tipologia_id === tipologiaInicial.id && f.configuracao_chave === 'mao_amiga_larga_sem_reforco')
          || formulas.find(f => f.tipologia_id === tipologiaInicial.id && f.acessorios.length > 0)
          || formulas.find(f => f.tipologia_id === tipologiaInicial.id)
        setConfiguracaoId(config?.id || '')
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
  const tipologiaSelecionada = useMemo(() => tipologias.find(t => t.id === tipologiaId) || null, [tipologias, tipologiaId])
  const configuracoes = useMemo(() => registros.filter(r => r.tipologia_id === tipologiaId), [registros, tipologiaId])
  const selecionada = useMemo(() => registros.find(r => r.id === configuracaoId) || null, [registros, configuracaoId])
  const acessoriosCatalogo = useMemo(() => produtos.filter(p => p.categoria === 'acessorio' && p.codigo), [produtos])
  const folhas = extrairFolhas(tipologiaSelecionada?.label || selecionada?.tipologia?.label || '')

  useEffect(() => {
    setRascunho(selecionada ? clonar(selecionada) : null)
    setResultados([]); setMensagem(''); setErro(''); setAcessorioAberto(null); setSubstituindoIndex(null)
  }, [selecionada?.id])

  function escolherTipologia(id: string) {
    setTipologiaId(id)
    const configs = registros.filter(r => r.tipologia_id === id)
    const preferida = configs.find(c => c.configuracao_chave === 'mao_amiga_larga_sem_reforco')
      || configs.find(c => c.acessorios.length > 0)
      || configs[0]
    setConfiguracaoId(preferida?.id || '')
  }
  function escolherLinha(id: string) {
    setLinhaId(id)
    const linha = linhas.find(l => l.id === id)
    if (!linha) { setTipologiaId(''); setConfiguracaoId(''); return }
    const ids = new Set(linha.tipologia_ids || [])
    const primeira = tipologias.find(t => ids.has(t.id) && registros.some(r => r.tipologia_id === t.id && r.acessorios.length > 0))
      || tipologias.find(t => ids.has(t.id) && registros.some(r => r.tipologia_id === t.id))
      || tipologias.find(t => ids.has(t.id))
    if (primeira) escolherTipologia(primeira.id)
    else { setTipologiaId(''); setConfiguracaoId('') }
  }

  function atualizar(index: number, patch: Partial<AcessorioFormulaCorte>) {
    setRascunho(prev => prev ? { ...prev, acessorios: prev.acessorios.map((item, i) => i === index ? { ...item, ...patch } : item) } : prev)
  }
  function trocarCodigo(index: number, codigo: string) {
    const normalizado = codigo.toUpperCase()
    const produto = acessoriosCatalogo.find(p => p.codigo?.toUpperCase() === normalizado)
    atualizar(index, {
      codigo: normalizado,
      ...(produto?.nome ? { descricao: produto.nome.replace(new RegExp(`^${normalizado}\\s*-?\\s*`, 'i'), '') } : {}),
      ...(produto?.unidade ? { unidade: produto.unidade } : {}),
    })
  }
  function adicionar() {
    const novoIndex = rascunho?.acessorios.length ?? 0
    setRascunho(prev => prev ? { ...prev, acessorios: [...prev.acessorios, {
      codigo: '', descricao: 'Novo acessório', cor: 'PRETO', unidade: 'UN', formula_quantidade: '', quantidade_referencia: 1,
      status: 'em_validacao', composicao_calculo: '', fonte: 'Cadastro manual Atlas',
    }] } : prev)
    setAcessorioAberto(novoIndex)
    setSubstituindoIndex(novoIndex)
  }
  function remover(index: number) {
    const item = rascunho?.acessorios[index]
    if (!window.confirm(`Apagar ${item?.codigo || 'este acessório'} desta tipologia?`)) return
    setRascunho(prev => prev ? { ...prev, acessorios: prev.acessorios.filter((_, i) => i !== index) } : prev)
    setAcessorioAberto(null)
    setSubstituindoIndex(null)
  }

  function testar() {
    if (!rascunho) return
    setErro('')
    const L = Number(largura); const H = Number(altura)
    if (!Number.isFinite(L) || !Number.isFinite(H) || L <= 0 || H <= 0) { setErro('Informe largura e altura válidas.'); return }
    try {
      const defaults: Record<string, string> = {}
      for (const variavel of rascunho.variaveis || []) defaults[variavel.chave] = variavel.opcoes[0] || ''
      const perfis = calcularFormulasCorte(rascunho, L, H, defaults)
      setResultados(calcularAcessoriosTecnicos(rascunho.acessorios, L, H, folhas, perfis.map(p => ({ codigo: p.codigo, tamanho: p.tamanho }))))
    } catch (e) {
      setResultados([])
      setErro(e instanceof FormulaCorteError || e instanceof FormulaAcessorioError || e instanceof Error ? e.message : 'Erro ao testar fórmulas.')
    }
  }

  async function salvar() {
    if (!rascunho) return
    setSalvando(true); setMensagem(''); setErro('')
    const salvo = await salvarFormulaCorte(rascunho.id, {
      configuracao_label: rascunho.configuracao_label, variaveis: rascunho.variaveis, pecas: rascunho.pecas,
      vidro: rascunho.vidro, acessorios: rascunho.acessorios, status: rascunho.status, ativo: rascunho.ativo, observacoes: rascunho.observacoes,
    })
    if (!salvo) setErro('Não foi possível salvar os acessórios.')
    else { setRegistros(prev => prev.map(item => item.id === salvo.id ? salvo : item)); setRascunho(clonar(salvo)); setMensagem(`Acessórios salvos. Versão técnica ${salvo.versao}.`) }
    setSalvando(false)
  }

  if (carregando) return <div className="grid min-h-[60vh] place-items-center text-slate-500"><Loader2 className="animate-spin" /></div>

  return <main className="min-h-screen bg-slate-50 p-4 md:p-7">
    <datalist id="catalogo-acessorios-atlas">{acessoriosCatalogo.map(p => <option key={p.id} value={p.codigo || ''}>{p.nome}</option>)}</datalist>
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><Link href="/engenharia" className="mb-2 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft size={16}/> Engenharia</Link><div className="flex items-center gap-3"><PackageOpen className="text-orange-600"/><div><h1 className="text-2xl font-bold text-slate-900">Editor técnico de acessórios</h1><p className="text-sm text-slate-500">A mesma lógica dos perfis: trocar, acrescentar, excluir e explicar a fórmula de cada item por tipologia/configuração.</p></div></div></div>
        <Link href="/engenharia/editor-tecnico" className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800"><Wrench size={16}/> Editor de perfis</Link>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="grid gap-3 md:grid-cols-3">
        <label className="text-xs font-semibold text-slate-600">1. Linha<select value={linhaId} onChange={e => escolherLinha(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"><option value="">Selecione</option>{linhas.map(l => <option key={l.id} value={l.id}>{l.nome}{l.ativo ? '' : ' — INATIVA'}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-600">2. Tipologia<select value={tipologiaId} onChange={e => escolherTipologia(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"><option value="">Selecione</option>{tipologiasDaLinha.map(t => <option key={t.id} value={t.id}>{t.label}{t.ativo ? '' : ' — INATIVA'}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-600">3. Configuração<select value={configuracaoId} onChange={e => setConfiguracaoId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"><option value="">Selecione</option>{configuracoes.map(c => <option key={c.id} value={c.id}>{c.configuracao_label} · v{c.versao}</option>)}</select></label>
      </div></section>

      {!rascunho ? <section className="grid min-h-[360px] place-items-center rounded-2xl border border-slate-200 bg-white text-slate-400">Escolha Linha → Tipologia → Configuração.</section> : <section className="space-y-5">
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-950"><strong>{tipologiaSelecionada?.label}</strong> · <strong>{rascunho.configuracao_label}</strong> · {folhas} folha(s) · {rascunho.acessorios.length} acessório(s). Fórmulas podem usar <strong>Largura, Altura, LF, HF, Folhas, Encontros</strong> e o código de um perfil calculado, por exemplo <strong>SU243</strong>.</div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">Acessórios e fórmulas</h2><p className="text-xs text-slate-500">Clique no código ou no nome de qualquer acessório para abrir as ações Substituir, Alterar ou Apagar.</p></div><div className="flex gap-2"><button type="button" onClick={adicionar} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold"><Plus size={15}/> Acrescentar</button><button type="button" disabled={salvando} onClick={() => void salvar()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{salvando ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Salvar alterações</button></div></div>
          {rascunho.acessorios.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Nenhum acessório cadastrado. Clique em Acrescentar.</div>}
          <div className="space-y-3">{rascunho.acessorios.map((item, index) => {
            const aberto = acessorioAberto === index
            const substituindo = substituindoIndex === index
            return <article key={`${index}-${item.codigo}`} className={`overflow-hidden rounded-xl border ${aberto ? 'border-orange-300 shadow-sm' : 'border-slate-200'}`}>
              <button type="button" onClick={() => { setAcessorioAberto(aberto ? null : index); setSubstituindoIndex(null) }} className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-slate-50">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-xs font-bold text-white">{item.codigo || 'SEM CÓDIGO'}</span><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${statusClass(item.status)}`}>{STATUS_ACESSORIO.find(s => s.value === (item.status || 'referencia'))?.label}</span></div><div className="mt-1 truncate text-sm font-semibold text-slate-800">{item.descricao || 'Acessório sem descrição'}</div><div className="mt-0.5 text-xs text-slate-500">{item.quantidade_referencia ?? '—'} {item.unidade || ''} · {item.cor || 'SEM COR'}</div></div>
                <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${aberto ? 'rotate-180' : ''}`}/>
              </button>

              {aberto && <div className="border-t border-slate-100 bg-white p-4">
                <div className="mb-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setSubstituindoIndex(index)} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${substituindo ? 'border-orange-300 bg-orange-50 text-orange-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}><RefreshCw size={14}/> Substituir</button>
                  <button type="button" onClick={() => setSubstituindoIndex(null)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Pencil size={14}/> Alterar</button>
                  <button type="button" onClick={() => remover(index)} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"><Trash2 size={14}/> Apagar</button>
                </div>

                {substituindo && <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-900"><strong>Substituir acessório:</strong> escolha ou digite outro código no campo abaixo. Ao reconhecer um item do catálogo, o Atlas também atualiza a descrição e a unidade. A fórmula pode ser mantida ou alterada.</div>}

                <div className="grid gap-3 md:grid-cols-12">
                  <label className="text-xs font-semibold text-slate-500 md:col-span-2">Código<input list="catalogo-acessorios-atlas" value={item.codigo} onChange={e => trocarCodigo(index, e.target.value)} className={`mt-1 w-full rounded-lg border p-2 text-sm font-semibold ${substituindo ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-100' : 'border-slate-300'}`}/></label>
                  <label className="text-xs font-semibold text-slate-500 md:col-span-4">Descrição<input value={item.descricao || ''} onChange={e => atualizar(index, { descricao: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"/></label>
                  <label className="text-xs font-semibold text-slate-500 md:col-span-2">Cor<input value={item.cor || ''} onChange={e => atualizar(index, { cor: e.target.value.toUpperCase() })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"/></label>
                  <label className="text-xs font-semibold text-slate-500 md:col-span-1">UN<input value={item.unidade || ''} onChange={e => atualizar(index, { unidade: e.target.value.toUpperCase() })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"/></label>
                  <label className="text-xs font-semibold text-slate-500 md:col-span-3">Status<select value={item.status || 'referencia'} onChange={e => atualizar(index, { status: e.target.value as StatusFormulaAcessorio })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs">{STATUS_ACESSORIO.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <label className="text-xs font-semibold text-slate-500">Fórmula da quantidade / metragem<input value={item.formula_quantidade || ''} onChange={e => atualizar(index, { formula_quantidade: e.target.value })} placeholder="Ex.: Folhas * 2" className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs"/></label>
                  <label className="text-xs font-semibold text-slate-500">Quantidade referência W.Vetro/PDF<input type="number" step="any" value={item.quantidade_referencia ?? ''} onChange={e => atualizar(index, { quantidade_referencia: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"/></label>
                  <div className="flex items-end"><span className={`mb-0.5 rounded-full px-3 py-2 text-xs font-semibold ${statusClass(item.status)}`}>{STATUS_ACESSORIO.find(s => s.value === (item.status || 'referencia'))?.label}</span></div>
                </div>
                <label className="mt-3 block text-xs font-semibold text-slate-500">Como chegou nessa quantidade / origem do cálculo<textarea rows={2} value={item.composicao_calculo || ''} onChange={e => atualizar(index, { composicao_calculo: e.target.value })} placeholder="Ex.: 2 roldanas por folha × número de folhas" className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"/></label>
                <label className="mt-3 block text-xs font-semibold text-slate-500">Fonte / observação<input value={item.fonte || ''} onChange={e => atualizar(index, { fonte: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 p-2 text-xs text-slate-600"/></label>
              </div>}
            </article>
          })}</div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><Beaker size={18} className="text-emerald-600"/><h2 className="font-bold text-slate-900">Testar fórmula e ver o cálculo</h2></div>
          <div className="mt-4 grid gap-3 md:grid-cols-4"><label className="text-xs font-semibold text-slate-500">Largura (mm)<input type="number" value={largura} onChange={e => setLargura(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2"/></label><label className="text-xs font-semibold text-slate-500">Altura (mm)<input type="number" value={altura} onChange={e => setAltura(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2"/></label><div className="md:col-span-2 flex items-end"><button type="button" onClick={testar} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white"><Beaker size={15}/> Calcular teste</button></div></div>
          {erro && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}{mensagem && <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><Check size={15}/>{mensagem}</div>}
          {resultados.length > 0 && <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">Código</th><th className="p-3">Fórmula</th><th className="p-3">Cálculo neste teste</th><th className="p-3 text-right">Calculado</th><th className="p-3 text-right">Referência</th><th className="p-3">Conferência</th></tr></thead><tbody>{resultados.map(r => {
            const item = rascunho.acessorios[r.index]; const ref = item?.quantidade_referencia
            const bate = r.valor !== null && ref !== undefined && Math.abs(r.valor - ref) < 0.0001
            return <tr key={`${r.index}-${item?.codigo}`} className="border-t border-slate-100"><td className="p-3"><strong>{item?.codigo}</strong><div className="text-xs text-slate-500">{item?.descricao}</div></td><td className="p-3 font-mono text-xs">{item?.formula_quantidade || 'sem fórmula'}</td><td className="p-3 font-mono text-xs">{r.calculo}</td><td className="p-3 text-right font-semibold">{r.erro ? <span className="text-red-600">Erro</span> : r.valor === null ? '—' : `${formatarNumero(r.valor)} ${item?.unidade || ''}`}</td><td className="p-3 text-right">{ref === undefined ? '—' : `${formatarNumero(ref)} ${item?.unidade || ''}`}</td><td className="p-3">{r.erro ? <span className="text-xs text-red-600">{r.erro}</span> : r.valor === null ? <span className="text-xs text-sky-700">Somente referência</span> : bate ? <span className="text-xs font-semibold text-emerald-700">Bate</span> : <span className="text-xs font-semibold text-amber-700">Diferente</span>}</td></tr>
          })}</tbody></table></div>}
        </div>
      </section>}
    </div>
  </main>
}