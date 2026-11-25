import { configuracaoEntrada } from '@/lib/atlasChatEntradaServer'
import { atlasChatHabilitado } from '@/lib/atlasChatAcessosServer'
import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { pilotoAtivo, atalhoAtlasChat,escopoPilotoLeitura,pilotoSomenteLeitura,equipePilotoEmpresa } from '@/lib/atlasChatPiloto'
export const dynamic='force-dynamic'
export async function GET(req: NextRequest) {
  const headers={'Cache-Control':'private, no-store'}
  const indisponivel=()=>NextResponse.json({habilitado:false,master:false,seletor:false,central:true},{headers})
  if(!pilotoAtivo())return indisponivel()
  try {
    const u=await autenticarTenant(req)
    if(!u)return NextResponse.json({error:'Entre no Atlas.'},{status:401,headers})
    const equipe=equipePilotoEmpresa(u.empresa_id)
    if(!equipe&&(!escopoPilotoLeitura(u.empresa_id,u.id)||(pilotoSomenteLeitura()&&u.role!=='master')))return indisponivel()
    const entrada=await configuracaoEntrada(u)
    const habilitado=entrada?.chat??await atlasChatHabilitado(u.empresa_id,u.id)
    return NextResponse.json({habilitado,master:u.role==='master'&&escopoPilotoLeitura(u.empresa_id,u.id),seletor:equipe,central:entrada?.central??true,atalho:habilitado?atalhoAtlasChat(u.id):null},{headers})
  } catch {return NextResponse.json({error:'Não foi possível verificar os acessos.'},{status:503,headers})}
}
