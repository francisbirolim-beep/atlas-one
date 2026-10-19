import { NextRequest,NextResponse } from 'next/server'
import { autenticarCompras } from '@/lib/comprasServer'
import { usuarioPodeAcaoServer } from '@/lib/acessoUsuarioServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(req:NextRequest){
  const usuario=await autenticarCompras(req)
  if(!usuario)return NextResponse.json({error:'Sessão inválida.'},{status:401})
  if(!(await usuarioPodeAcaoServer({usuarioId:usuario.id,role:usuario.role,empresaId:usuario.empresa_id,setorId:'financeiro',acaoId:'financeiro.contas_receber.consultar'}))){
    return NextResponse.json({error:'Sem permissão para consultar contas a receber.'},{status:403})
  }
  try{
    const [titulos,recebimentos,obras]=await Promise.all([
      supabaseAdmin.from('financeiro_contas_receber').select('id,cliente_id,cliente_nome,obra_id,documento,parcela,total_parcelas,data_emissao,vencimento,valor,valor_pago,valor_desconto,status,forma,data_pagamento,observacoes,created_at').eq('empresa_id',usuario.empresa_id).order('vencimento',{ascending:true,nullsFirst:false}).limit(1500),
      supabaseAdmin.from('financeiro_recebimentos').select('id,cliente_id,cliente_nome,obra_id,data_recebimento,valor,valor_desconto,forma,referencia,observacoes,status,criado_por_nome,created_at').eq('empresa_id',usuario.empresa_id).neq('status','cancelado').order('data_recebimento',{ascending:false}).order('created_at',{ascending:false}).limit(1000),
      supabaseAdmin.from('obras').select('id,cliente_id,nome,numero').eq('empresa_id',usuario.empresa_id).order('created_at',{ascending:false}).limit(1500),
    ])
    if(titulos.error||recebimentos.error||obras.error)throw titulos.error||recebimentos.error||obras.error
    const ids=(recebimentos.data||[]).map(x=>x.id)
    const descontos:Record<string,number>={}
    for(let i=0;i<ids.length;i+=100){
      const {data,error}=await supabaseAdmin.from('financeiro_recebimento_alocacoes').select('recebimento_id,tipo,valor').eq('empresa_id',usuario.empresa_id).in('recebimento_id',ids.slice(i,i+100))
      if(error)throw error
      for(const a of data||[])if(a.tipo==='desconto')descontos[a.recebimento_id]=(descontos[a.recebimento_id]||0)+Number(a.valor||0)
    }
    return NextResponse.json({ok:true,contas:titulos.data||[],recebimentos:(recebimentos.data||[]).map(r=>({...r,desconto:Math.max(Number(r.valor_desconto||0),descontos[r.id]||0)})),obras:obras.data||[]},{headers:{'Cache-Control':'no-store'}})
  }catch(e){console.error('Listar contas a receber',e);return NextResponse.json({error:'Não foi possível carregar contas a receber.'},{status:500})}
}
