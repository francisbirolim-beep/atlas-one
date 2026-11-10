import {NextRequest,NextResponse} from 'next/server'
import {autenticarCompras} from '@/lib/comprasServer'
import {permissoesKanbanObra} from '@/lib/kanbanObraPermissoesServer'
import {podeMoverKanbanGeral,podeConsultarPainelGeral} from '@/lib/painelGeralAcessoServer'
import {supabaseAdmin as db} from '@/lib/supabaseAdmin'
import {ETAPAS_OPERACIONAIS} from '@/lib/visaoGeralProjetos'
import {colunasKanbanEmpresa} from '@/lib/kanbanColunasSincronizadas'

export const dynamic='force-dynamic'
export const runtime='nodejs'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const etapas=new Set<string>(ETAPAS_OPERACIONAIS)
const falha=(erro:string,status:number)=>NextResponse.json({erro},{status,headers:{'Cache-Control':'no-store'}})

/** Lê o registro efetivamente persistido. É a mesma fonte dos Kanbans Geral, da Venda e do Cliente. */
export async function GET(req:NextRequest){
 try{
  const u=await autenticarCompras(req)
  if(!u)return falha('Sessão expirada.',401)
  const vendaId=req.nextUrl.searchParams.get('vendaId')
  if(!vendaId||!uuid.test(vendaId))return falha('Venda inválida.',400)
  const permissao=await permissoesKanbanObra(u)
  if(!permissao.consultar && !(await podeConsultarPainelGeral(u,'visao-geral-projetos')))
   return falha('Acesso não autorizado ao Kanban.',403)
  const {data:venda,error:erroVenda}=await db.from('vendas_obras').select('id')
   .eq('empresa_id',u.empresa_id).eq('id',vendaId).maybeSingle()
  if(erroVenda)throw erroVenda
  if(!venda)return falha('Venda não encontrada na empresa.',404)
  const {data,error}=await db.from('visao_geral_cards_controle')
   .select('estado,coluna_visual_id,etapa_visual,updated_at')
   .eq('empresa_id',u.empresa_id).eq('venda_id',vendaId).maybeSingle()
  if(error)throw error
  return NextResponse.json({
   ok:true,vendaId,
   colunaId:data?.estado==='manual'?data.coluna_visual_id:null,
   estado:data?.estado||null,atualizadoEm:data?.updated_at||null,
  },{headers:{'Cache-Control':'no-store, max-age=0'}})
 }catch(e){
  console.error('[Kanban principal] consulta da posição persistida',e)
  return falha('Falha ao consultar posição persistida.',503)
 }
}

/** Move só a apresentação do card nos Kanbans; não altera status operacionais. */
export async function POST(req:NextRequest){
 try{
  const u=await autenticarCompras(req)
  if(!u)return falha('Sessão expirada.',401)
  const permissao=await permissoesKanbanObra(u)
  if(!permissao.mover && !(await podeMoverKanbanGeral(u)))return falha('O Master não autorizou a movimentação deste Kanban.',403)
  const body=await req.json().catch(()=>null)
  if(!body||typeof body.vendaId!=='string'||!uuid.test(body.vendaId))
   return falha('Venda inválida.',400)
  const porColuna=typeof body.colunaId==='string'
  if(porColuna && !/^[a-zA-Z0-9_-]{1,100}$/.test(body.colunaId))
   return falha('Coluna de destino inválida.',400)
  if(!porColuna && (typeof body.etapa!=='string'||!etapas.has(body.etapa)))
   return falha('Etapa de destino inválida.',400)
  const motivo=typeof body.motivo==='string'?body.motivo.trim():''
  if(motivo.length<8||motivo.length>1000)
   return falha('Informe o motivo de 8 a 1000 caracteres.',400)

  // Clientes anteriores podem enviar a etapa. Ela é traduzida para o mesmo
  // identificador de coluna; toda gravação usa a mesma transação auditada.
  let colunaId:string=body.colunaId
  if(!porColuna){
   const layout=await db.from('visao_geral_configuracoes').select('colunas')
    .eq('empresa_id',u.empresa_id).maybeSingle()
   if(layout.error)throw layout.error
   const coluna=colunasKanbanEmpresa(layout.data?.colunas)
    .find(c=>c.criterios.includes(body.etapa))
   if(!coluna)return falha('Etapa não vinculada a uma coluna.',409)
   colunaId=coluna.id
  }
  const {data,error}=await db.rpc('mover_card_principal_kanban_obra_coluna_v2',{
   p_empresa:u.empresa_id,p_usuario:u.id,p_venda:body.vendaId,
   p_coluna_id:colunaId,p_motivo:motivo,
  })
  if(error){
   if(['PGRST202','42P01','42703','42883'].includes(String(error.code||'')))
    return falha('Movimentação ainda não configurada no banco. Nenhum dado foi alterado.',409)
   if(/não autorizad|n[aã]o encontrada|cancelad|inv[aá]lid|retirado/i.test(String(error.message||'')))
    return falha(String(error.message),403)
   throw error
  }
  // A resposta de sucesso só pode ser dada depois de confirmar a posição
  // na mesma tabela consumida pelos três Kanbans. Não confundir drag visual com gravação.
  if(!data || typeof data!=='object' || data.ok!==true)
   return falha('O banco não confirmou a movimentação do card.',409)
  const {data:gravado,error:erroLeitura}=await db.from('visao_geral_cards_controle')
   .select('estado,coluna_visual_id,updated_at').eq('empresa_id',u.empresa_id)
   .eq('venda_id',body.vendaId).maybeSingle()
  if(erroLeitura)throw erroLeitura
  if(gravado?.estado!=='manual'||gravado.coluna_visual_id!==colunaId)
   return falha('A gravação não foi confirmada. Verifique a posição atual do card antes de tentar novamente.',409)
  return NextResponse.json({...data,colunaId:gravado.coluna_visual_id,
   persistido:true,atualizadoEm:gravado.updated_at},
   {headers:{'Cache-Control':'no-store, max-age=0'}})
 }catch(e){
  console.error('[Kanban principal] movimentação visual',e)
  return falha('Não foi possível salvar a nova posição. Nenhum status operacional foi alterado.',500)
 }
}
