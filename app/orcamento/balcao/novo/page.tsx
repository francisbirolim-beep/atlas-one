'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, FileDown, ImageIcon, Loader2, Minus, Plus, Printer, Search, Text, Trash2, UserCheck, X } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'
import CatalogoFiltros from '@/components/balcao/CatalogoFiltros'
import { criarOrcamentoBalcao } from '@/lib/orcamentoBalcao'
import { abrirPdfParaImpressao, gerarPdfOrcamentoBalcao, type ItemPdfBalcao } from '@/lib/pdfOrcamentoBalcao'
import { lerConfiguracaoOrcamento, lerDadosEmpresa, type ConfiguracaoOrcamento, type DadosEmpresaCompleta } from '@/lib/configGeral'

type Categoria = { valor: string; label: string }
type ModoImpressao = 'imagem' | 'descricao'
type Produto = {
  id: string
  codigo: string
  nome: string
  descricao?: string | null
  categoria?: string | null
  grupo?: string | null
  grupos?: string[]
  unidade: string
  fotoUrl?: string | null
  preco: number
  precoPromocional?: number | null
  precoEfetivo: number
  custo?: number | null
  precoMinimo?: number | null
  pesoKgM?: number | null
  tamanhoBarraMm?: number | null
}
type Cliente = {
  id: string
  nome: string
  apelido?: string | null
  cpf_cnpj?: string | null
  telefone?: string | null
  whatsapp?: string | null
  email?: string | null
  cidade?: string | null
  bairro?: string | null
  endereco?: string | null
  cep?: string | null
}
type ItemCarrinho = { produto: Produto; quantidade: number; precoUnitario: number }
type ResultadoSalvo = { id?: string; numero?: number | null; total: number }

function moeda(valor: number) { return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function num(valor: string | number) { const n = Number(String(valor).replace(',', '.')); return Number.isFinite(n) ? n : 0 }
function pesoTexto(produto: Produto) {
  if (produto.categoria !== 'perfil' || produto.pesoKgM == null) return null
  const peso = Number(produto.pesoKgM)
  if (!Number.isFinite(peso)) return null
  return `Peso cadastrado: ${peso.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} kg/m${peso > 50 ? ' • REVISAR CADASTRO' : ''}`
}

export default function NovoOrcamentoBalcao() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [grupos, setGrupos] = useState<string[]>([])
  const [categoria, setCategoria] = useState('')
  const [grupo, setGrupo] = useState('')
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [carrinho, setCarrinho] = useState<Record<string, ItemCarrinho>>({})

  const [clienteBusca, setClienteBusca] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [carregandoClientes, setCarregandoClientes] = useState(false)
  const [clienteNome, setClienteNome] = useState('')
  const [clienteApelido, setClienteApelido] = useState('')
  const [clienteWhatsapp, setClienteWhatsapp] = useState('')
  const [clienteTelefone, setClienteTelefone] = useState('')
  const [clienteEmail, setClienteEmail] = useState('')
  const [clienteCpfCnpj, setClienteCpfCnpj] = useState('')
  const [clienteEndereco, setClienteEndereco] = useState('')
  const [clienteBairro, setClienteBairro] = useState('')
  const [clienteCep, setClienteCep] = useState('')
  const [clienteCidade, setClienteCidade] = useState('')

  const [obraEndereco, setObraEndereco] = useState('')
  const [obraNumero, setObraNumero] = useState('')
  const [obraComplemento, setObraComplemento] = useState('')
  const [obraBairro, setObraBairro] = useState('')
  const [obraCidade, setObraCidade] = useState('')
  const [obraUf, setObraUf] = useState('')
  const [obraCep, setObraCep] = useState('')

  const [desconto, setDesconto] = useState('0')
  const [formaPagamento, setFormaPagamento] = useState('A combinar')
  const [prazoEntrega, setPrazoEntrega] = useState('')
  const [condicoes, setCondicoes] = useState('')
  const [modoImpressao, setModoImpressao] = useState<ModoImpressao>('imagem')
  const [empresa, setEmpresa] = useState<DadosEmpresaCompleta | null>(null)
  const [config, setConfig] = useState<ConfiguracaoOrcamento | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [salvo, setSalvo] = useState<ResultadoSalvo | null>(null)
  const documentoRef = useRef<Awaited<ReturnType<typeof gerarPdfOrcamentoBalcao>> | null>(null)
  const arquivoRef = useRef('orcamento-balcao.pdf')
  const catalogoAbort = useRef<AbortController | null>(null)
  const catalogoSeq = useRef(0)
  const clienteAbort = useRef<AbortController | null>(null)
  const clienteSeq = useRef(0)

  async function api(url: string, init?: RequestInit) {
    const token = await tokenAtual()
    if (!token) throw new Error('Sessão expirada. Entre novamente no Atlas.')
    return fetch(url, { ...init, headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` }, cache: 'no-store' })
  }

  async function carregarCatalogo() {
    const seq = ++catalogoSeq.current
    catalogoAbort.current?.abort()
    const controller = new AbortController()
    catalogoAbort.current = controller
    setCarregando(true)
    try {
      const params = new URLSearchParams()
      if (busca.trim().length >= 2) params.set('q', busca.trim())
      if (categoria) params.set('categoria', categoria)
      if (grupo) params.set('grupo', grupo)
      const resp = await api(`/api/balcao/catalogo-v2?${params.toString()}`, { signal: controller.signal })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Não foi possível carregar o catálogo.')
      if (seq !== catalogoSeq.current) return
      setProdutos(json.produtos || [])
      setCategorias(json.categorias || [])
      setGrupos(json.grupos || [])
    } catch (e) {
      if ((e as { name?: string })?.name !== 'AbortError' && seq === catalogoSeq.current) setErro(e instanceof Error ? e.message : 'Erro ao carregar produtos.')
    } finally { if (seq === catalogoSeq.current) setCarregando(false) }
  }

  async function carregarClientes(termo: string) {
    const seq = ++clienteSeq.current
    clienteAbort.current?.abort()
    const controller = new AbortController()
    clienteAbort.current = controller
    setCarregandoClientes(true)
    try {
      const resp = await api(`/api/balcao/catalogo?tipo=clientes&q=${encodeURIComponent(termo)}`, { signal: controller.signal })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Erro ao pesquisar clientes.')
      if (seq === clienteSeq.current) setClientes(json.clientes || [])
    } catch (e) {
      if ((e as { name?: string })?.name !== 'AbortError' && seq === clienteSeq.current) setErro(e instanceof Error ? e.message : 'Erro ao pesquisar cliente.')
    } finally { if (seq === clienteSeq.current) setCarregandoClientes(false) }
  }

  useEffect(() => {
    Promise.all([lerDadosEmpresa(), lerConfiguracaoOrcamento()]).then(([dadosEmpresa, cfg]) => {
      setEmpresa(dadosEmpresa); setConfig(cfg); setCondicoes(dadosEmpresa?.condicoesPadrao || cfg.observacaoPadrao || '')
    })
  }, [])
  useEffect(() => { catalogoAbort.current?.abort(); catalogoSeq.current++; const h = setTimeout(() => carregarCatalogo(), 80); return () => clearTimeout(h) }, [busca, categoria, grupo])
  useEffect(() => {
    const termo = clienteBusca.trim(); clienteAbort.current?.abort(); clienteSeq.current++
    if (termo.length < 2 || cliente) { setClientes([]); setCarregandoClientes(false); return }
    const h = setTimeout(() => carregarClientes(termo), 80); return () => clearTimeout(h)
  }, [clienteBusca, cliente])

  const itens = useMemo(() => Object.values(carrinho), [carrinho])
  const subtotal = itens.reduce((s, item) => s + item.quantidade * item.precoUnitario, 0)
  const descontoN = Math.min(subtotal, Math.max(0, num(desconto)))
  const total = Math.max(0, subtotal - descontoN)
  const pesquisou = busca.trim().length >= 2 || Boolean(categoria) || Boolean(grupo)

  function adicionar(produto: Produto) {
    setErro(''); setCarrinho(atual => { const existente = atual[produto.id]; return { ...atual, [produto.id]: existente ? { ...existente, quantidade: existente.quantidade + 1 } : { produto, quantidade: 1, precoUnitario: Number(produto.precoEfetivo || 0) } } })
  }
  function quantidade(produtoId: string, valor: number) {
    setCarrinho(atual => { const existente = atual[produtoId]; if (!existente) return atual; if (valor <= 0) { const novo = { ...atual }; delete novo[produtoId]; return novo } return { ...atual, [produtoId]: { ...existente, quantidade: valor } } })
  }
  function preco(produtoId: string, valor: string) { setCarrinho(atual => atual[produtoId] ? { ...atual, [produtoId]: { ...atual[produtoId], precoUnitario: Math.max(0, num(valor)) } } : atual) }
  function remover(produtoId: string) { setCarrinho(atual => { const novo = { ...atual }; delete novo[produtoId]; return novo }) }

  function selecionarCliente(c: Cliente) {
    setCliente(c); setClienteBusca(c.nome); setClienteNome(c.nome || ''); setClienteApelido(c.apelido || ''); setClienteWhatsapp(c.whatsapp || ''); setClienteTelefone(c.telefone || ''); setClienteEmail(c.email || ''); setClienteCpfCnpj(c.cpf_cnpj || ''); setClienteEndereco(c.endereco || ''); setClienteBairro(c.bairro || ''); setClienteCep(c.cep || ''); setClienteCidade(c.cidade || ''); setClientes([])
  }
  function trocarCliente(valor: string) {
    setCliente(null); setClienteBusca(valor); setClienteNome(valor)
    if (!valor) { setClienteApelido(''); setClienteWhatsapp(''); setClienteTelefone(''); setClienteEmail(''); setClienteCpfCnpj(''); setClienteEndereco(''); setClienteBairro(''); setClienteCep(''); setClienteCidade('') }
  }
  function usarEnderecoCliente() {
    setObraEndereco(clienteEndereco); setObraBairro(clienteBairro); setObraCidade(clienteCidade); setObraCep(clienteCep)
  }

  function montarItens(): ItemPdfBalcao[] {
    return itens.map(({ produto, quantidade: qtd, precoUnitario }) => ({ produto_id: produto.id, codigo: produto.codigo || null, nome: produto.nome, categoria: produto.categoria || 'produto', descricao: produto.descricao || null, foto_url: produto.fotoUrl || null, unidade: produto.unidade || 'UN', quantidade: qtd, preco_unit: precoUnitario, preco_total: qtd * precoUnitario, peso_kg_m: produto.pesoKgM ?? null, tamanho_barra_mm: produto.tamanhoBarraMm ?? null, linha_nome: (produto.grupos || []).join(', ') || produto.grupo || null }))
  }

  async function salvar(acao: 'pdf' | 'imprimir') {
    setErro('')
    if (salvo && documentoRef.current) { if (acao === 'pdf') documentoRef.current.save(arquivoRef.current); else abrirPdfParaImpressao(documentoRef.current); return }
    if (!clienteNome.trim()) return setErro('Informe ou selecione o cliente.')
    if (!itens.length) return setErro('Adicione pelo menos um produto ao orçamento.')
    const semPreco = itens.find(item => item.precoUnitario <= 0); if (semPreco) return setErro(`Informe um preço válido para ${semPreco.produto.nome}.`)
    const abaixo = itens.find(item => item.produto.precoMinimo != null && item.precoUnitario < Number(item.produto.precoMinimo)); if (abaixo) return setErro(`${abaixo.produto.nome}: o preço está abaixo do mínimo cadastrado.`)

    setSalvando(true)
    try {
      const itensPdf = montarItens()
      const prazo = prazoEntrega.trim() === '' ? null : Math.max(0, Math.round(num(prazoEntrega)))
      const resultado = await criarOrcamentoBalcao({
        clienteId: cliente?.id, clienteNome: clienteNome.trim(), clienteApelido: clienteApelido || undefined, clienteWhatsapp: clienteWhatsapp || undefined, clienteTelefone: clienteTelefone || undefined, clienteEmail: clienteEmail || undefined, clienteCpfCnpj: clienteCpfCnpj || undefined, clienteEndereco: clienteEndereco || undefined, clienteBairro: clienteBairro || undefined, clienteCep: clienteCep || undefined, cidade: clienteCidade || undefined,
        obraEndereco: obraEndereco || undefined, obraNumero: obraNumero || undefined, obraComplemento: obraComplemento || undefined, obraBairro: obraBairro || undefined, obraCidade: obraCidade || undefined, obraUf: obraUf || undefined, obraCep: obraCep || undefined,
        itens: itensPdf, desconto: descontoN, formaPagamento, prazoEntregaDias: prazo, condicoes,
      })
      if (!resultado.ok) throw new Error(resultado.error || 'Não foi possível salvar o orçamento.')

      const usuario = await usuarioAtual()
      const cfg = config || await lerConfiguracaoOrcamento()
      const dadosEmpresa = empresa || { nome: 'ESQUADRIFÁCIO SOLUÇÕES EM ALUMÍNIO' }
      const doc = await gerarPdfOrcamentoBalcao(dadosEmpresa, {
        numero: resultado.numero ?? null, emissao: new Date().toLocaleDateString('pt-BR'), vendedorNome: usuario?.nome || '', clienteNome: clienteNome.trim(), clienteTelefone: clienteTelefone || null, clienteWhatsapp: clienteWhatsapp || null, clienteEmail: clienteEmail || null, clienteCpfCnpj: clienteCpfCnpj || null, clienteEndereco: [clienteEndereco, clienteBairro, clienteCep].filter(Boolean).join(' · ') || null, clienteCidade: clienteCidade || null,
        obraEndereco: obraEndereco || null, obraNumero: obraNumero || null, obraComplemento: obraComplemento || null, obraBairro: obraBairro || null, obraCidade: obraCidade || null, obraUf: obraUf || null, obraCep: obraCep || null,
        itens: itensPdf, desconto: descontoN, formaPagamento, prazoEntregaDias: prazo, condicoes,
      }, { ...cfg, mostrarFoto: modoImpressao === 'imagem' })

      documentoRef.current = doc; arquivoRef.current = `orcamento-${resultado.numero || 'balcao'}.pdf`; setSalvo({ id: resultado.id, numero: resultado.numero, total: resultado.total ?? total })
      if (acao === 'pdf') doc.save(arquivoRef.current); else abrirPdfParaImpressao(doc)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao salvar o orçamento.') }
    finally { setSalvando(false) }
  }

  return <main className="min-h-screen bg-slate-50 p-3"><div className="mx-auto max-w-[1540px] space-y-3">
    <header className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Link href="/balcao/orcamentos" className="rounded-lg border bg-white p-2"><ArrowLeft size={18}/></Link><div><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-slate-400">Venda Balcão</p><h1 className="text-xl font-bold text-slate-900">Novo orçamento</h1><p className="text-xs text-slate-500">Catálogo à esquerda e orçamento sendo montado em tempo real.</p></div></div>{salvo && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">Orçamento #{salvo.numero || '—'} salvo • {moeda(salvo.total)}</div>}</header>
    {erro && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_430px]">
      <section className="min-w-0 rounded-xl border bg-white p-3">
        <div className="mb-3"><h2 className="text-sm font-semibold text-slate-900">Adicionar produtos</h2><p className="text-[11px] text-slate-500">Pesquise código, nome ou descrição. Categoria e grupo/linha podem ser combinados.</p></div>
        <div className="relative mb-3"><Search size={16} className="absolute left-3 top-2.5 text-slate-400"/><input value={busca} onInput={e => setBusca(e.currentTarget.value)} placeholder="Ex.: SUPREMA ROLDANA, SU 039, puxador preto..." className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm"/>{carregando && <Loader2 size={14} className="absolute right-3 top-2.5 animate-spin text-slate-400"/>}</div>
        <CatalogoFiltros categorias={categorias} grupos={grupos} categoria={categoria} grupo={grupo} onCategoria={setCategoria} onGrupo={setGrupo}/>
        <div className="mt-4 max-h-[620px] space-y-2 overflow-y-auto pr-1">
          {!pesquisou && <div className="py-16 text-center text-sm text-slate-400">Digite pelo menos 2 caracteres ou escolha um filtro para exibir produtos.</div>}
          {pesquisou && !carregando && produtos.length === 0 && <div className="py-16 text-center text-sm text-slate-400">Nenhum produto encontrado com estes filtros.</div>}
          {produtos.map(produto => { const peso = pesoTexto(produto); return <div key={produto.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-emerald-300 hover:bg-emerald-50/30">{produto.fotoUrl ? <img src={produto.fotoUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg border bg-white object-contain" onError={e => { e.currentTarget.style.display = 'none' }}/>:<div className="h-12 w-12 shrink-0 rounded-lg border bg-slate-50"/>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{produto.codigo ? `${produto.codigo} — ` : ''}{produto.nome}</p>{produto.descricao && <p className="truncate text-[11px] text-slate-500">{produto.descricao}</p>}<div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-500"><span>{(produto.grupos || []).join(' • ') || produto.grupo || produto.categoria}</span><span>Preço: <strong>{moeda(produto.precoEfetivo)}</strong> / {produto.unidade}</span>{peso && <span className={Number(produto.pesoKgM) > 50 ? 'font-semibold text-amber-700' : ''}>{peso}</span>}</div></div><button type="button" onClick={() => adicionar(produto)} className="rounded-lg bg-brand-navyLight p-2.5 text-brand-navy hover:bg-brand-navy hover:text-white" title="Adicionar ao orçamento"><Plus size={17}/></button></div> })}
        </div>
      </section>

      <aside className="space-y-3 xl:sticky xl:top-3 xl:self-start">
        <section className="rounded-xl border bg-white p-3"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-900">Itens ({itens.length})</h2><span className="text-xs font-semibold text-emerald-700">{moeda(total)}</span></div><div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">{!itens.length && <div className="rounded-lg bg-slate-50 py-8 text-center text-xs text-slate-400">Nenhum item adicionado.</div>}{itens.map(({ produto, quantidade: qtd, precoUnitario }) => <div key={produto.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5"><div className="flex gap-2"><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-800">{produto.codigo ? `${produto.codigo} — ` : ''}{produto.nome}</p>{pesoTexto(produto) && <p className={`mt-0.5 text-[9px] ${Number(produto.pesoKgM) > 50 ? 'font-semibold text-amber-700' : 'text-slate-400'}`}>{pesoTexto(produto)}</p>}</div><button onClick={() => remover(produto.id)} className="text-red-500"><Trash2 size={14}/></button></div><div className="mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-2"><div className="flex items-center gap-1"><button onClick={() => quantidade(produto.id, qtd - 1)} className="rounded border bg-white p-1"><Minus size={12}/></button><input type="number" min="0.001" step="any" value={qtd} onChange={e => quantidade(produto.id, Math.max(0, num(e.target.value)))} className="w-14 rounded border px-1 py-1 text-center text-xs"/><button onClick={() => quantidade(produto.id, qtd + 1)} className="rounded border bg-white p-1"><Plus size={12}/></button></div><input type="number" min="0" step="any" value={precoUnitario} onChange={e => preco(produto.id, e.target.value)} className="w-full rounded border px-2 py-1 text-right text-xs"/><strong className="min-w-20 text-right text-xs">{moeda(qtd * precoUnitario)}</strong></div>{precoUnitario <= 0 && <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-amber-700"><AlertTriangle size={11}/>Informe o preço antes de salvar.</p>}</div>)}</div><div className="mt-3 space-y-2 border-t pt-3 text-xs"><div className="flex justify-between"><span>Subtotal</span><strong>{moeda(subtotal)}</strong></div><label className="grid grid-cols-[1fr_130px] items-center gap-2"><span>Desconto</span><input type="number" min="0" step="any" value={desconto} onChange={e => setDesconto(e.target.value)} className="rounded border px-2 py-1.5 text-right"/></label><div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span className="text-emerald-700">{moeda(total)}</span></div></div></section>

        <section className="rounded-xl border bg-white p-3"><div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">Cliente / faturamento</h2>{cliente && <button onClick={() => trocarCliente('')} className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-500"><X size={11}/>Trocar</button>}</div><div className="relative"><Search size={14} className="absolute left-3 top-2.5 text-slate-400"/><input value={clienteBusca} onInput={e => trocarCliente(e.currentTarget.value)} placeholder="Nome / buscar cliente" className="w-full rounded-lg border py-2 pl-8 pr-8 text-xs"/>{carregandoClientes && <Loader2 size={13} className="absolute right-3 top-2.5 animate-spin text-slate-400"/>}{!cliente && clientes.length > 0 && <div className="absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-lg border bg-white shadow-xl">{clientes.map(c => <button key={c.id} type="button" onClick={() => selecionarCliente(c)} className="block w-full border-b px-3 py-2 text-left hover:bg-slate-50"><div className="flex items-center gap-1.5 text-xs font-semibold"><UserCheck size={12}/>{c.nome}{c.apelido ? <span className="text-[9px] text-sky-700">({c.apelido})</span>:null}</div><div className="text-[9px] text-slate-400">{[c.cidade,c.bairro,c.whatsapp||c.telefone,c.cpf_cnpj].filter(Boolean).join(' • ')}</div></button>)}</div>}</div><div className="mt-2 grid grid-cols-2 gap-2"><input value={clienteCidade} onChange={e => setClienteCidade(e.target.value)} placeholder="Cidade" className="rounded border px-2 py-1.5 text-xs"/><input value={clienteBairro} onChange={e => setClienteBairro(e.target.value)} placeholder="Bairro" className="rounded border px-2 py-1.5 text-xs"/><input value={clienteWhatsapp} onChange={e => setClienteWhatsapp(e.target.value)} placeholder="WhatsApp" className="rounded border px-2 py-1.5 text-xs"/><input value={clienteCpfCnpj} onChange={e => setClienteCpfCnpj(e.target.value)} placeholder="CPF/CNPJ" className="rounded border px-2 py-1.5 text-xs"/><input value={clienteEmail} onChange={e => setClienteEmail(e.target.value)} placeholder="E-mail" className="rounded border px-2 py-1.5 text-xs col-span-2"/><input value={clienteEndereco} onChange={e => setClienteEndereco(e.target.value)} placeholder="Endereço" className="rounded border px-2 py-1.5 text-xs col-span-2"/></div></section>

        <section className="rounded-xl border bg-white p-3"><div className="mb-2 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Local da obra / entrega</h2><button type="button" onClick={usarEnderecoCliente} className="text-[10px] font-semibold text-emerald-700 hover:underline">Usar endereço do cliente</button></div><div className="grid grid-cols-6 gap-2"><input value={obraEndereco} onChange={e=>setObraEndereco(e.target.value)} placeholder="Logradouro" className="col-span-4 rounded border px-2 py-1.5 text-xs"/><input value={obraNumero} onChange={e=>setObraNumero(e.target.value)} placeholder="Número" className="col-span-2 rounded border px-2 py-1.5 text-xs"/><input value={obraComplemento} onChange={e=>setObraComplemento(e.target.value)} placeholder="Complemento" className="col-span-3 rounded border px-2 py-1.5 text-xs"/><input value={obraBairro} onChange={e=>setObraBairro(e.target.value)} placeholder="Bairro" className="col-span-3 rounded border px-2 py-1.5 text-xs"/><input value={obraCidade} onChange={e=>setObraCidade(e.target.value)} placeholder="Cidade" className="col-span-3 rounded border px-2 py-1.5 text-xs"/><input value={obraUf} onChange={e=>setObraUf(e.target.value.toUpperCase())} placeholder="UF" maxLength={2} className="col-span-1 rounded border px-2 py-1.5 text-xs"/><input value={obraCep} onChange={e=>setObraCep(e.target.value)} placeholder="CEP" className="col-span-2 rounded border px-2 py-1.5 text-xs"/></div></section>

        <section className="rounded-xl border bg-white p-3 space-y-2"><h2 className="text-sm font-semibold">Condições comerciais</h2><label className="block text-[10px] font-medium text-slate-500">Forma de pagamento<input list="formas-pagamento" value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} className="mt-1 w-full rounded border px-2 py-1.5 text-xs"/><datalist id="formas-pagamento"><option value="A combinar"/><option value="PIX"/><option value="Dinheiro"/><option value="Cartão"/><option value="Boleto"/><option value="À vista"/><option value="50% entrada + 50% entrega"/><option value="70% entrada + 30% entrega"/><option value="50% entrada + 20% produção + 30% entrega"/></datalist></label><label className="block text-[10px] font-medium text-slate-500">Prazo de entrega (dias)<input type="number" min="0" value={prazoEntrega} onChange={e => setPrazoEntrega(e.target.value)} placeholder="A combinar" className="mt-1 w-full rounded border px-2 py-1.5 text-xs"/></label><label className="block text-[10px] font-medium text-slate-500">Observações<textarea value={condicoes} onChange={e => setCondicoes(e.target.value)} rows={3} className="mt-1 w-full resize-none rounded border p-2 text-xs"/></label></section>

        <section className="rounded-xl border bg-white p-3"><h2 className="text-sm font-semibold">Modelo de impressão</h2><p className="mt-0.5 text-[10px] text-slate-500">Escolha antes de salvar. O modelo compacto usa melhor a folha inteira.</p><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" disabled={Boolean(salvo)} onClick={()=>setModoImpressao('imagem')} className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${modoImpressao==='imagem'?'border-emerald-500 bg-emerald-50 text-emerald-800':'bg-white text-slate-600'} disabled:opacity-60`}><ImageIcon size={14}/>Com desenho/imagem</button><button type="button" disabled={Boolean(salvo)} onClick={()=>setModoImpressao('descricao')} className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${modoImpressao==='descricao'?'border-emerald-500 bg-emerald-50 text-emerald-800':'bg-white text-slate-600'} disabled:opacity-60`}><Text size={14}/>Só descrição</button></div></section>

        {!salvo ? <div className="grid grid-cols-2 gap-2"><button onClick={() => salvar('pdf')} disabled={salvando} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-navy px-3 py-3 text-sm font-semibold text-white disabled:opacity-50"><FileDown size={16}/>{salvando ? 'Salvando...' : 'Salvar PDF'}</button><button onClick={() => salvar('imprimir')} disabled={salvando} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-3 text-sm font-semibold text-white disabled:opacity-50"><Printer size={16}/>Imprimir</button></div> : <div className="grid grid-cols-2 gap-2"><button onClick={() => documentoRef.current?.save(arquivoRef.current)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-navy px-3 py-3 text-sm font-semibold text-white"><FileDown size={16}/>Baixar PDF</button><button onClick={() => documentoRef.current && abrirPdfParaImpressao(documentoRef.current)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-3 text-sm font-semibold text-white"><Printer size={16}/>Imprimir</button></div>}
      </aside>
    </div>
  </div></main>
}
