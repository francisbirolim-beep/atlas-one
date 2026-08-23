'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Beaker, Check, Loader2, Plus, Save, Trash2, Wrench } from 'lucide-react'
import {
  calcularFormulaCorteIsolada,
  calcularFormulasCorte,
  FormulaCorteError,
  type PecaFormula,
  type ResultadoPeca,
} from '@/lib/formulasCorteEngine'
import {
  calcularAcessoriosFormula,
  FormulaAcessorioError,
  type AcessorioFormulaCorte,
  type ResultadoAcessorioFormula,
} from '@/lib/formulasAcessoriosEngine'
import {
  listarTodasFormulasCorte,
  salvarFormulaCorte,
  type RegistroFormulaCorte,
  type StatusFormulaCorte,
} from '@/lib/engenhariaFormulasCorte'
import { listarProdutosTecnicos } from '@/lib/engenhariaReceitas'
import { alternarLinhaTecnica, listarLinhasTecnicas, type LinhaTecnica } from '@/lib/linhasTecnicas'
import { alternarTipologiaTecnica, listarTipologias, type TipologiaTecnica } from '@/lib/tipologias'
import type { Produto } from '@/lib/tipos'

const STATUS: Array<{ value: StatusFormulaCorte; label: string }> = [
  { value: 'em_desenvolvimento', label: 'Em desenvolvimento' },
  { value: 'em_validacao', label: 'Em validação' },
  { value: 'validada', label: 'Validada' },
]

function clonar<T>(valor: T): T { return JSON.parse(JSON.stringify(valor)) as T }
function medida(valor: number) { return Number.isInteger(valor) ? String(valor) : valor.toFixed(3).replace('.', ',').replace(/0+$/, '').replace(/,$/, '') }
function statusClass(status: StatusFormulaCorte) {
  if (status === 'validada') return 'bg-emerald-100 text-emerald-800'
  if (status === 'em_validacao') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-600'
}
function extrairFolhas(texto: string) {
  const match = texto.match(/(\d+)\s*folhas?/i)
  return match ? Number(match[1]) : 1
}

export default function EditorTecnicoPage() {
  const [registros, setRegistros] = useState<RegistroFormulaCorte[]>([])
  const [selecionadaId, setSelecionadaId] = useState('')
  const [rascunho, setRascunho] = useState<RegistroFormulaCorte | null>(null)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [linhas, setLinhas] = useState<LinhaTecnica[]>([])
  const [tipologias, setTipologias] = useState<TipologiaTecnica[]>([])
  const [linhaId, setLinhaId] = useState('')
  const [tipologiaId, setTipologiaId] = useState('')
  const [alterandoDisponibilidade, setAlterandoDisponibilidade] = useState<'linha' | 'tipologia' | ''>('')
  const [avisoCatalogo, setAvisoCatalogo] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const [largura, setLargura] = useState('2000')
  const [altura, setAltura] = useState('2100')
  const [opcoes, setOpcoes] = useState<Record<string, string>>({})
  const [resultados, setResultados] = useState<ResultadoPeca[]>([])
  const [vidroTeste, setVidroTeste] = useState<{ largura: number; altura: number; quantidade: number } | null>(null)
  const [acessoriosTeste, setAcessoriosTeste] = useState<ResultadoAcessorioFormula[]>([])

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const [formulas, catalogo, linhasTecnicas, tipologiasTecnicas] = await Promise.all([
        listarTodasFormulasCorte(), listarProdutosTecnicos(), listarLinhasTecnicas(), listarTipologias(true),
      ])
      setRegistros(formulas); setProdutos(catalogo); setLinhas(linhasTecnicas); setTipologias(tipologiasTecnicas)
      const primeira = formulas.find(f => f.configuracao_chave !== 'legado_wvetro_994') || formulas[0] || null
      const linha = primeira ? linhasTecnicas.find(l => (l.tipologia_ids || []).includes(primeira.tipologia_id)) || linhasTecnicas[0] : linhasTecnicas[0]
      if (linha) {
        setLinhaId(linha.id)
        const ids = new Set(linha.tipologia_ids || [])
        const candidatas = tipologiasTecnicas.filter(t => ids.has(t.id))
        const tipologia = primeira && ids.has(primeira.tipologia_id) ? candidatas.find(t => t.id === primeira.tipologia_id) : candidatas[0]
        if (tipologia) {
          setTipologiaId(tipologia.id)
          const formula = formulas.find(f => f.tipologia_id === tipologia.id && f.configuracao_chave !== 'legado_wvetro_994') || formulas.find(f => f.tipologia_id === tipologia.id)
          setSelecionadaId(formula?.id || '')
        }
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
  const registrosDaTipologia = useMemo(() => registros.filter(r => r.tipologia_id === tipologiaId), [registros, tipologiaId])
  const selecionada = useMemo(() => registros.find(r => r.id === selecionadaId) || null, [registros, selecionadaId])
  const perfisCatalogo = useMemo(() => produtos.filter(p => p.categoria === 'perfil' && p.codigo), [produtos])
  const acessoriosCatalogo = useMemo(() => produtos.filter(p => p.categoria === 'acessorio' && p.codigo), [produtos])
  const folhas = extrairFolhas(tipologiaSelecionada?.label || selecionada?.tipologia?.label || '')

  useEffect(() => {
    setRascunho(selecionada ? clonar(selecionada) : null)
    setMensagem(''); setErro(''); setResultados([]); setVidroTeste(null); setAcessoriosTeste([])
    const defaults: Record<string, string> = {}
    for (const variavel of selecionada?.variaveis || []) defaults[variavel.chave] = variavel.opcoes[0] || ''
    setOpcoes(defaults)
  }, [selecionada?.id])

  function escolherConfiguracao(id: string) {
    const preferida = registros.find(r => r.tipologia_id === id && r.configuracao_chave !== 'legado_wvetro_994') || registros.find(r => r.tipologia_id === id)
    setSelecionadaId(preferida?.id || '')
  }
  function selecionarLinha(id: string) {
    setLinhaId(id); setAvisoCatalogo('')
    const linha = linhas.find(l => l.id === id)
    if (!linha) { setTipologiaId(''); setSelecionadaId(''); return }
    const ids = new Set(linha.tipologia_ids || [])
    const candidatas = tipologias.filter(t => ids.has(t.id))
    const proxima = candidatas.find(t => registros.some(r => r.tipologia_id === t.id)) || candidatas[0] || null
    setTipologiaId(proxima?.id || '')
    if (proxima) escolherConfiguracao(proxima.id); else setSelecionadaId('')
  }
  function selecionarTipologia(id: string) { setTipologiaId(id); setAvisoCatalogo(''); escolherConfiguracao(id) }

  async function alternarLinha() {
    if (!linhaSelecionada) return
    setAlterandoDisponibilidade('linha')
    const ativo = !linhaSelecionada.ativo
    const { error } = await alternarLinhaTecnica(linhaSelecionada.id, ativo)
    if (error) setAvisoCatalogo('Não foi possível alterar a disponibilidade da linha.')
    else { setLinhas(prev => prev.map(l => l.id === linhaSelecionada.id ? { ...l, ativo } : l)); setAvisoCatalogo(ativo ? 'Linha liberada.' : 'Linha inativada sem apagar o cadastro.') }
    setAlterandoDisponibilidade('')
  }
  async function alternarTipologia() {
    if (!tipologiaSelecionada) return
    setAlterandoDisponibilidade('tipologia')
    const ativo = !tipologiaSelecionada.ativo
    const { error } = await alternarTipologiaTecnica(tipologiaSelecionada.id, ativo)
    if (error) setAvisoCatalogo('Não foi possível alterar a disponibilidade da tipologia.')
    else { setTipologias(prev => prev.map(t => t.id === tipologiaSelecionada.id ? { ...t, ativo } : t)); setAvisoCatalogo(ativo ? 'Tipologia liberada.' : 'Tipologia inativada sem apagar fórmulas.') }
    setAlterandoDisponibilidade('')
  }

  function atualizarPeca(index: number, patch: Partial<PecaFormula>) {
    setRascunho(prev => prev ? { ...prev, pecas: prev.pecas.map((p, i) => i === index ? { ...p, ...patch } : p) } : prev)
  }
  function removerPeca(index: number) { setRascunho(prev => prev ? { ...prev, pecas: prev.pecas.filter((_, i) => i !== index) } : prev) }
  function adicionarPeca() {
    setRascunho(prev => prev ? { ...prev, pecas: [...prev.pecas, { codigo: '', descricao: 'Novo perfil', formula: '', quantidade: 1, eixo: 'L', composicao_desconto: '' }] } : prev)
  }
  function selecionarCodigoPerfil(index: number, codigo: string) {
    const valor = codigo.toUpperCase()
    const produto = perfisCatalogo.find(p => p.codigo?.toUpperCase() === valor)
    atualizarPeca(index, { codigo: valor, ...(produto ? { descricao: produto.nome } : {}) })
  }

  function atualizarAcessorio(index: number, patch: Partial<AcessorioFormulaCorte>) {
    setRascunho(prev => prev ? { ...prev, acessorios: (prev.acessorios || []).map((a, i) => i === index ? { ...a, ...patch } : a) } : prev)
  }
  function removerAcessorio(index: number) { setRascunho(prev => prev ? { ...prev, acessorios: (prev.acessorios || []).filter((_, i) => i !== index) } : prev) }
  function adicionarAcessorio() {
    setRascunho(prev => prev ? { ...prev, acessorios: [...(prev.acessorios || []), { codigo: '', descricao: 'Novo acessório', unidade: 'UN', formula: '', quantidade_base: 1, cor: '', origem_calculo: '', ativo: true }] } : prev)
  }
  function selecionarCodigoAcessorio(index: number, codigo: string) {
    const valor = codigo.toUpperCase()
    const produto = acessoriosCatalogo.find(p => p.codigo?.toUpperCase() === valor)
    atualizarAcessorio(index, { codigo: valor, ...(produto ? { descricao: produto.nome, unidade: produto.unidade || 'UN' } : {}) })
  }

  async function salvar() {
    if (!rascunho) return
    setSalvando(true); setMensagem(''); setErro('')
    const salvo = await salvarFormulaCorte(rascunho.id, {
      configuracao_label: rascunho.configuracao_label,
      variaveis: rascunho.variaveis,
      pecas: rascunho.pecas,
      vidro: rascunho.vidro,
      acessorios: rascunho.acessorios || [],
      status: rascunho.status,
      ativo: rascunho.ativo,
      observacoes: rascunho.observacoes,
    })
    if (!salvo) setErro('Não foi possível salvar a configuração.')
    else { setRegistros(prev => prev.map(r => r.id === salvo.id ? salvo : r)); setRascunho(clonar(salvo)); setMensagem(`Salvo. Versão atual: ${salvo.versao}.`) }
    setSalvando(false)
  }

  function testar() {
    if (!rascunho) return
    setErro(''); setMensagem('')
    try {
      const L = Number(largura); const H = Number(altura)
      const calculados = calcularFormulasCorte(rascunho, L, H, opcoes)
      setResultados(calculados)
      const formulaL = rascunho.vidro.formula_largura; const formulaH = rascunho.vidro.formula_altura
      setVidroTeste(formulaL && formulaH ? { largura: calcularFormulaCorteIsolada(formulaL, L, H), altura: calcularFormulaCorteIsolada(formulaH, L, H), quantidade: Number(rascunho.vidro.quantidade || 1) } : null)
      setAcessoriosTeste(calcularAcessoriosFormula(rascunho.acessorios || [], L, H, folhas, calculados.map(r => ({ codigo: r.codigo, tamanho: r.tamanho }))))
    } catch (e) {
      setResultados([]); setVidroTeste(null); setAcessoriosTeste([])
      setErro(e instanceof FormulaCorteError || e instanceof FormulaAcessorioError || e instanceof Error ? e.message : 'Erro ao testar configuração.')
    }
  }

  if (carregando) return <div className="grid min-h-[60vh] place-items-center text-slate-500"><Loader2 className="animate-spin" /></div>

  return <main className="min-h-screen bg-slate-50 p-4 md:p-7">
    <datalist id="catalogo-perfis-atlas">{perfisCatalogo.map(p => <option key={p.id} value={p.codigo || ''}>{p.nome}</option>)}</datalist>
    <datalist id="catalogo-acessorios-atlas">{acessoriosCatalogo.map(p => <option key={p.id} value={p.codigo || ''}>{p.nome}</option>)}</datalist>

    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><Link href="/engenharia" className="mb-2 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft size={16}/> Engenharia</Link><div className="flex items-center gap-3"><Wrench className="text-emerald-600"/><div><h1 className="text-2xl font-bold text-slate-900">Editor técnico de tipologias</h1><p className="text-sm text-slate-500">Linha → Tipologia → Configuração. Ajuste perfis, acessórios, fórmulas e vidro no mesmo lugar.</p></div></div></div>
        <Link href="/engenharia/formulas-corte" className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Plano de Corte</Link>
      </header>

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24">
          <div className="text-xs font-bold uppercase tracking-[.18em] text-slate-400">Organização técnica</div>
          <label className="mt-4 block text-xs font-semibold text-slate-600">1. Linha<select value={linhaId} onChange={e => selecionarLinha(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"><option value="">Selecione a linha</option>{linhas.map(l => <option key={l.id} value={l.id}>{l.nome}{l.ativo ? '' : ' — INATIVA'}</option>)}</select></label>
          {linhaSelecionada && <div className="mt-2 flex items-center justify-between rounded-xl border border-slate-200 p-3"><span className="text-xs text-slate-600">{linhaSelecionada.ativo ? 'Linha liberada' : 'Linha inativa'}</span><button type="button" disabled={alterandoDisponibilidade === 'linha'} onClick={() => void alternarLinha()} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white">{linhaSelecionada.ativo ? 'Inativar linha' : 'Liberar linha'}</button></div>}
          <label className="mt-4 block text-xs font-semibold text-slate-600">2. Tipologia<select value={tipologiaId} onChange={e => selecionarTipologia(e.target.value)} disabled={!linhaSelecionada} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm disabled:bg-slate-100"><option value="">Selecione a tipologia</option>{tipologiasDaLinha.map(t => <option key={t.id} value={t.id}>{t.label}{t.ativo ? '' : ' — INATIVA'}</option>)}</select></label>
          {tipologiaSelecionada && <div className="mt-2 flex items-center justify-between rounded-xl border border-slate-200 p-3"><span className="text-xs text-slate-600">{tipologiaSelecionada.ativo ? 'Tipologia liberada' : 'Tipologia inativa'}</span><button type="button" disabled={alterandoDisponibilidade === 'tipologia'} onClick={() => void alternarTipologia()} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white">{tipologiaSelecionada.ativo ? 'Inativar tipologia' : 'Liberar tipologia'}</button></div>}
          {avisoCatalogo && <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-2.5 text-xs text-sky-800">{avisoCatalogo}</div>}
          <div className="mb-2 mt-5 border-t border-slate-200 pt-4 text-xs font-bold uppercase tracking-[.18em] text-slate-400">3. Configuração</div>
          <div className="max-h-[42vh] space-y-2 overflow-auto pr-1">{registrosDaTipologia.map(item => <button key={item.id} type="button" onClick={() => setSelecionadaId(item.id)} className={`w-full rounded-xl border p-3 text-left ${selecionadaId === item.id ? 'border-emerald-300 bg-emerald-50' : 'border-slate-100 hover:bg-slate-50'}`}><div className="text-sm font-semibold text-slate-800">{item.configuracao_label}</div><div className="mt-2 flex items-center justify-between"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${statusClass(item.status)}`}>{STATUS.find(s => s.value === item.status)?.label}</span><span className="text-[10px] text-slate-400">v{item.versao}</span></div></button>)}</div>
        </aside>

        {!rascunho ? <section className="grid min-h-[500px] place-items-center rounded-2xl border border-slate-200 bg-white text-slate-400">Escolha Linha → Tipologia → Configuração.</section> : <section className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-bold uppercase tracking-[.16em] text-emerald-600">Configuração fixa</div><h2 className="mt-1 text-xl font-bold text-slate-900">{tipologiaSelecionada?.label}</h2><p className="mt-1 text-xs text-slate-400">{linhaSelecionada?.nome} · {folhas} folha(s) · versão {rascunho.versao}</p></div><button type="button" disabled={salvando} onClick={() => void salvar()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{salvando ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Salvar alterações</button></div>
            <div className="mt-5 grid gap-4 md:grid-cols-3"><label className="text-sm font-medium text-slate-700 md:col-span-2">Nome da configuração<input value={rascunho.configuracao_label} onChange={e => setRascunho({ ...rascunho, configuracao_label: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"/></label><label className="text-sm font-medium text-slate-700">Status<select value={rascunho.status} onChange={e => setRascunho({ ...rascunho, status: e.target.value as StatusFormulaCorte, ativo: e.target.value === 'validada' ? rascunho.ativo : false })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">{STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label></div>
            <label className="mt-4 block text-sm font-medium text-slate-700">Observações técnicas<textarea value={rascunho.observacoes || ''} onChange={e => setRascunho({ ...rascunho, observacoes: e.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"/></label>
            <label className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><input type="checkbox" checked={rascunho.ativo} disabled={rascunho.status !== 'validada'} onChange={e => setRascunho({ ...rascunho, ativo: e.target.checked })}/><span><strong>Liberar no Plano de Corte</strong><br/><span className="text-xs text-slate-500">Somente configuração Validada.</span></span></label>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">Perfis e fórmulas</h3><p className="text-xs text-slate-500">LF = largura − 4 · HF = altura − 4 · CEIL() arredonda para cima.</p></div><button type="button" onClick={adicionarPeca} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold"><Plus size={15}/> Adicionar perfil</button></div>
            <div className="space-y-3">{rascunho.pecas.map((peca, index) => <div key={`${index}-${peca.codigo || peca.grupo || 'perfil'}`} className="rounded-xl border border-slate-200 p-4"><div className="grid gap-3 md:grid-cols-12"><label className="text-xs font-semibold text-slate-500 md:col-span-2">Código<input list="catalogo-perfis-atlas" value={peca.codigo || peca.grupo || ''} disabled={!peca.codigo && Boolean(peca.grupo)} onChange={e => selecionarCodigoPerfil(index, e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm disabled:bg-slate-100"/></label><label className="text-xs font-semibold text-slate-500 md:col-span-4">Descrição<input value={peca.descricao || ''} onChange={e => atualizarPeca(index, { descricao: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"/></label><label className="text-xs font-semibold text-slate-500 md:col-span-3">Fórmula<input value={peca.formula || ''} onChange={e => atualizarPeca(index, { formula: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs"/></label><label className="text-xs font-semibold text-slate-500 md:col-span-1">Qtd.<input type="number" min="0" value={peca.quantidade ?? ''} onChange={e => atualizarPeca(index, { quantidade: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"/></label><label className="text-xs font-semibold text-slate-500 md:col-span-1">Eixo<select value={peca.eixo || ''} onChange={e => atualizarPeca(index, { eixo: (e.target.value || undefined) as 'L' | 'H' | undefined })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm"><option value="">—</option><option value="L">L</option><option value="H">H</option></select></label><button type="button" onClick={() => removerPeca(index)} className="mt-5 grid h-9 place-items-center text-slate-400 hover:text-red-600"><Trash2 size={16}/></button></div>{(peca.formula_L || peca.formula_H) && <div className="mt-3 grid gap-3 md:grid-cols-2"><input value={peca.formula_L || ''} onChange={e => atualizarPeca(index, { formula_L: e.target.value || undefined })} placeholder="Fórmula L" className="rounded-lg border border-slate-300 p-2 font-mono text-xs"/><input value={peca.formula_H || ''} onChange={e => atualizarPeca(index, { formula_H: e.target.value || undefined })} placeholder="Fórmula H" className="rounded-lg border border-slate-300 p-2 font-mono text-xs"/></div>}<label className="mt-3 block text-xs font-semibold text-slate-500">Composição / origem do desconto<input value={peca.composicao_desconto || ''} onChange={e => atualizarPeca(index, { composicao_desconto: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"/></label></div>)}</div>
          </div>

          <div className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">Acessórios e consumíveis</h3><p className="text-xs text-slate-500">Edite igual aos perfis: código, cor, unidade, fórmula, quantidade fixa e origem do cálculo. Fórmulas podem usar Largura, Altura, LF, HF, Folhas, Encontros e códigos de perfis (ex.: SU243).</p></div><button type="button" onClick={adicionarAcessorio} className="inline-flex items-center gap-2 rounded-xl border border-violet-300 px-3 py-2 text-sm font-semibold text-violet-800"><Plus size={15}/> Adicionar acessório</button></div>
            <div className="space-y-3">{(rascunho.acessorios || []).map((a, index) => <div key={`${index}-${a.codigo || 'acessorio'}`} className="rounded-xl border border-slate-200 p-4"><div className="grid gap-3 md:grid-cols-12"><label className="text-xs font-semibold text-slate-500 md:col-span-2">Código<input list="catalogo-acessorios-atlas" value={a.codigo || ''} onChange={e => selecionarCodigoAcessorio(index, e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"/></label><label className="text-xs font-semibold text-slate-500 md:col-span-3">Descrição<input value={a.descricao || ''} onChange={e => atualizarAcessorio(index, { descricao: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"/></label><label className="text-xs font-semibold text-slate-500 md:col-span-1">Cor<input value={a.cor || ''} onChange={e => atualizarAcessorio(index, { cor: e.target.value.toUpperCase() })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"/></label><label className="text-xs font-semibold text-slate-500 md:col-span-1">UN<input value={a.unidade || 'UN'} onChange={e => atualizarAcessorio(index, { unidade: e.target.value.toUpperCase() })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"/></label><label className="text-xs font-semibold text-slate-500 md:col-span-3">Fórmula de quantidade<input value={a.formula || ''} onChange={e => atualizarAcessorio(index, { formula: e.target.value })} placeholder="Ex.: Folhas * 2" className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs"/></label><label className="text-xs font-semibold text-slate-500 md:col-span-1">Qtd. fixa<input type="number" step="0.001" value={a.quantidade_base ?? ''} onChange={e => atualizarAcessorio(index, { quantidade_base: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"/></label><button type="button" onClick={() => removerAcessorio(index)} className="mt-5 grid h-9 place-items-center text-slate-400 hover:text-red-600"><Trash2 size={16}/></button></div><label className="mt-3 block text-xs font-semibold text-slate-500">Origem / explicação da fórmula<input value={a.origem_calculo || ''} onChange={e => atualizarAcessorio(index, { origem_calculo: e.target.value })} placeholder="Ex.: 2 roldanas por folha móvel" className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"/></label><label className="mt-2 block text-xs font-semibold text-slate-500">Observação<input value={a.observacao || ''} onChange={e => atualizarAcessorio(index, { observacao: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"/></label></div>)}{(rascunho.acessorios || []).length === 0 && <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhum acessório cadastrado nesta configuração. Clique em “Adicionar acessório”.</div>}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Vidro</h3><div className="mt-4 grid gap-3 md:grid-cols-3"><label className="text-xs font-semibold text-slate-500">Largura<input value={rascunho.vidro.formula_largura || ''} onChange={e => setRascunho({ ...rascunho, vidro: { ...rascunho.vidro, formula_largura: e.target.value } })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs"/></label><label className="text-xs font-semibold text-slate-500">Altura<input value={rascunho.vidro.formula_altura || ''} onChange={e => setRascunho({ ...rascunho, vidro: { ...rascunho.vidro, formula_altura: e.target.value } })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs"/></label><label className="text-xs font-semibold text-slate-500">Qtd.<input type="number" min="1" value={rascunho.vidro.quantidade || 1} onChange={e => setRascunho({ ...rascunho, vidro: { ...rascunho.vidro, quantidade: Number(e.target.value) || 1 } })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"/></label></div></div>

          <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><Beaker size={18} className="text-emerald-600"/><h3 className="font-bold text-slate-900">Testar perfis + acessórios + vidro</h3></div>
            <div className="mt-4 grid gap-3 md:grid-cols-4"><label className="text-xs font-semibold text-slate-500">Largura (mm)<input type="number" value={largura} onChange={e => setLargura(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2"/></label><label className="text-xs font-semibold text-slate-500">Altura (mm)<input type="number" value={altura} onChange={e => setAltura(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2"/></label>{rascunho.variaveis.map(v => <label key={v.chave} className="text-xs font-semibold text-slate-500">{v.label}<select value={opcoes[v.chave] || ''} onChange={e => setOpcoes(prev => ({ ...prev, [v.chave]: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2">{v.opcoes.map(o => <option key={o} value={o}>{o}</option>)}</select></label>)}<button type="button" onClick={testar} className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white"><Beaker size={15}/> Calcular teste</button></div>
            {erro && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}{mensagem && <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><Check size={15}/>{mensagem}</div>}
            {resultados.length > 0 && <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Perfil</th><th className="p-3">Eixo</th><th className="p-3 text-right">Corte</th><th className="p-3 text-right">Qtd.</th></tr></thead><tbody>{resultados.map((r,i) => <tr key={`${r.codigo}-${r.eixo}-${i}`} className="border-t"><td className="p-3"><strong>{r.codigo}</strong><div className="text-xs text-slate-500">{r.descricao}</div></td><td className="p-3">{r.eixo || '—'}</td><td className="p-3 text-right font-semibold">{medida(r.tamanho)} mm</td><td className="p-3 text-right">{r.quantidade ?? 1}</td></tr>)}</tbody></table></div>}
            {acessoriosTeste.length > 0 && <div className="mt-5 overflow-x-auto rounded-xl border border-violet-200"><table className="min-w-full text-sm"><thead className="bg-violet-50 text-left text-xs uppercase text-violet-700"><tr><th className="p-3">Acessório</th><th className="p-3">Fórmula</th><th className="p-3">Cálculo neste teste</th><th className="p-3 text-right">Resultado</th><th className="p-3">Origem</th></tr></thead><tbody>{acessoriosTeste.map((a,i) => <tr key={`${a.codigo}-${i}`} className="border-t border-violet-100"><td className="p-3"><strong>{a.codigo}</strong><div className="text-xs text-slate-500">{a.descricao}</div><div className="text-[11px] text-slate-400">Cor: {a.cor || '—'}</div></td><td className="p-3 font-mono text-xs">{a.formula || 'fixo'}</td><td className="p-3 font-mono text-xs">{a.calculo}</td><td className="p-3 text-right font-bold">{medida(a.quantidade)} {a.unidade}</td><td className="p-3 text-xs text-slate-500">{a.origem_calculo || '—'}</td></tr>)}</tbody></table></div>}
            {vidroTeste && <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900"><strong>Vidro:</strong> {vidroTeste.quantidade} peça(s) de <strong>{medida(vidroTeste.largura)} × {medida(vidroTeste.altura)} mm</strong></div>}
          </div>
        </section>}
      </div>
    </div>
  </main>
}
