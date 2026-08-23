'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Minus, Plus, Search, Trash2 } from 'lucide-react'
import { listarProdutos, CATEGORIAS_PRODUTO } from '@/lib/produtos'
import { lerConfiguracaoOrcamento, lerDadosEmpresa, type ConfiguracaoOrcamento } from '@/lib/configGeral'
import { criarOrcamentoBalcao } from '@/lib/orcamentoBalcao'
import { gerarPdfOrcamentoBalcao } from '@/lib/pdfOrcamentoBalcao'
import { usuarioAtual } from '@/lib/auth'
import { Produto, CategoriaProduto, ItemBalcao, DadosEmpresa } from '@/lib/tipos'
import { abaixoDoPrecoMinimo, margemRealPorPreco, precoVendaBalcao } from '@/lib/precificacaoBalcao'

type ProdutoBalcao = Produto & {
  preco_minimo?: number | null
  preco_promocional?: number | null
  ultimo_preco_vendido?: number | null
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
  const [empresa, setEmpresa] = useState<DadosEmpresa | null>(null)
  const [configOrcamento, setConfigOrcamento] = useState<ConfiguracaoOrcamento | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState<CategoriaProduto | 'todas'>('todas')
  const [carrinho, setCarrinho] = useState<Record<string, LinhaCarrinho>>({})

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
      setProdutos((listaProdutos as ProdutoBalcao[]).filter(p => Boolean(p.unidade?.trim()) && p.ativo))
      setEmpresa(dadosEmpresa)
      setConfigOrcamento(config)
      setMostrarFoto(config.mostrarFoto)
      setMostrarPrecoUnitario(config.mostrarPrecoUnitario)
      setCondicoes(dadosEmpresa?.condicoesPadrao || config.observacaoPadrao || '')
      setCarregando(false)
    }
    carregar()
  }, [])

  const produtosFiltrados = useMemo(() => produtos.filter(p => {
    const q = busca.trim().toLowerCase()
    const bateBusca = !q || `${p.codigo || ''} ${p.nome} ${p.descricao || ''}`.toLowerCase().includes(q)
    const bateCategoria = categoria === 'todas' || p.categoria === categoria
    return bateBusca && bateCategoria
  }), [produtos, busca, categoria])

  const itensCarrinho = useMemo(() => Object.entries(carrinho)
    .filter(([, linha]) => linha.quantidade > 0)
    .map(([produtoId, linha]) => {
      const produto = produtos.find(p => p.id === produtoId)
      return produto ? { produto, ...linha } : null
    })
    .filter(Boolean) as Array<{ produto: ProdutoBalcao; quantidade: number; precoUnit: number }>, [carrinho, produtos])

  const totalCarrinho = itensCarrinho.reduce((s, it) => s + it.precoUnit * it.quantidade, 0)

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
    if (!clienteNome.trim()) return setMensagem({ tipo: 'erro', texto: 'Informe o nome do cliente.' })
    if (!itensCarrinho.length) return setMensagem({ tipo: 'erro', texto: 'Adicione ao menos um produto.' })

    const invalido = itensCarrinho.find(it => it.precoUnit <= 0)
    if (invalido) return setMensagem({ tipo: 'erro', texto: `Informe um preço válido para ${invalido.produto.nome}.` })

    const abaixo = itensCarrinho.find(it => abaixoDoPrecoMinimo(it.produto, it.precoUnit))
    if (abaixo) {
      return setMensagem({
        tipo: 'erro',
        texto: `${abaixo.produto.nome}: ${moeda(abaixo.precoUnit)} está abaixo do preço mínimo ${moeda(abaixo.produto.preco_minimo)}.`,
      })
    }

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

    setMensagem({ tipo: 'ok', texto: 'Orçamento balcão salvo e preço praticado registrado no histórico do produto.' })
    setTimeout(() => router.push('/kanban'), 1800)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight pb-24">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-4">
          <Link href="/orcamento/novo" className="rounded-lg p-2 transition hover:bg-slate-100"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Venda / Orçamento Balcão</h1>
            <p className="text-sm text-slate-500">Preço de venda próprio do produto, sem interferir no custo das tipologias.</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <strong>Regra:</strong> tipologias usam <strong>custo técnico</strong>. Aqui a venda avulsa usa preço normal/promocional e mostra a margem real. Preço abaixo do mínimo é bloqueado.
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Produtos</h2>
          <div className="mb-3 flex items-center gap-2">
            <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar código, produto ou descrição..." className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm" /></div>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <button onClick={() => setCategoria('todas')} className={`rounded-full px-3 py-1.5 text-xs font-medium ${categoria === 'todas' ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-600'}`}>Todas</button>
            {CATEGORIAS_PRODUTO.map(cat => <button key={cat.valor} onClick={() => setCategoria(cat.valor)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${categoria === cat.valor ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-600'}`}>{cat.label}</button>)}
          </div>

          {carregando ? <p className="text-sm text-slate-400">Carregando produtos...</p> : (
            <div className="max-h-[420px] space-y-2 overflow-y-auto">
              {produtosFiltrados.map(produto => {
                const precoInicial = precoVendaBalcao(produto)
                const promo = Number(produto.preco_promocional) > 0
                return <div key={produto.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 hover:bg-slate-50">
                  {produto.foto_url ? <img src={produto.foto_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" /> : <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-100" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{produto.codigo ? `${produto.codigo} — ` : ''}{produto.nome}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500">
                      <span>{promo ? 'Promocional' : 'Preço'}: <strong>{moeda(precoInicial)}</strong> / {produto.unidade}</span>
                      {produto.custo != null ? <span>Margem: <strong>{margemTexto(produto.custo, precoInicial)}</strong></span> : null}
                      {produto.preco_minimo != null ? <span>Mínimo: {moeda(produto.preco_minimo)}</span> : null}
                    </div>
                  </div>
                  <button disabled={precoInicial <= 0} onClick={() => adicionar(produto)} className="rounded-lg bg-brand-navyLight p-2 text-brand-navy transition hover:bg-brand-navy hover:text-white disabled:opacity-30"><Plus size={16} /></button>
                </div>
              })}
              {!produtosFiltrados.length ? <p className="py-5 text-center text-sm text-slate-400">Nenhum produto encontrado.</p> : null}
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
                  <div className="min-w-[220px] flex-1"><p className="text-sm font-semibold text-slate-800">{produto.codigo ? `${produto.codigo} — ` : ''}{produto.nome}</p><p className="mt-1 text-xs text-slate-500">Custo: {moeda(produto.custo)} • Margem nesta venda: <strong>{margemTexto(produto.custo, precoUnit)}</strong>{produto.preco_minimo != null ? ` • Mínimo: ${moeda(produto.preco_minimo)}` : ''}</p></div>
                  <label className="text-xs text-slate-500">Preço unitário<input type="number" step="any" min="0" value={precoUnit} onChange={e => mudarPreco(produto.id, e.target.value)} className="mt-1 block w-32 rounded-lg border border-slate-300 px-3 py-2 text-right text-sm" /></label>
                  <div className="flex items-center gap-1"><button onClick={() => decrementar(produto.id)} className="rounded-md border bg-white p-1.5"><Minus size={14} /></button><span className="w-8 text-center text-sm font-medium">{quantidade}</span><button onClick={() => adicionar(produto)} className="rounded-md border bg-white p-1.5"><Plus size={14} /></button></div>
                  <div className="w-28 text-right text-sm font-bold text-slate-800">{moeda(precoUnit * quantidade)}</div>
                  <button onClick={() => remover(produto.id)} className="rounded-md p-1.5 text-red-500 hover:bg-red-100"><Trash2 size={16} /></button>
                </div>
                {abaixo ? <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-red-700"><AlertTriangle size={14} />Preço abaixo do mínimo cadastrado. A venda não poderá ser salva.</div> : null}
              </div>
            })}
            <div className="flex items-center justify-between border-t border-slate-200 pt-3"><span className="font-semibold text-slate-800">Total</span><span className="text-xl font-bold text-brand-navy">{moeda(totalCarrinho)}</span></div>
          </div>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Dados do cliente</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Nome *" value={clienteNome} onChange={setClienteNome} />
            <Campo label="Cidade" value={clienteCidade} onChange={setClienteCidade} />
            <Campo label="WhatsApp" value={clienteWhatsapp} onChange={setClienteWhatsapp} />
            <Campo label="Telefone" value={clienteTelefone} onChange={setClienteTelefone} />
            <Campo label="E-mail" value={clienteEmail} onChange={setClienteEmail} />
            <Campo label="CPF/CNPJ" value={clienteCpfCnpj} onChange={setClienteCpfCnpj} />
            <div className="sm:col-span-2"><Campo label="Endereço" value={clienteEndereco} onChange={setClienteEndereco} /></div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <label className="block text-xs font-medium text-slate-600">Condições / observações<textarea value={condicoes} onChange={e => setCondicoes(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600"><label><input type="checkbox" checked={mostrarFoto} onChange={e => setMostrarFoto(e.target.checked)} className="mr-1" />Mostrar fotos</label><label><input type="checkbox" checked={mostrarPrecoUnitario} onChange={e => setMostrarPrecoUnitario(e.target.checked)} className="mr-1" />Mostrar preço unitário</label></div>
        </section>

        {mensagem ? <div className={`rounded-xl border p-4 text-sm ${mensagem.tipo === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>{mensagem.texto}</div> : null}
        <button onClick={salvarEGerarPdf} disabled={salvando || !itensCarrinho.length} className="w-full rounded-xl bg-brand-navy py-3 font-semibold text-white disabled:opacity-50">{salvando ? 'Salvando...' : 'Salvar orçamento e gerar PDF'}</button>
      </main>
    </div>
  )
}

function Campo({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label className="block text-xs font-medium text-slate-600">{label}<input value={value} onChange={e => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
}
