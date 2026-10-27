import {NextRequest,NextResponse} from 'next/server'
import {autenticarCompras} from '@/lib/comprasServer'
import {permissoesKanbanObra,type AcaoKanbanObra} from '@/lib/kanbanObraPermissoesServer'
import {supabaseAdmin as db} from '@/lib/supabaseAdmin'
export const dynamic='force-dynamic'
export const runtime='nodejs'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ETAPAS=new Set(['vendido','separacao_materiais','compras','aguardando_materiais','medicao_final','producao','instalacao','finalizado'])
const ERRO=(erro:string,status:number)=>NextResponse.json({erro},{status,headers:{'Cache-Control':'no-store'}})
/** Mutações somente no acompanhamento visual. Nenhum pedido, venda ou OP é modificado. */
export async function POST(req:NextRequest){
 try{
  const u=await autenticarCompras(req)
  if(!u)return ERRO('Sessão expirada',401)
  const body=await req.json().catch(()=>null)
  const acao=body?.acao as AcaoKanbanObra
  if(!body||!['criar','mover','retirar','restaurar'].includes(acao))return ERRO('Ação inválida',400)
  const acessos=await permissoesKanbanObra(u)
  if(!acessos[acao])return ERRO('O Master não autorizou esta ação para seu usuário.',403)
  if(!uuid.test(body.vendaId||''))return ERRO('Venda inválida.',400)
  const cardId=body.cardId||null
  if(acao!=='criar'&&!uuid.test(cardId||''))return ERRO('Card inválido.',400)
  const titulo=String(body.titulo||'').trim()
  const descricao=String(body.descricao||'').trim()
  const etapa=String(body.etapa||'')
  const motivo=String(body.motivo||'').trim()
  if(motivo.length<8||motivo.length>1000)return ERRO('Informe o motivo da alteração (8 a 1000 caracteres).',400)
  if(acao==='criar'&&(titulo.length<3||titulo.length>120||descricao.length>1000))return ERRO('Título de 3 a 120 caracteres e descrição de até 1000 caracteres.',400)
  if((acao==='criar'||acao==='mover')&&!ETAPAS.has(etapa))return ERRO('Etapa inválida.',400)
  const {data,error}=await db.rpc('alterar_card_kanban_obra_v1',{
   p_empresa:u.empresa_id,p_usuario:u.id,p_venda:body.vendaId,p_card:cardId,
   p_acao:acao,p_titulo:titulo||null,p_descricao:descricao||null,
   p_etapa:ETAPAS.has(etapa)?etapa:null,p_motivo:motivo
  })
  if(error){
   if(['PGRST202','42P01','42883'].includes(String(error.code)))return ERRO('Kanban da obra em preparação no banco de dados; nada foi alterado.',409)
   if(/n[aã]o autorizad|n[aã]o encontrada|inv[aá]lid|retirad/i.test(error.message))return ERRO(error.message,403)
   throw error
  }
  return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}})
 }catch(e){console.error('[kanban obra] salvamento',e);return ERRO('Não foi possível salvar o acompanhamento. Nenhum pedido ou obra foi alterado.',500)}
}
