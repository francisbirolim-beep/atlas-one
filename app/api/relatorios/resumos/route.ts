import { NextRequest,NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { autorizarRelatorio,carregarPermissoesRelatorios } from '@/lib/relatoriosPermissoesServer'
import { carregarResumoComercial,carregarResumoMedicao } from '@/lib/relatoriosResumoServer'
export const dynamic='force-dynamic'
export async function GET(req:NextRequest){
 const usuario=await autenticarTenant(req)
 if(!usuario)return NextResponse.json({error:'Sessão inválida.'},{status:401})
 const tipo=req.nextUrl.searchParams.get('tipo')
 if(tipo!=='comercial'&&tipo!=='producao')return NextResponse.json({error:'Relatório inválido.'},{status:400})
 const bloqueio=await autorizarRelatorio(req,usuario,tipo)
 if(bloqueio)return bloqueio
 const inicio=req.nextUrl.searchParams.get('inicio')||'',fim=req.nextUrl.searchParams.get('fim')||''
 if(!/^\d{4}-\d{2}-\d{2}$/.test(inicio)||!/^\d{4}-\d{2}-\d{2}$/.test(fim)||!Number.isFinite(Date.parse(inicio))||!Number.isFinite(Date.parse(fim))||inicio>fim)
  return NextResponse.json({error:'Período inválido.'},{status:400})
 try{
  const acesso=(await carregarPermissoesRelatorios(usuario))[tipo]
  const dados=tipo==='comercial'?await carregarResumoComercial({inicio,fim},usuario,acesso.proprios):await carregarResumoMedicao({inicio,fim},usuario)
  return NextResponse.json(dados,{headers:{'Cache-Control':'private, no-store'}})
 }catch{return NextResponse.json({error:'Não foi possível carregar o relatório completo. Reduza o período e tente novamente.'},{status:500})}
}
