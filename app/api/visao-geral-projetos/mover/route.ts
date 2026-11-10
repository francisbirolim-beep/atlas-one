import {NextRequest,NextResponse} from 'next/server'
import {autenticarCompras} from '@/lib/comprasServer'
import {permissoesKanbanObra} from '@/lib/kanbanObraPermissoesServer'
import {supabaseAdmin as db} from '@/lib/supabaseAdmin'
import {ETAPAS_OPERACIONAIS} from '@/lib/visaoGeralProjetos'

export const dynamic='force-dynamic'
export const runtime='nodejs'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const etapas=new Set<string>(ETAPAS_OPERACIONAIS)
const falha=(erro:string,status:number)=>NextResponse.json({erro},{status,headers:{'Cache-Control':'no-store'}})

/** Move só o card principal na apresentação dos dois Kanbans; não altera os status operacionais. */
export async function POST(req:NextRequest){
 try{
  const u=await autenticarCompras(req)
  if(!u)return falha('Sessão expirada.',401)
  const permissao=await permissoesKanbanObra(u)
  if(!permissao.mover)return falha('O Master não autorizou a movimentação deste Kanban.',403)
  const body=await req.json().catch(()=>null)
  if(!body||typeof body.vendaId!=='string'||!uuid.test(body.vendaId))
   return falha('Venda inválida.',400)
  if(typeof body.etapa!=='string'||!etapas.has(body.etapa))
   return falha('Etapa de destino inválida.',400)
  const motivo=typeof body.motivo==='string'?body.motivo.trim():''
  if(motivo.length<8||motivo.length>1000)
   return falha('Informe o motivo de 8 a 1000 caracteres.',400)

  const {data,error}=await db.rpc('mover_card_principal_kanban_obra_v1',{
   p_empresa:u.empresa_id,p_usuario:u.id,p_venda:body.vendaId,
   p_etapa:body.etapa,p_motivo:motivo,
  })
  if(error){
   if(['PGRST202','42P01','42703','42883'].includes(String(error.code||'')))
    return falha('Movimentação ainda não configurada no banco. Nenhum dado foi alterado.',409)
   if(/não autorizad|n[aã]o encontrada|cancelad|inv[aá]lid|retirado/i.test(String(error.message||'')))
    return falha(String(error.message),403)
   throw error
  }
  return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}})
 }catch(e){
  console.error('[Kanban principal] movimentação visual',e)
  return falha('Não foi possível salvar a nova posição. Nenhum status operacional foi alterado.',500)
 }
}
