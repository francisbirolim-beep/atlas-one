'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import ImagemProdutoTecnico from '@/components/engenharia/ImagemProdutoTecnico'
import { ArrowLeft, Beaker, BookOpen, Check, ClipboardCopy, FileDown, Loader2, Plus, Save, Trash2, Wrench } from 'lucide-react'
import {
  calcularFormulaCorteIsolada,
  calcularFormulasCorte,
  resolverFormulaCondicional,
  FormulaCorteError,
  type PecaFormula,
  type ResultadoPeca,
} from '@/lib/formulasCorteEngine'
import {
  listarTodasFormulasCorte,
  salvarFormulaCorte,
  criarVersaoTesteFormulaCorte,
  type RegistroFormulaCorte,
  type StatusFormulaCorte,
} from '@/lib/engenhariaFormulasCorte'
import { calcularAcessoriosTecnicos, type ResultadoAcessorioFormula } from '@/lib/formulasAcessoriosEngine'
import { listarProdutos } from '@/lib/produtos'
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

function somenteDisponibilidade(
  salvo: RegistroFormulaCorte | null, rascunho: RegistroFormulaCorte | null
): boolean {
  if (!salvo || !rascunho || salvo.id !== rascunho.id ||
      salvo.status !== 'validada' || rascunho.status !== 'validada' ||
      salvo.ativo === rascunho.ativo) return false
  const tecnico = (r: RegistroFormulaCorte) => JSON.stringify({
    configuracao_label: r.configuracao_label,
    variaveis: r.variaveis,
    pecas: r.pecas,
    vidro: r.vidro,
    acessorios: r.acessorios,
    folgas: r.folgas,
    metadados_editor: r.metadados_editor,
    observacoes: r.observacoes,
  })
  return tecnico(salvo) === tecnico(rascunho)
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
  const [resultadosAcessorios, setResultadosAcessorios] = useState<ResultadoAcessorioFormula[]>([])
  const [duplicando, setDuplicando] = useState(false)
  const [testeRealizado, setTesteRealizado] = useState(false)
  const [vidroTeste, setVidroTeste] = useState<{ largura: number; altura: number; quantidade: number } | null>(null)

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const [formulas, catalogo, linhasTecnicas, tipologiasTecnicas] = await Promise.all([
        listarTodasFormulasCorte(),
        listarProdutos(),
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
    setResultadosAcessorios([])
    setTesteRealizado(false)
    setVidroTeste(null)
    const defaults: Record<string, string> = {}
    for (const variavel of selecionada?.variaveis || []) defaults[variavel.chave] = variavel.opcoes[0] || ''
    setOpcoes(defaults)
  }, [selecionada?.id])

  useEffect(() => {
    setResultados([])
    setResultadosAcessorios([])
    setTesteRealizado(false)
    setVidroTeste(null)
  }, [rascunho, largura, altura, opcoes])

  const perfis = useMemo(
    () => produtos.filter(p => p.categoria === 'perfil' && p.codigo && p.ativo !== false && Boolean(p.unidade)),
    [produtos]
  )

  const buscarPerfil = (codigo: string) => produtos.find(p => p.categoria === 'perfil' && p.codigo?.trim().toUpperCase() === codigo.trim().toUpperCase()) || null
  const atualizarImagem = (id: string, fotoUrl: string) => setProdutos(anteriores => anteriores.map(p => p.id === id ? { ...p, foto_url: fotoUrl } : p))

  function escolherConfiguracaoDaTipologia(id: string) {
    const preferida = registros.find(item => item.tipologia_id === id && item.ativo && item.status === 'validada')
      || registros.find(item => item.tipologia_id === id && item.configuracao_chave !== 'legado_wvetro_994')
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

  function atualizarAcessorio(index: number, patch: Partial<RegistroFormulaCorte['acessorios'][number]>) {
    setRascunho(prev => prev ? {
      ...prev,
      acessorios: prev.acessorios.map((item, i) => i === index ? { ...item, ...patch } : item),
    } : prev)
  }

  function adicionarAcessorio() {
    setRascunho(prev => prev ? { ...prev, acessorios: [...prev.acessorios, { codigo: '', descricao: '', formula_quantidade: '', status: 'em_validacao' }] } : prev)
  }

  function removerAcessorio(index: number) {
    setRascunho(prev => prev ? { ...prev, acessorios: prev.acessorios.filter((_, i) => i !== index) } : prev)
  }

  function atualizarVariavel(index: number, patch: Partial<RegistroFormulaCorte['variaveis'][number]>) {
    setRascunho(prev => prev ? {
      ...prev, variaveis: prev.variaveis.map((v,i) => i===index ? { ...v, ...patch } : v),
    } : prev)
  }
  function adicionarVariavel() {
    setRascunho(prev => prev ? { ...prev, variaveis: [...prev.variaveis, { chave: '', label: '', opcoes: [] }] } : prev)
  }
  function removerVariavel(index: number) {
    setRascunho(prev => prev ? { ...prev, variaveis: prev.variaveis.filter((_,i)=>i!==index) } : prev)
  }
  function definirDescricao(chave: 'descricao_interna' | 'descricao_orcamento', valor: string) {
    setRascunho(prev => prev ? { ...prev, metadados_editor: { ...prev.metadados_editor, [chave]: valor } } : prev)
  }
  async function criarVersaoTeste() {
    if (!selecionada || duplicando) return
    setDuplicando(true)
    setErro('')
    const nova = await criarVersaoTesteFormulaCorte(rascunho || selecionada)
    if (nova) {
      setRegistros(prev => [...prev,nova])
      setSelecionadaId(nova.id)
      setMensagem('Versão para teste criada. Original preservado. Simule antes de validar.')
    } else setErro('Não foi possível criar versão de teste. Original não alterado.')
    setDuplicando(false)
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
    const apenasAtivacao = somenteDisponibilidade(selecionada, rascunho)
    if (selecionada?.status === 'validada' && selecionada.id === rascunho.id && !apenasAtivacao) {
      setErro('Receita homologada protegida: crie uma versão de teste antes de alterar e salvar.')
      return
    }
    if (rascunho.ativo && registros.some(f =>
      f.id !== rascunho.id && f.tipologia_id === rascunho.tipologia_id && f.ativo
    )) {
      setErro('Existe outra receita ativa nesta tipologia. Para liberar a nova, inative primeiro a anterior e depois ative a revisão validada.')
      return
    }
    if (rascunho.variaveis.some(v => !v.chave.trim() || !v.label.trim())) {
      setErro('Preencha nome e chave de todas as variáveis antes de salvar.')
      return
    }
    if (new Set(rascunho.variaveis.map(v => v.chave.trim())).size !== rascunho.variaveis.length) {
      setErro('Há variáveis com a mesma chave.')
      return
    }
    if (rascunho.status === 'validada' && !apenasAtivacao && (!testeRealizado || resultados.length === 0 ||
      resultadosAcessorios.some(a => a.erro || (a.ativo !== false && a.valor === null)))) {
      setErro('Antes de validar, execute uma simulação atualizada e corrija todas as fórmulas pendentes de acessórios.')
      return
    }
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
      folgas: rascunho.folgas,
      metadados_editor: rascunho.metadados_editor,
      acessorios: rascunho.acessorios,
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
      const escolha = { ...opcoes }
      for (const v of rascunho.variaveis) {
        if (!escolha[v.chave] && v.opcoes[0]) escolha[v.chave] = v.opcoes[0]
      }
      const calculados = calcularFormulasCorte(rascunho, L, H, escolha)
      setResultados(calculados)
      setResultadosAcessorios(calcularAcessoriosTecnicos(
        rascunho.acessorios, L, H, Number(escolha.numero_folhas || escolha.folhas || 2),
        calculados.map(p => ({ codigo: p.codigo, tamanho: p.tamanho, grupo: p.grupo })),
        escolha, rascunho.folgas
      ))
      setTesteRealizado(true)
      const formulaL = rascunho.vidro.formula_largura
        ? resolverFormulaCondicional(rascunho.vidro.formula_largura, rascunho.vidro.condicoes_largura, escolha)
        : null
      const formulaH = rascunho.vidro.formula_altura
        ? resolverFormulaCondicional(rascunho.vidro.formula_altura, rascunho.vidro.condicoes_altura, escolha)
        : null
      if (formulaL && formulaH) {
        setVidroTeste({
          largura: calcularFormulaCorteIsolada(formulaL, L, H, escolha.numero_folhas ? Number(escolha.numero_folhas) : undefined, rascunho.folgas),
          altura: calcularFormulaCorteIsolada(formulaH, L, H, escolha.numero_folhas ? Number(escolha.numero_folhas) : undefined, rascunho.folgas),
          quantidade: rascunho.vidro.formula_quantidade ? calcularFormulaCorteIsolada(rascunho.vidro.formula_quantidade, L, H, escolha.numero_folhas ? Number(escolha.numero_folhas) : undefined, rascunho.folgas) : Number(escolha.numero_folhas || rascunho.vidro.quantidade || 1),
        })
      } else setVidroTeste(null)
    } catch (e) {
      setResultados([])
      setResultadosAcessorios([])
      setTesteRealizado(false)
      setVidroTeste(null)
      setErro(e instanceof FormulaCorteError || e instanceof Error ? e.message : 'Erro ao testar fórmula.')
    }
  }

  const receitaAtivaProtegida = Boolean(selecionada?.status === 'validada' && selecionada.id === rascunho?.id && !somenteDisponibilidade(selecionada, rascunho))

  if (carregando) {
    return <div className="grid min-h-[60vh] place-items-center text-slate-500"><Loader2 className="animate-spin" /></div>
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-7">
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #relatorio-simulacao, #relatorio-simulacao * { visibility: visible !important; }
        #relatorio-simulacao { position: absolute !important; left: 0; top: 0; width: 100%; border: 0; box-shadow: none; }
        .nao-imprimir { display: none !important; }
        @page { size: A4 portrait; margin: 12mm; }
      }`}</style>
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
                <h1 className="text-2xl font-bold text-slate-900">Bancada de Engenharia · Simulação de Corte</h1>
                <p className="text-sm text-slate-500">Escolha linha → tipologia → receita. Abra a árvore, simule perfis, acessórios e vidros, revise e valide sem alterar a original.</p>
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

            <div className="mb-2 mt-5 border-t border-slate-200 pt-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">3. Receitas técnicas e versões</div>
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
            {rascunho && <nav aria-label="Árvore da receita técnica" className="mt-4 border-t border-slate-200 pt-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Árvore da tipologia</p>
              <div className="grid gap-1 text-xs font-semibold">
                {[
                  ['bloco-descricoes', '01 · Descrições e status'],
                  ['bloco-variaveis', '02 · Variáveis e montagem'],
                  ['bloco-perfis', '03 · Perfis e fórmulas'],
                  ['bloco-vidro', '04 · Vidros e folgas'],
                  ['bloco-acessorios', '05 · Acessórios'],
                  ['bloco-simulacao', '06 · Simulação de corte'],
                ].map(([id,text])=><a key={id} href={'#'+id} className="rounded-lg px-3 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800">{text} ↗</a>)}
              </div>
            </nav>}
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

              {receitaAtivaProtegida && <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                <strong>Receita homologada protegida.</strong> Para modificar medidas, fórmulas ou acessórios, crie uma revisão. O controle de disponibilidade pode ser alterado sem modificar os cálculos.
              </div>}
              <div id="bloco-descricoes" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">Configuração fixa</div>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">{tipologiaSelecionada?.label || rascunho.tipologia?.label?.split(' — ')[0]}</h2>
                    <p className="mt-1 text-xs text-slate-400">{linhaSelecionada?.nome || 'Linha não identificada'} · Chave: {rascunho.configuracao_chave} · Versão {rascunho.versao}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" disabled={duplicando} onClick={() => void criarVersaoTeste()} className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 disabled:opacity-60">
                      <ClipboardCopy size={16}/>{duplicando ? 'Criando...' : 'Criar versão de teste'}
                    </button>
                    <button type="button" disabled={salvando || receitaAtivaProtegida} onClick={() => void salvar()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar revisão</button>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <label className="text-sm font-medium text-slate-700 md:col-span-2">Nome da configuração<input value={rascunho.configuracao_label} onChange={e => setRascunho({ ...rascunho, configuracao_label: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
                  <label className="text-sm font-medium text-slate-700">Status<select value={rascunho.status} onChange={e => setRascunho({ ...rascunho, status: e.target.value as StatusFormulaCorte, ativo: e.target.value === 'validada' ? rascunho.ativo : false })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">{STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
                </div>

                <div className="mt-4 grid gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 md:grid-cols-2">
                  <label className="text-xs font-semibold text-sky-800">Folga encaixe largura (mm)
                    <input type="number" min="0" max="100" step="0.5" value={rascunho.folgas?.largura_mm ?? 4} onChange={e => setRascunho({ ...rascunho, folgas: { largura_mm: Number(e.target.value), altura_mm: rascunho.folgas?.altura_mm ?? 4 } })} className="mt-1 w-full rounded-lg border border-sky-200 bg-white p-2 text-sm" />
                  </label>
                  <label className="text-xs font-semibold text-sky-800">Folga encaixe altura (mm)
                    <input type="number" min="0" max="100" step="0.5" value={rascunho.folgas?.altura_mm ?? 4} onChange={e => setRascunho({ ...rascunho, folgas: { largura_mm: rascunho.folgas?.largura_mm ?? 4, altura_mm: Number(e.target.value) } })} className="mt-1 w-full rounded-lg border border-sky-200 bg-white p-2 text-sm" />
                  </label>
                  <p className="text-xs text-sky-800 md:col-span-2">Essas folgas são descontadas do vão antes das fórmulas (LF e HF). A regra padrão de 4 mm fica preservada nas receitas antigas.</p>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-semibold text-slate-700">Descrição interna da Engenharia
                    <textarea value={String(rascunho.metadados_editor?.descricao_interna || '')} onChange={e => definirDescricao('descricao_interna',e.target.value)} rows={3} placeholder="Ex.: Suprema, mão-amiga comum, 2 a 6 folhas, montar com..." className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" />
                    <span className="mt-1 block text-xs font-normal text-slate-500">Apenas referência técnica interna; não aparece para o cliente.</span>
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">Descrição para o orçamento do cliente
                    <textarea value={String(rascunho.metadados_editor?.descricao_orcamento || '')} onChange={e => definirDescricao('descricao_orcamento',e.target.value)} rows={3} placeholder="Ex.: Porta de correr sequencial Suprema, folhas móveis, acabamento..." className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" />
                    <span className="mt-1 block text-xs font-normal text-slate-500">Esta descrição será usada como nome comercial da configuração no orçamento; o cliente não recebe códigos de perfis.</span>
                  </label>
                </div>
                <label className="mt-4 block text-sm font-medium text-slate-700">Observações técnicas<textarea value={rascunho.observacoes || ''} onChange={e => setRascunho({ ...rascunho, observacoes: e.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>

                <label className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><input type="checkbox" checked={rascunho.ativo} disabled={rascunho.status !== 'validada'} onChange={e => setRascunho({ ...rascunho, ativo: e.target.checked })} className="h-4 w-4" /><span><strong>Liberar esta configuração no Plano de Corte</strong><br/><span className="text-xs text-slate-500">A configuração precisa estar Validada. Linha e tipologia também precisam estar liberadas.</span></span></label>
              </div>

              <div id="bloco-variaveis" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h3 className="font-bold text-slate-900">Árvore de variáveis da tipologia</h3>
                    <p className="text-xs text-slate-500">Quantidade de folhas, montagem, trilho, mão-amiga, reforços e demais opções. As regras por variante ficam nas fórmulas dos perfis e acessórios.</p>
                  </div>
                  <button type="button" onClick={adicionarVariavel} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold"><Plus size={15}/> Nova variável</button>
                </div>
                {rascunho.variaveis.length === 0 && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Sem variáveis adicionais nesta receita. Você pode cadastrar uma árvore de escolhas.</p>}
                <div className="mt-4 space-y-3">
                  {rascunho.variaveis.map((item,index)=><div key={index} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-12">
                    <label className="text-xs font-semibold text-slate-600 md:col-span-3">Chave técnica
                      <input value={item.chave} onChange={e=>atualizarVariavel(index,{chave:e.target.value.trim().replace(/\s/g,'_')})} placeholder="numero_folhas" className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs"/>
                    </label>
                    <label className="text-xs font-semibold text-slate-600 md:col-span-3">Nome da variável
                      <input value={item.label} onChange={e=>atualizarVariavel(index,{label:e.target.value})} placeholder="Quantidade de folhas" className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"/>
                    </label>
                    <label className="text-xs font-semibold text-slate-600 md:col-span-5">Opções (separadas por vírgula)
                      <input value={item.opcoes.join(', ')} onChange={e=>atualizarVariavel(index,{opcoes:e.target.value.split(',').map(v=>v.trim()).filter(Boolean)})} placeholder="2, 3, 4, 5, 6" className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"/>
                    </label>
                    <button type="button" onClick={()=>removerVariavel(index)} className="mt-5 grid h-9 place-items-center rounded-lg text-red-600 hover:bg-red-50" title="Remover variável"><Trash2 size={16}/></button>
                  </div>)}
                </div>
                <p className="mt-3 text-xs text-amber-700">Antes de remover uma variável, revise as fórmulas que dependem dela. A simulação avisa se houver referências sem valor.</p>
              </div>

              <div id="bloco-perfis" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">Perfis e fórmulas</h3><p className="text-xs text-slate-500">LF = largura menos folga cadastrada · HF = altura menos folga cadastrada · travessas sempre arredondadas para cima.</p></div><button type="button" onClick={adicionarPeca} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"><Plus size={15}/> Adicionar perfil</button></div>

                <div className="space-y-3">
                  {rascunho.pecas.map((peca, index) => {
                    const avancada = !peca.codigo && Boolean(peca.grupo)
                    const produtoItem = buscarPerfil(peca.codigo || '')
                    return (
                      <div key={`${index}-${peca.codigo || peca.grupo || 'peca'}`} className="rounded-xl border border-slate-200 p-4">
                        <div className="mb-4 flex flex-wrap items-center gap-4">
                          <ImagemProdutoTecnico codigo={peca.codigo || ''} produto={produtoItem} permitirEdicao onAtualizar={atualizarImagem} />
                          <div className="text-sm"><span className="font-mono font-semibold text-slate-800">{peca.codigo || peca.grupo || 'Sem código'}</span><p className="text-slate-600">{peca.descricao || 'Perfil sem descrição'}</p><p className="mt-1 text-xs text-slate-400">Foto do cadastro técnico central; a fórmula não é modificada.</p></div>
                        </div>
                        {avancada && <div className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Regra legada avançada ({peca.grupo}). Ela é preservada, mas o código não pode ser trocado neste editor simples.</div>}
                        <div className="grid gap-3 md:grid-cols-12">
                          <label className="text-xs font-semibold text-slate-500 md:col-span-2">Código do perfil (trocar = substituir)<input list="catalogo-perfis-atlas" disabled={avancada} value={peca.codigo || peca.grupo || ''} onChange={e => atualizarPeca(index, { codigo: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm disabled:bg-slate-100" /></label>
                          <label className="text-xs font-semibold text-slate-500 md:col-span-4">Descrição<input value={peca.descricao || ''} onChange={e => atualizarPeca(index, { descricao: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" /></label>
                          <label className="text-xs font-semibold text-slate-500 md:col-span-3">Fórmula<input value={peca.formula || ''} onChange={e => atualizarPeca(index, { formula: e.target.value })} placeholder="Ex.: CEIL((LF - 181) / 2)" className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs" /></label>
                          <label className="text-xs font-semibold text-slate-500 md:col-span-1">Qtd.<input type="number" min="0" value={peca.quantidade ?? ''} onChange={e => atualizarPeca(index, { quantidade: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" /></label>
                          <label className="text-xs font-semibold text-slate-500 md:col-span-1">Eixo<select value={peca.eixo || ''} onChange={e => atualizarPeca(index, { eixo: (e.target.value || undefined) as 'L' | 'H' | undefined })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm"><option value="">—</option><option value="L">L</option><option value="H">H</option></select></label>
                          <button type="button" onClick={() => removerPeca(index)} className="mt-5 grid h-9 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 md:col-span-1"><Trash2 size={16}/></button>
                        </div>
                        {(peca.formula_L || peca.formula_H) && <div className="mt-3 grid gap-3 md:grid-cols-2"><label className="text-xs font-semibold text-slate-500">Fórmula L<input value={peca.formula_L || ''} onChange={e => atualizarPeca(index, { formula_L: e.target.value || undefined })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs" /></label><label className="text-xs font-semibold text-slate-500">Fórmula H<input value={peca.formula_H || ''} onChange={e => atualizarPeca(index, { formula_H: e.target.value || undefined })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs" /></label></div>}
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <label className="text-xs font-semibold text-slate-500">Fórmula da quantidade
                            <input value={peca.formula_quantidade || ''} onChange={e => atualizarPeca(index, { formula_quantidade: e.target.value || undefined })} placeholder="Ex.: Folhas ou 2 * Folhas" className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs" />
                          </label>
                          {peca.condicao_ativa?.numero_folhas && <label className="text-xs font-semibold text-slate-500">Somente para quantidades de folhas (separadas por vírgula)
                            <input value={peca.condicao_ativa.numero_folhas.join(', ')} onChange={e => atualizarPeca(index, { condicao_ativa: { ...peca.condicao_ativa, numero_folhas: e.target.value.split(',').map(v => v.trim()).filter(Boolean) } })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs" />
                          </label>}
                        </div>
                        {peca.mapa_codigo && <div className="mt-3 grid gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:grid-cols-5">
                          {Object.entries(peca.mapa_codigo).map(([folhas, codigo]) => <label key={folhas} className="text-xs font-semibold text-amber-900">{folhas} folhas
                            <input value={codigo} onChange={e => atualizarPeca(index, { mapa_codigo: { ...peca.mapa_codigo, [folhas]: e.target.value.toUpperCase() } })} className="mt-1 w-full rounded-lg border border-amber-200 bg-white p-2 font-mono text-xs" />
                          </label>)}
                          <p className="text-[11px] text-amber-800 sm:col-span-5">Código do marco selecionado automaticamente pelo número de planos. Pode ser revisto por folha sem duplicar tipologias.</p>
                        </div>}
                        <label className="mt-3 block text-xs font-semibold text-slate-500">Composição / origem do desconto<input value={peca.composicao_desconto || ''} onChange={e => atualizarPeca(index, { composicao_desconto: e.target.value })} placeholder="Ex.: 181 = ..." className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" /></label>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div id="bloco-vidro" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-bold text-slate-900">Vidro</h3><p className="mt-1 text-xs text-slate-500">A fórmula do vidro fica separada da folga de encaixe da esquadria.</p>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <label className="text-xs font-semibold text-slate-500">Largura do vidro<input value={rascunho.vidro.formula_largura || ''} onChange={e => setRascunho({ ...rascunho, vidro: { ...rascunho.vidro, formula_largura: e.target.value } })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs" /></label>
                  <label className="text-xs font-semibold text-slate-500">Altura do vidro<input value={rascunho.vidro.formula_altura || ''} onChange={e => setRascunho({ ...rascunho, vidro: { ...rascunho.vidro, formula_altura: e.target.value } })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs" /></label>
                  <label className="text-xs font-semibold text-slate-500">Quantidade<input type="number" min="1" value={rascunho.vidro.quantidade || 1} onChange={e => setRascunho({ ...rascunho, vidro: { ...rascunho.vidro, quantidade: Number(e.target.value) || 1 } })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" /></label>
                  <label className="text-xs font-semibold text-slate-500">Fórmula de quantidade de vidros<input value={rascunho.vidro.formula_quantidade || ''} onChange={e => setRascunho({ ...rascunho, vidro: { ...rascunho.vidro, formula_quantidade: e.target.value } })} placeholder="Ex.: Folhas" className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs" /></label>
                  <label className="text-xs font-semibold text-slate-500 md:col-span-3">Composição da largura<input value={rascunho.vidro.composicao_largura || ''} onChange={e => setRascunho({ ...rascunho, vidro: { ...rascunho.vidro, composicao_largura: e.target.value } })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" /></label>
                  <label className="text-xs font-semibold text-slate-500 md:col-span-3">Composição da altura<input value={rascunho.vidro.composicao_altura || ''} onChange={e => setRascunho({ ...rascunho, vidro: { ...rascunho.vidro, composicao_altura: e.target.value } })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" /></label>
                </div>
              </div>

              <div id="bloco-acessorios" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h3 className="font-bold text-slate-900">Acessórios e consumíveis da receita</h3>
                    <p className="text-xs text-slate-500">Código, quantidade, status e condições por número de folhas. Salvar mantém essas alterações junto à fórmula técnica.</p>
                  </div>
                  <button type="button" onClick={adicionarAcessorio} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold"><Plus size={15} /> Adicionar acessório</button>
                </div>
                <div className="mt-4 space-y-2">
                  {rascunho.acessorios.map((item, index) => <div key={`${item.codigo}-${index}`} className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-12">
                    <label className="text-[11px] font-semibold text-slate-500 md:col-span-2">Código (trocar = substituir)
                      <input value={item.codigo} onChange={e => atualizarAcessorio(index, { codigo: e.target.value.toUpperCase() })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs" />
                    </label>
                    <label className="text-[11px] font-semibold text-slate-500 md:col-span-3">Descrição
                      <input value={item.descricao || ''} onChange={e => atualizarAcessorio(index, { descricao: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs" />
                    </label>
                    <label className="text-[11px] font-semibold text-slate-500 md:col-span-3">Fórmula de quantidade
                      <input value={item.formula_quantidade || ''} onChange={e => atualizarAcessorio(index, { formula_quantidade: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs" />
                    </label>
                    <label className="text-[11px] font-semibold text-slate-500 md:col-span-2">Aplica às folhas (vazio = todas)
                      <input value={item.condicao_ativa?.numero_folhas?.join(', ') || ''} onChange={e => atualizarAcessorio(index, { condicao_ativa: e.target.value.trim() ? { ...item.condicao_ativa, numero_folhas: e.target.value.split(',').map(v => v.trim()).filter(Boolean) } : undefined })} placeholder="2, 3, 4" className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs" />
                    </label>
                    <label className="text-[11px] font-semibold text-slate-500 md:col-span-1">Status
                      <select value={item.status || 'em_validacao'} onChange={e => atualizarAcessorio(index, { status: e.target.value as 'referencia' | 'em_validacao' | 'validada' })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs">
                        <option value="referencia">Referência</option><option value="em_validacao">Revisão</option><option value="validada">Validada</option>
                      </select>
                    </label>
                    <button type="button" title="Remover acessório da receita" onClick={() => removerAcessorio(index)} className="mt-5 grid h-9 place-items-center rounded-lg text-red-600 hover:bg-red-50"><Trash2 size={16}/></button>
                  </div>)}
                </div>
              </div>

              <div id="bloco-simulacao" className="scroll-mt-24 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2"><Beaker size={18} className="text-emerald-600"/><h3 className="font-bold text-slate-900">Testar antes de salvar / liberar</h3></div>
                <p className="mt-2 text-xs text-slate-500">O teste usa os dados mostrados na tela, inclusive alterações ainda não salvas. Nada é enviado para produção.</p>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <label className="text-xs font-semibold text-slate-500">Largura (mm)<input type="number" value={largura} onChange={e => setLargura(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" /></label>
                  <label className="text-xs font-semibold text-slate-500">Altura (mm)<input type="number" value={altura} onChange={e => setAltura(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" /></label>
                  {rascunho.variaveis.map(v => <label key={v.chave} className="text-xs font-semibold text-slate-500">{v.label}{v.opcoes.length > 0 ? <select value={opcoes[v.chave] || ''} onChange={e => setOpcoes(prev => ({ ...prev, [v.chave]: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm">{v.opcoes.map(o => <option key={o} value={o}>{o}</option>)}</select> : <input value={opcoes[v.chave] || ''} onChange={e => setOpcoes(prev => ({ ...prev, [v.chave]: e.target.value }))} placeholder={`Informe ${v.label.toLowerCase()}`} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm" />}</label>)}
                  <button type="button" onClick={testar} className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white"><Beaker size={15}/> Calcular teste</button>
                </div>

                {erro && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
                {mensagem && <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><Check size={15}/>{mensagem}</div>}

                {testeRealizado && resultados.length > 0 && <div id="relatorio-simulacao" className="mt-5 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div><p className="text-xs font-bold uppercase tracking-wider text-amber-700">Simulação técnica — não é ordem de produção</p>
                      <h4 className="mt-1 font-bold text-slate-900">{String(rascunho.metadados_editor?.descricao_interna || tipologiaSelecionada?.label || rascunho.configuracao_label)}</h4>
                      <p className="text-xs text-slate-500">Vão: {largura} × {altura} mm · Folga: {rascunho.folgas?.largura_mm ?? 4} / {rascunho.folgas?.altura_mm ?? 4} mm · Configuração: {rascunho.configuracao_label} · v{rascunho.versao}</p>
                    </div>
                    <button type="button" onClick={() => window.print()} className="nao-imprimir inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"><FileDown size={15}/> Imprimir / salvar PDF</button>
                  </div>
                  {(rascunho.variaveis.some(v=>v.chave==='numero_folhas') || /\b0?[2-6] folhas/i.test(tipologiaSelecionada?.label || '')) && (() => {
                    const qtd = Number(opcoes.numero_folhas || (tipologiaSelecionada?.label || '').match(/\b0?([2-6]) folhas/i)?.[1] || 2)
                    return <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-2 text-xs font-semibold text-slate-600">Croqui esquemático · {qtd} folhas / {qtd} planos</p>
                      <div className="flex h-20 max-w-md gap-0.5 border-4 border-slate-700 bg-white p-1">
                        {Array.from({length:qtd},(_,i)=><div key={i} className="relative min-w-0 flex-1 border-2 border-slate-500 bg-sky-50"><span className="absolute inset-0 grid place-items-center text-lg text-slate-700">←</span><span className="absolute bottom-0.5 left-1 text-[9px]">{i+1}</span></div>)}
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">Representação da quantidade de folhas; sentido de abertura definitivo conforme projeto.</p>
                    </div>
                  })()}
                  <h4 className="text-sm font-bold text-slate-900">Perfis — lista de corte</h4>
                  <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">Código</th><th className="p-3">Descrição</th><th className="p-3">Eixo</th><th className="p-3 text-right">Corte</th><th className="p-3 text-right">Qtd.</th><th className="p-3">Origem do desconto</th></tr></thead><tbody>{resultados.map((r, i) => <tr key={`${r.codigo}-${r.eixo}-${i}`} className="border-t border-slate-100"><td className="p-3 font-semibold"><div className="flex items-center gap-2"><ImagemProdutoTecnico codigo={r.codigo} produto={buscarPerfil(r.codigo)} pequeno/><span>{r.codigo}</span></div></td><td className="p-3">{r.descricao || '—'}</td><td className="p-3">{r.eixo || '—'}</td><td className="p-3 text-right font-mono font-semibold">{medida(r.tamanho)} mm</td><td className="p-3 text-right">{r.quantidade ?? '—'}</td><td className="p-3 text-xs text-slate-500">{r.composicao_desconto || '—'}</td></tr>)}</tbody></table></div>

                <h4 className="mt-5 text-sm font-bold text-slate-900">Acessórios e consumíveis</h4>
                <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-xs"><thead className="bg-slate-50 text-left text-slate-600"><tr><th className="p-2">Código</th><th className="p-2">Descrição</th><th className="p-2">Fórmula / origem</th><th className="p-2 text-right">Consumo</th><th className="p-2">Situação</th></tr></thead>
                    <tbody>{resultadosAcessorios.map((res,i)=>{
                      if(res.ativo===false) return null
                      const item=rascunho.acessorios[i]
                      return <tr key={i} className="border-t border-slate-100"><td className="p-2 font-semibold">{item.codigo}</td><td className="p-2">{item.descricao || '—'}</td><td className="p-2 font-mono">{res.calculo}</td><td className="p-2 text-right font-semibold">{res.valor===null ? (item.quantidade_referencia ?? 'A validar') : medida(res.valor)} {item.unidade || 'UN'}</td><td className={res.erro ? 'p-2 text-red-700' : res.valor===null ? 'p-2 text-amber-700' : 'p-2 text-emerald-700'}>{res.erro || (res.valor===null ? 'Somente referência' : 'Calculado')}</td></tr>
                    })}</tbody>
                  </table>
                </div>
                {vidroTeste && <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm">
                  <h4 className="font-bold text-slate-900">Vidro — corte</h4>
                  <p>{vidroTeste.quantidade} peças × {medida(vidroTeste.largura)} × {medida(vidroTeste.altura)} mm</p>
                  <p className="mt-1 text-xs text-slate-600">Fórmula largura: {rascunho.vidro.formula_largura || '—'} · altura: {rascunho.vidro.formula_altura || '—'} · quantidade: {rascunho.vidro.formula_quantidade || rascunho.vidro.quantidade || '—'}</p>
                </div>}
                <div className="mt-3 text-xs text-slate-600">
                  <strong>Descrição no orçamento:</strong> {String(rascunho.metadados_editor?.descricao_orcamento || rascunho.configuracao_label)}
                </div>
                {resultadosAcessorios.some(a=>a.erro || (a.ativo!==false && a.valor===null)) && <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Há acessórios com fórmula pendente ou inválida. Corrija antes de homologar a revisão; simulações não liberam compra nem produção.</div>}
                </div>}

                {resultados.length > 0 && rascunho.variaveis.some(v => v.chave === 'numero_folhas') && (() => {
                  const qtd = Number(opcoes.numero_folhas)
                  const larguraFinal = Number(largura) - (rascunho.folgas?.largura_mm ?? 4)
                  const alturaFinal = Number(altura) - (rascunho.folgas?.altura_mm ?? 4)
                  const desconto = 162 + 19 * (qtd - 2)
                  const travessa = Math.ceil((larguraFinal - desconto) / qtd)
                  return <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                    <strong>Como chegou no cálculo — {qtd} folhas sequenciais</strong>
                    <p className="mt-2">Largura útil (LF): {medida(Number(largura))} − {rascunho.folgas?.largura_mm ?? 4} = <strong>{medida(larguraFinal)} mm</strong>. Altura útil (HF): {medida(Number(altura))} − {rascunho.folgas?.altura_mm ?? 4} = <strong>{medida(alturaFinal)} mm</strong>.</p>
                    <p className="mt-1">Travessa: CEIL((LF − 162 − 19 × ({qtd} − 2)) ÷ {qtd}) = CEIL(({medida(larguraFinal)} − {desconto}) ÷ {qtd}) = <strong>{medida(travessa)} mm</strong>.</p>
                    <p className="mt-1">Vidro: largura {medida(travessa)} − 6 = <strong>{medida(travessa - 6)} mm</strong>; altura HF − 163 = <strong>{medida(alturaFinal - 163)} mm</strong>. Quantidade = {qtd} vidros.</p>
                    <p className="mt-2 text-xs text-emerald-800">Regra da Esquadrifácio: toda travessa arredonda para cima. A compensação de 19 mm acompanha o aumento de folhas; marcos e acessórios são definidos na receita pela quantidade escolhida.</p>
                  </div>
                })()}

              </div>


            </section>
          )}
        </div>
      </div>
    </main>
  )
}
