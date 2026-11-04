'use client'

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import Link from 'next/link'
import { ArrowLeft, Beaker, CheckCircle2, ClipboardCheck, FileText, Loader2, Plus, Save, Upload, Wrench, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usuarioAtual } from '@/lib/auth'
import { listarTodasFormulasCorte, criarVersaoTesteFormulaCorte, salvarFormulaCorte, type RegistroFormulaCorte } from '@/lib/engenhariaFormulasCorte'
import { calcularFormulasCorte, type PecaFormula, type ResultadoPeca } from '@/lib/formulasCorteEngine'
import { conferirCaso, compararSimulacoes, listaCortesTexto, type CasoTipologia } from '@/lib/bancadaTipologias'
import { simularBarras } from '@/lib/planoCorteBancada'
import { conferirAcessorios, lerListaAcessorios } from '@/lib/bancadaAcessorios'
import { calcularAcessoriosTecnicos } from '@/lib/formulasAcessoriosEngine'
import { listarProdutos } from '@/lib/produtos'
import ImagemProdutoTecnico from '@/components/engenharia/ImagemProdutoTecnico'
import type { Produto } from '@/lib/tipos'

type ExemploSalvo = {
  id: string
  status: string
  created_at: string
  usuario: string
  tem_pdf: boolean
  caso: CasoTipologia | null
  fonte: string
  formula_assinatura: string
  conferencia: { ok: boolean; avaliados: number; conformes: number }
  conferencia_acessorios?: { ok: boolean; conferidos: number; conformes: number; erro?: string }
}

function numero(v: number | null | undefined) {
  return v == null || !Number.isFinite(v) ? '—' : Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ',')
}
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
function mensagemErro(e: unknown) { return e instanceof Error ? e.message : 'Operação não concluída.' }
function iniciais(reg: RegistroFormulaCorte | null) {
  return Object.fromEntries((reg?.variaveis || []).map(v => [v.chave, v.opcoes[0] || '']))
}
function formatarCortes(pecas: ResultadoPeca[]) {
  return pecas.map(p => [p.codigo, p.eixo || '', numero(p.tamanho), numero(p.quantidade ?? 1)].join(';')).join('\n')
}

export default function BancadaTipologiasPage() {
  const [master, setMaster] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [formulas, setFormulas] = useState<RegistroFormulaCorte[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [id, setId] = useState('')
  const [rascunho, setRascunho] = useState<RegistroFormulaCorte | null>(null)
  const [largura, setLargura] = useState('1800')
  const [altura, setAltura] = useState('2200')
  const [folgaL, setFolgaL] = useState('4')
  const [folgaH, setFolgaH] = useState('4')
  const [opcoes, setOpcoes] = useState<Record<string, string>>({})
  const [alternativas, setAlternativas] = useState<Record<string, string>>({})
  const [numeroBarra, setNumeroBarra] = useState('6000')
  const [serra, setSerra] = useState('4')
  const [fonte, setFonte] = useState('')
  const [nome, setNome] = useState('')
  const [lista, setLista] = useState('')
  const [listaAcessorios, setListaAcessorios] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [textoPdf, setTextoPdf] = useState('')
  const [consentimentoPdfIA, setConsentimentoPdfIA] = useState(false)
  const [exemplos, setExemplos] = useState<ExemploSalvo[]>([])
  const [ocupado, setOcupado] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const usuario = await usuarioAtual()
        if (usuario?.role !== 'master') return
        setMaster(true)
        const [registros, catalogo] = await Promise.all([listarTodasFormulasCorte(), listarProdutos()])
        setFormulas(registros)
        setProdutos(catalogo)
        const pedido = new URLSearchParams(window.location.search).get('formulaId')
        const primeiro = registros.find(x => x.id === pedido) || registros.find(x => x.status === 'em_validacao' && !x.ativo) || registros[0]
        if (primeiro) setId(primeiro.id)
      } catch (e) { setErro(mensagemErro(e)) }
      finally { setCarregando(false) }
    })()
  }, [])

  const original = useMemo(() => formulas.find(f => f.id === id) || null, [formulas, id])
  useEffect(() => {
    setRascunho(original ? clone(original) : null)
    const escolhas = iniciais(original)
    setOpcoes(escolhas)
    setAlternativas(escolhas)
    setFolgaL(String(original?.folgas?.largura_mm ?? 4))
    setFolgaH(String(original?.folgas?.altura_mm ?? 4))
    setLista('')
    setListaAcessorios('')
    setArquivo(null)
    setTextoPdf('')
    setNome('')
    setFonte('')
    setExemplos([])
    if (original) void carregarExemplos(original.id)
  }, [original])

  async function chamada(acao: string, valores: Record<string, string>, file?: File | null) {
    const sessao = await supabase.auth.getSession()
    const token = sessao.data.session?.access_token
    if (!token) throw Error('Faça login novamente para continuar.')
    const form = new FormData()
    form.set('acao', acao)
    form.set('formulaId', id)
    for (const [k, v] of Object.entries(valores)) form.set(k, v)
    if (file) form.set('arquivo', file)
    const resp = await fetch('/api/engenharia/bancada-tipologias', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form,
    })
    const json = await resp.json().catch(() => ({}))
    if (!resp.ok) throw Error(json.error || 'Falha na comunicação com o Atlas.')
    return json
  }
  async function carregarExemplos(formulaId: string) {
    try {
      const sessao = await supabase.auth.getSession()
      const token = sessao.data.session?.access_token
      if (!token) return
      const resposta = await fetch('/api/engenharia/bancada-tipologias?formulaId=' + encodeURIComponent(formulaId), {
        headers: { Authorization: 'Bearer ' + token },
      })
      const json = await resposta.json()
      if (!resposta.ok) throw Error(json.error || 'Não foi possível consultar exemplos.')
      if (formulaId === id || !id) setExemplos(json.casos || [])
    } catch (e) { setErro(mensagemErro(e)) }
  }
  function executar(tarefa: string, fn: () => Promise<void>) {
    if (ocupado) return
    setErro(''); setSucesso(''); setOcupado(tarefa)
    void fn().catch(e => setErro(mensagemErro(e))).finally(() => setOcupado(''))
  }
  const definicao = useMemo(() => rascunho
    ? { tipologia_id: rascunho.tipologia_id, variaveis: rascunho.variaveis, pecas: rascunho.pecas,
        folgas: { largura_mm: Number(folgaL), altura_mm: Number(folgaH) } }
    : null, [rascunho, folgaL, folgaH])
  const simulado = useMemo(() => {
    if (!definicao) return { pecas: [] as ResultadoPeca[], erro: '' }
    try { return { pecas: calcularFormulasCorte(definicao, Number(largura), Number(altura), opcoes), erro: '' } }
    catch (e) { return { pecas: [] as ResultadoPeca[], erro: mensagemErro(e) } }
  }, [definicao, largura, altura, opcoes])
  const alternativo = useMemo(() => {
    if (!definicao) return { pecas: [] as ResultadoPeca[], erro: '' }
    try { return { pecas: calcularFormulasCorte(definicao, Number(largura), Number(altura), alternativas), erro: '' } }
    catch (e) { return { pecas: [] as ResultadoPeca[], erro: mensagemErro(e) } }
  }, [definicao, largura, altura, alternativas])
  const comparacao = useMemo(() => compararSimulacoes(simulado.pecas, alternativo.pecas), [simulado.pecas, alternativo.pecas])
  const acessorios = useMemo(() => rascunho && definicao && !simulado.erro
    ? calcularAcessoriosTecnicos(rascunho.acessorios || [], Number(largura), Number(altura),
        Number(opcoes.numero_folhas || 1), simulado.pecas.map(p => ({ codigo: p.codigo, tamanho: p.tamanho, grupo: p.grupo })), opcoes, definicao.folgas)
    : [], [rascunho, definicao, simulado.pecas, simulado.erro, largura, altura, opcoes])
  const plano = useMemo(() => {
    try { return { resultado: simularBarras(simulado.pecas, Number(numeroBarra), Number(serra)), erro: '' } }
    catch (e) { return { resultado: null, erro: mensagemErro(e) } }
  }, [simulado.pecas, numeroBarra, serra])
  const caso = useMemo(() => {
    if (!definicao || !lista.trim()) return { atual: null as CasoTipologia | null, erro: '' }
    try {
      return { atual: { nome: nome || 'Projeto de referência', largura_mm: Number(largura), altura_mm: Number(altura),
        opcoes, folgas: definicao.folgas, cortes: listaCortesTexto(lista),
        acessorios: listaAcessorios.trim() ? lerListaAcessorios(listaAcessorios) : [] }, erro: '' }
    } catch (e) { return { atual: null, erro: mensagemErro(e) } }
  }, [definicao, lista, listaAcessorios, nome, largura, altura, opcoes])
  const conferencia = useMemo(() => caso.atual && definicao ? conferirCaso(definicao, caso.atual) : null, [caso.atual, definicao])
  const conferenciaAcessorios = useMemo(() => caso.atual && definicao && rascunho
    ? conferirAcessorios(definicao, rascunho.acessorios || [], caso.atual) : null,
    [caso.atual, definicao, rascunho])
  const modificado = Boolean(rascunho && original && (
    JSON.stringify(rascunho.pecas) !== JSON.stringify(original.pecas) ||
    JSON.stringify(rascunho.acessorios) !== JSON.stringify(original.acessorios) ||
    Number(folgaL) !== original.folgas?.largura_mm ||
    Number(folgaH) !== original.folgas?.altura_mm
  ))

  function adicionarPerfilLaboratorio() {
    setRascunho(atual => atual ? {
      ...atual,
      pecas: [...atual.pecas, {
        codigo: '', descricao: 'Perfil a identificar', eixo: 'L',
        formula: 'Largura', formula_quantidade: '1',
        composicao_desconto: 'Hipótese em desenvolvimento, aguardando referência técnica.',
      }],
    } : atual)
  }
  function removerPerfilLaboratorio(index: number) {
    setRascunho(atual => atual ? { ...atual,
      pecas: atual.pecas.filter((_,indice) => indice !== index) } : atual)
  }
  function mudarPeca(index: number, campo: keyof PecaFormula, valor: string) {
    setRascunho(atual => {
      if (!atual) return atual
      const novo = clone(atual)
      ;(novo.pecas[index] as Record<string, unknown>)[campo] = valor
      return novo
    })
  }
  function mudarAcessorio(index: number, formula: string) {
    setRascunho(atual => {
      if (!atual) return atual
      const novo = clone(atual)
      novo.acessorios[index].formula_quantidade = formula
      return novo
    })
  }
  async function salvarRevisao() {
    if (!original || !rascunho) throw Error('Selecione a tipologia.')
    // Permite clonar uma receita já validada sem nenhuma edição, para iniciar novos testes.
    const base = await criarVersaoTesteFormulaCorte(original)
    if (!base) throw Error('Não foi possível criar a versão separada. Nenhum projeto foi alterado.')
    const salvo = await salvarFormulaCorte(base.id, {
      configuracao_label: original.configuracao_label + ' · Bancada',
      variaveis: rascunho.variaveis, pecas: rascunho.pecas, vidro: rascunho.vidro,
      acessorios: rascunho.acessorios,
      status: 'em_validacao', ativo: false, observacoes: rascunho.observacoes,
      folgas: { largura_mm: Number(folgaL), altura_mm: Number(folgaH) },
      metadados_editor: { ...rascunho.metadados_editor, origem_bancada_id: original.id },
    })
    if (!salvo) throw Error('Versão de teste criada, mas falhou ao salvar. Confira no Editor Técnico.')
    setFormulas(anteriores => [...anteriores, salvo])
    setId(salvo.id)
    setSucesso('Nova versão isolada salva. A fórmula original continua intocada.')
  }
  async function extrairPdf() {
    if (!arquivo) throw Error('Selecione um PDF do orçamento ou da lista de corte.')
    const resp = await chamada('extrair_pdf', {}, arquivo)
    setTextoPdf(resp.texto || '')
    setSucesso('PDF extraído para conferência manual. Cole ou ajuste as linhas na lista de referência.')
  }
  async function interpretarPdfComIA() {
    if (!arquivo || !consentimentoPdfIA) throw Error('Selecione um arquivo e autorize a análise por IA.')
    if (lista.trim()) throw Error('A lista de cortes já está preenchida. Revise-a antes de substituí-la para não perder correções.')
    const sessao = await supabase.auth.getSession()
    const token = sessao.data.session?.access_token
    if (!token) throw Error('Faça login novamente.')
    const form = new FormData()
    form.set('acao', 'analisar')
    form.set('consentimentoIA', 'sim')
    form.set('arquivo', arquivo)
    form.set('observacoes', 'Comparar a lista de corte desta medida com a receita selecionada.')
    const resp = await fetch('/api/engenharia/bancada-tipologias/nova', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form,
    })
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) throw Error(data.error || 'Não foi possível interpretar o PDF.')
    const cortes = (Array.isArray(data.componentes) ? data.componentes : []).filter((p: {
      tipo: string; eixo: string; comprimento_mm: number | null
    }) => p.tipo === 'perfil' && (p.eixo === 'L' || p.eixo === 'H') && p.comprimento_mm != null)
    if (!cortes.length) throw Error('Nenhuma lista completa foi reconhecida com segurança. Use a extração de texto e preencha manualmente.')
    setLista(cortes.map((p: {codigo:string;eixo:string;comprimento_mm:number;quantidade:number}) =>
      [p.codigo,p.eixo,p.comprimento_mm,p.quantidade].join(';')).join('\n'))
    setTextoPdf(data.texto_extraido || '')
    setSucesso('IA sugeriu ' + cortes.length + ' linhas. Confira código, eixo, comprimento e quantidade antes de registrar.')
  }
  async function registrarCaso() {
    if (!original || !caso.atual || !conferencia || caso.erro) throw Error(caso.erro || 'Preencha a lista de corte.')
    if (modificado) throw Error('Primeiro salve as fórmulas alteradas numa nova versão isolada.')
    const resp = await chamada('registrar', { caso: JSON.stringify(caso.atual), fonte }, arquivo)
    setSucesso('Projeto registrado. ' + (resp.conferencia.ok && resp.comparacaoAcessorios?.ok !== false
      ? 'Listas coincidem. Confira e aprove a referência.' : 'Existem diferenças de cortes ou acessórios para corrigir.'))
    await carregarExemplos(id)
  }
  async function validarCaso(casoId: string) {
    if (modificado) throw Error('Salve ou descarte as alterações locais antes de validar.')
    await chamada('validar_caso', { casoId })
    setSucesso('Referência conferida e aprovada com rastreabilidade.')
    await carregarExemplos(id)
  }
  async function validarFormula() {
    if (modificado) throw Error('Salve ou descarte as alterações locais antes de validar.')
    const resp = await chamada('validar_formula', {})
    setSucesso(resp.mensagem)
    setFormulas(prev => prev.map(p => p.id === id ? { ...p, status: 'validada', ativo: false } : p))
  }
  async function abrirPdf(arquivoId: string) {
    const sessao = await supabase.auth.getSession()
    const token = sessao.data.session?.access_token
    if (!token) throw Error('Sessão expirada.')
    const resp = await fetch('/api/engenharia/bancada-tipologias?formulaId=' + encodeURIComponent(id) + '&arquivoId=' + encodeURIComponent(arquivoId), {
      headers: { Authorization: 'Bearer ' + token },
    })
    const data = await resp.json()
    if (!resp.ok) throw Error(data.error || 'Documento não encontrado.')
    window.open(data.url, '_blank', 'noopener,noreferrer')
  }
  function arquivoAlterado(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null
    setArquivo(file)
    setTextoPdf('')
  }
  const painel = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'
  const campo = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500'
  const botao = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40'

  if (carregando) return <div className="p-10 text-slate-600"><Loader2 className="mr-2 inline animate-spin" size={18}/> Carregando bancada técnica...</div>
  if (!master) return <div className="mx-auto max-w-3xl p-10"><h1 className="text-xl font-bold">Bancada de Tipologias</h1><p className="mt-2 text-slate-600">Acesso restrito ao usuário Master. As fórmulas operacionais permanecem protegidas.</p></div>

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/engenharia" className="inline-flex items-center gap-2 text-sm text-slate-500"><ArrowLeft size={15}/> Engenharia</Link>
          <h1 className="mt-2 text-2xl font-extrabold text-slate-900">Bancada de Projetos de Tipologia</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">Simule cortes, compare perfis, documente orçamentos W Vetro com medidas diferentes e valide uma versão segura antes da liberação operacional.</p>
        </div>
        <div className="flex flex-wrap gap-2"><Link className={botao + ' bg-indigo-700 text-white'} href="/engenharia/bancada-tipologias/nova"><Plus size={16}/> Nova Tipologia</Link><Link className={botao + ' bg-slate-900 text-white'} href="/engenharia/editor-tecnico"><Wrench size={16}/> Editor Técnico completo</Link></div>
      </header>
      {erro && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{erro}</div>}
      {sucesso && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{sucesso}</div>}

      <section className={painel}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(160px,1fr)_minmax(160px,1fr)]">
          <label className="text-sm font-semibold text-slate-700">Receita / tipologia
            <select className={campo + ' mt-1'} value={id} onChange={e => setId(e.target.value)}>
              {formulas.map(f => <option key={f.id} value={f.id}>{f.tipologia?.label || f.tipologia_id} · {f.configuracao_label} · v{f.versao}{f.ativo ? ' [EM USO]' : ''}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">Largura (mm)
            <input className={campo + ' mt-1'} type="number" min="100" value={largura} onChange={e => setLargura(e.target.value)}/>
          </label>
          <label className="text-sm font-semibold text-slate-700">Altura (mm)
            <input className={campo + ' mt-1'} type="number" min="100" value={altura} onChange={e => setAltura(e.target.value)}/>
          </label>
        </div>
        {original && <p className="mt-3 text-xs text-slate-500">Versão {original.versao} · Status {original.status.replaceAll('_', ' ')} · {original.ativo ? 'Em uso operacional — será apenas simulada' : 'Não ativa em produção'}. Fórmulas visíveis abaixo.</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <label className="text-xs font-semibold text-slate-600">Folga largura (mm)<input className={campo + ' mt-1'} type="number" step=".1" min="0" max="100" value={folgaL} onChange={e => setFolgaL(e.target.value)}/></label>
          <label className="text-xs font-semibold text-slate-600">Folga altura (mm)<input className={campo + ' mt-1'} type="number" step=".1" min="0" max="100" value={folgaH} onChange={e => setFolgaH(e.target.value)}/></label>
        </div>
      </section>

      {rascunho && <section className={painel}>
        <h2 className="text-lg font-bold text-slate-900">Variáveis e substituição de perfis</h2>
        <p className="mt-1 text-xs text-slate-500">Cenário A: projeto principal. Cenário B: escolha outra variante e confira a diferença de comprimentos e perfis. As variantes disponíveis vêm da receita cadastrada.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {rascunho.variaveis.map(v => <div key={v.chave} className="rounded-xl border border-slate-200 p-3">
            <strong className="text-sm">{v.label}</strong><span className="ml-2 text-xs text-slate-400">{v.chave}</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-600">A<select className={campo + ' mt-1'} value={opcoes[v.chave] || ''} onChange={e => setOpcoes(prev => ({ ...prev, [v.chave]: e.target.value }))}>{v.opcoes.map(x => <option key={x} value={x}>{x.replaceAll('_', ' ')}</option>)}</select></label>
              <label className="text-xs text-slate-600">B<select className={campo + ' mt-1'} value={alternativas[v.chave] || ''} onChange={e => setAlternativas(prev => ({ ...prev, [v.chave]: e.target.value }))}>{v.opcoes.map(x => <option key={x} value={x}>{x.replaceAll('_', ' ')}</option>)}</select></label>
            </div>
          </div>)}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold">Fórmulas abertas de cada peça</h3>
            {!rascunho.pecas.length && <p className="mt-1 text-sm text-amber-800">Rascunho ainda sem perfis. Anexe a lista técnica ou cadastre os perfis abaixo para começar a simular.</p>}
          </div>
          <div className="flex flex-wrap gap-2">
          {!original?.ativo && <button type="button" className={botao + ' border border-slate-300 text-slate-800'} onClick={adicionarPerfilLaboratorio}>+ Adicionar perfil</button>}
          <button className={botao + ' bg-indigo-700 text-white'} disabled={!!ocupado} onClick={() => executar('revisao', salvarRevisao)}>
            {ocupado === 'revisao' ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>} Criar nova versão de teste
          </button>
          </div>
        </div>
        <div className="mt-3 space-y-3">
          {rascunho.pecas.map((p, i) => <div key={i} className="grid items-end gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[76px_minmax(120px,1fr)_minmax(160px,1.3fr)_minmax(160px,1.3fr)]">
            <ImagemProdutoTecnico codigo={p.codigo || p.grupo || ''} produto={produtos.find(prod => prod.codigo === p.codigo) || null} pequeno/>
            <div className="min-w-0"><strong className="block text-sm">{p.codigo || p.grupo || 'Peça ' + (i + 1)}</strong><span className="block truncate text-xs text-slate-500">{p.descricao || p.grupo || 'Componente'}</span></div>
            {!original?.ativo && <div className="grid gap-2 md:col-span-full md:grid-cols-[1fr_1.5fr_115px_auto]">
              <label className="text-xs font-semibold text-slate-600">Código do perfil<input className={campo + ' mt-1 font-mono'} value={p.codigo || ''} onChange={e => mudarPeca(i, 'codigo', e.target.value.toUpperCase())} placeholder="Ex.: SU001"/></label>
              <label className="text-xs font-semibold text-slate-600">Descrição<input className={campo + ' mt-1'} value={p.descricao || ''} onChange={e => mudarPeca(i, 'descricao', e.target.value)}/></label>
              <label className="text-xs font-semibold text-slate-600">Eixo<select className={campo + ' mt-1'} value={p.eixo || 'L'} onChange={e => mudarPeca(i, 'eixo', e.target.value)}><option value="L">Largura</option><option value="H">Altura</option></select></label>
              <button type="button" className={botao + ' border border-red-200 text-red-700'} onClick={() => removerPerfilLaboratorio(i)}>Remover</button>
            </div>}
            <label className="text-xs font-semibold text-slate-600">Corte / comprimento
              <input className={campo + ' mt-1 font-mono'} value={p.formula || p.formula_L || ''} onChange={e => mudarPeca(i, p.formula_L && !p.formula ? 'formula_L' : 'formula', e.target.value)}/>
            </label>
            <label className="text-xs font-semibold text-slate-600">Quantidade
              <input className={campo + ' mt-1 font-mono'} value={p.formula_quantidade || String(p.quantidade ?? 1)} onChange={e => mudarPeca(i, 'formula_quantidade', e.target.value)}/>
            </label>
            {p.formula_H && <label className="text-xs font-semibold text-slate-600 md:col-start-3 md:col-span-2">Corte altura (H)
              <input className={campo + ' mt-1 font-mono'} value={p.formula_H} onChange={e => mudarPeca(i, 'formula_H', e.target.value)}/></label>}
            {(p.condicoes?.length || p.mapa_codigo || p.formula_por_variavel) && <p className="text-xs text-amber-800 md:col-span-full">Esta peça também tem condições ou códigos por variante. Edite esses detalhes no Editor Técnico completo antes de validar.</p>}
          </div>)}
        </div>
        {!!rascunho.acessorios?.length && <>
          <h3 className="mt-6 font-bold text-slate-900">Acessórios e quantidades calculadas</h3>
          <p className="mt-1 text-xs text-slate-500">As imagens vêm do cadastro central. Quantidades propostas devem ser comparadas com cada orçamento antes da validação.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {rascunho.acessorios.map((a,i) => {
              const resultado = acessorios.find(x => x.index === i)
              return <div key={i} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
                <ImagemProdutoTecnico codigo={a.codigo} produto={produtos.find(p => p.codigo === a.codigo) || null} permitirEdicao />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{a.codigo} · {a.descricao || 'Acessório'}</p>
                  <label className="mt-2 block text-xs font-semibold text-slate-600">Fórmula de quantidade
                    <input className={campo + ' mt-1 font-mono'} value={a.formula_quantidade || ''} onChange={e => mudarAcessorio(i, e.target.value)}/>
                  </label>
                  <p className="mt-1 text-xs text-slate-600">Quantidade simulada: <b>{numero(resultado?.valor)}</b>{resultado?.erro ? ' · ' + resultado.erro : ''}</p>
                </div>
              </div>
            })}
          </div>
        </>}
        {modificado && <p className="mt-3 text-sm font-semibold text-amber-800">Alterações em simulação local. Salve como nova versão para registrar exemplos, sem alterar a fórmula operacional.</p>}
      </section>}

      <section className={painel}>
        <h2 className="text-lg font-bold">Lista de corte e impacto das alterações</h2>
        {simulado.erro && <p className="mt-2 text-sm text-red-700">{simulado.erro}</p>}
        {alternativo.erro && <p className="mt-2 text-sm text-amber-700">Cenário B: {alternativo.erro}</p>}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b text-xs text-slate-500"><th className="p-2">Perfil (imagem)</th><th className="p-2">Corte A (mm)</th><th className="p-2">Corte B (mm)</th><th className="p-2">Diferença</th></tr></thead>
            <tbody>{comparacao.map((p, i) => <tr key={i} className="border-b border-slate-100">
              <td className="flex min-w-[200px] items-center gap-2 p-2"><ImagemProdutoTecnico codigo={p.codigo} produto={produtos.find(prod => prod.codigo === p.codigo) || null} pequeno/><div><b>{p.codigo}{p.codigo_alternativo && p.codigo_alternativo !== p.codigo ? ' → ' + p.codigo_alternativo : ''}</b><p className="max-w-48 truncate text-xs text-slate-500">{p.descricao}</p></div></td>
              <td className="p-2">{numero(p.original_mm)}</td><td className="p-2">{numero(p.alternativo_mm)}</td>
              <td className={'p-2 font-semibold ' + ((p.diferenca_mm || 0) !== 0 ? 'text-amber-700' : 'text-slate-500')}>{numero(p.diferenca_mm)} mm</td>
            </tr>)}</tbody>
          </table>
        </div>
        {simulado.pecas.length > 0 && <button className={botao + ' mt-3 border border-slate-300 text-slate-700'} onClick={() => { void navigator.clipboard.writeText(formatarCortes(simulado.pecas)); setSucesso('Lista de corte copiada.') }}>Copiar lista de corte A</button>}
      </section>

      <section className={painel}>
        <h2 className="text-lg font-bold">Simulação de barras e aproveitamento</h2>
        <p className="mt-1 text-xs text-slate-500">Simulador independente de primeira alocação decrescente, por código de perfil. Não utiliza nem altera o estoque ou a produção. Confirme barras comerciais e espessura de serra antes de usar valores reais.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-semibold">Barra simulada (mm)<input className={campo + ' mt-1'} type="number" min="1" value={numeroBarra} onChange={e => setNumeroBarra(e.target.value)}/></label>
          <label className="text-xs font-semibold">Perda por corte (mm)<input className={campo + ' mt-1'} type="number" min="0" value={serra} onChange={e => setSerra(e.target.value)}/></label>
          <div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-500">Aproveitamento simulado</span><p className="text-xl font-extrabold">{plano.resultado ? numero(plano.resultado.aproveitamento) + '%' : '—'}</p></div>
        </div>
        {plano.erro && <p className="mt-2 text-sm text-red-700">{plano.erro}</p>}
        {plano.resultado?.alertas.map((a,i) => <p key={i} className="mt-2 text-sm text-amber-700">{a}</p>)}
        <div className="mt-3 max-h-64 overflow-y-auto text-sm">
          {plano.resultado?.barras.map((b,i) => <div key={i} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-2">
            <span><b>{b.codigo}</b> · Barra {b.numero} · {b.cortes_mm.map(numero).join(' + ')} mm</span>
            <span className="font-semibold text-slate-600">Sobra {numero(b.sobra_mm)} mm</span>
          </div>)}
        </div>
      </section>

      <section className={painel}>
        <div className="flex items-center gap-2"><Upload size={19} className="text-blue-700"/><h2 className="text-lg font-bold">Cadastrar orçamento e lista de corte de referência</h2></div>
        <p className="mt-1 text-sm text-slate-600">Use medidas diferentes da mesma tipologia. O PDF fica arquivado privadamente e a lista precisa ser conferida antes de ser aprovada. Para criar uma referência, simule acima com as medidas desse orçamento.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold">Nome do exemplo<input className={campo + ' mt-1'} value={nome} placeholder="Porta integrada – medida 01" onChange={e => setNome(e.target.value)}/></label>
          <label className="text-xs font-semibold">Número do orçamento / origem<input className={campo + ' mt-1'} value={fonte} placeholder="W Vetro nº 1234 – Lista de corte" onChange={e => setFonte(e.target.value)}/></label>
          <label className="text-xs font-semibold md:col-span-2">PDF do projeto ou lista de corte (opcional, mas recomendado)
            <input className={campo + ' mt-1'} type="file" accept=".pdf,application/pdf" onChange={arquivoAlterado}/>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button className={botao + ' border border-slate-300'} disabled={!arquivo || !!ocupado || !id} onClick={() => executar('extrair', extrairPdf)}><FileText size={16}/> Extrair texto do PDF</button>
          <button className={botao + ' border border-indigo-200 text-indigo-800'} disabled={!arquivo || !consentimentoPdfIA || !!ocupado || !id || !!lista.trim()} onClick={() => executar('interpretar', interpretarPdfComIA)}><Sparkles size={16}/> Sugerir cortes com IA</button>
          <label className="flex items-start gap-2 text-xs text-slate-600"><input type="checkbox" className="mt-0.5" checked={consentimentoPdfIA} onChange={e => setConsentimentoPdfIA(e.target.checked)}/> Autorizo enviar este PDF à IA configurada no Atlas para interpretação técnica.</label>
          <span className="w-full text-xs text-slate-500">A IA não valida fórmulas nem substitui cortes conferidos. Revise todas as linhas antes de registrar.</span>
        </div>
        {!!textoPdf && <details className="mt-3 rounded-xl bg-slate-50 p-3"><summary className="cursor-pointer text-sm font-semibold">Texto extraído do PDF para conferência</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-xs">{textoPdf}</pre></details>}
        <label className="mt-4 block text-sm font-semibold">Lista de corte de referência — uma peça por linha
          <textarea className={campo + ' mt-1 min-h-36 font-mono'} value={lista} onChange={e => setLista(e.target.value)} placeholder={'CÓDIGO;EIXO;COMPRIMENTO;QUANTIDADE\nSU001;L;1796;2\nSU053;H;2196;2'}/>
        </label>
        <p className="mt-1 text-xs text-slate-500">Formato: CÓDIGO;EIXO (L/H ou vazio);COMPRIMENTO em mm;QUANTIDADE. Use ponto ou vírgula decimal. Não misture quantidade de barras compradas com quantidade de peças cortadas.</p>
        {!!rascunho?.acessorios?.length && <>
          <label className="mt-4 block text-sm font-semibold">Lista de acessórios conferida no W.Vetro — um código por linha
            <textarea className={campo + ' mt-1 min-h-28 font-mono'} value={listaAcessorios}
              onChange={e => setListaAcessorios(e.target.value)}
              placeholder={'CÓDIGO;QUANTIDADE\nAC001;4\nAC099;2'} />
          </label>
          <p className="mt-1 text-xs text-slate-500">Compare todas as quantidades. Referências sem acessórios não poderão ser aprovadas se a receita contiver acessórios.</p>
        </>}
        {caso.erro && <p className="mt-3 text-sm text-red-700">{caso.erro}</p>}
        {conferencia && <div className={'mt-3 rounded-xl p-3 text-sm ' + (conferencia.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900')}>
          <strong>{conferencia.ok ? 'Todas as peças coincidem' : 'Existem diferenças a conferir'}</strong> · {conferencia.conformes}/{conferencia.avaliados} linhas iguais, tolerância 0,5 mm.
          {conferencia.erro && <p>{conferencia.erro}</p>}
          {conferencia.desvios.filter(d => d.estado !== 'conforme').slice(0, 12).map((d,i) => <p key={i}>{d.codigo} {d.eixo || ''}: esperado {numero(d.esperado_mm)} mm × {numero(d.esperado_quantidade)}, Atlas {numero(d.calculado_mm)} mm × {numero(d.calculado_quantidade)} ({d.estado.replaceAll('_',' ')})</p>)}
        </div>}
        {conferenciaAcessorios && !!rascunho?.acessorios?.length && <div className={'mt-3 rounded-xl p-3 text-sm ' +
          (conferenciaAcessorios.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900')}>
          <b>{conferenciaAcessorios.ok ? 'Acessórios conferidos' : 'Acessórios ainda não conformes'}</b>
          {' · '}{conferenciaAcessorios.conformes}/{conferenciaAcessorios.conferidos} códigos coincidentes.
          {conferenciaAcessorios.erro && <p>{conferenciaAcessorios.erro}</p>}
          {conferenciaAcessorios.diferencas.filter(a => !a.conforme).slice(0,12).map((a,i) =>
            <p key={i}>{a.codigo}: W.Vetro {numero(a.esperado)}, Atlas {numero(a.calculado)}</p>)}
        </div>}
        <button className={botao + ' mt-4 bg-blue-700 text-white'} disabled={!caso.atual || !!ocupado || !fonte.trim() || modificado} onClick={() => executar('registrar', registrarCaso)}>
          {ocupado === 'registrar' ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Registrar exemplo e comparação
        </button>
      </section>

      <section className={painel}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-lg font-bold">Validação supervisionada</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">Aprovar referências sem divergências, em ao menos três medidas diferentes, permite validar esta versão no Atlas. Uma mudança de fórmula exige nova conferência. Validar não libera pedidos ou produção automaticamente.</p></div>
          <button className={botao + ' bg-emerald-700 text-white'} disabled={!exemplos.some(c => c.status === 'concluido') || !!ocupado || !!original?.ativo || modificado} onClick={() => executar('validar_formula', validarFormula)}><ClipboardCheck size={16}/> Validar versão no Atlas</button>
        </div>
        {!exemplos.length && <p className="mt-4 text-sm text-slate-500">Nenhum projeto de referência registrado para esta versão.</p>}
        <div className="mt-3 space-y-3">
          {exemplos.map(e => <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
            <div className="min-w-0">
              <p className="font-semibold">{e.caso?.nome || 'Projeto'} <span className="text-sm text-slate-500">({numero(e.caso?.largura_mm)} × {numero(e.caso?.altura_mm)} mm)</span></p>
              <p className="text-xs text-slate-600">{e.fonte} · {e.usuario || 'Responsável'} · {new Date(e.created_at).toLocaleDateString('pt-BR')}</p>
              <p className={'text-xs font-semibold ' + (e.status === 'concluido' ? 'text-emerald-700' : 'text-amber-800')}>{!e.caso?.cortes?.length ? 'Documento de origem: falta lista de corte confirmada' : e.status === 'concluido' ? 'Referência validada' : 'Aguardando conferência'} · {e.conferencia?.conformes || 0}/{e.conferencia?.avaliados || 0} linhas conformes na gravação</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {e.tem_pdf && <button className={botao + ' border border-slate-200'} onClick={() => executar('pdf_'+e.id, () => abrirPdf(e.id))}><FileText size={15}/> Referência</button>}
              {e.status !== 'concluido' && !!e.caso?.cortes?.length && <button className={botao + ' bg-slate-900 text-white'} disabled={!!ocupado || modificado} onClick={() => executar('validar_'+e.id, () => validarCaso(e.id))}><CheckCircle2 size={16}/> Aprovar cortes</button>}
            </div>
          </div>)}
        </div>
      </section>
      <div className="pb-8 text-xs text-slate-500"><Beaker size={14} className="mr-1 inline"/> As fórmulas são regras técnicas e só serão reconhecidas como aprovadas após comparação com os projetos fornecidos. A bancada não modifica preços, estoque nem receitas ativas.</div>
    </main>
  )
}
