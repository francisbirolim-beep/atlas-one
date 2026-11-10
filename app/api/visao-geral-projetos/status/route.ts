import {NextRequest,NextResponse} from 'next/server'
import {autenticarCompras} from '@/lib/comprasServer'
import {permissoesKanbanObra} from '@/lib/kanbanObraPermissoesServer'
import {podeMoverKanbanGeral} from '@/lib/painelGeralAcessoServer'
import {supabaseAdmin as db} from '@/lib/supabaseAdmin'

export const dynamic='force-dynamic'
export const runtime='nodejs'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const falha=(erro:string,status:number)=>NextResponse.json({erro},{status,headers:{'Cache-Control':'no-store'}})

/** Atualização visual de status, sem movimentar o card ou gravar etapas operacionais. */
export async function POST(req:NextRequest){
 try{
  const usuario=await autenticarCompras(req)
  if(!usuario)return falha('Sessão expirada.',401)
  const permissoes=await permissoesKanbanObra(usuario)
  if(!permissoes.mover && !(await podeMoverKanbanGeral(usuario)))
   return falha('Você não tem permissão para alterar os status do Kanban.',403)
  const b=await req.json().catch(()=>null)
  if(!b||typeof b.vendaId!=='string'||!uuid.test(b.vendaId)||
     typeof b.colunaId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(b.colunaId)||
     !Array.isArray(b.statusIds)||b.statusIds.length>24||
     b.statusIds.some((s:unknown)=>typeof s!=='string'||!/^[a-z0-9_-]{1,48}$/.test(s))||
     new Set(b.statusIds).size!==b.statusIds.length)
   return falha('Seleção de status inválida.',400)

  const {data,error}=await db.rpc('salvar_visao_geral_status_etapa_v1',{
   p_empresa:usuario.empresa_id,p_usuario:usuario.id,
   p_venda:b.vendaId,p_coluna_id:b.colunaId,p_status_ids:b.statusIds,
  })
  if(error){
   if(['42P01','PGRST202','42883'].includes(String(error.code||'')))
    return falha('A atualização de status ainda não foi configurada no banco.',409)
   if(/usuário|empresa|inválid|coluna|desativado|desconhecido|duplicado|máxima/i.test(String(error.message||'')))
    return falha('Status incompatível com a coluna ou a venda atual. Atualize o Kanban.',409)
   throw error
  }
  if(!data||data.ok!==true)return falha('O banco não confirmou os status.',409)
  return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}})
 }catch(e){
  console.error('[Kanban geral] alteração visual de status',e)
  return falha('Não foi possível registrar os status. Nenhuma movimentação operacional foi realizada.',500)
 }
}
