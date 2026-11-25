import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { usuarioLocalContramarco, UUID_LOCAL } from '@/lib/contramarcoLocalServer'
export const runtime='nodejs'
export async function GET(req:NextRequest){
  const cliente=req.nextUrl.searchParams.get('cliente')||''
  if(!UUID_LOCAL.test(cliente))return NextResponse.json({error:'Cliente inválido.'},{status:400})
  const usuario=await usuarioLocalContramarco(req)
  if(!usuario)return NextResponse.json({error:'Sem acesso à medição.'},{status:403})
  const {data:medicoes,error}=await supabaseAdmin.from('medicoes_finais').select('id').eq('empresa_id',usuario.empresa_id).eq('cliente_id',cliente).eq('tipo_medicao','contramarco')
  if(error)return NextResponse.json({error:'Não foi possível consultar as medições.'},{status:500})
  const nomes:Record<string,string>={}
  const ids=(medicoes||[]).map(m=>m.id)
  // Small batches avoid excessively long URLs on the database gateway.
  for(let i=0;i<ids.length;i+=100){
    const {data,error:erro}=await supabaseAdmin.from('medicao_contramarco_local').select('medicao_id,nome_obra').eq('empresa_id',usuario.empresa_id).in('medicao_id',ids.slice(i,i+100))
    if(erro)return NextResponse.json({error:'Não foi possível consultar as obras.'},{status:500})
    for(const l of data||[])nomes[l.medicao_id]=l.nome_obra
  }
  return NextResponse.json({nomes},{headers:{'Cache-Control':'private, no-store'}})
}
