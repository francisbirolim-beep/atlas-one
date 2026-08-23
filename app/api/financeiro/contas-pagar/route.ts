import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarCompras, limiteSeguro } from '@/lib/comprasServer'

export const runtime='nodejs';export const dynamic='force-dynamic'
function texto(v:unknown,max=200){return String(v??'').trim().slice(0,max)}
function numero(v:unknown){const n=Number(v);return Number.isFinite(n)?n:null}

export async function GET(req:NextRequest){
 const u=await autenticarCompras(req);if(!u)return NextResponse.json({error:'Sessão inválida.'},{status:401})
 try{const limite=limiteSeguro(req.nextUrl.searchParams.get('limit'),300,1000);const status=req.nextUrl.searchParams.get('status');let q=supabaseAdmin.from('financeiro_contas_pagar').select('id,nf_id,fornecedor_id,fornecedor_nome,documento,parcela,descricao,data_emissao,vencimento,valor,status,data_pagamento,valor_pago,forma_pagamento,observacoes,created_at').order('vencimento',{ascending:true,nullsFirst:false}).order('created_at',{ascending:false}).limit(limite);if(status)q=q.eq('status',status);const {data,error}=await q;if(error)throw error;return NextResponse.json({ok:true,contas:data||[]})}catch(e){console.error(e);return NextResponse.json({error:'Não foi possível carregar Contas a Pagar.'},{status:500})}
}

export async function PATCH(req:NextRequest){
 const u=await autenticarCompras(req);if(!u)return NextResponse.json({error:'Sessão inválida.'},{status:401})
 try{const b=await req.json();const id=texto(b.id,80);const acao=texto(b.acao,30);if(!id)return NextResponse.json({error:'Conta não informada.'},{status:400});const {data:conta}=await supabaseAdmin.from('financeiro_contas_pagar').select('id,valor,status').eq('id',id).maybeSingle();if(!conta)return NextResponse.json({error:'Conta não encontrada.'},{status:404});const agora=new Date().toISOString().slice(0,10);let patch:any={updated_at:new Date().toISOString()};if(acao==='pagar'){patch={...patch,status:'pago',data_pagamento:texto(b.dataPagamento,10)||agora,valor_pago:numero(b.valorPago)??Number(conta.valor),forma_pagamento:texto(b.formaPagamento,60)||null}}else if(acao==='cancelar'){patch={...patch,status:'cancelado'}}else if(acao==='reabrir'){patch={...patch,status:'aberto',data_pagamento:null,valor_pago:null}}else if(acao==='vencimento'){const v=texto(b.vencimento,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return NextResponse.json({error:'Vencimento inválido.'},{status:400});patch={...patch,vencimento:v,status:conta.status==='pendente_vencimento'?'aberto':conta.status}}else return NextResponse.json({error:'Ação inválida.'},{status:400});const {data,error}=await supabaseAdmin.from('financeiro_contas_pagar').update(patch).eq('id',id).select('*').single();if(error)throw error;return NextResponse.json({ok:true,conta:data})}catch(e){console.error(e);return NextResponse.json({error:e instanceof Error?e.message:'Erro ao atualizar conta.'},{status:500})}
}
