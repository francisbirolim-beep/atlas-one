import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarTarefasEquipe, encontrarTarefaEquipe } from '@/lib/servidorTarefasEquipe'
export async function PATCH(req:NextRequest,{params}:{params:{id:string}}) {
  const usuario=await autenticarTarefasEquipe(req)
  if(!usuario) return NextResponse.json({error:'Não autenticado'},{status:401})
  const tarefa=await encontrarTarefaEquipe(params.id,usuario)
  if(!tarefa||!tarefa.responsaveis_ids.includes(usuario.id)) return NextResponse.json({error:'Não autorizado'},{status:403})
  if(tarefa.status==='concluido') return NextResponse.json({ok:true})
  let body:any
  try{body=await req.json()}catch{return NextResponse.json({error:'Dados inválidos'},{status:400})}
  const acao=typeof body.acao==='string'?body.acao:'ok'
  if(!['ok','15','60','240','amanha','ver'].includes(acao)) return NextResponse.json({error:'Adiamento inválido'},{status:400})
  const agora=new Date()
  const proximo=new Date(agora)
  if(acao==='amanha'){
    proximo.setDate(proximo.getDate()+1)
    proximo.setHours(9,0,0,0)
  } else proximo.setMinutes(proximo.getMinutes()+(acao==='15'?15:acao==='60'?60:acao==='240'?240:240))
  const {error}=await supabaseAdmin.from('atlas_tarefa_avisos').upsert({
    empresa_id:usuario.empresa_id,tarefa_id:tarefa.id,usuario_id:usuario.id,
    proximo_aviso_em:proximo.toISOString(),ultimo_aviso_em:agora.toISOString(),
    visto_em:(acao==='ok'||acao==='ver')?agora.toISOString():null,
  },{onConflict:'tarefa_id,usuario_id'})
  if(error) return NextResponse.json({error:'Não foi possível adiar o lembrete'},{status:500})
  return NextResponse.json({ok:true,proximoAviso:proximo.toISOString()})
}
