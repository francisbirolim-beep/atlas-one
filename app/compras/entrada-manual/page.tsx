'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Boxes, Building2, CheckCircle2, ClipboardList, ImageOff, Loader2, PackageCheck, Plus, Search, Trash2 } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Produto = { id: string; codigo: string | null; nome: string; unidade: string | null; custo: number | null; foto_url: string | null; categoria?: string | null }
type Cliente = { id: string; nome: string; cidade?: string | null }
type Obra = { id: string; nome: string; numero?: number | null; status?: string }
type Local = { id: string; nome: string; codigo: string }
type Item = { produto: Produto; quantidade: string; custoUnitario: string }
type Destino = 'obra' | 'estoque'
type Historico = { id: string; fornecedor_nome: string; numero_romaneio: string; data_documento: string; destino: Destino; created_at: string; criado_por_nome: string }
type HistoricoItem = { id: string; entrada_id: string; descricao: string; quantidade: number; unidade: string | null; produto?: { foto_url?: string | null; codigo?: string | null } | null }

const numeroBR = (s: string) => { const v = s.trim(); return Number(v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v) }
const moeda = (n: number | null) => n === null ? '' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
function Foto({ src, nome }: { src?: string | null; nome: string }) {
  return src
    ? <img src={src} alt={nome} loading="lazy" className="h-14 w-14 shrink-0 rounded-lg border bg-white object-contain"/>
    : <span title="Imagem do produto não cadastrada" className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-dashed bg-slate-50 text-[9px] text-slate-400"><ImageOff size={16}/>Sem foto</span>
}
function Campo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-700">{titulo}<div className="mt-1">{children}</div></label>
}
const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
const diaHoje = () => {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

export default function EntradaManualPage() {
  const [destino, setDestino] = useState<Destino>('obra')
  const [fornecedor, setFornecedor] = useState('')
  const [numeroRomaneio, setNumeroRomaneio] = useState('')
  const [dataDocumento, setDataDocumento] = useState(diaHoje)
  const [observacoes, setObservacoes] = useState('')
  const [clienteBusca, setClienteBusca] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [obras, setObras] = useState<Obra[]>([])
  const [obraId, setObraId] = useState('')
  const [locais, setLocais] = useState<Local[]>([])
  const [localId, setLocalId] = useState('')
  const [produtoBusca, setProdutoBusca] = useState('')
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [itens, setItens] = useState<Item[]>([])
  const [salvando, setSalvando] = useState(false)
  const [permissao, setPermissao] = useState(false)
  const [consultando, setConsultando] = useState(true)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState<{ entradaId: string; duplicado?: boolean; itensRegistrados?: number } | null>(null)
  const [chaveIdempotencia, setChaveIdempotencia] = useState('')
  const [historico, setHistorico] = useState<Historico[]>([])
  const [historicoItens, setHistoricoItens] = useState<HistoricoItem[]>([])

  const consultar = useCallback(async (params: Record<string, string>) => {
    const token = await tokenAtual()
    if (!token) throw new Error('Faça login novamente para continuar.')
    const res = await fetch('/api/compras/entrada-manual?' + new URLSearchParams(params), {
      cache: 'no-store', headers: { Authorization: `Bearer ${token}` },
    })
    const dados = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(dados.error || 'Falha ao consultar dados.')
    return dados
  }, [])

  useEffect(() => {
    let ativo = true
    Promise.all([consultar({ tipo: 'permissoes' }), consultar({ tipo: 'locais' })])
      .then(([a, b]) => {
        if (!ativo) return
        setPermissao(Boolean(a.podeReceber))
        setLocais(b.locais || [])
        if (b.locais?.length === 1) setLocalId(b.locais[0].id)
      }).catch(e => { if (ativo) setErro(e.message) })
      .finally(() => { if (ativo) setConsultando(false) })
    return () => { ativo = false }
  }, [consultar])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const clienteId = params.get('cliente') || ''
    const obra = params.get('obra') || ''
    if (!/^[0-9a-f-]{36}$/i.test(clienteId) || !/^[0-9a-f-]{36}$/i.test(obra)) return
    let ativo = true
    consultar({ tipo: 'clientePorId', clienteId }).then(r => {
      if (!ativo || !r.cliente) return
      setCliente(r.cliente); setClienteBusca(r.cliente.nome); setObraId(obra); setDestino('obra')
    }).catch(() => {})
    return () => { ativo = false }
  }, [consultar])

  useEffect(() => {
    if (cliente || clienteBusca.trim().length < 3) { setClientes([]); return }
    let ativo = true
    const t = setTimeout(() => {
      consultar({ tipo: 'clientes', q: clienteBusca }).then(r => { if (ativo) setClientes(r.clientes || []) })
        .catch(e => { if (ativo) setErro(e.message) })
    }, 250)
    return () => { ativo = false; clearTimeout(t) }
  }, [clienteBusca, cliente, consultar])

  useEffect(() => {
    if (!cliente) { setObras([]); setObraId(''); return }
    let ativo = true
    consultar({ tipo: 'obras', clienteId: cliente.id })
      .then(r => { if (ativo) setObras(r.obras || []) })
      .catch(e => { if (ativo) setErro(e.message) })
    return () => { ativo = false }
  }, [cliente, consultar])

  useEffect(() => {
    if (produtoBusca.trim().length < 2) { setProdutos([]); return }
    let ativo = true
    const t = setTimeout(() => {
      consultar({ tipo: 'produtos', q: produtoBusca })
        .then(r => { if (ativo) setProdutos(r.produtos || []) })
        .catch(e => { if (ativo) setErro(e.message) })
    }, 250)
    return () => { ativo = false; clearTimeout(t) }
  }, [produtoBusca, consultar])

  useEffect(() => {
    const params: Record<string, string> | null = destino === 'obra'
      ? obraId ? { tipo: 'historico', obraId } : null
      : { tipo: 'historico', destino: 'estoque' }
    if (!params) { setHistorico([]); setHistoricoItens([]); return }
    let ativo = true
    consultar(params).then(r => {
      if (ativo) { setHistorico(r.entradas || []); setHistoricoItens(r.itens || []) }
    }).catch(() => { if (ativo) { setHistorico([]); setHistoricoItens([]) } })
    return () => { ativo = false }
  }, [destino, obraId, sucesso, consultar])

  function adicionarProduto(p: Produto) {
    setErro('')
    setItens(lista => {
      const index = lista.findIndex(x => x.produto.id === p.id)
      if (index !== -1) return lista.map((x, i) => i === index ? { ...x, quantidade: String(numeroBR(x.quantidade) + 1) } : x)
      return [...lista, { produto: p, quantidade: '1', custoUnitario: moeda(p.custo) }]
    })
    setProdutoBusca('')
    setProdutos([])
  }
  function alterarItem(index: number, campo: 'quantidade' | 'custoUnitario', valor: string) {
    setItens(lista => lista.map((x, i) => i === index ? { ...x, [campo]: valor } : x))
  }
  function trocarDestino(d: Destino) {
    setDestino(d)
    setErro('')
    setSucesso(null)
    setChaveIdempotencia('')
  }
  function limpar() {
    setFornecedor(''); setNumeroRomaneio(''); setDataDocumento(diaHoje()); setObservacoes('')
    setCliente(null); setClienteBusca(''); setObraId('')
    setItens([]); setProdutoBusca(''); setErro(''); setSucesso(null); setChaveIdempotencia('')
  }
  async function salvar() {
    setErro('')
    if (!fornecedor.trim() || !numeroRomaneio.trim() || !dataDocumento) return setErro('Preencha fornecedor, número e data do romaneio.')
    if (destino === 'obra' && (!cliente || !obraId)) return setErro('Selecione o cliente e a obra de destino.')
    if (destino === 'estoque' && !localId) return setErro('Escolha um Estoque Geral.')
    if (!itens.length) return setErro('Inclua pelo menos um produto.')
    if (itens.some(i => !Number.isFinite(numeroBR(i.quantidade)) || numeroBR(i.quantidade) <= 0
      || (i.custoUnitario.trim() !== '' && (!Number.isFinite(numeroBR(i.custoUnitario)) || numeroBR(i.custoUnitario) < 0)))) {
      return setErro('Confira as quantidades e os custos dos produtos.')
    }
    const chave = chaveIdempotencia || crypto.randomUUID()
    setChaveIdempotencia(chave)
    setSalvando(true)
    try {
      const token = await tokenAtual()
      if (!token) throw new Error('Sessão expirada.')
      const resposta = await fetch('/api/compras/entrada-manual', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destino, fornecedor, numeroRomaneio, dataDocumento, observacoes,
          clienteId: destino === 'obra' ? cliente?.id : null,
          obraId: destino === 'obra' ? obraId : null,
          localId: destino === 'estoque' ? localId : null,
          chaveIdempotencia: chave,
          itens: itens.map(i => ({
            produtoId: i.produto.id, quantidade: numeroBR(i.quantidade),
            custoUnitario: i.custoUnitario.trim() ? numeroBR(i.custoUnitario) : null,
          })),
        }),
      })
      const dados = await resposta.json().catch(() => ({}))
      if (!resposta.ok) throw new Error(dados.error || 'Falha ao confirmar entrada manual.')
      setSucesso(dados)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao salvar.') }
    finally { setSalvando(false) }
  }

  if (consultando) return <div className="p-10 text-sm text-slate-500"><Loader2 className="mr-2 inline animate-spin" size={17}/>Verificando acesso...</div>
  return <main className="min-h-screen bg-slate-50 px-4 py-7 text-slate-900">
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start gap-3">
        <Link href="/compras/entrada" className="mt-1 rounded-xl border bg-white p-2" aria-label="Voltar para entrada de nota fiscal"><ArrowLeft size={20}/></Link>
        <div><p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Compras · Recebimento</p><h1 className="text-2xl font-bold">Entrada Manual de Mercadorias</h1>
          <p className="mt-1 text-sm text-slate-500">Para produtos que chegaram com romaneio, sem nota fiscal. Não gera NF nem lançamento financeiro automático.</p>
          <p className="mt-2 text-xs text-amber-700">Se a nota fiscal dessa mesma entrega chegar depois, concilie com este romaneio antes de conferir a NF, para evitar uma segunda entrada física. A conciliação automática entre NF e romaneio ainda não está disponível.</p>
        </div>
      </div>
      {erro && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{erro}</div>}
      {!permissao ? <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600">Sua conta não está liberada para registrar recebimentos. Solicite a permissão ao Master.</div> : sucesso ? (
        <div className="rounded-2xl border border-emerald-200 bg-white p-7">
          <CheckCircle2 size={38} className="text-emerald-600"/>
          <h2 className="mt-3 text-xl font-semibold">Romaneio registrado com sucesso</h2>
          <p className="mt-2 text-sm text-slate-600">Documento {numeroRomaneio} · {fornecedor}. {sucesso.duplicado ? 'Este lançamento já havia sido registrado; nenhuma quantidade foi duplicada.' : destino === 'obra' ? 'Os itens foram vinculados diretamente à obra, sem somar no estoque geral.' : 'As quantidades foram adicionadas ao Estoque Geral.'}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {destino === 'obra' && <Link href={`/obras/${obraId}`} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Ver mercadoria na obra</Link>}
            {destino === 'estoque' && <Link href="/estoque" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Ver estoque</Link>}
            <button onClick={limpar} className="rounded-lg border px-4 py-2 text-sm font-semibold">Nova entrada manual</button>
          </div>
        </div>
      ) : <>
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold">1. Para onde chegou a mercadoria?</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => trocarDestino('obra')} className={`rounded-xl border-2 p-4 text-left ${destino === 'obra' ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}>
              <Building2 size={24} className="mb-2 text-blue-700"/><strong className="block">Cliente / Obra</strong><span className="mt-1 block text-xs text-slate-500">Vai aparecer dentro da obra escolhida. Não entra no estoque comum.</span>
            </button>
            <button type="button" onClick={() => trocarDestino('estoque')} className={`rounded-xl border-2 p-4 text-left ${destino === 'estoque' ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}>
              <Boxes size={24} className="mb-2 text-blue-700"/><strong className="block">Estoque Geral</strong><span className="mt-1 block text-xs text-slate-500">Aumenta o saldo disponível do estoque, sem vincular a cliente.</span>
            </button>
          </div>
          {destino === 'obra' ? <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Campo titulo="Cliente *"><div className="relative"><input className={input} value={cliente ? cliente.nome : clienteBusca} onChange={e => { setCliente(null); setClienteBusca(e.target.value); setObraId('') }} placeholder="Digite 3 letras do nome..." autoComplete="off"/>
              {!cliente && clientes.length > 0 && <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border bg-white shadow-xl">
                {clientes.map(c => <button key={c.id} onClick={() => { setCliente(c); setClienteBusca(c.nome); setClientes([]) }} className="block w-full border-b px-3 py-3 text-left text-sm hover:bg-blue-50">{c.nome}<span className="ml-2 text-xs text-slate-500">{c.cidade}</span></button>)}
              </div>}</div>
            </Campo>
            <Campo titulo="Obra do cliente *"><select value={obraId} disabled={!cliente} onChange={e => setObraId(e.target.value)} className={input}><option value="">Selecione a obra...</option>{obras.map(o => <option key={o.id} value={o.id}>{o.numero ? `#${o.numero} · ` : ''}{o.nome}</option>)}</select>
              {cliente && obras.length === 0 && <p className="mt-1 text-xs text-amber-700">Nenhuma obra localizada. Cadastre a obra antes de lançar.</p>}
            </Campo>
          </div> : <div className="mt-5"><Campo titulo="Local de Estoque Geral *"><select value={localId} onChange={e => setLocalId(e.target.value)} className={input}><option value="">Selecione o estoque...</option>{locais.map(l => <option key={l.id} value={l.id}>{l.nome} ({l.codigo})</option>)}</select>
            {locais.length === 0 && <p className="mt-2 text-xs text-amber-700">Nenhum Estoque Geral ativo cadastrado para a empresa.</p>}
          </Campo></div>}
        </section>
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold">2. Dados do romaneio</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Campo titulo="Fornecedor *"><input value={fornecedor} onChange={e => setFornecedor(e.target.value)} className={input} placeholder="Nome do fornecedor" maxLength={200}/></Campo>
            <Campo titulo="Número do romaneio *"><input value={numeroRomaneio} onChange={e => setNumeroRomaneio(e.target.value)} className={input} placeholder="Nº ou referência" maxLength={100}/></Campo>
            <Campo titulo="Data do documento *"><input type="date" value={dataDocumento} onChange={e => setDataDocumento(e.target.value)} className={input}/></Campo>
          </div>
          <div className="mt-4"><Campo titulo="Observações"><textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} className={input} placeholder="Conferência, avaria, lote, transporte..." maxLength={2000}/></Campo></div>
        </section>
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold">3. Produtos recebidos</h2>
          <p className="mt-1 text-xs text-slate-500">Pesquise por nome ou código. Cada perfil ou acessório mostra sua imagem cadastrada; cadastros sem foto são sinalizados.</p>
          <div className="relative mt-4">
            <Search size={18} className="absolute left-3 top-3 text-slate-400"/>
            <input value={produtoBusca} onChange={e => setProdutoBusca(e.target.value)} className={input + ' pl-10'} placeholder="Digite ao menos 2 letras ou o código do produto..."/>
            {produtos.length > 0 && <div className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border bg-white shadow-xl">
              {produtos.map(p => <button key={p.id} onClick={() => adicionarProduto(p)} className="flex w-full items-center gap-3 border-b p-3 text-left hover:bg-blue-50">
                <Foto src={p.foto_url} nome={p.nome}/><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{p.nome}</strong><span className="text-xs text-slate-500">{p.codigo || 'Sem código'} · {p.unidade || 'UN'}</span></span><Plus size={17}/></button>)}
            </div>}
          </div>
          {itens.length === 0 ? <div className="mt-5 rounded-xl border border-dashed px-4 py-7 text-center text-sm text-slate-500"><ClipboardList size={24} className="mx-auto mb-2"/>Nenhum produto incluído.</div> :
            <div className="mt-4 space-y-3">{itens.map((i, index) => <div key={i.produto.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-slate-50 p-3">
              <Foto src={i.produto.foto_url} nome={i.produto.nome}/>
              <div className="min-w-[130px] flex-1"><strong className="block text-sm">{i.produto.nome}</strong><span className="text-xs text-slate-500">{i.produto.codigo || 'Sem código'} · {i.produto.unidade || 'UN'}</span></div>
              <label className="text-xs text-slate-600">Quantidade *<input inputMode="decimal" value={i.quantidade} onChange={e => alterarItem(index, 'quantidade', e.target.value)} className={input + ' mt-1 w-28'}/></label>
              <label className="text-xs text-slate-600">Custo un. (R$)<input inputMode="decimal" value={i.custoUnitario} onChange={e => alterarItem(index, 'custoUnitario', e.target.value)} className={input + ' mt-1 w-28'}/></label>
              <button title="Remover item" onClick={() => setItens(lista => lista.filter((_, n) => n !== index))} className="mt-4 rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={17}/></button>
            </div>)}</div>}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-sm text-slate-600">{itens.length} produto(s). {destino === 'estoque' ? 'O saldo será atualizado uma única vez.' : 'A entrada será vinculada à obra sem gerar saldo geral.'}</p>
            <button disabled={salvando || itens.length === 0} onClick={salvar} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {salvando ? <Loader2 size={17} className="animate-spin"/> : <PackageCheck size={18}/>} {salvando ? 'Registrando...' : 'Confirmar entrada manual'}
            </button>
          </div>
        </section>
      </>}
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Histórico {destino === 'obra' ? 'desta obra' : 'do Estoque Geral'}</h2>
        {destino === 'obra' && !obraId ? <p className="mt-3 text-sm text-slate-500">Selecione uma obra para visualizar os romaneios recebidos.</p> : historico.length === 0 ? <p className="mt-3 text-sm text-slate-500">Nenhuma entrada manual registrada.</p> :
        <div className="mt-4 space-y-3">{historico.map(h => <div key={h.id} className="rounded-xl border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">Romaneio {h.numero_romaneio} · {h.fornecedor_nome}</strong><span className="text-xs text-slate-500">{new Date(h.data_documento + 'T12:00:00').toLocaleDateString('pt-BR')} · {h.criado_por_nome}</span></div>
          <div className="mt-2 flex flex-wrap gap-2">{historicoItens.filter(i => i.entrada_id === h.id).map(i => <div key={i.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5 text-xs">
            <Foto src={i.produto?.foto_url} nome={i.descricao}/><span>{i.descricao} · <strong>{Number(i.quantidade).toLocaleString('pt-BR')} {i.unidade || 'UN'}</strong></span>
          </div>)}</div>
        </div>)}</div>}
      </section>
    </div>
  </main>
}
