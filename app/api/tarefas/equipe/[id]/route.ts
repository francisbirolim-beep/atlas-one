import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarTarefasEquipe, encontrarTarefaEquipe, notificarEnvolvidos, registrarHistorico, statusTarefa } from '@/lib/servidorTarefasEquipe'

export async function GET(req:NextRequest, {params}:{params:{id:string}}) {
  const usuario=await autenticarTarefasEquipe(req)
  if(!usuario) return NextResponse.json({error:'Não autenticado'},{status:401})
  const tarefa=await encontrarTarefaEquipe(params.id,usuario)
  if(!tarefa) return NextResponse.json({error:'Tarefa não encontrada'},{status:404})
  const [com,hist]=await Promise.all([
    supabaseAdmin.from('atlas_tarefa_comentarios').select('id,autor_id,texto,created_at')
      .eq('empresa_id',usuario.empresa_id).eq('tarefa_id',tarefa.id).order('created_at',{ascending:true}).limit(150),
    supabaseAdmin.from('atlas_tarefa_historico').select('id,autor_id,acao,detalhe,created_at')
      .eq('empresa_id',usuario.empresa_id).eq('tarefa_id',tarefa.id).order('created_at',{ascending:false}).limit(150),
  ])
  if(com.error||hist.error) return NextResponse.json({error:'Não foi possível carregar o histórico'},{status:500})
  const ids=[...new Set([...(com.data||[]).map(x=>x.autor_id),...(hist.data||[]).map(x=>x.autor_id),tarefa.criado_por_id,
    ...tarefa.responsaveis_ids].filter(Boolean))]
  const {data:nomes}=ids.length?await supabaseAdmin.from('usuarios').select('id,nome')
    .eq('empresa_id',usuario.empresa_id).in('id',ids):{data:[]}
  const mapa=new Map((nomes||[]).map(u=>[u.id,u.nome]))
  return NextResponse.json({
    tarefa:{...tarefa,criador_nome:mapa.get(tarefa.criado_por_id),
      responsaveis_nomes:tarefa.responsaveis_ids.map((id:string)=>mapa.get(id)||'Usuário')},
    comentarios:(com.data||[]).map(c=>({...c,autor_nome:mapa.get(c.autor_id)||'Usuário'})),
    historico:(hist.data||[]).map(h=>({...h,autor_nome:mapa.get(h.autor_id)||'Usuário'})),
  },{headers:{'Cache-Control':'no-store'}})
}

export async function PATCH(req:NextRequest,{params}:{params:{id:string}}) {
  const usuario=await autenticarTarefasEquipe(req)
  if(!usuario) return NextResponse.json({error:'Não autenticado'},{status:401})
  const tarefa=await encontrarTarefaEquipe(params.id,usuario)
  if(!tarefa) return NextResponse.json({error:'Tarefa não encontrada'},{status:404})
  if(!tarefa.responsaveis_ids.includes(usuario.id)) return NextResponse.json({
    error:'Somente os responsáveis podem movimentar esta tarefa.'
  },{status:403})
  let body:any
  try{body=await req.json()}catch{return NextResponse.json({error:'Dados inválidos'},{status:400})}
  if(!statusTarefa.includes(body.status)) return NextResponse.json({error:'Status inválido'},{status:400})
  if(tarefa.status===body.status) return NextResponse.json({ok:true,tarefa})
  const agora=new Date().toISOString()
  const patch:any={status:body.status,updated_at:agora,
    concluida_em:body.status==='concluido'?agora:null,
    concluida_por_id:body.status==='concluido'?usuario.id:null,
  }
  if(body.status==='em_andamento'&&!tarefa.iniciada_em) patch.iniciada_em=agora
  const {data:atualizada,error}=await supabaseAdmin.from('atlas_tarefas_equipe')
    .update(patch).eq('id',tarefa.id).eq('empresa_id',usuario.empresa_id)
    .eq('status',tarefa.status).select('*').maybeSingle()
  if(error) return NextResponse.json({error:'Não foi possível atualizar o andamento.'},{status:500})
  if(!atualizada) return NextResponse.json({error:'Esta tarefa já foi atualizada em outra sessão. Atualize para continuar.'},{status:409})
  await registrarHistorico(usuario.empresa_id,tarefa.id,usuario.id,'status',body.status)
  await notificarEnvolvidos(tarefa,usuario.id,body.status==='concluido'?'Tarefa concluída':'Andamento atualizado',tarefa.titulo)
  return NextResponse.json({ok:true,tarefa:atualizada},{headers:{'Cache-Control':'no-store'}})
}
