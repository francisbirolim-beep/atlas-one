import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarTarefasEquipe, encontrarTarefaEquipe, notificarEnvolvidos, registrarHistorico } from '@/lib/servidorTarefasEquipe'
export async function POST(req:NextRequest,{params}:{params:{id:string}}) {
  const usuario=await autenticarTarefasEquipe(req)
  if(!usuario) return NextResponse.json({error:'Não autenticado'},{status:401})
  const tarefa=await encontrarTarefaEquipe(params.id,usuario)
  if(!tarefa) return NextResponse.json({error:'Tarefa não encontrada'},{status:404})
  let body:any
  try{body=await req.json()}catch{return NextResponse.json({error:'Dados inválidos'},{status:400})}
  const texto=typeof body.texto==='string'?body.texto.trim():''
  if(!texto||texto.length>2000) return NextResponse.json({error:'Comentário vazio ou muito longo.'},{status:400})
  const {data:comentario,error}=await supabaseAdmin.from('atlas_tarefa_comentarios')
    .insert({empresa_id:usuario.empresa_id,tarefa_id:tarefa.id,autor_id:usuario.id,texto})
    .select('id,autor_id,texto,created_at').single()
  if(error||!comentario) return NextResponse.json({error:'Não foi possível salvar o comentário.'},{status:500})
  await registrarHistorico(usuario.empresa_id,tarefa.id,usuario.id,'comentario','Comentou a tarefa')
  await notificarEnvolvidos(tarefa,usuario.id,'Novo comentário na tarefa',tarefa.titulo)
  return NextResponse.json({ok:true,comentario:{...comentario,autor_nome:usuario.nome}},{status:201})
}
