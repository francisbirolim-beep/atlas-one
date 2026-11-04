import { NextRequest, NextResponse } from 'next/server'
import { autenticarCompras } from '@/lib/comprasServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { usuarioPodeAcaoServer } from '@/lib/acessoUsuarioServer'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(req:NextRequest){
 const u=await autenticarCompras(req)
 if(!u)return NextResponse.json({error:'Sessão expirada ou inválida.'},{status:401})
 const [caixa,financeiro]=await Promise.all([
   usuarioPodeAcaoServer({usuarioId:u.id,role:u.role,empresaId:u.empresa_id,setorId:'caixa-balcao',acaoId:'financeiro.contas_receber.consultar'}),
   usuarioPodeAcaoServer({usuarioId:u.id,role:u.role,empresaId:u.empresa_id,setorId:'financeiro',acaoId:'financeiro.contas_receber.consultar'})
 ])
 // Aceita permissões já delegadas tanto ao Contas a Receber do Balcão quanto ao Financeiro legado.
 if(!caixa&&!financeiro)return NextResponse.json({error:'Sem permissão para consultar Contas a Receber.'},{status:403})
 try{
  const [cr,receb]=await Promise.all([
   supabaseAdmin.from('financeiro_contas_receber').select('id,cliente_id,cliente_nome,obra_id,documento,parcela,total_parcelas,data_emissao,vencimento,valor,valor_pago,valor_desconto,status,forma,data_pagamento,observacoes,created_at').eq('empresa_id',u.empresa_id).order('vencimento',{ascending:true,nullsFirst:false}).limit(1500),
   supabaseAdmin.from('financeiro_recebimentos').select('id,cliente_id,cliente_nome,obra_id,data_recebimento,valor,valor_desconto,forma,referencia,observacoes,status,criado_por_nome,created_at').eq('empresa_id',u.empresa_id).neq('status','cancelado').order('data_recebimento',{ascending:false}).order('created_at',{ascending:false}).limit(1000)
  ])
  if(cr.error||receb.error)throw cr.error||receb.error
  const clienteIds=[...new Set([...(cr.data||[]).map(c=>c.cliente_id),...(receb.data||[]).map(r=>r.cliente_id)].filter((v):v is string=>!!v))]
  const mapaClientes=new Map<string,{cpf_cnpj:string|null;cidade:string|null;telefone:string|null}>()
  for(let i=0;i<clienteIds.length;i+=80){
   const cadastros=await supabaseAdmin.from('clientes').select('id,cpf_cnpj,cidade,telefone').eq('empresa_id',u.empresa_id).in('id',clienteIds.slice(i,i+80))
   if(cadastros.error)throw cadastros.error
   for(const c of cadastros.data||[])mapaClientes.set(c.id,c)
  }
  const camposCadastro=(id:string|null|undefined)=>({cliente_cpf_cnpj:mapaClientes.get(id||'')?.cpf_cnpj||null,cliente_cidade:mapaClientes.get(id||'')?.cidade||null})
  const contas=(cr.data||[]).map(c=>({...c,...camposCadastro(c.cliente_id)}))
  const ids=[...new Set((cr.data||[]).map(c=>c.obra_id).filter((v):v is string=>!!v))]
  const nomes:Record<string,string>={}
  for(let i=0;i<ids.length;i+=80){
   const r=await supabaseAdmin.from('obras').select('id,nome,numero').eq('empresa_id',u.empresa_id).in('id',ids.slice(i,i+80))
   if(r.error)throw r.error
   for(const o of r.data||[])nomes[o.id]=`${o.nome}${o.numero?` #${o.numero}`:''}`
  }
  const descontos:Record<string,number>={}
  const idsRec=(receb.data||[]).map(r=>r.id)
  for(let i=0;i<idsRec.length;i+=80){
   const r=await supabaseAdmin.from('financeiro_recebimento_alocacoes').select('recebimento_id,tipo,valor').eq('empresa_id',u.empresa_id).in('recebimento_id',idsRec.slice(i,i+80))
   if(r.error)throw r.error
   for(const a of r.data||[])if(a.tipo==='desconto')descontos[a.recebimento_id]=(descontos[a.recebimento_id]||0)+Number(a.valor||0)
  }
  const multiformaIds=(receb.data||[]).filter(r=>r.forma==='multiplo'||r.forma==='cartao_credito').map(r=>r.id)
  const composicoes:Record<string,Array<{forma:string;valor:number;parcelas?:number|null}>>={}
  for(let i=0;i<multiformaIds.length;i+=80){
    const detalhes=await supabaseAdmin.from('financeiro_recebimento_formas').select('recebimento_id,forma,valor,parcelas,ordem').eq('empresa_id',u.empresa_id).in('recebimento_id',multiformaIds.slice(i,i+80)).order('ordem')
    if(detalhes.error)throw detalhes.error
    for(const d of detalhes.data||[])(composicoes[d.recebimento_id] ||= []).push({forma:d.forma,valor:Number(d.valor),parcelas:d.parcelas==null?null:Number(d.parcelas)})
  }
  return NextResponse.json({ok:true,contas,recebimentos:(receb.data||[]).map(r=>({...r,...camposCadastro(r.cliente_id),formas:composicoes[r.id]||[],composicaoInconsistente:r.forma==='multiplo'&&Math.abs((composicoes[r.id]||[]).reduce((a,f)=>a+f.valor,0)-Number(r.valor))>0.009,desconto:Math.max(Number(r.valor_desconto||0),descontos[r.id]||0)})),nomesObras:nomes},{headers:{'Cache-Control':'private, no-store'}})
 }catch(e){console.error('contas a receber leitura',e);return NextResponse.json({error:'Falha ao consultar Contas a Receber.'},{status:500})}
}
