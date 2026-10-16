import { NextRequest,NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { carregarPermissoesRelatorios,autorizarRelatorio } from '@/lib/relatoriosPermissoesServer'
import { RELATORIOS_PERMISSOES } from '@/lib/relatoriosPermissoes'
export const dynamic='force-dynamic'
export async function GET(req:NextRequest){
 const usuario=await autenticarTenant(req)
 if(!usuario)return NextResponse.json({error:'Sessão inválida.'},{status:401})
 const id=req.nextUrl.searchParams.get('relatorio')
 if(id){
  const report=RELATORIOS_PERMISSOES.find(([r])=>r===id)
  if(!report)return NextResponse.json({error:'Relatório inválido.'},{status:400})
  const bloqueio=await autorizarRelatorio(req,usuario,report[0])
  if(bloqueio)return bloqueio
  return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}})
 }
 try{return NextResponse.json(await carregarPermissoesRelatorios(usuario),{headers:{'Cache-Control':'no-store'}})}
 catch{return NextResponse.json({error:'Não foi possível conferir as permissões.'},{status:503})}
}
