import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarBalcao } from '@/lib/balcaoServer'

export const runtime='nodejs';export const dynamic='force-dynamic'
export async function GET(req:NextRequest){
 const u=await autenticarBalcao(req,'relatorios-balcao','consulta');if(!u)return NextResponse.json({error:'Sem permissão para relatórios do balcão.'},{status:403})
 try{
  const hoje=new Date();const inicioDefault=new Date(hoje);inicioDefault.setDate(hoje.getDate()-30)
  const de=req.nextUrl.searchParams.get('de')||inicioDefault.toISOString().slice(0,10);const ate=req.nextUrl.searchParams.get('ate')||hoje.toISOString().slice(0,10)
  const inicio=`${de}T00:00:00`;const fim=`${ate}T23:59:59.999`
  const {data:vendas,error}=await supabaseAdmin.from('balcao_vendas').select('id,numero,status,cliente_nome,vendedor_nome,subtotal,desconto,total,finalizada_em').eq('status','finalizada').gte('finalizada_em',inicio).lte('finalizada_em',fim).order('finalizada_em')
  if(error)throw error;const ids=(vendas||[]).map(v=>v.id)
  const [{data:itens},{data:pagamentos}]=ids.length?await Promise.all([
   supabaseAdmin.from('balcao_venda_itens').select('venda_id,produto_id,produto_codigo,produto_nome,quantidade,custo_unitario_snapshot,preco_unitario,total_item,margem_real_percentual').in('venda_id',ids),
   supabaseAdmin.from('balcao_pagamentos').select('venda_id,forma,valor').in('venda_id',ids),
  ]):[{data:[]},{data:[]}]
  const faturamento=(vendas||[]).reduce((s,v)=>s+Number(v.total||0),0);const ticket=(vendas||[]).length?faturamento/(vendas||[]).length:0
  let lucro=0,custo=0;const produtos=new Map<string,{codigo:string;nome:string;qtd:number;faturamento:number}>();
  for(const i of itens||[]){const q=Number(i.quantidade||0),c=Number(i.custo_unitario_snapshot||0),t=Number(i.total_item||0);custo+=q*c;lucro+=t-q*c;const k=i.produto_id;const a=produtos.get(k)||{codigo:i.produto_codigo||'',nome:i.produto_nome,qtd:0,faturamento:0};a.qtd+=q;a.faturamento+=t;produtos.set(k,a)}
  const margem=faturamento>0?lucro/faturamento*100:0
  const porPagamento:Record<string,number>={};for(const p of pagamentos||[])porPagamento[p.forma]=(porPagamento[p.forma]||0)+Number(p.valor||0)
  const porDia:Record<string,number>={};for(const v of vendas||[]){const d=String(v.finalizada_em).slice(0,10);porDia[d]=(porDia[d]||0)+Number(v.total||0)}
  const porVendedor:Record<string,{vendas:number;faturamento:number}>={};for(const v of vendas||[]){const k=v.vendedor_nome||'Sem vendedor';const a=porVendedor[k]||{vendas:0,faturamento:0};a.vendas++;a.faturamento+=Number(v.total||0);porVendedor[k]=a}
  return NextResponse.json({ok:true,periodo:{de,ate},resumo:{vendas:(vendas||[]).length,faturamento,ticket,custo,lucro,margem,clientes:new Set((vendas||[]).map(v=>v.cliente_nome).filter(Boolean)).size},porPagamento,porDia,porVendedor,topProdutos:[...produtos.values()].sort((a,b)=>b.faturamento-a.faturamento).slice(0,10),ultimas:[...(vendas||[])].reverse().slice(0,10)})
 }catch(e){console.error('Erro relatório balcão',e);return NextResponse.json({error:'Não foi possível gerar os relatórios.'},{status:500})}
}
