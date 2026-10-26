import {NextRequest,NextResponse} from 'next/server'
import {autenticarCompras} from '@/lib/comprasServer'
import {supabaseAdmin as db} from '@/lib/supabaseAdmin'
export const dynamic='force-dynamic'
export const runtime='nodejs'
const erro=(mensagem:string,status:number)=>NextResponse.json({erro:mensagem},{status,headers:{'Cache-Control':'no-store'}})
export async function POST(req:NextRequest){
 try{
  const u=await autenticarCompras(req)
  if(!u)return erro('Sessão inválida.',401)
  if(u.role!=='master')return erro('Apenas o Master pode finalizar ou excluir cards da Visão Geral.',403)
  const b=await req.json().catch(()=>null)
  if(!b||typeof b.vendaId!=='string'||typeof b.acao!=='string'||typeof b.motivo!=='string')
   return erro('Dados inválidos.',400)
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.vendaId))
   return erro('ID do projeto inválido.',400)
  if(!['finalizar','ocultar','restaurar'].includes(b.acao)||b.motivo.trim().length<8||b.motivo.trim().length>1000)
   return erro('Informe uma ação permitida e um motivo de 8 a 1000 caracteres.',400)
  const resposta=await db.rpc('alterar_card_visao_geral_master_v1',{
   p_empresa:u.empresa_id,p_usuario:u.id,p_venda:b.vendaId,
   p_acao:b.acao,p_motivo:b.motivo.trim(),
  })
  if(resposta.error){
   const mensagem=String(resposta.error.message||'')
   if(/somente.*master|n[aã]o encontrada na empresa/i.test(mensagem))return erro(mensagem,403)
   if(['PGRST202','42P01','42883'].includes(String(resposta.error.code||'')))
    return erro('Controle de cards ainda não configurado no banco. Nenhum dado foi alterado.',409)
   throw resposta.error
  }
  return NextResponse.json(resposta.data,{headers:{'Cache-Control':'no-store'}})
 }catch(e){console.error('controle master visao geral',e);return erro('Não foi possível salvar a alteração. Nenhum status operacional foi modificado.',500)}
}
