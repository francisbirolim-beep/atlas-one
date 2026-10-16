'use client'
import {useEffect,useState} from 'react'
import Link from 'next/link'
import {tokenAtual} from '@/lib/auth'
type Compra={fornecedor:string;comprado_em:string|null;quantidade_obra:number;quantidade_estoque:number;status:string}
type Item={id:string;obra_nome:string;descricao:string;quantidade_necessaria:number|null;unidade:string;status:string;compras:Compra[]}
type Sol={id:string;obra_nome:string;solicitante_nome:string;status:string;itens:Item[];created_at:string}
const data=(s:string|null)=>s?new Date(s).toLocaleDateString('pt-BR'):'—'
const leg=(s:string)=>({comprado:'Comprado',comprado_parcial:'Compra parcial',aguardando_compra:'Aguardando compra',cancelado:'Cancelado',pedido_emitido:'Pedido emitido',aguardando_entrega:'Aguardando entrega',recebido_parcial:'Recebido parcial',recebido:'Recebido'}[s]||s)
export default function ComprasClienteCards({clienteId}:{clienteId:string}){
 const [sol,setSol]=useState<Sol[]>([]),[erro,setErro]=useState(''),[loading,setLoading]=useState(true)
 useEffect(()=>{let active=true;(async()=>{try{const t=await tokenAtual();if(!t)return
  const r=await fetch('/api/compras/cliente/'+encodeURIComponent(clienteId),{headers:{Authorization:'Bearer '+t},cache:'no-store'})
  if(!r.ok){if(r.status===403)return;throw Error('O acompanhamento de compras está temporariamente indisponível')}
  const j=await r.json();if(active)setSol(j.solicitacoes||[])
 }catch(e){if(active)setErro(e instanceof Error?e.message:'Falha ao consultar')}
 finally{if(active)setLoading(false)}})();return()=>{active=false}},[clienteId])
 if(loading)return <p className="mt-4 text-xs text-slate-500">Carregando as novas solicitações...</p>
 if(!sol.length&&!erro)return null
 return <section className="mt-4 rounded-xl border border-blue-200 bg-blue-50/30 p-4">
  <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">Compras vinculadas a este cliente e obra</h3><Link href="/compras/solicitacoes" className="text-xs font-semibold text-blue-700 underline">Acompanhar em Compras</Link></div>
  {erro&&<p className="text-xs text-amber-700">{erro}</p>}
  {sol.map(s=><div key={s.id} className="mb-3 rounded-xl border bg-white p-3"><p className="text-xs font-bold">{s.obra_nome} · Solicitado por {s.solicitante_nome} em {data(s.created_at)}</p>
   {s.itens.map(i=><div key={i.id} className="mt-2 border-t py-2 text-xs"><div className="flex justify-between gap-2"><b>{i.descricao} · {i.obra_nome}</b><span>{leg(i.status)}</span></div>
    <p className="text-slate-500">Quantidade para a obra: {i.quantidade_necessaria??'a definir'} {i.unidade}</p>
    {i.compras.map((c,k)=><p key={k} className="mt-1 text-blue-800">{c.fornecedor} · Comprado em {data(c.comprado_em)} · {c.quantidade_obra} para a obra{c.quantidade_estoque>0?` + ${c.quantidade_estoque} para estoque`:''} · {leg(c.status)}</p>)}
   </div>)}
  </div>)}
 </section>
}
