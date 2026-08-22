'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Beaker, BookOpen, Check, Loader2, Plus, Save, Trash2, Wrench } from 'lucide-react'
import {
  calcularFormulaCorteIsolada,
  calcularFormulasCorte,
  FormulaCorteError,
  type PecaFormula,
  type ResultadoPeca,
} from '@/lib/formulasCorteEngine'
import {
  listarTodasFormulasCorte,
  salvarFormulaCorte,
  type RegistroFormulaCorte,
  type StatusFormulaCorte,
} from '@/lib/engenhariaFormulasCorte'
import { listarProdutosTecnicos } from '@/lib/engenhariaReceitas'
import {
  alternarLinhaTecnica,
  listarLinhasTecnicas,
  type LinhaTecnica,
} from '@/lib/linhasTecnicas'
import {
  alternarTipologiaTecnica,
  listarTipologias,
  type TipologiaTecnica,
} from '@/lib/tipologias'
import type { Produto } from '@/lib/tipos'

const STATUS: Array<{ value: StatusFormulaCorte; label: string }> = [
  { value: 'em_desenvolvimento', label: 'Em desenvolvimento' },
  { value: 'em_validacao', label: 'Em validação' },
  { value: 'validada', label: 'Validada' },
]

function clonar<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T
}

function medida(valor: number) {
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(2).replace('.', ',')
}

function statusClass(status: StatusFormulaCorte) {
  if (status === 'validada') return 'bg-emerald-100 text-emerald-800'
  if (status === 'em_validacao') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-600'
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

      const primeiraFormula = formulas.find(f => f.configuracao_chave !== 'legado_wvetro_994') || formulas[0] || null
      const linhaInicial = primeiraFormula
        ? linhasTecnicas.find(linha => (linha.tipologia_ids || []).includes(primeiraFormula.tipologia_id)) || linhasTecnicas[0]
        : linhasTecnicas[0]

      if (linhaInicial) {
        setLinhaId(linhaInicial.id)
        const ids = new Set(linhaInicial.tipologia_ids || [])
        const candidatas = tipologiasTecnicas.filter(t => ids.has(t.id))
        const tipologiaInicial = primeiraFormula && ids.has(primeiraFormula.tipologia_id)
          ? candidatas.find(t => t.id === primeiraFormula.tipologia_id)
          : candidatas.find(t => formulas.some(f => f.tipologia_id === t.id)) || candidatas[0]

        if (tipologiaInicial) {
          setTipologiaId(tipologiaInicial.id)
          const formulaInicial = formulas.find(f => f.tipologia_id === tipologiaInicial.id && f.configuracao_chave !== 'legado_wvetro_994')
            || formulas.find(f => f.tipologia_id === tipologiaInicial.id)
          setSelecionadaId(formulaInicial?.id || '')
        }
      }
      setCarregando(false)
    }
    void carregar()
  }, [])

  const linhaSelecionada = useMemo(
    () => linhas.find(item => item.id === linhaId) || null,
    [linhas, linhaId]
  )

  const tipologiasDaLinha = useMemo(() => {
    if (!linhaSelecionada) return []
    const ids = new Set(linhaSelecionada.tipologia_ids || [])
    return tipologias.filter(t => ids.has(t.id))
  }, [linhaSelecionada, tipologias])

  const tipologiaSelecionada = useMemo(
    () => tipologias.find(item => item.id === tipologiaId) || null,
    [tipologias, tipologiaId]
  )

  const registrosDaTipologia = useMemo(
    () => registros.filter(item => item.tipologia_id === tipologiaId),
    [registros, tipologiaId]
  )

  const selecionada = useMemo(
    () => registros.find(item => item.id === selecionadaId) || null,
    [registros, selecionadaId]
  )

  useEffect(() => {
    setRascunho(selecionada ? clonar(selecionada) : null)
    setMensagem('')
    setErro('')
    setResultados([])
    setVidroTeste(null)
    const defaults: Record<string, string> = {}
    for (const variavel of selecionada?.variaveis || []) defaults[variavel.chave] = variavel.opcoes[0] || ''
    setOpcoes(defaults)
  }, [selecionada?.id])

  const perfis = useMemo(
    () => produtos.filter(p => p.categoria === 'perfil' && p.codigo),
    [produtos]
  )

  function escolherConfiguracaoDaTipologia(id: string) {
    const preferida = registros.find(item => item.tipologia_id === id && item.configuracao_chave !== 'legado_wvetro_994')
      || registros.find(item => item.tipologia_id === id)
    setSelecionadaId(preferida?.id || '')
  }

  function selecionarLinha(id: string) {
    setLinhaId(id)
    setAvisoCatalogo('')
    const linha = linhas.find(item => item.id === id)
    if (!linha) {
      setTipologiaId('')
      setSelecionadaId('')
      return
    }

    const ids = new Set(linha.tipologia_ids || [])
    const candidatas = tipologias.filter(t => ids.has(t.id))
    const proxima = candidatas.find(t => registros.some(r => r.tipologia_id === t.id)) || candidatas[0] || null
    setTipologiaId(proxima?.id || '')
    if (proxima) escolherConfiguracaoDaTipologia(proxima.id)
    else setSelecionadaId('')
  }

  function selecionarTipologia(id: string) {
    setTipologiaId(id)
    setAvisoCatalogo('')
    escolherConfiguracaoDaTipologia(id)
  }

  async function alternarDisponibilidadeLinha() {
    if (!linhaSelecionada) return
    setAlterandoDisponibilidade('linha')
    setAvisoCatalogo('')
    const novoAtivo = !linhaSelecionada.ativo
    const { error } = await alternarLinhaTecnica(linhaSelecionada.id, novoAtivo)
    if (error) setAvisoCatalogo('Não foi possível alterar a disponibilidade da linha.')
    else {
      setLinhas(prev => prev.map(linha => linha.id === linhaSelecionada.id ? { ...linha, ativo: novoAtivo } : linha))
      setAvisoCatalogo(novoAtivo ? 'Linha liberada para uso.' : 'Linha inativada. O cadastro e o histórico foram preservados.')
    }
    setAlterandoDisponibilidade('')
  }

  async function alternarDisponibilidadeTipologia() {
    if (!tipologiaSelecionada) return
    setAlterandoDisponibilidade('tipologia')
    setAvisoCatalogo('')
    const novoAtivo = !tipologiaSelecionada.ativo
    const { error } = await alternarTipologiaTecnica(tipologiaSelecionada.id, novoAtivo)
    if (error) setAvisoCatalogo('Não foi possível alterar a disponibilidade da tipologia.')
    else {
      setTipologias(prev => prev.map(tipologia => tipologia.id === tipologiaSelecionada.id ? { ...tipologia, ativo: novoAtivo } : tipologia))
      setRegistros(prev => prev.map(item => item.tipologia_id === tipologiaSelecionada.id && item.tipologia
        ? { ...item, tipologia: { ...item.tipologia, ativo: novoAtivo } }
        : item))
      setAvisoCatalogo(novoAtivo ? 'Tipologia liberada para uso.' : 'Tipologia inativada. Fórmulas e histórico foram preservados.')
    }
    setAlterandoDisponibilidade('')
  }

  function atualizarPeca(index: number, patch: Partial<PecaFormula>) {
    setRascunho(prev => {
      if (!prev) return prev
      const pecas = prev.pecas.map((peca, i) => i === index ? { ...peca, ...patch } : peca)
      return { ...prev, pecas }
    })
  }

  function removerPeca(index: number) {
    setRascunho(prev => prev ? { ...prev, pecas: prev.pecas.filter((_, i) => i !== index) } : prev)
  }

  function adicionarPeca() {
    setRascunho(prev => prev ? {
      ...prev,
      pecas: [...prev.pecas, {
        codigo: '',
        descricao: 'Novo perfil / componente',
        formula: '',
        quantidade: 1,
        eixo: 'L',
        composicao_desconto: '',
      }],
    } : prev)
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
      status: rascunho.status,
      ativo: rascunho.ativo,
      observacoes: rascunho.observacoes,
    })
    if (!salvo) {
      setErro('Não foi possível salvar a fórmula.')
      setSalvando(false)
      return
    }
    setRegistros(prev => prev.map(item => item.id === salvo.id ? salvo : item))
    setRascunho(clonar(salvo))
    setMensagem(`Salvo. Versão atual: ${salvo.versao}.`)
    setSalvando(false)
  }

  function testar() {
    if (!rascunho) return
    setErro('')
    setMensagem('')
    try {
      const L = Number(largura)
      const H = Number(altura)
      const calculados = calcularFormulasCorte(rascunho, L, H, opcoes)
      setResultados(calculados)
      const formulaL = rascunho.vidro.formula_largura
      const formulaH = rascunho.vidro.formula_altura
      if (formulaL && formulaH) {
        setVidroTeste({
          largura: calcularFormulaCorteIsolada(formulaL, L, H),
          altura: calcularFormulaCorteIsolada(formulaH, L, H),
          quantidade: Number(rascunho.vidro.quantidade || 1),
        })
      } else setVidroTeste(null)
    } catch (e) {
      setResultados([])
      setVidroTeste(null)
      setErro(e instanceof FormulaCorteError || e instanceof Error ? e.message : 'Erro ao testar fórmula.')
    }
  }

  if (carregando) {
    return <div className="grid min-h-[60vh] place-items-center text-slate-500"><Loader2 className="animate-spin" /></div>
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-7">
      <datalist id="catalogo-perfis-atlas">
        {perfis.map(p => <option key={p.id} value={p.codigo || ''}>{p.nome}</option>)}
      </datalist>

      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/engenharia" className="mb-2 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft size={16} /> Engenharia</Link>
            <div className="flex items-center gap-3">
              <Wrench className="text-emerald-600" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Editor técnico de tipologias</h1>
                <p className="text-sm text-slate-500">Escolha a linha, escolha a tipologia e depois ajuste perfis, fórmulas, quantidades e vidro.</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/engenharia/receitas" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><BookOpen size={16} /> Acessórios / Receitas</Link>
            <Link href="/engenharia/formulas-corte" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Plano de Corte</Link>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Organização técnica</div>

            <label className="mt-4 block text-xs font-semibold text-slate-600">1. Linha
              <select value={linhaId} onChange={e => selecionarLinha(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">
                <option value="">Selecione a linha</option>
                {linhas.map(linha => <option key={linha.id} value={linha.id}>{linha.nome}{linha.ativo ? '' : ' — INATIVA'}</option>)}
              </select>
            </label>

            {linhaSelecionada && (
              <div className={`mt-2 rounded-xl border p-3 ${linhaSelecionada.ativo ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-xs font-semibold text-slate-700">Disponibilidade da linha</p><p className="mt-0.5 text-[11px] text-slate-500">{linhaSelecionada.ativo ? 'Liberada para novas seleções.' : 'Inativa, mas o cadastro continua salvo.'}</p></div>
                  <button type="button" disabled={alterandoDisponibilidade === 'linha'} onClick={() => void alternarDisponibilidadeLinha()} className={`rounded-lg px-3 py-2 text-xs font-semibold ${linhaSelecionada.ativo ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-white'} disabled:opacity-50`}>
                    {alterandoDisponibilidade === 'linha' ? 'Salvando...' : linhaSelecionada.ativo ? 'Inativar linha' : 'Liberar linha'}
                  </button>
                </div>
              </div>
            )}

            <label className="mt-4 block text-xs font-semibold text-slate-600">2. Tipologia
              <select value={tipologiaId} onChange={e => selecionarTipologia(e.target.value)} disabled={!linhaSelecionada || tipologiasDaLinha.length === 0} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm disabled:bg-slate-100">
                <option value="">{!linhaSelecionada ? 'Selecione uma linha primeiro' : tipologiasDaLinha.length === 0 ? 'Nenhuma tipologia vinculada' : 'Selecione a tipologia'}</option>
                {tipologiasDaLinha.map(tipologia => <option key={tipologia.id} value={tipologia.id}>{tipologia.label}{tipologia.ativo ? '' : ' — INATIVA'}</option>)}
              </select>
            </label>

            {tipologiaSelecionada && (
              <div className={`mt-2 rounded-xl border p-3 ${tipologiaSelecionada.ativo ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-xs font-semibold text-slate-700">Disponibilidade da tipologia</p><p className="mt-0.5 text-[11px] text-slate-500">{tipologiaSelecionada.ativo ? 'Liberada dentro desta linha.' : 'Inativa, fórmulas e histórico preservados.'}</p></div>
                  <button type="button" disabled={alterandoDisponibilidade === 'tipologia'} onClick={() => void alternarDisponibilidadeTipologia()} className={`rounded-lg px-3 py-2 text-xs font-semibold ${tipologiaSelecionada.ativo ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-white'} disabled:opacity-50`}>
                    {alterandoDisponibilidade === 'tipologia' ? 'Salvando...' : tipologiaSelecionada.ativo ? 'Inativar tipologia' : 'Liberar tipologia'}
                  </button>
                </div>
              </div>
            )}

            {avisoCatalogo && <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-2.5 text-xs text-sky-800">{avisoCatalogo}</div>}

            <div className="mb-2 mt-5 border-t border-slate-200 pt-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Configurações da tipologia</div>
            <div className="max-h-[42vh] space-y-2 overflow-auto pr-1">
              {registrosDaTipologia.map(item => (
                <button key={item.id} type="button" onClick={() => setSelecionadaId(item.id)} className={`w-full rounded-xl border p-3 text-left transition ${selecionadaId === item.id ? 'border-emerald-300 bg-emerald-50' : 'border-slate-100 hover:bg-slate-50'}`}>
                  <div className="text-sm font-semibold text-slate-800">{item.configuracao_label}</div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${statusClass(item.status)}`}>{STATUS.find(s => s.value === item.status)?.label}</span>
                    <span className="text-[10px] text-slate-400">v{item.versao}</span>
                  </div>
                </button>
              ))}
              {tipologiaSelecionada && registrosDaTipologia.length === 0 && <p className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">Esta tipologia ainda não possui configuração de fórmula cadastrada.</p>}
              {!tipologiaSelecionada && <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Escolha uma tipologia para ver suas configurações.</p>}
            </div>
          </aside>

          {!rascunho ? (
            <section className="grid min-h-[500px] place-items-center rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-400">
              <div><Wrench className="mx-auto mb-3"/><p className="font-medium text-slate-600">Nenhuma configuração selecionada</p><p className="mt-1 text-sm">Escolha Linha → Tipologia → Configuração no painel ao lado.</p></div>
            </section>
          ) : (
            <section className="space-y-5">
              {(!linhaSelecionada?.ativo || !tipologiaSelecionada?.ativo) && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Cadastro inativo:</strong> esta fórmula pode continuar sendo editada e testada, mas não será oferecida nos fluxos ativos enquanto a linha e a tipologia não estiverem liberadas.</div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">Configuração fixa</div>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">{tipologiaSelecionada?.label || rascunho.tipologia?.label?.split(' — ')[0]}</h2>
                    <p className="mt-1 text-xs text-slate-400">{linhaSelecionada?.nome || 'Linha não identificada'} · Chave: {rascunho.configuracao_chave} · Versão {rascunho.versao}</p>
                  </div>
                  <button type="button" disabled={salvando} onClick={salvar} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar alterações</button>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <label className="text-sm font-medium text-slate-700 md:col-span-2">Nome da configuração<input value={rascunho.configuracao_label} onChange={e => setRascunho({ ...rascunho, configuracao_label: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
                  <label className="text-sm font-medium text-slate-700">Status<select value={rascunho.status} onChange={e => setRascunho({ ...rascunho, status: e.target.value as StatusFormulaCorte, ativo: e.target.value === 'validada' ? rascunho.ativo : false })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">{STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
                </div>

                <label className="mt-4 block text-sm font-medium text-slate-700">Observações técnicas<textarea value={rascunho.observacoes || ''} onChange={e => setRascunho({ ...rascunho, observacoes: e.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>

                <label className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><input type="checkbox" checked={rascunho.ativo} disabled={rascunho.status !== 'validada'} onChange={e => setRascunho({ ...rascunho, ativo: e.target.checked })} className="h-4 w-4" /><span><strong>Liberar esta configuração no Plano de Corte</strong><br/><span className="text-xs text-slate-500">A configuração precisa estar Validada. Linha e tipologia também precisam estar liberadas.</span></span></label>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">Perfis e fórmulas</h3><p className="text-xs text-slate-500">LF = largura − 4 mm · HF = altura − 4 mm · CEIL() sempre arredonda para cima.</p></div><button type="button" onClick={adicionarPeca} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"><Plus size={15}/> Adicionar perfil</button></div>

                <div className="space-y-3">
                  {rascunho.pecas.map((peca, index) => {
                    const avancada = !peca.codigo && Boolean(peca.grupo)
                    return (
                      <div key={`${index}-${peca.codigo || peca.grupo || 'peca'}`} className="rounded-xl border border-slate-200 p-4">
                        {avancada && <div className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Regra legada avançada ({peca.grupo}). Ela é preservada, mas o código não pode ser trocado neste editor simples.</div>}
                        <div className="grid gap-3 md:grid-cols-12">
                          <label className="text-xs font-semibold text-slate-500 md:col-span-2">Código do perfil<input list="catalogo-perfis-atlas" disabled={avancada} value={peca.codigo || peca.grupo || ''} onChange={e => atualizarPeca(index, { codigo: e.target.value.toUpperCase() })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm disabled:bg-slate-100" /></label>
                          <label className="text-xs font-semibold text-slate-500 md:col-span-4">Descrição<input value={peca.descricao || ''} onChange={e => atualizarPeca(index, { descricao: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" /></label>
                          <label className="text-xs font-semibold text-slate-500 md:col-span-3">Fórmula<input value={peca.formula || ''} onChange={e => atualizarPeca(index, { formula: e.target.value })} placeholder="Ex.: CEIL((LF - 181) / 2)" className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs" /></label>
                          <label className="text-xs font-semibold text-slate-500 md:col-span-1">Qtd.<input type="number" min="0" value={peca.quantidade ?? ''} onChange={e => atualizarPeca(index, { quantidade: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" /></label>
                          <label className="text-xs font-semibold text-slate-500 md:col-span-1">Eixo<select value={peca.eixo || ''} onChange={e => atualizarPeca(index, { eixo: (e.target.value || undefined) as 'L' | 'H' | undefined })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm"><option value="">—</option><option value="L">L</option><option value="H">H</option></select></label>
                          <button type="button" onClick={() => removerPeca(index)} className="mt-5 grid h-9 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 md:col-span-1"><Trash2 size={16}/></button>
                        </div>
                        {(peca.formula_L || peca.formula_H) && <div className="mt-3 grid gap-3 md:grid-cols-2"><label className="text-xs font-semibold text-slate-500">Fórmula L<input value={peca.formula_L || ''} onChange={e => atualizarPeca(index, { formula_L: e.target.value || undefined })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs" /></label><label className="text-xs font-semibold text-slate-500">Fórmula H<input value={peca.formula_H || ''} onChange={e => atualizarPeca(index, { formula_H: e.target.value || undefined })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs" /></label></div>}
                        <label className="mt-3 block text-xs font-semibold text-slate-500">Composição / origem do desconto<input value={peca.composicao_desconto || ''} onChange={e => atualizarPeca(index, { composicao_desconto: e.target.value })} placeholder="Ex.: 181 = ..." className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" /></label>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-bold text-slate-900">Vidro</h3><p className="mt-1 text-xs text-slate-500">A fórmula do vidro fica separada da folga de encaixe da esquadria.</p>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <label className="text-xs font-semibold text-slate-500">Largura do vidro<input value={rascunho.vidro.formula_largura || ''} onChange={e => setRascunho({ ...rascunho, vidro: { ...rascunho.vidro, formula_largura: e.target.value } })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs" /></label>
                  <label className="text-xs font-semibold text-slate-500">Altura do vidro<input value={rascunho.vidro.formula_altura || ''} onChange={e => setRascunho({ ...rascunho, vidro: { ...rascunho.vidro, formula_altura: e.target.value } })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs" /></label>
                  <label className="text-xs font-semibold text-slate-500">Quantidade<input type="number" min="1" value={rascunho.vidro.quantidade || 1} onChange={e => setRascunho({ ...rascunho, vidro: { ...rascunho.vidro, quantidade: Number(e.target.value) || 1 } })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" /></label>
                  <label className="text-xs font-semibold text-slate-500 md:col-span-3">Composição da largura<input value={rascunho.vidro.composicao_largura || ''} onChange={e => setRascunho({ ...rascunho, vidro: { ...rascunho.vidro, composicao_largura: e.target.value } })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" /></label>
                  <label className="text-xs font-semibold text-slate-500 md:col-span-3">Composição da altura<input value={rascunho.vidro.composicao_altura || ''} onChange={e => setRascunho({ ...rascunho, vidro: { ...rascunho.vidro, composicao_altura: e.target.value } })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" /></label>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2"><Beaker size={18} className="text-emerald-600"/><h3 className="font-bold text-slate-900">Testar antes de salvar / liberar</h3></div>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <label className="text-xs font-semibold text-slate-500">Largura (mm)<input type="number" value={largura} onChange={e => setLargura(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" /></label>
                  <label className="text-xs font-semibold text-slate-500">Altura (mm)<input type="number" value={altura} onChange={e => setAltura(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" /></label>
                  {rascunho.variaveis.map(v => <label key={v.chave} className="text-xs font-semibold text-slate-500">{v.label}<select value={opcoes[v.chave] || ''} onChange={e => setOpcoes(prev => ({ ...prev, [v.chave]: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm">{v.opcoes.map(o => <option key={o} value={o}>{o}</option>)}</select></label>)}
                  <button type="button" onClick={testar} className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white"><Beaker size={15}/> Calcular teste</button>
                </div>

                {erro && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
                {mensagem && <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><Check size={15}/>{mensagem}</div>}

                {resultados.length > 0 && <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">Código</th><th className="p-3">Descrição</th><th className="p-3">Eixo</th><th className="p-3 text-right">Corte</th><th className="p-3 text-right">Qtd.</th><th className="p-3">Origem do desconto</th></tr></thead><tbody>{resultados.map((r, i) => <tr key={`${r.codigo}-${r.eixo}-${i}`} className="border-t border-slate-100"><td className="p-3 font-semibold">{r.codigo}</td><td className="p-3">{r.descricao || '—'}</td><td className="p-3">{r.eixo || '—'}</td><td className="p-3 text-right font-mono font-semibold">{medida(r.tamanho)} mm</td><td className="p-3 text-right">{r.quantidade ?? '—'}</td><td className="p-3 text-xs text-slate-500">{r.composicao_desconto || '—'}</td></tr>)}</tbody></table></div>}

                {vidroTeste && <div className="mt-4 rounded-xl bg-sky-50 p-4 text-sm text-sky-900"><strong>Vidro:</strong> {vidroTeste.quantidade} peça(s) de <strong>{medida(vidroTeste.largura)} × {medida(vidroTeste.altura)} mm</strong></div>}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4 text-sm text-slate-600"><strong>Acessórios, reforços e outros componentes:</strong> continuam em <Link href="/engenharia/receitas" className="font-semibold text-emerald-700 underline">Receitas Técnicas</Link>. Este editor altera os perfis e fórmulas do Plano de Corte; a receita técnica mantém acessórios e variantes da tipologia.</div>
            </section>
          )}
        </div>
      </div>
    </main>
  )
}
