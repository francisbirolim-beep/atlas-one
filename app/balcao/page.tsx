'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Banknote, Calculator, CreditCard, History, Loader2, PackageSearch, Plus, Search, ShoppingCart, Trash2, UserPlus, WalletCards } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Produto = {
  id:string; codigo:string; nome:string; descricao?:string|null; unidade:string; estoque:number; unidadeEstoque:string;
  preco:number; precoPromocional?:number|null; precoEfetivo:number; fotoUrl?:string|null;
  custo?:number|null; margem?:number|null; precoMinimo?:number|null
}
type Cliente = { id:string; nome:string; cpf_cnpj?:string|null; telefone?:string|null; whatsapp?:string|null; cidade?:string|null }
type ItemCarrinho = Produto & { quantidade:number; precoUnitario:number }
type Pagamento = { forma:string; valor:string; parcelas:number }
type Caixa = { id:string; status:string; aberto_em:string; saldo_inicial:number; operador_nome:string }

const formas = [
  ['pix','PIX'],['dinheiro','Dinheiro'],['cartao_debito','Cartão débito'],['cartao_credito','Cartão crédito'],['boleto','Boleto'],['a_prazo','A prazo'],['outros','Outros'],
]
function moeda(n:number){return n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function num(s:string){const n=Number(String(s).replace(',','.'));return Number.isFinite(n)?n:0}

export default function VendaBalcaoPage(){
  const [produtos,setProdutos]=useState<Produto[]>([])
  const [busca,setBusca]=useState('')
  const [carregando,setCarregando]=useState(true)
  const [podeVerGestao,setPodeVerGestao]=useState(false)
  const [carrinho,setCarrinho]=useState<Record<string,ItemCarrinho>>({})
  const [clienteBusca,setClienteBusca]=useState('')
  const [clientes,setClientes]=useState<Cliente[]>([])
  const [cliente,setCliente]=useState<Cliente|null>(null)
  const [desconto,setDesconto]=useState('0')
  const [pagamentos,setPagamentos]=useState<Pagamento[]>([{forma:'pix',valor:'',parcelas:1}])
  const [caixa,setCaixa]=useState<Caixa|null>(null)
  const [salvando,setSalvando]=useState(false)
  const [erro,setErro]=useState('')
  const [sucesso,setSucesso]=useState<{numero:number;total:number}|null>(null)

  async function api(url:string,init?:RequestInit){const t=await tokenAtual();if(!t)throw new Error('Sessão expirada.');return fetch(url,{...init,headers:{...(init?.headers||{}),Authorization:`Bearer ${t}`}})}
  async function carregarProdutos(q=''){
    setCarregando(true)
    try{const r=await api(`/api/balcao/catalogo?tipo=produtos&q=${encodeURIComponent(q)}`);const j=await r.json();if(!r.ok)throw new Error(j.error);setProdutos(j.produtos||[]);setPodeVerGestao(!!j.podeVerGestao)}catch(e){setErro(e instanceof Error?e.message:'Erro ao carregar produtos.')}finally{setCarregando(false)}
  }
  async function carregarCaixa(){try{const r=await api('/api/balcao/caixa');const j=await r.json();if(r.ok)setCaixa(j.caixa||null)}catch{}}
  useEffect(()=>{carregarProdutos();carregarCaixa()},[])
  useEffect(()=>{const h=setTimeout(()=>carregarProdutos(busca),300);return()=>clearTimeout(h)},[busca])
  useEffect(()=>{if(!clienteBusca.trim()){setClientes([]);return}const h=setTimeout(async()=>{try{const r=await api(`/api/balcao/catalogo?tipo=clientes&q=${encodeURIComponent(clienteBusca)}`);const j=await r.json();if(r.ok)setClientes(j.clientes||[])}catch{}},300);return()=>clearTimeout(h)},[clienteBusca])

  const itens=Object.values(carrinho)
  const subtotal=itens.reduce((s,i)=>s+i.quantidade*i.precoUnitario,0)
  const descontoN=Math.min(subtotal,Math.max(0,num(desconto)))
  const total=Math.max(0,subtotal-descontoN)
  const pagos=pagamentos.reduce((s,p)=>s+num(p.valor),0)
  const falta=Math.round((total-pagos)*100)/100

  function adicionar(p:Produto){if(p.estoque<=0)return;setCarrinho(c=>{const atual=c[p.id];const qtd=Math.min(p.estoque,(atual?.quantidade||0)+1);return{...c,[p.id]:atual?{...atual,quantidade:qtd}:{...p,quantidade:1,precoUnitario:p.precoEfetivo}}})}
  function qtd(id:string,v:number){setCarrinho(c=>{const i=c[id];if(!i)return c;if(v<=0){const n={...c};delete n[id];return n}return{...c,[id]:{...i,quantidade:Math.min(i.estoque,v)}}})}
  function preco(id:string,v:string){setCarrinho(c=>{const i=c[id];return i?{...c,[id]:{...i,precoUnitario:Math.max(0,num(v))}}:c})}
  function remover(id:string){setCarrinho(c=>{const n={...c};delete n[id];return n})}
  function atualizarPagamento(i:number,k:keyof Pagamento,v:string|number){setPagamentos(p=>p.map((x,n)=>n===i?{...x,[k]:v}:x))}
  function preencherRestante(i:number){setPagamentos(p=>p.map((x,n)=>n===i?{...x,valor:String(Math.max(0,Math.round((total-(p.reduce((s,y,idx)=>idx===i?s:s+num(y.valor),0)))*100)/100))}:x))}

  async function finalizar(){setErro('');setSucesso(null);if(!caixa)return setErro('Abra o caixa antes de finalizar a venda.');if(!itens.length)return setErro('Adicione pelo menos um produto.');if(Math.abs(falta)>0.01)return setErro(`Os pagamentos precisam fechar o total. Diferença: ${moeda(falta)}`);setSalvando(true)
    try{const r=await api('/api/balcao/vendas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clienteId:cliente?.id||null,clienteNome:cliente?.nome||null,desconto:descontoN,itens:itens.map(i=>({produtoId:i.id,quantidade:i.quantidade,precoUnitario:i.precoUnitario})),pagamentos:pagamentos.map(p=>({forma:p.forma,valor:num(p.valor),parcelas:p.parcelas}))})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Não foi possível finalizar.');setSucesso({numero:Number(j.numero),total:Number(j.total)});setCarrinho({});setDesconto('0');setPagamentos([{forma:'pix',valor:'',parcelas:1}]);setCliente(null);setClienteBusca('');await carregarProdutos(busca);await carregarCaixa()}catch(e){setErro(e instanceof Error?e.message:'Erro ao finalizar a venda.')}finally{setSalvando(false)}}

  return <main className="min-h-screen bg-slate-50 p-4 sm:p-6"><div className="mx-auto max-w-[1500px] space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.15em] text-slate-400">Venda Balcão</p><h1 className="text-2xl font-bold text-slate-900">Venda</h1><p className="text-sm text-slate-500">Venda rápida de produtos com estoque e financeiro integrados.</p></div><div className="flex gap-2"><Link href="/balcao/consulta-preco" className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold">Consulta de preço</Link><Link href="/balcao/historico" className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold"><History size={15} className="mr-1 inline"/>Histórico</Link><Link href="/balcao/caixa" className={`rounded-xl px-3 py-2 text-sm font-semibold ${caixa?'border border-emerald-300 bg-emerald-50 text-emerald-800':'bg-amber-500 text-white'}`}><WalletCards size={15} className="mr-1 inline"/>{caixa?'Caixa aberto':'Abrir caixa'}</Link></div></header>

    <nav className="grid gap-2 sm:grid-cols-3"><Link href="/balcao" className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4"><ShoppingCart className="text-emerald-700"/><strong className="mt-2 block">Venda</strong><span className="text-xs text-slate-500">Nova venda</span></Link><Link href="/orcamento/balcao/novo" className="rounded-2xl border bg-white p-4"><Calculator className="text-slate-500"/><strong className="mt-2 block">Orçamento</strong><span className="text-xs text-slate-500">Gerar orçamento sem baixar estoque</span></Link><Link href="/balcao/consulta-preco" className="rounded-2xl border bg-white p-4"><PackageSearch className="text-slate-500"/><strong className="mt-2 block">Consulta de preço</strong><span className="text-xs text-slate-500">Preço e disponibilidade</span></Link></nav>

    {erro&&<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
    {sucesso&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">Venda #{sucesso.numero} finalizada • {moeda(sucesso.total)}</div>}

    <section className="rounded-2xl border bg-white p-4"><div className="grid gap-3 lg:grid-cols-[1fr_auto]"><div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={cliente?cliente.nome:clienteBusca} onChange={e=>{setCliente(null);setClienteBusca(e.target.value)}} placeholder="Cliente opcional — nome, CPF/CNPJ ou telefone" className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm"/>{!cliente&&clientes.length>0&&<div className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-xl border bg-white shadow-lg">{clientes.map(c=><button key={c.id} onClick={()=>{setCliente(c);setClienteBusca(c.nome);setClientes([])}} className="block w-full border-b px-3 py-2 text-left text-sm hover:bg-slate-50"><strong>{c.nome}</strong><div className="text-xs text-slate-400">{c.cpf_cnpj||c.whatsapp||c.telefone||c.cidade||''}</div></button>)}</div>}</div><Link href="/clientes/novo" className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold"><UserPlus size={16}/>Novo cliente</Link></div></section>

    <div className="grid gap-4 xl:grid-cols-[1fr_430px]">
      <section className="rounded-2xl border bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">Adicionar produtos</h2><p className="text-xs text-slate-500">Busque por código, nome ou descrição.</p></div></div><div className="relative mt-3"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar produto..." className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm"/></div>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="p-2">Produto</th><th>Estoque</th>{podeVerGestao&&<th>Custo</th>}<th>Preço balcão</th>{podeVerGestao&&<th>Margem</th>}<th></th></tr></thead><tbody>{carregando?<tr><td className="p-6 text-center text-slate-400" colSpan={6}><Loader2 className="mx-auto animate-spin"/></td></tr>:produtos.map(p=><tr key={p.id} className="border-t"><td className="p-2"><div className="font-semibold">{p.codigo||'—'} <span className="font-normal text-slate-700">{p.nome}</span></div><div className="max-w-lg truncate text-xs text-slate-400">{p.descricao}</div></td><td><span className={`rounded-full px-2 py-1 text-xs ${p.estoque>0?'bg-emerald-50 text-emerald-700':'bg-red-50 text-red-600'}`}>{p.estoque} {p.unidadeEstoque}</span></td>{podeVerGestao&&<td>{p.custo==null?'—':moeda(p.custo)}</td>}<td><strong className="text-emerald-700">{moeda(p.precoEfetivo)}</strong>{p.precoPromocional!=null&&<div className="text-[10px] text-amber-600">promocional</div>}</td>{podeVerGestao&&<td>{p.margem==null?'—':`${p.margem.toFixed(1)}%`}</td>}<td className="text-right"><button disabled={p.estoque<=0} onClick={()=>adicionar(p)} className="rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-30"><Plus size={14} className="mr-1 inline"/>Adicionar</button></td></tr>)}</tbody></table></div>
      </section>

      <aside className="rounded-2xl border bg-white p-4"><div className="flex items-center justify-between"><h2 className="font-semibold">Itens da venda ({itens.length})</h2>{itens.length>0&&<button onClick={()=>setCarrinho({})} className="text-xs font-semibold text-red-500">Limpar tudo</button>}</div><div className="mt-3 max-h-[430px] space-y-2 overflow-auto">{!itens.length?<div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-400"><ShoppingCart className="mx-auto mb-2"/>Nenhum item adicionado</div>:itens.map(i=><div key={i.id} className="rounded-xl border p-3"><div className="flex justify-between gap-2"><div><div className="text-xs font-bold">{i.codigo}</div><div className="text-sm">{i.nome}</div><div className="text-xs text-slate-400">Estoque {i.estoque} {i.unidadeEstoque}</div></div><button onClick={()=>remover(i.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button></div><div className="mt-2 grid grid-cols-[90px_1fr_auto] items-end gap-2"><label className="text-[11px] text-slate-500">Qtde<input type="number" min="1" step="any" value={i.quantidade} onChange={e=>qtd(i.id,num(e.target.value))} className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm"/></label><label className="text-[11px] text-slate-500">Preço unit.<input type="number" step="0.01" value={i.precoUnitario} onChange={e=>preco(i.id,e.target.value)} className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm"/></label><strong className="pb-2 text-sm">{moeda(i.precoUnitario*i.quantidade)}</strong></div>{podeVerGestao&&i.custo!=null&&<div className="mt-2 text-[11px] text-slate-500">Custo {moeda(i.custo)} • margem desta linha {i.precoUnitario>0?(((i.precoUnitario-i.custo)/i.precoUnitario)*100).toFixed(1):'—'}%{i.precoMinimo!=null?` • mínimo ${moeda(i.precoMinimo)}`:''}</div>}</div>)}</div>
        <div className="mt-4 space-y-2 border-t pt-3 text-sm"><div className="flex justify-between"><span>Subtotal</span><strong>{moeda(subtotal)}</strong></div><label className="flex items-center justify-between gap-3"><span>Desconto (R$)</span><input value={desconto} onChange={e=>setDesconto(e.target.value)} className="w-28 rounded-lg border px-2 py-1.5 text-right"/></label><div className="flex justify-between text-lg"><strong>Total</strong><strong className="text-emerald-700">{moeda(total)}</strong></div></div>
        <div className="mt-4 border-t pt-3"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Pagamento</h3><button onClick={()=>setPagamentos(p=>[...p,{forma:'pix',valor:'',parcelas:1}])} className="text-xs font-semibold text-blue-700"><Plus size={13} className="inline"/> Dividir</button></div><div className="mt-2 space-y-2">{pagamentos.map((p,i)=><div key={i} className="grid grid-cols-[1fr_110px_44px] gap-2"><select value={p.forma} onChange={e=>atualizarPagamento(i,'forma',e.target.value)} className="rounded-lg border px-2 py-2 text-sm">{formas.map(f=><option key={f[0]} value={f[0]}>{f[1]}</option>)}</select><input type="number" step="0.01" value={p.valor} onFocus={()=>{if(!p.valor)preencherRestante(i)}} onChange={e=>atualizarPagamento(i,'valor',e.target.value)} placeholder="Valor" className="rounded-lg border px-2 py-2 text-sm"/><button disabled={pagamentos.length===1} onClick={()=>setPagamentos(x=>x.filter((_,n)=>n!==i))} className="rounded-lg border text-slate-400 disabled:opacity-20"><Trash2 size={14} className="mx-auto"/></button>{(p.forma==='cartao_credito'||p.forma==='boleto'||p.forma==='a_prazo')&&<label className="col-span-3 text-[11px] text-slate-500">Parcelas<input type="number" min="1" max="36" value={p.parcelas} onChange={e=>atualizarPagamento(i,'parcelas',Math.max(1,Number(e.target.value)||1))} className="ml-2 w-16 rounded border px-1 py-0.5"/></label>}</div>)}</div><div className={`mt-2 text-right text-xs ${Math.abs(falta)<=0.01?'text-emerald-700':'text-amber-700'}`}>{Math.abs(falta)<=0.01?'Pagamento fechado':falta>0?`Falta ${moeda(falta)}`:`Excede ${moeda(Math.abs(falta))}`}</div></div>
        <button onClick={finalizar} disabled={salvando||!caixa||!itens.length} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white disabled:opacity-40">{salvando?<Loader2 size={18} className="animate-spin"/>:<Banknote size={18}/>}Finalizar venda • {moeda(total)}</button>{!caixa&&<Link href="/balcao/caixa" className="mt-2 block text-center text-xs font-semibold text-amber-700">Abra o caixa para vender</Link>}
      </aside>
    </div>
  </div></main>
}
