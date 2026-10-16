'use client'
import {useMemo,useState} from 'react'
import Link from 'next/link'
import {calcularPedidoMinimo} from '@/lib/comprasCotacaoAssistida'

type Carrinho={id:string;fornecedor_id:string;status:string;pedido_emitido_em:string|null;created_at:string}
type Linha={id:string;carrinho_id:string;item_id:string;quantidade_obra:number;quantidade_estoque:number;preco_unitario:number|null}
type Item={id:string;descricao:string;produto_id:string|null;cliente_id:string|null;obra_id:string|null;destino:'obra'|'estoque';foto_url:string|null}
type Fornecedor={id:string;nome:string;pedido_minimo:number|null}
type Produto={id:string;codigo:string|null;nome:string;foto_url:string|null}
type Cliente={id:string;nome:string}
type Obra={id:string;nome:string}
type FluxoProps={carrinhos:Carrinho[];linhas:Linha[];itens:Item[];fornecedores:Fornecedor[];produtos:Produto[];clientes:Cliente[];obras:Obra[];
 podeComprar:boolean;ocupado:boolean;onComprar:(id:string)=>void;onAdicionarMais:()=>void}
type Quadro='montagem'|'pronto'|'enviado'|'recebido'
const reais=(v:number)=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const dia=(s:string|null)=>s?new Date(s).toLocaleDateString('pt-BR'):'—'
const colunas:{id:Quadro;nome:string;cor:string}[]=[
 {id:'montagem',nome:'Em montagem',cor:'border-amber-200 bg-amber-50'},
 {id:'pronto',nome:'Pronto para enviar',cor:'border-emerald-200 bg-emerald-50'},
 {id:'enviado',nome:'Pedido emitido / aguardando chegar',cor:'border-blue-200 bg-blue-50'},
 {id:'recebido',nome:'Recebido',cor:'border-teal-200 bg-teal-50'}
]
export default function CarrinhosFluxoAprovado(p:FluxoProps){
 const [visao,setVisao]=useState<'fornecedor'|'cliente'|'lista'>('fornecedor')
 const [aberto,setAberto]=useState<string|null>(null)
 const dados=useMemo(()=>p.carrinhos.map(c=>{
  const f=p.fornecedores.find(x=>x.id===c.fornecedor_id)
  const linhas=p.linhas.filter(l=>l.carrinho_id===c.id)
  const sim=linhas.map(l=>({necessidadeId:l.item_id,descricao:p.itens.find(x=>x.id===l.item_id)?.descricao||'Material',fornecedorId:c.fornecedor_id,quantidadeObra:l.quantidade_obra,quantidadeEstoque:l.quantidade_estoque,precoUnitario:l.preco_unitario,unidade:'UN'}))
  const resumo=calcularPedidoMinimo(sim,{id:c.fornecedor_id,nome:f?.nome||'Fornecedor',pedido_minimo:f?.pedido_minimo??0})
  const estagio:Quadro=['recebido','recebido_parcial'].includes(c.status)?'recebido':
   ['pedido_emitido','aguardando_entrega'].includes(c.status)?'enviado':resumo.atingiuMinimo?'pronto':'montagem'
  const porcentagem=resumo.minimo<=0?100:Math.min(100,Math.round(resumo.subtotal/resumo.minimo*100))
  const cor=resumo.atingiuMinimo?'emerald':resumo.minimo>0&&resumo.subtotal>=resumo.minimo*.8?'amber':'red'
  return{...c,fornecedor:f?.nome||'Fornecedor',linhas,resumo,estagio,porcentagem,cor}
 }),[p.carrinhos,p.fornecedores,p.linhas,p.itens])
 const escolhido=dados.find(c=>c.id===aberto)||null
 const feitos=dados.filter(c=>['enviado','recebido'].includes(c.estagio))
 const registros=feitos.flatMap(c=>c.linhas.map(l=>({id:l.id,c,linha:l,item:p.itens.find(i=>i.id===l.item_id)})))
 const foto=(item:Item|undefined)=>item?.foto_url||p.produtos.find(prod=>prod.id===item?.produto_id)?.foto_url||null
 function cartao(c:typeof dados[number]){
  return <button type="button" onClick={()=>setAberto(c.id)} key={c.id}
   className={'w-full rounded-xl border border-l-4 bg-white p-3 text-left shadow-sm transition hover:shadow-md '+
   (c.cor==='emerald'?'border-l-emerald-500':c.cor==='amber'?'border-l-amber-500':'border-l-red-500')}>
   <div className="flex items-center justify-between gap-2"><strong className="text-sm">{c.fornecedor}</strong><span className="text-[10px] font-semibold text-slate-500">{c.linhas.length} produto(s)</span></div>
   <p className="mt-2 text-xs text-slate-700">Total: <b>{reais(c.resumo.subtotal)}</b> de {reais(c.resumo.minimo)}</p>
   {c.estagio==='montagem'||c.estagio==='pronto'?<p className={'mt-1 text-[11px] font-semibold '+(c.resumo.falta>0?'text-orange-700':'text-emerald-700')}>{c.resumo.falta>0?'Faltam '+reais(c.resumo.falta):'Pedido mínimo atingido'}</p>:
    <p className="mt-1 text-[11px] text-slate-500">{c.estagio==='recebido'?'Recebimento parcial ou total registrado':'Comprado em '+dia(c.pedido_emitido_em)}</p>}
   <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200"><div className={'h-full rounded-full '+(c.cor==='emerald'?'bg-emerald-500':c.cor==='amber'?'bg-amber-500':'bg-red-500')} style={{width:c.porcentagem+'%'}}/></div>
   <p className="mt-1 text-right text-[11px] text-slate-600">{c.porcentagem}% do mínimo · Ver pedido →</p>
  </button>
 }
 return <section className="rounded-2xl border bg-white p-5 shadow-sm" id="kanban-pedidos-fornecedor">
  <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Pedidos de Compra por Fornecedor</h2><p className="text-xs text-slate-500">Os pedidos são agrupados por fornecedor e fase. Verde significa apenas pedido mínimo atingido, não mercadoria recebida.</p></div>
   <div className="flex flex-wrap gap-1 rounded-xl border bg-slate-100 p-1 text-xs">{([['fornecedor','Por fornecedor'],['cliente','Por cliente / obra'],['lista','Lista']] as const).map(([v,t])=><button type="button" key={v} onClick={()=>{setVisao(v);setAberto(null)}} className={'rounded-lg px-3 py-2 font-semibold '+(visao===v?'bg-white text-blue-700 shadow':'text-slate-500')}>{t}</button>)}</div></div>
  {visao==='fornecedor'&&<div className="flex gap-3 overflow-x-auto pb-3">{colunas.map(col=>{
   const grupos=dados.filter(c=>c.estagio===col.id)
   return <div className={'min-w-[220px] flex-1 rounded-xl border p-2 '+col.cor} key={col.id}><div className="mb-3 flex justify-between gap-2 px-1 pt-1"><h3 className="text-xs font-bold">{col.nome}</h3><span className="rounded-full bg-white px-2 text-xs font-bold">{grupos.length}</span></div><div className="space-y-2">{grupos.map(cartao)}{!grupos.length&&<p className="rounded-lg border border-dashed bg-white/70 p-3 text-center text-xs text-slate-400">Nenhum pedido</p>}</div></div>
  })}</div>}
  {visao==='lista'&&<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{dados.map(cartao)}{!dados.length&&<p className="text-sm text-slate-500">Nenhum carrinho cadastrado. Comece pelas necessidades.</p>}</div>}
  {visao==='cliente'&&<div className="overflow-auto rounded-xl border"><table className="w-full min-w-[730px] text-left text-xs"><thead className="bg-slate-50"><tr>{['Data da compra','Cliente / Obra','Produto','Fornecedor','Quantidade obra','Quantidade estoque','Valor','Situação'].map(c=><th className="p-3" key={c}>{c}</th>)}</tr></thead><tbody>{registros.map(({id,c,linha,item})=><tr key={id} className="border-t"><td className="p-3">{dia(c.pedido_emitido_em)}</td><td className="p-3">{item?.cliente_id?<Link href={'/clientes/'+item.cliente_id} className="font-semibold text-blue-700 underline">{p.clientes.find(x=>x.id===item.cliente_id)?.nome||'Cliente'} / {p.obras.find(x=>x.id===item.obra_id)?.nome||'Obra'}</Link>:'Estoque'}</td><td className="p-3"><div className="flex items-center gap-2">{foto(item)?<img src={foto(item)||''} alt={item?.descricao||'Material'} className="h-9 w-9 rounded border object-contain"/>:<span className="flex h-9 w-9 items-center justify-center rounded border border-dashed text-[8px] text-amber-700">Sem foto</span>}{item?.descricao||'Produto'}</div></td><td className="p-3">{c.fornecedor}</td><td className="p-3">{linha.quantidade_obra}</td><td className="p-3">{linha.quantidade_estoque}</td><td className="p-3">{reais((linha.quantidade_obra+linha.quantidade_estoque)*Number(linha.preco_unitario||0))}</td><td className="p-3">{c.estagio==='recebido'?'Recebimento registrado':'Pedido comprado'}</td></tr>)}{!registros.length&&<tr><td colSpan={8} className="p-5 text-center text-slate-500">Ainda não há pedidos comprados para mostrar.</td></tr>}</tbody></table></div>}
  {escolhido&&<div className="mt-4 rounded-2xl border-2 border-blue-200 bg-blue-50/40 p-4" role="region" aria-label={'Carrinho do fornecedor '+escolhido.fornecedor}>
   <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-bold">Carrinho / Pedido — {escolhido.fornecedor}</h3><p className="text-xs text-slate-600">Pedido {escolhido.id.slice(0,8)} · {escolhido.estagio==='enviado'?'Comprado, aguardando entrega':escolhido.estagio==='recebido'?'Recebimento registrado':'Em montagem pelo comprador'}</p></div><button type="button" className="rounded-lg border bg-white px-3 py-2 text-xs" onClick={()=>setAberto(null)}>Fechar</button></div>
   <div className="mt-3 flex flex-wrap gap-4 rounded-xl border bg-white p-3 text-sm"><span>Pedido mínimo: <b>{reais(escolhido.resumo.minimo)}</b></span><span>Total atual: <b>{reais(escolhido.resumo.subtotal)}</b></span><span className={escolhido.resumo.falta>0?'font-bold text-orange-700':'font-bold text-emerald-700'}>{escolhido.resumo.falta>0?'Faltam '+reais(escolhido.resumo.falta):'Mínimo atingido'}</span></div>
   <div className="mt-3 overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[650px] text-left text-xs"><thead className="bg-slate-50"><tr>{['Foto / Produto','Cliente / Obra / Estoque','Qtde. obra','Qtde. estoque','Valor unitário','Total'].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{escolhido.linhas.map(l=>{const it=p.itens.find(i=>i.id===l.item_id);return <tr className="border-t" key={l.id}><td className="p-2"><div className="flex items-center gap-2">{foto(it)?<img src={foto(it)||''} alt={it?.descricao||'Produto'} className="h-10 w-10 rounded border object-contain"/>:<span className="flex h-10 w-10 items-center justify-center rounded border border-dashed text-[8px] text-amber-700">Foto pendente</span>}{it?.descricao||'Material'}</div></td><td className="p-2">{it?.destino==='estoque'?'Estoque':(p.clientes.find(x=>x.id===it?.cliente_id)?.nome||'Cliente')+' / '+(p.obras.find(x=>x.id===it?.obra_id)?.nome||'Obra')}</td><td className="p-2">{l.quantidade_obra}</td><td className="p-2">{l.quantidade_estoque}</td><td className="p-2">{l.preco_unitario==null?'Pendente':reais(l.preco_unitario)}</td><td className="p-2">{reais((l.quantidade_obra+l.quantidade_estoque)*Number(l.preco_unitario||0))}</td></tr>})}</tbody></table></div>
   <div className="mt-3 flex flex-wrap gap-2">{escolhido.status==='rascunho'&&<button type="button" onClick={p.onAdicionarMais} className="rounded-lg border border-blue-300 bg-white px-4 py-2 text-xs font-semibold text-blue-800">Adicionar mais itens</button>}
    {escolhido.status==='rascunho'&&p.podeComprar&&<button disabled={p.ocupado||!escolhido.resumo.atingiuMinimo} type="button" onClick={()=>p.onComprar(escolhido.id)} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Confirmar pedido comprado</button>}
    {escolhido.estagio==='enviado'&&<Link className="rounded-lg border bg-white px-4 py-2 text-xs font-semibold text-blue-800" href="/compras/recebimento-integrado">Registrar conferência pela nota fiscal →</Link>}
   </div>
  </div>}
 </section>
}
