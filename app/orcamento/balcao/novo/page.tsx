'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Filter, Minus, Plus, Trash2, UserCheck, X } from 'lucide-react'
import { listarProdutos, CATEGORIAS_PRODUTO } from '@/lib/produtos'
import { listarLinhasTecnicas, type LinhaTecnica } from '@/lib/linhasTecnicas'
import { lerConfiguracaoOrcamento, lerDadosEmpresa, type ConfiguracaoOrcamento } from '@/lib/configGeral'
import { criarOrcamentoBalcao } from '@/lib/orcamentoBalcao'
import { gerarPdfOrcamentoBalcao } from '@/lib/pdfOrcamentoBalcao'
import { usuarioAtual } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Produto, CategoriaProduto, ItemBalcao, DadosEmpresa } from '@/lib/tipos'
import { abaixoDoPrecoMinimo, margemRealPorPreco, precoVendaBalcao } from '@/lib/precificacaoBalcao'
import { correspondeBuscaAtlas, normalizarBuscaAtlas } from '@/lib/buscaAtlas'
import BuscaAtlasInput from '@/components/system/BuscaAtlasInput'

type ProdutoBalcao = Produto & {
  preco_minimo?: number | null
  preco_promocional?: number | null
  ultimo_preco_vendido?: number | null
  linha_id?: string | null
  grupo?: string | null
  marca?: string | null
  ncm?: string | null
  codigo_origem?: string | null
  dados_origem?: Record<string, unknown> | null
}

type ClienteBusca = {
  id: string
  nome: string
  apelido?: string | null
  whatsapp?: string | null
  telefone?: string | null
  email?: string | null
  cpf_cnpj?: string | null
  cidade?: string | null
  bairro?: string | null
  endereco?: string | null
  cep?: string | null
}

type LinhaCarrinho = { quantidade: number; precoUnit: number }

function moeda(valor: number | null | undefined) {
  if (valor == null) return '—'
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function margemTexto(custo: number | null | undefined, preco: number) {
  const m = margemRealPorPreco(custo, preco)
  return m == null ? '—' : `${m.toFixed(2)}%`
}

export default function NovoOrcamentoBalcao() {
  const router = useRouter()
  const [produtos, setProdutos] = useState<ProdutoBalcao[]>([])
  const [linhas, setLinhas] = useState<LinhaTecnica[]>([])
  const [clientes, setClientes] = useState<ClienteBusca[]>([])
  const [empresa, setEmpresa] = useState<DadosEmpresa | null>(null)
  const [configOrcamento, setConfigOrcamento] = useState<ConfiguracaoOrcamento | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState<CategoriaProduto | 'todas'>('todas')
  const [linhaId, setLinhaId] = useState<string>('')
  const [carrinho, setCarrinho] = useState<Record<string, LinhaCarrinho>>({})

  const [clienteBusca, setClienteBusca] = useState('')
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<string | null>(null)
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
  const [condicoes, setCondicoes] = useState('')
  const [mostrarFoto, setMostrarFoto] = useState(true)
  const [mostrarPrecoUnitario, setMostrarPrecoUnitario] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  useEffect(() => {
    async function carregar() {
      const [listaProdutos, listaLinhas, dadosEmpresa, config, clientesResp] = await Promise.all([
        listarProdutos(),
        listarLinhasTecnicas(),
        lerDadosEmpresa(),
        lerConfiguracaoOrcamento(),
        supabase
          .from('clientes')
          .select('id,nome,apelido,whatsapp,telefone,email,cpf_cnpj,cidade,bairro,endereco,cep')
          .order('nome')
          .limit(1000),
      ])
      setProdutos((listaProdutos as ProdutoBalcao[]).filter(p => Boolean(p.unidade?.trim()) && p.ativo))
      setLinhas(listaLinhas.filter(l => l.ativo))
      const listaClientes = (clientesResp.data || []) as ClienteBusca[]
      setClientes(listaClientes)
      const clienteContextoId = new URLSearchParams(window.location.search).get('cliente')
      if (clienteContextoId) {
        const clienteContexto = listaClientes.find(c => c.id === clienteContextoId)
        if (clienteContexto) selecionarCliente(clienteContexto)
      }
      setEmpresa(dadosEmpresa)
      setConfigOrcamento(config)
      setMostrarFoto(config.mostrarFoto)
      setMostrarPrecoUnitario(config.mostrarPrecoUnitario)
      setCondicoes(dadosEmpresa?.condicoesPadrao || config.observacaoPadrao || '')
      setCarregando(false)
    }
    carregar()
  }, [])

  const linhasPorProduto = useMemo(() => {
    const mapa = new Map<string, LinhaTecnica[]>()
    for (const linha of linhas) {
      for (const produtoId of linha.produto_ids || []) {
        const atual = mapa.get(produtoId) || []
        atual.push(linha)
        mapa.set(produtoId, atual)
      }
    }
    return mapa
  }, [linhas])

  const linhasDisponiveis = useMemo(() => {
    const idsCategoria = new Set(
      produtos
        .filter(p => categoria === 'todas' || p.categoria === categoria)
        .map(p => p.id)
    )
    return linhas.filter(l => (l.produto_ids || []).some(id => idsCategoria.has(id)))
  }, [linhas, produtos, categoria])

  const produtosFiltrados = useMemo(() => produtos.filter(p => {
    if (categoria !== 'todas' && p.categoria !== categoria) return false
    const linhasProduto = linhasPorProduto.get(p.id) || []
    if (linhaId && !linhasProduto.some(l => l.id === linhaId)) return false
    if (!busca.trim()) return true
    return correspondeBuscaAtlas(
      busca,
      p.codigo,
      p.codigo_origem,
      p.nome,
      p.descricao,
      p.categoria,
      p.grupo,
      p.marca,
      p.ncm,
      ...linhasProduto.flatMap(l => [l.nome, l.fabricante, l.descricao, ...(l.apelidos || [])])
    )
  }), [produtos, busca, categoria, linhaId, linhasPorProduto])

  const clientesEncontrados = useMemo(() => {
    if (clienteSelecionadoId || clienteBusca.trim().length < 2) return []
    return clientes
      .filter(c => correspondeBuscaAtlas(
        clienteBusca,
        c.nome,
        c.apelido,
        c.cpf_cnpj,
        c.whatsapp,
        c.telefone,
        c.email,
        c.cidade,
        c.bairro,
        c.endereco,
        c.cep
      ))
      .slice(0, 12)
  }, [clientes, clienteBusca, clienteSelecionadoId])

  const itensCarrinho = useMemo(() => Object.entries(carrinho)
    .filter(([, linha]) => linha.quantidade > 0)
    .map(([produtoId, linha]) => {
      const produto = produtos.find(p => p.id === produtoId)
      return produto ? { produto, ...linha } : null
    })
    .filter(Boolean) as Array<{ produto: ProdutoBalcao; quantidade: number; precoUnit: number }>, [carrinho, produtos])

  const totalCarrinho = itensCarrinho.reduce((s, it) => s + it.precoUnit * it.quantidade, 0)

  function trocarCategoria(valor: CategoriaProduto | 'todas') {
    setCategoria(valor)
    setLinhaId('')
  }

  function selecionarCliente(c: ClienteBusca) {
    setClienteSelecionadoId(c.id)
    setClienteBusca(c.nome)
    setClienteNome(c.nome || '')
    setClienteApelido(c.apelido || '')
    setClienteWhatsapp(c.whatsapp || '')
    setClienteTelefone(c.telefone || '')
    setClienteEmail(c.email || '')
    setClienteCpfCnpj(c.cpf_cnpj || '')
    setClienteEndereco(c.endereco || '')
    setClienteBairro(c.bairro || '')
    setClienteCep(c.cep || '')
    setClienteCidade(c.cidade || '')
  }

  function limparCliente() {
    setClienteSelecionadoId(null)
    setClienteBusca('')
    setClienteNome('')
    setClienteApelido('')
    setClienteWhatsapp('')
    setClienteTelefone('')
    setClienteEmail('')
    setClienteCpfCnpj('')
    setClienteEndereco('')
    setClienteBairro('')
    setClienteCep('')
    setClienteCidade('')
  }

  function adicionar(produto: ProdutoBalcao) {
    setCarrinho(prev => {
      const atual = prev[produto.id]
      if (atual) return { ...prev, [produto.id]: { ...atual, quantidade: atual.quantidade + 1 } }
      return { ...prev, [produto.id]: { quantidade: 1, precoUnit: precoVendaBalcao(produto) } }
    })
  }

  function decrementar(produtoId: string) {
    setCarrinho(prev => {
      const atual = prev[produtoId]
      if (!atual) return prev
      if (atual.quantidade <= 1) {
        const { [produtoId]: _omit, ...resto } = prev
        return resto
      }
      return { ...prev, [produtoId]: { ...atual, quantidade: atual.quantidade - 1 } }
    })
  }

  function remover(produtoId: string) {
    setCarrinho(prev => {
      const { [produtoId]: _omit, ...resto } = prev
      return resto
    })
  }

  function mudarPreco(produtoId: string, valor: string) {
    const preco = Number(valor)
    setCarrinho(prev => ({ ...prev, [produtoId]: { ...prev[produtoId], precoUnit: Number.isFinite(preco) ? preco : 0 } }))
  }

  async function salvarEGerarPdf() {
    setMensagem(null)
    if (!clienteNome.trim()) return setMensagem({ tipo: 'erro', texto: 'Informe ou selecione o cliente.' })
    if (!itensCarrinho.length) return setMensagem({ tipo: 'erro', texto: 'Adicione ao menos um produto.' })

    const invalido = itensCarrinho.find(it => it.precoUnit <= 0)
    if (invalido) return setMensagem({ tipo: 'erro', texto: `Informe um preço válido para ${invalido.produto.nome}.` })
    const abaixo = itensCarrinho.find(it => abaixoDoPrecoMinimo(it.produto, it.precoUnit))
    if (abaixo) return setMensagem({ tipo: 'erro', texto: `${abaixo.produto.nome}: ${moeda(abaixo.precoUnit)} está abaixo do preço mínimo ${moeda(abaixo.produto.preco_minimo)}.` })

    setSalvando(true)
    const itens: ItemBalcao[] = itensCarrinho.map(({ produto, quantidade, precoUnit }) => ({
      produto_id: produto.id,
      nome: produto.nome,
      categoria: produto.categoria,
      descricao: produto.descricao || null,
      foto_url: produto.foto_url || null,
      unidade: produto.unidade!,
      quantidade,
      preco_unit: precoUnit,
      preco_total: precoUnit * quantidade,
    }))

    const params = new URLSearchParams(window.location.search)
    const resultado = await criarOrcamentoBalcao({
      clienteId: clienteSelecionadoId || undefined,
      obraId: params.get('obra'),
      clienteNome,
      clienteApelido: clienteApelido || undefined,
      clienteWhatsapp: clienteWhatsapp || undefined,
      clienteTelefone: clienteTelefone || undefined,
      clienteEmail: clienteEmail || undefined,
      clienteCpfCnpj: clienteCpfCnpj || undefined,
      clienteEndereco: clienteEndereco || undefined,
      clienteBairro: clienteBairro || undefined,
      clienteCep: clienteCep || undefined,
      cidade: clienteCidade || undefined,
      itens,
      condicoes: condicoes || undefined,
    })

    if (!resultado.ok) {
      setMensagem({ tipo: 'erro', texto: resultado.error || 'Erro ao salvar orçamento.' })
      setSalvando(false)
      return
    }

    try {
      const usuario = await usuarioAtual()
      const config = configOrcamento || await lerConfiguracaoOrcamento()
      const doc = await gerarPdfOrcamentoBalcao(
        empresa || { nome: 'Empresa' },
        {
          numero: resultado.numero ?? null,
          emissao: new Date().toLocaleDateString('pt-BR'),
          vendedorNome: usuario?.nome || '',
          clienteNome,
          clienteTelefone: clienteTelefone || null,
          clienteWhatsapp: clienteWhatsapp || null,
          clienteEmail: clienteEmail || null,
          clienteCpfCnpj: clienteCpfCnpj || null,
          clienteEndereco: clienteEndereco || null,
          clienteCidade: clienteCidade || null,
          itens,
          condicoes: condicoes || null,
        },
        {
          mostrarFoto,
          mostrarPrecoUnitario,
          tituloDocumento: config.tituloDocumento,
          validadeDias: config.validadeDias,
          mostrarAssinatura: config.mostrarAssinatura,
          rodape: config.rodape,
        }
      )
      doc.save(`orcamento-${resultado.numero || 'balcao'}.pdf`)
    } catch (e) {
      console.error('Erro ao gerar PDF:', e)
    }

    setMensagem({ tipo: 'ok', texto: 'Orçamento balcão salvo com o cadastro compartilhado do Atlas.' })
    const clienteContexto = params.get('cliente')
    setTimeout(() => router.push(clienteContexto ? `/clientes/${clienteContexto}/central` : '/balcao/orcamentos'), 1400)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight pb-24">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4">
          <Link href="/balcao/orcamentos" className="rounded-lg p-2 transition hover:bg-slate-100"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Venda / Orçamento Balcão</h1>
            <p className="text-sm text-slate-500">Preço comercial do produto, usando os mesmos clientes, produtos e linhas do Atlas.</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5">
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <strong>Regra:</strong> tipologias usam <strong>custo técnico</strong>. Venda avulsa usa preço normal/promocional e preço abaixo do mínimo continua bloqueado.
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><h2 className="text-sm font-semibold text-slate-800">Produtos</h2><p className="text-xs text-slate-500">Pesquise por várias palavras, em qualquer ordem, inclusive descrição e linha.</p></div>
            <span className="text-xs text-slate-400">{produtosFiltrados.length} resultado(s)</span>
          </div>
          <BuscaAtlasInput value={busca} onValueChange={setBusca} placeholder="Ex.: SUPREMA ROLDANA, ROLDANA SUPREMA, código, descrição..." inputClassName="w-full rounded-lg border border-slate-200 py-2 pr-3 text-sm" />
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => trocarCategoria('todas')} className={`rounded-full px-3 py-1.5 text-xs font-medium ${categoria === 'todas' ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-600'}`}>Todas</button>
            {CATEGORIAS_PRODUTO.map(cat => <button key={cat.valor} onClick={() => trocarCategoria(cat.valor)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${categoria === cat.valor ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-600'}`}>{cat.label}</button>)}
          </div>
          {linhasDisponiveis.length > 0 && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Filter size={13}/>Linha</div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setLinhaId('')} className={`rounded-full border px-3 py-1 text-xs ${!linhaId ? 'border-emerald-600 bg-emerald-50 font-semibold text-emerald-800' : 'border-slate-200 text-slate-600'}`}>Todas as linhas</button>
                {linhasDisponiveis.map(l => <button key={l.id} onClick={() => setLinhaId(l.id)} className={`rounded-full border px-3 py-1 text-xs ${linhaId === l.id ? 'border-emerald-600 bg-emerald-50 font-semibold text-emerald-800' : 'border-slate-200 text-slate-600'}`}>{l.nome}</button>)}
              </div>
            </div>
          )}

          {carregando ? <p className="py-8 text-center text-sm text-slate-400">Carregando produtos...</p> : (
            <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {produtosFiltrados.map(produto => {
                const precoInicial = precoVendaBalcao(produto)
                const promo = Number(produto.preco_promocional) > 0
                const linhasProduto = linhasPorProduto.get(produto.id) || []
                return <div key={produto.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 hover:bg-slate-50">
                  {produto.foto_url ? <img src={produto.foto_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" /> : <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-100" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{produto.codigo ? `${produto.codigo} — ` : ''}{produto.nome}</p>
                    {produto.descricao ? <p className="truncate text-xs text-slate-500">{produto.descricao}</p> : null}
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-slate-500">
                      {linhasProduto.map(l => <span key={l.id} className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-700">{l.nome}</span>)}
                      <span>{promo ? 'Promocional' : 'Preço'}: <strong>{moeda(precoInicial)}</strong> / {produto.unidade}</span>
                      {produto.custo != null ? <span>Margem: <strong>{margemTexto(produto.custo, precoInicial)}</strong></span> : null}
                    </div>
                  </div>
                  <button disabled={precoInicial <= 0} onClick={() => adicionar(produto)} className="rounded-lg bg-brand-navyLight p-2 text-brand-navy transition hover:bg-brand-navy hover:text-white disabled:opacity-30"><Plus size={16} /></button>
                </div>
              })}
              {!produtosFiltrados.length ? <p className="py-6 text-center text-sm text-slate-400">Nenhum produto encontrado com todos os filtros.</p> : null}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Itens da venda</h2>
          {!itensCarrinho.length ? <p className="text-sm text-slate-400">Nenhum produto adicionado.</p> : <div className="space-y-3">
            {itensCarrinho.map(({ produto, quantidade, precoUnit }) => {
              const abaixo = abaixoDoPrecoMinimo(produto, precoUnit)
              return <div key={produto.id} className={`rounded-xl border p-3 ${abaixo ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50'}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-[220px] flex-1"><p className="text-sm font-semibold text-slate-800">{produto.codigo ? `${produto.codigo} — ` : ''}{produto.nome}</p><p className="mt-1 text-xs text-slate-500">Custo: {moeda(produto.custo)} • Margem: <strong>{margemTexto(produto.custo, precoUnit)}</strong>{produto.preco_minimo != null ? ` • Mínimo: ${moeda(produto.preco_minimo)}` : ''}</p></div>
                  <label className="text-xs text-slate-500">Preço unitário<input type="number" step="any" min="0" value={precoUnit} onChange={e => mudarPreco(produto.id, e.target.value)} className="mt-1 block w-32 rounded-lg border border-slate-300 px-3 py-2 text-right text-sm" /></label>
                  <div className="flex items-center gap-2"><button onClick={() => decrementar(produto.id)} className="rounded-lg border border-slate-200 p-2"><Minus size={14}/></button><span className="w-8 text-center text-sm font-semibold">{quantidade}</span><button onClick={() => adicionar(produto)} className="rounded-lg border border-slate-200 p-2"><Plus size={14}/></button></div>
                  <strong className="w-28 text-right text-sm">{moeda(precoUnit * quantidade)}</strong>
                  <button onClick={() => remover(produto.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={16}/></button>
                </div>
                {abaixo ? <p className="mt-2 flex items-center gap-1 text-xs font-medium text-red-600"><AlertTriangle size={13}/>Preço abaixo do mínimo permitido.</p> : null}
              </div>
            })}
            <div className="flex justify-end border-t border-slate-200 pt-3 text-base font-bold text-slate-800">Total: {moeda(totalCarrinho)}</div>
          </div>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-800">Dados do cliente</h2><p className="text-xs text-slate-500">Encontre um cliente existente por nome, apelido, cidade, bairro, telefone, CPF/CNPJ ou endereço.</p></div>{clienteSelecionadoId ? <button onClick={limparCliente} className="inline-flex items-center gap-1 text-xs font-semibold text-red-500"><X size={13}/>Trocar cliente</button> : null}</div>
          <div className="relative mb-4">
            <BuscaAtlasInput value={clienteBusca} onValueChange={valor => { setClienteBusca(valor); if (clienteSelecionadoId) setClienteSelecionadoId(null) }} placeholder="Buscar cliente em todo o cadastro..." inputClassName="w-full rounded-lg border border-slate-200 py-2.5 pr-3 text-sm" />
            {!clienteSelecionadoId && clientesEncontrados.length > 0 && <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border bg-white shadow-xl">{clientesEncontrados.map(c => <button key={c.id} type="button" onClick={() => selecionarCliente(c)} className="block w-full border-b px-3 py-2.5 text-left hover:bg-slate-50"><div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><UserCheck size={14}/>{c.nome}{c.apelido ? <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] text-sky-700">{c.apelido}</span> : null}</div><div className="mt-0.5 text-xs text-slate-500">{[c.cidade,c.bairro,c.whatsapp||c.telefone,c.cpf_cnpj].filter(Boolean).join(' • ')}</div></button>)}</div>}
          </div>
          {clienteSelecionadoId ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">Cliente existente selecionado. O orçamento será vinculado ao mesmo cadastro do Atlas.</div> : clienteBusca.trim().length >= 2 && clientesEncontrados.length === 0 ? <div className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Nenhum cliente encontrado. Preencha os dados abaixo para cadastrar junto com o orçamento.</div> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-600">Nome *<input value={clienteNome} onChange={e => setClienteNome(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="text-xs text-slate-600">Apelido<input value={clienteApelido} onChange={e => setClienteApelido(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Nome pelo qual é conhecido" /></label>
            <label className="text-xs text-slate-600">Cidade<input value={clienteCidade} onChange={e => setClienteCidade(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="text-xs text-slate-600">Bairro<input value={clienteBairro} onChange={e => setClienteBairro(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="text-xs text-slate-600">WhatsApp<input value={clienteWhatsapp} onChange={e => setClienteWhatsapp(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="text-xs text-slate-600">Telefone<input value={clienteTelefone} onChange={e => setClienteTelefone(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="text-xs text-slate-600">E-mail<input value={clienteEmail} onChange={e => setClienteEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="text-xs text-slate-600">CPF/CNPJ<input value={clienteCpfCnpj} onChange={e => setClienteCpfCnpj(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="text-xs text-slate-600 sm:col-span-2">Endereço<input value={clienteEndereco} onChange={e => setClienteEndereco(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="text-xs text-slate-600">CEP<input value={clienteCep} onChange={e => setClienteCep(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <label className="text-sm font-semibold text-slate-800">Condições / observações<textarea value={condicoes} onChange={e => setCondicoes(e.target.value)} className="mt-2 h-28 w-full resize-none rounded-xl border border-slate-200 p-3 text-sm" /></label>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600"><label><input type="checkbox" checked={mostrarFoto} onChange={e => setMostrarFoto(e.target.checked)} className="mr-1"/>Mostrar foto no PDF</label><label><input type="checkbox" checked={mostrarPrecoUnitario} onChange={e => setMostrarPrecoUnitario(e.target.checked)} className="mr-1"/>Mostrar preço unitário</label></div>
        </section>

        {mensagem ? <div className={`rounded-xl border p-3 text-sm ${mensagem.tipo === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>{mensagem.texto}</div> : null}
        <button onClick={salvarEGerarPdf} disabled={salvando} className="w-full rounded-xl bg-brand-navy px-4 py-3 font-semibold text-white disabled:opacity-50">{salvando ? 'Salvando...' : 'Salvar orçamento e gerar PDF'}</button>
      </main>
    </div>
  )
}
