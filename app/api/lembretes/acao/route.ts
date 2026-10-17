import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const INTERVALOS = new Set([15,30,60,120,360,720,1440,2880,10080])

/** Somente o responsável autenticado pode concluir, adiar ou reagendar. */
export async function POST(req:NextRequest) {
 const usuario=await autenticarTenant(req)
 if(!usuario)return NextResponse.json({error:'Não autenticado.'},{status:401})
 let body:Record<string,unknown>
 try { body=await req.json() } catch {return NextResponse.json({error:'JSON inválido.'},{status:400})}
 const tipo=String(body.tipo||''),id=String(body.id||''),acao=String(body.acao||'')
 if(!['tarefa','agenda'].includes(tipo)||!UUID.test(id)||!['concluir','adiar','reagendar'].includes(acao))
   return NextResponse.json({error:'Comando inválido.'},{status:400})
 const tabela=tipo==='tarefa'?'tarefas':'eventos'
 const campoData=tipo==='tarefa'?'data_hora':'data_inicio'
 const campoFim=tipo==='tarefa'?'concluida_em':'concluido_em'
 const {data:item,error:erro}=await supabaseAdmin.from(tabela)
   .select('*')
   .eq('id',id).eq('empresa_id',usuario.empresa_id).eq('usuario_id',usuario.id).maybeSingle()
 if(erro)return NextResponse.json({error:'Não foi possível consultar o item.'},{status:500})
 if(!item)return NextResponse.json({error:'Item não encontrado para este usuário.'},{status:404})
 if(item[campoFim])return NextResponse.json({error:'Este item já está concluído.'},{status:409})

 const agora=Date.now(),patch:Record<string,unknown>={}
 let novaData:Date|null=null
 if(acao==='concluir'){
   patch[campoFim]=new Date(agora).toISOString()
 }else if(acao==='adiar'){
   const minutos=Number(body.minutos)
   if(!Number.isInteger(minutos)||!INTERVALOS.has(minutos))return NextResponse.json({error:'Intervalo inválido.'},{status:400})
   const referencia=Date.parse(String(item[campoData]||''))
   novaData=new Date(Math.max(agora,Number.isFinite(referencia)?referencia:0)+minutos*60000)
 }else{
   const dataHora=String(body.dataHora||'')
   novaData=new Date(dataHora)
   if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(dataHora)||!Number.isFinite(novaData.getTime())||novaData.getTime()<=agora)
     return NextResponse.json({error:'Informe uma nova data e hora futura.'},{status:400})
 }
 if(novaData){
   patch[campoData]=novaData.toISOString()
   patch.pausado_ate=null
   if(tipo==='agenda'){
     const duracao=Math.max(0,Date.parse(String(item.data_fim||item.data_inicio))-Date.parse(String(item.data_inicio)))
     patch.data_fim=duracao?new Date(novaData.getTime()+duracao).toISOString():null
   }
 }
 const {data:atualizado,error}=await supabaseAdmin.from(tabela).update(patch)
   .eq('id',id).eq('usuario_id',usuario.id).eq('empresa_id',usuario.empresa_id)
   .is(campoFim,null).select('id').maybeSingle()
 if(error)return NextResponse.json({error:'Não foi possível atualizar o item.'},{status:500})
 if(!atualizado)return NextResponse.json({error:'O item já foi alterado. Atualize a tela.'},{status:409})
 return NextResponse.json({ok:true,id,tipo,acao,dataHora:novaData?.toISOString()||null})
}
