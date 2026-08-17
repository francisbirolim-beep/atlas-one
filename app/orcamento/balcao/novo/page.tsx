'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Minus, Trash2, Search } from 'lucide-react'
import { listarProdutos, CATEGORIAS_PRODUTO } from '@/lib/produtos'
import { lerConfiguracaoOrcamento, lerDadosEmpresa, type ConfiguracaoOrcamento } from '@/lib/configGeral'
import { criarOrcamentoBalcao } from '@/lib/orcamentoBalcao'
import { gerarPdfOrcamentoBalcao } from '@/lib/pdfOrcamentoBalcao'
import { usuarioAtual } from '@/lib/auth'
import { Produto, CategoriaProduto, ItemBalcao, DadosEmpresa } from '@/lib/tipos'

export default function NovoOrcamentoBalcao() {
  const router = useRouter()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [empresa, setEmpresa] = useState<DadosEmpresa | null>(null)
  const [configOrcamento, setConfigOrcamento] = useState<ConfiguracaoOrcamento | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState<CategoriaProduto | 'todas'>('todas')
  const [carrinho, setCarrinho] = useState<Record<string, number>>({})

  const [clienteNome, setClienteNome] = useState('')
  const [clienteWhatsapp, setClienteWhatsapp] = useState('')
  const [clienteTelefone, setClienteTelefone] = useState('')
  const [clienteEmail, setClienteEmail] = useState('')
  const [clienteCpfCnpj, setClienteCpfCnpj] = useState('')
  const [clienteEndereco, setClienteEndereco] = useState('')
  const [clienteCidade, setClienteCidade] = useState('')

  const [condicoes, setCondicoes] = useState('')
  const [mostrarFoto, setMostrarFoto] = useState(true)
  const [mostrarPrecoUnitario, setMostrarPrecoUnitario] = useState(true)

  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  useEffect(() => {
    async function carregar() {
      const [listaProdutos, dadosEmpresa, config] = await Promise.all([
        listarProdutos(),
        lerDadosEmpresa(),
        lerConfiguracaoOrcamento(),
      ])
      setProdutos(listaProdutos.filter(p => Boolean(p.unidade?.trim())))
      setEmpresa(dadosEmpresa)
      setConfigOrcamento(config)
      setMostrarFoto(config.mostrarFoto)
      setMostrarPrecoUnitario(config.mostrarPrecoUnitario)
      setCondicoes(dadosEmpresa?.condicoesPadrao || config.observacaoPadrao || '')
      setCarregando(false)
    }
    carregar()
  }, [])

  const produtosFiltrados = useMemo(() => {
    return produtos.filter(p => {
      const bateBusca = !busca.trim() || p.nome.toLowerCase().includes(busca.trim().toLowerCase())
      const bateCategoria = categoria === 'todas' || p.categoria === categoria
      return bateBusca && bateCategoria
    })
  }, [produtos, busca, categoria])

  const itensCarrinho = useMemo(() => {
    return Object.entries(carrinho)
      .filter(([, qtd]) => qtd > 0)
      .map(([produtoId, quantidade]) => {
        const produto = produtos.find(p => p.id === produtoId)
        return produto ? { produto, quantidade } : null
      })
      .filter(Boolean) as { produto: Produto; quantidade: number }[]
  }, [carrinho, produtos])

  const totalCarrinho = itensCarrinho.reduce((soma, it) => soma + it.produto.preco * it.quantidade, 0)

  function adicionar(produtoId: string) {
    setCarrinho(c => ({ ...c, [produtoId]: (c[produtoId] || 0) + 1 }))
  }

  function decrementar(produtoId: string) {
    setCarrinho(c => {
      const atual = c[produtoId] || 0
      if (atual <= 1) {
        const { [produtoId]: _omit, ...resto } = c
        return resto
      }
      return { ...c, [produtoId]: atual - 1 }
    })
  }

  function remover(produtoId: string) {
    setCarrinho(c => {
      const { [produtoId]: _omit, ...resto } = c
      return resto
    })
  }

  async function salvarEGerarPdf() {
    setMensagem(null)
    if (!clienteNome.trim()) {
      setMensagem({ tipo: 'erro', texto: 'Informe o nome do cliente' })
      return
    }
    if (itensCarrinho.length === 0) {
      setMensagem({ tipo: 'erro', texto: 'Adicione ao menos um produto' })
      return
    }

    setSalvando(true)
    const itens: ItemBalcao[] = itensCarrinho.map(({ produto, quantidade }) => ({
      produto_id: produto.id,
      nome: produto.nome,
      categoria: produto.categoria,
      descricao: produto.descricao || null,
      foto_url: produto.foto_url || null,
      unidade: produto.unidade!,
      quantidade,
      preco_unit: produto.preco,
      preco_total: produto.preco * quantidade,
    }))

    const resultado = await criarOrcamentoBalcao({
      clienteNome,
      clienteWhatsapp: clienteWhatsapp || undefined,
      clienteTelefone: clienteTelefone || undefined,
      clienteEmail: clienteEmail || undefined,
      clienteCpfCnpj: clienteCpfCnpj || undefined,
      clienteEndereco: clienteEndereco || undefined,
      cidade: clienteCidade || undefined,
      itens,
      condicoes: condicoes || undefined,
    })

    if (!resultado.ok) {
      setMensagem({ tipo: 'erro', texto: resultado.error || 'Erro ao salvar orçamento' })
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

    setMensagem({ tipo: 'ok', texto: 'Orçamento salvo! Gerando PDF...' })
    setTimeout(() => router.push('/kanban'), 1800)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight pb-24">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/orcamento/novo" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Orçamento Balcão</h1>
            <p className="text-sm text-slate-500">Escolha os produtos e gere o PDF</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <section className="bg-white rounded-2xl border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Produtos</h2>
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar produto..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setCategoria('todas')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${categoria === 'todas' ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              Todas
            </button>
            {CATEGORIAS_PRODUTO.map(cat => (
              <button
                key={cat.valor}
                onClick={() => setCategoria(cat.valor)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${categoria === cat.valor ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {carregando ? (
            <p className="text-sm text-slate-400">Carregando produtos...</p>
          ) : produtosFiltrados.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum produto encontrado</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {produtosFiltrados.map(produto => (
                <div key={produto.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                  {produto.foto_url ? (
                    <img src={produto.foto_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{produto.nome}</p>
                    <p className="text-xs text-slate-500">R$ {produto.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / {produto.unidade}</p>
                  </div>
                  <button
                    onClick={() => adicionar(produto.id)}
                    className="p-2 rounded-lg bg-brand-navyLight text-brand-navy hover:bg-brand-navy hover:text-white transition"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Itens do orçamento</h2>
          {itensCarrinho.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum produto adicionado</p>
          ) : (
            <div className="space-y-2">
              {itensCarrinho.map(({ produto, quantidade }) => (
                <div key={produto.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{produto.nome}</p>
                    <p className="text-xs text-slate-500">
                      R$ {(produto.preco * quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => decrementar(produto.id)} className="p-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-100">
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-sm font-medium">{quantidade}</span>
                    <button onClick={() => adicionar(produto.id)} className="p-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-100">
                      <Plus size={14} />
                    </button>
                  </div>
                  <button onClick={() => remover(produto.id)} className="p-1.5 rounded-md text-red-500 hover:bg-red-50">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <span className="text-sm font-semibold text-slate-800">Total</span>
                <span className="text-base font-bold text-brand-navy">
                  R$ {totalCarrinho.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Dados do cliente</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nome *</label>
              <input
                value={clienteNome}
                onChange={e => setClienteNome(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">WhatsApp</label>
                <input value={clienteWhatsapp} onChange={e => setClienteWhatsapp(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Telefone</label>
                <input value={clienteTelefone} onChange={e => setClienteTelefone(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/30" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">E-mail</label>
                <input value={clienteEmail} onChange={e => setClienteEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">CPF/CNPJ</label>
                <input value={clienteCpfCnpj} onChange={e => setClienteCpfCnpj(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/30" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Endereço</label>
              <input value={clienteEndereco} onChange={e => setClienteEndereco(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cidade</label>
              <input value={clienteCidade} onChange={e => setClienteCidade(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/30" />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Condições e opções do PDF</h2>
              {configOrcamento && (
                <p className="mt-1 text-xs text-slate-400">Padrão Atlas: validade de {configOrcamento.validadeDias} dias. Você pode ajustar as opções deste orçamento antes de gerar.</p>
              )}
            </div>
            <Link href="/configuracoes/orcamento" className="text-xs font-semibold text-brand-navy hover:underline">Padrão</Link>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Forma de pagamento / Prazo de entrega</label>
              <textarea
                value={condicoes}
                onChange={e => setCondicoes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={mostrarFoto} onChange={e => setMostrarFoto(e.target.checked)} />
              Exibir foto dos produtos no PDF
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={mostrarPrecoUnitario} onChange={e => setMostrarPrecoUnitario(e.target.checked)} />
              Exibir preço unitário no PDF (o total sempre aparece)
            </label>
          </div>
        </section>

        {mensagem && (
          <div className={`p-3 rounded-lg text-sm ${mensagem.tipo === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {mensagem.texto}
          </div>
        )}

        <button
          onClick={salvarEGerarPdf}
          disabled={salvando}
          className="w-full py-3 rounded-xl bg-brand-navy text-white font-semibold hover:bg-brand-navy/90 transition disabled:opacity-50"
        >
          {salvando ? 'Salvando...' : 'Salvar orçamento e gerar PDF'}
        </button>
      </main>
    </div>
  )
}
