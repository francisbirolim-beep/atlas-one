'use client'

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, FileImage, FileText, Image as ImageIcon, Loader2, Plus, Save, Sparkles, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usuarioAtual } from '@/lib/auth'
import { listarProdutos } from '@/lib/produtos'
import type { Produto } from '@/lib/tipos'
import ImagemProdutoTecnico from '@/components/engenharia/ImagemProdutoTecnico'
import { normalizarComponentes, tipoCroquiSeguro, type ComponenteCandidato } from '@/lib/bancadaCriacaoTipologia'

type RespostaAnalise = {
  componentes: ComponenteCandidato[]
  descricao: string
  tipo_croqui: string
  texto_extraido: string
  origem_ia: string
  aviso: string
  estado_documento?: 'lista_corte' | 'orcamento_comercial' | 'link_wvetro' | 'pdf_digitalizado' | 'desconhecido'
  quantidade_cortes_completos?: number
}
type ResultadoCriacao = { ok: boolean; formulaId: string; tipologiaId: string; pendentes: string[]; semImagem: string[]; aviso: string; incompleto?: boolean }

const campo = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-600'
const botao = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed'
const vazio = (): ComponenteCandidato => ({ codigo: '', descricao: '', tipo: 'perfil', eixo: 'L', comprimento_mm: null, quantidade: 1 })
const numero = (v: number | null | undefined) => v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('pt-BR')

function CroquiProprio({ tipo, largura, altura }: { tipo: string; largura: number; altura: number }) {
  const modelo = tipoCroquiSeguro(tipo)
  const integrada = modelo === 'integrada'
  const correr = integrada || modelo === 'correr' || modelo === 'janela'
  return (
    <figure className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <svg viewBox="0 0 500 405" role="img" aria-label="Croqui paramétrico ilustrativo da tipologia, não validado" className="w-full">
        <rect width="500" height="405" fill="#f8fafc" rx="12"/>
        <g fill="none" stroke="#334155" strokeWidth="5">
          <rect x="87" y="58" width="330" height="278" rx="2"/>
          <rect x="98" y={integrada ? '131' : '69'} width="308" height={integrada ? '194' : '256'} strokeWidth="2.5"/>
          {integrada && <>
            <line x1="98" x2="406" y1="128" y2="128"/>
            {Array.from({ length: 9 }, (_, i) => <line key={i} x1={108 + i * 36} x2={108 + i * 36} y1="70" y2="116" stroke="#64748b" strokeWidth="2"/>)}
          </>}
          {correr ? <>
            <line x1="252" x2="252" y1={integrada ? '133' : '72'} y2="325" strokeWidth="4"/>
            <rect x="103" y={integrada ? '138' : '77'} width="145" height={integrada ? '181' : '242'} stroke="#94a3b8" strokeWidth="1.5"/>
            <rect x="255" y={integrada ? '138' : '77'} width="145" height={integrada ? '181' : '242'} stroke="#94a3b8" strokeWidth="1.5"/>
            <path d="M140 233h57m0 0-12-9m12 9-12 9 M360 233h-57m0 0 12-9m-12 9 12 9" stroke="#475569" strokeWidth="2"/>
          </> : <path d="M102 325 L397 72 M102 72 L397 325" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="5 7"/>}
        </g>
        <g stroke="#64748b" strokeWidth="1.4" fill="none">
          <line x1="87" y1="352" x2="417" y2="352"/><path d="m87 352 8-4v8z m330 0-8-4v8z" fill="#64748b"/>
          <line x1="435" y1="58" x2="435" y2="336"/><path d="m435 58-4 8h8z m0 278-4-8h8z" fill="#64748b"/>
        </g>
        <text x="251" y="377" fontSize="17" fill="#0f172a" textAnchor="middle">Largura {numero(largura)} mm</text>
        <text x="461" y="198" fontSize="15" fill="#0f172a" textAnchor="middle" transform="rotate(90 461 198)">Altura {numero(altura)} mm</text>
        <text x="250" y="35" textAnchor="middle" fill="#475569" fontSize="15">{integrada ? 'PORTA INTEGRADA' : modelo === 'janela' ? 'JANELA' : modelo === 'correr' ? 'ESQUADRIA DE CORRER' : 'ESQUADRIA'}</text>
      </svg>
      <figcaption className="mt-2 text-center text-xs text-amber-800">Desenho novo e esquemático do Atlas. Não representa cortes, encaixes ou montagem aprovados.</figcaption>
    </figure>
  )
}

export default function NovaTipologiaPage() {
  const [master, setMaster] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [nome, setNome] = useState('')
  const [categoria, setCategoria] = useState('porta')
  const [largura, setLargura] = useState('1500')
  const [altura, setAltura] = useState('2300')
  const [tipo, setTipo] = useState('integrada')
  const [origem, setOrigem] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [imagemLocal, setImagemLocal] = useState('')
  const [pdfLocal, setPdfLocal] = useState('')
  const [componentes, setComponentes] = useState<ComponenteCandidato[]>([])
  const [analise, setAnalise] = useState<RespostaAnalise | null>(null)
  const [consentimento, setConsentimento] = useState(false)
  const [revisado, setRevisado] = useState(false)
  const [processando, setProcessando] = useState('')
  const [erro, setErro] = useState('')
  const [criado, setCriado] = useState<ResultadoCriacao | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const usuario = await usuarioAtual()
        if (usuario?.role === 'master') {
          setMaster(true)
          setProdutos(await listarProdutos())
        }
      } catch { setErro('Não foi possível abrir o catálogo. Atualize a página.') }
      finally { setCarregando(false) }
    })()
  }, [])
  useEffect(() => {
    if (!arquivo || !(arquivo.type.startsWith('image/') || arquivo.type === 'application/pdf' ||
      /\.pdf$/i.test(arquivo.name))) { setImagemLocal(''); setPdfLocal(''); return }
    const url = URL.createObjectURL(arquivo)
    setImagemLocal(arquivo.type.startsWith('image/') ? url : '')
    setPdfLocal(arquivo.type.startsWith('image/') ? '' : url)
    return () => URL.revokeObjectURL(url)
  }, [arquivo])

  const produtosPorCodigo = useMemo(() =>
    new Map(produtos.filter(p => p.codigo).map(p => [String(p.codigo).trim().toUpperCase(), p])), [produtos])
  const componentesValidos = useMemo(() => normalizarComponentes(componentes), [componentes])
  const desconhecidos = useMemo(() => Array.from(new Set(componentesValidos.filter(c => !produtosPorCodigo.has(c.codigo)).map(c => c.codigo))), [componentesValidos, produtosPorCodigo])
  const semImagem = useMemo(() => Array.from(new Set(componentesValidos.filter(c => !produtosPorCodigo.get(c.codigo)?.foto_url).map(c => c.codigo))), [componentesValidos, produtosPorCodigo])
  function alterarArquivo(evento: ChangeEvent<HTMLInputElement>) {
    setArquivo(evento.target.files?.[0] || null)
    setAnalise(null)
    setRevisado(false)
    setCriado(null)
    setComponentes([])
  }
  function atualizarItem(i: number, patch: Partial<ComponenteCandidato>) {
    setComponentes(prev => prev.map((c, index) => index === i ? { ...c, ...patch } : c))
    setRevisado(false)
  }
  async function chamada(acao: string, dados?: Record<string, unknown>) {
    const sessao = await supabase.auth.getSession()
    const token = sessao.data.session?.access_token
    if (!token) throw new Error('Faça login novamente para continuar.')
    const form = new FormData()
    form.set('acao', acao)
    if (arquivo) form.set('arquivo', arquivo)
    if (acao === 'analisar') {
      form.set('consentimentoIA', consentimento ? 'sim' : 'nao')
      form.set('observacoes', observacoes)
    } else if (dados) form.set('dados', JSON.stringify(dados))
    const resposta = await fetch('/api/engenharia/bancada-tipologias/nova', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form,
    })
    const json = await resposta.json().catch(() => ({}))
    if (!resposta.ok) throw new Error(json.error || 'Falha de comunicação com a engenharia.')
    return json
  }
  async function analisar() {
    if (!arquivo || !consentimento) throw new Error('Selecione um documento e autorize a análise por IA.')
    setErro(''); setProcessando('analisar')
    try {
      const resposta = await chamada('analisar') as RespostaAnalise
      setAnalise(resposta)
      setComponentes(resposta.componentes)
      if (resposta.tipo_croqui && resposta.tipo_croqui !== 'outro') setTipo(resposta.tipo_croqui)
      setRevisado(false)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível analisar o documento.') }
    finally { setProcessando('') }
  }
  async function criar() {
    if (componentesValidos.length !== componentes.length) throw new Error('Há componentes com código, quantidade ou medida inválidos. Corrija-os antes de salvar.')
    if (componentesValidos.length && !revisado) throw new Error('Confira os componentes identificados antes de salvar.')
    setErro(''); setProcessando('criar')
    try {
      const resposta = await chamada('criar', {
        nome, categoria, largura_mm: Number(largura), altura_mm: Number(altura),
        tipo_croqui: tipo, fonte: origem, componentes: componentesValidos,
      }) as ResultadoCriacao
      setCriado(resposta)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível criar a tipologia.') }
    finally { setProcessando('') }
  }
  if (carregando) return <div className="p-8 text-slate-600"><Loader2 className="mr-2 inline animate-spin" size={18}/> Carregando laboratório...</div>
  if (!master) return <main className="p-8"><h1 className="text-xl font-bold">Nova Tipologia</h1><p className="mt-2 text-slate-600">Criação técnica disponível apenas ao Master.</p></main>
  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <Link href="/engenharia/bancada-tipologias" className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft size={16}/> Voltar à bancada</Link>
        <h1 className="mt-2 text-2xl font-extrabold text-slate-900">Criar Nova Tipologia</h1>
        <p className="mt-1 text-sm text-slate-600">Envie foto ou PDF, confira os componentes e gere um laboratório com croqui original, fórmulas editáveis e testes por medidas.</p>
      </div>
      <span className="rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-800">Ambiente de desenvolvimento — não libera produção</span>
    </header>
    {erro && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{erro}</div>}
    {criado ? <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2/><h2 className="text-xl font-bold">Laboratório da tipologia criado</h2></div>
      <p className="mt-2 text-sm text-slate-700">{criado.aviso}</p>
      <p className="mt-2 text-sm text-slate-600">Códigos ainda não cadastrados: <b>{criado.pendentes.length ? criado.pendentes.join(', ') : 'nenhum'}</b>. Componentes sem foto confirmada: <b>{criado.semImagem.length ? criado.semImagem.join(', ') : 'nenhum'}</b>.</p>
      <p className="mt-3 text-sm text-slate-600">{criado.incompleto ? 'Você já pode anexar novas referências na bancada, mesmo antes de identificar os perfis. Para editar a lista de componentes, use o Editor Técnico ou a própria bancada de testes.' : 'O próximo PDF, com outra largura e altura, deve ser anexado à receita criada. Compare cortes, ajuste os descontos e valide três medidas diferentes.'}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link className={botao + ' bg-indigo-700 text-white'} href={'/engenharia/bancada-tipologias?formulaId=' + encodeURIComponent(criado.formulaId)}>{criado.incompleto ? 'Completar projeto na bancada' : 'Abrir motor de fórmulas e testes'}</Link>
        <Link className={botao + ' border border-slate-300'} href="/cadastro/produtos">Completar imagens do catálogo</Link>
      </div>
    </section> : <>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(330px,1fr)]">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div><h2 className="text-lg font-bold">1. Identificar projeto</h2><p className="text-xs text-slate-500">Informe medidas externas reais em milímetros. A análise não substitui a conferência do projetista.</p></div>
          <label className="block text-xs font-semibold text-slate-700">Nome da nova tipologia<input className={campo + ' mt-1'} value={nome} onChange={e => setNome(e.target.value)} placeholder="Porta Integrada 2 Folhas"/></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold">Categoria<select className={campo + ' mt-1'} value={categoria} onChange={e => setCategoria(e.target.value)}><option value="porta">Porta</option><option value="janela">Janela</option></select></label>
            <label className="text-xs font-semibold">Modelo do croqui<select className={campo + ' mt-1'} value={tipo} onChange={e => setTipo(e.target.value)}><option value="integrada">Porta integrada</option><option value="correr">De correr</option><option value="abrir">De abrir</option><option value="janela">Janela</option><option value="outro">Outro</option></select></label>
            <label className="text-xs font-semibold">Largura (mm)<input className={campo + ' mt-1'} type="number" min="100" max="20000" value={largura} onChange={e => setLargura(e.target.value)}/></label>
            <label className="text-xs font-semibold">Altura (mm)<input className={campo + ' mt-1'} type="number" min="100" max="20000" value={altura} onChange={e => setAltura(e.target.value)}/></label>
          </div>
          <label className="block text-xs font-semibold">Origem / orçamento<input className={campo + ' mt-1'} value={origem} onChange={e => setOrigem(e.target.value)} placeholder="W Vetro — orçamento 1234"/></label>
          <label className="block text-xs font-semibold">O que você sabe desta tipologia?<textarea className={campo + ' mt-1 min-h-24'} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Linha de alumínio, folhas, persiana, folgas conhecidas, detalhes de montagem..."/></label>
          <label className="block text-xs font-semibold"><span className="inline-flex items-center gap-2"><FileImage size={16}/> Foto, imagem do projeto ou PDF do W Vetro</span>
            <input className={campo + ' mt-1'} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.webloc,.url,application/pdf,image/png,image/jpeg,image/webp" onChange={alterarArquivo}/>
            <span className="mt-1 block text-xs font-normal text-slate-500">No W.Vetro, abra o relatório de corte e escolha Imprimir/Exportar → Salvar como PDF. Um atalho para o site não contém a lista de perfis.</span>
          </label>
          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input type="checkbox" className="mt-0.5" checked={consentimento} onChange={e => setConsentimento(e.target.checked)}/>
            Autorizo o envio do documento selecionado ao serviço de IA configurado no Atlas para análise técnica. Conferirei os dados antes do cadastro.
          </label>
          <button type="button" className={botao + ' w-full bg-indigo-700 text-white'} disabled={!arquivo || !consentimento || !!processando} onClick={() => void analisar()}>
            {processando === 'analisar' ? <Loader2 className="animate-spin" size={17}/> : <Sparkles size={17}/>} Analisar documento com IA
          </button>
          {analise && <div className="rounded-xl border border-slate-200 p-3 text-xs text-slate-700">
            <p><b>Resultado:</b> {analise.estado_documento === 'link_wvetro' ? 'Atalho/Link, não é relatório técnico' : analise.origem_ia} · {analise.componentes.length} linhas sugeridas · {analise.quantidade_cortes_completos ?? analise.componentes.filter(c => c.eixo && c.comprimento_mm != null).length} cortes com orientação identificada.</p>
            {analise.componentes.length > 0 && <p className="mt-2 font-semibold text-amber-800">Esses materiais são apenas sugestões de leitura; nenhum está validado. Confira as imagens, os códigos e as medidas abaixo.</p>}
            {!analise.componentes.length && <p className="mt-2 font-semibold text-amber-800">Nenhum perfil confirmado. Você pode salvar o projeto como rascunho, sem cadastrar materiais fictícios.</p>}
            {analise.descricao && <p className="mt-1">{analise.descricao}</p>}
            {analise.aviso && <p className="mt-2 text-amber-800">{analise.aviso}</p>}
            {!!analise.texto_extraido && <details className="mt-2"><summary className="cursor-pointer font-semibold">Ver texto original extraído</summary><pre className="max-h-40 overflow-auto whitespace-pre-wrap">{analise.texto_extraido}</pre></details>}
          </div>}
        </section>
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-bold">2. Croqui original do Atlas</h2><span className="text-xs text-slate-500">Visualização dinâmica</span></div>
          <CroquiProprio tipo={tipo || nome} largura={Number(largura)} altura={Number(altura)}/>
          {imagemLocal && <details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-xs font-semibold">Comparar com imagem de referência</summary><img src={imagemLocal} alt="Referência enviada, não reproduzida no croqui" className="mt-2 max-h-72 w-full object-contain"/></details>}
          {pdfLocal && <details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-xs font-semibold">Conferir páginas do PDF original</summary><iframe title="PDF de referência" src={pdfLocal} className="mt-3 h-80 w-full rounded-lg border"/></details>}
          {arquivo && !imagemLocal && <div className="flex min-w-0 items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600"><FileText size={17} className="shrink-0"/><span className="min-w-0 truncate" title={arquivo.name}>{arquivo.name.length > 80 ? arquivo.name.slice(0,77) + '...' : arquivo.name}</span></div>}
          <p className="text-xs text-slate-500">O desenho muda com largura, altura e modelo. A seção exata dos perfis exige imagem técnica vinculada ao código no catálogo.</p>
        </section>
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">3. Perfis, acessórios e listas para conferência</h2>
          <p className="mt-1 text-xs text-slate-500">Revise código, descrição, eixo, comprimento e quantidade. Cada item mostra a imagem cadastrada ou uma pendência de imagem.</p></div>
          <button className={botao + ' border border-slate-300 text-slate-700'} onClick={() => { setComponentes(prev => [...prev, vazio()]); setRevisado(false) }}><Plus size={16}/> Adicionar componente</button>
        </div>
        <div className="mt-4 space-y-3">
          {componentes.map((c,i) => {
            const codigo = String(c.codigo || '').toUpperCase()
            const produto = produtosPorCodigo.get(codigo)
            return <div key={i} className="grid items-end gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-[110px_minmax(105px,1.1fr)_minmax(120px,1.4fr)_80px_85px_95px_78px_32px]">
              <div><ImagemProdutoTecnico codigo={codigo} produto={produto || null} permitirEdicao/><span className={'text-[10px] ' + (produto?.foto_url ? 'text-emerald-700' : 'text-amber-800')}>{produto?.foto_url ? 'Foto cadastrada' : 'Imagem pendente'}</span></div>
              <label className="text-xs font-semibold">Código<input className={campo + ' mt-1 font-mono'} value={c.codigo} onChange={e => atualizarItem(i,{codigo:e.target.value.toUpperCase()})}/></label>
              <label className="text-xs font-semibold">Descrição<input className={campo + ' mt-1'} value={c.descricao} onChange={e => atualizarItem(i,{descricao:e.target.value})}/></label>
              <label className="text-xs font-semibold">Tipo<select className={campo + ' mt-1 px-1'} value={c.tipo} onChange={e => atualizarItem(i,{tipo:e.target.value as ComponenteCandidato['tipo']})}><option value="perfil">Perfil</option><option value="acessorio">Acessório</option></select></label>
              <label className="text-xs font-semibold">Eixo<select className={campo + ' mt-1'} value={c.eixo} onChange={e => atualizarItem(i,{eixo:e.target.value as ComponenteCandidato['eixo']})}><option value="">—</option><option value="L">L</option><option value="H">H</option></select></label>
              <label className="text-xs font-semibold">Corte (mm)<input className={campo + ' mt-1'} type="number" min="1" step=".1" value={c.comprimento_mm ?? ''} onChange={e => atualizarItem(i,{comprimento_mm:e.target.value === '' ? null : Number(e.target.value)})}/></label>
              <label className="text-xs font-semibold">Qtd.<input className={campo + ' mt-1'} type="number" min="1" max="500" value={c.quantidade} onChange={e => atualizarItem(i,{quantidade:Number(e.target.value)})}/></label>
              <button type="button" title="Remover componente" className="mb-3 text-red-600" onClick={() => { setComponentes(prev => prev.filter((_,ix)=>ix!==i));setRevisado(false) }}><Trash2 size={17}/></button>
            </div>
          })}
          {componentes.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500"><ImageIcon size={23} className="mx-auto mb-2"/>Os componentes reconhecidos aparecem aqui. Você também pode incluí-los manualmente.</div>}
        </div>
        {componentes.length > 0 && <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
          <p className="rounded-xl bg-slate-50 p-3"><b>{componentesValidos.length}</b> componentes com códigos válidos</p>
          <p className="rounded-xl bg-slate-50 p-3"><b>{desconhecidos.length}</b> códigos para pré-cadastro: {desconhecidos.slice(0,8).join(', ') || 'nenhum'}</p>
          <p className="rounded-xl bg-slate-50 p-3"><b>{semImagem.length}</b> imagens pendentes: {semImagem.slice(0,8).join(', ') || 'nenhuma'}</p>
        </div>}
        <p className="mt-3 text-xs text-amber-800">Perfis sem cadastro ou foto ficam identificados como pendência técnica. O Atlas não atribui a um código a foto de outro perfil, nem cria produto ativo com imagem presumida.</p>
        <label className="mt-5 flex items-start gap-2 text-sm text-slate-700"><input className="mt-1" type="checkbox" checked={revisado} onChange={e=>setRevisado(e.target.checked)}/>
          Conferi os componentes apresentados. Entendo que as fórmulas são hipóteses para testar com outros PDFs e não serão usadas na produção.</label>
        <button type="button" className={botao + ' mt-4 bg-slate-900 text-white'} disabled={(!!componentesValidos.length && !revisado) || !!processando || nome.trim().length < 4 || componentesValidos.length !== componentes.length || !Number(largura) || !Number(altura)} onClick={() => void criar()}>
          {processando === 'criar' ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} {componentesValidos.some(c=>c.tipo==='perfil') ? 'Criar tipologia no laboratório' : 'Salvar rascunho sem perfis identificados'}
        </button>
      </section>
    </>}
  </main>
}
