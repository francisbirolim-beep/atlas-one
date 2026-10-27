import { NextRequest,NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { permitidoConferirVenda } from '@/lib/conferenciaFinanceiraPermissaoServer'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(req:NextRequest){
 const usuario=await autenticarTenant(req)
 if(!usuario)return NextResponse.json({error:'Sessão expirada.'},{status:401})
 try{
  const permitido=await permitidoConferirVenda(req,usuario)
  return NextResponse.json({permitido,motivo:permitido?null:'Confira o acesso de edição em Vendas e Financeiro do Cliente 360 e seus setores.'},{headers:{'Cache-Control':'private, no-store'}})
 }catch{return NextResponse.json({permitido:false,error:'Não foi possível validar suas permissões. Atualize a página.'},{status:503})}
}
