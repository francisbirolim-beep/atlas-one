import {NextRequest,NextResponse} from 'next/server'
import {autenticarTenant} from '@/lib/tenantServer'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import {usuarioPodeAcaoServer} from '@/lib/acessoUsuarioServer'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const erro=(texto:string,status=400)=>NextResponse.json({error:texto},{status})
async function acesso(req:NextRequest,edicao:boolean){
 const usuario=await autenticarTenant(req)
 if(!usuario)return null
 const permitido=await usuarioPodeAcaoServer({
  usuarioId:usuario.id,role:usuario.role,empresaId:usuario.empresa_id,
  setorId:'producao',acaoId:'producao_ordens',minimo:edicao?'edicao':'consulta',
 })
 return permitido?usuario:null
}
export async function GET(req:NextRequest){
 const usuario=await acesso(req,false)
 if(!usuario)return erro('Sem acesso à Produção.',403)
 const cardId=req.nextUrl.searchParams.get('cardId')||''
 if(!uuid.test(cardId))return erro('Card inválido.')
 try{
  const {data:ordens,error:oe}=await supabaseAdmin.from('ordens_producao')
   .select('id,quantidade,status,quantidade_produzida')
   .eq('empresa_id',usuario.empresa_id).eq('setor_card_id',cardId).neq('status','cancelada')
  if(oe)throw oe
  const ids=(ordens||[]).map(x=>x.id)
  if(!ids.length)return NextResponse.json({ok:true,ordens:[],unidades:[]},{headers:{'Cache-Control':'private,no-store'}})
  const {data:unidades,error:ue}=await supabaseAdmin.from('ordens_producao_unidades')
   .select('ordem_id,indice,status,produzido_em,produzido_por_nome')
   .eq('empresa_id',usuario.empresa_id).in('ordem_id',ids).order('indice')
  if(ue)throw ue
  return NextResponse.json({ok:true,ordens,unidades:unidades||[]},{headers:{'Cache-Control':'private,no-store'}})
 }catch(e){console.error('[Produção][Unidades][GET]',e);return erro('Falha ao consultar unidades da produção.',500)}
}
export async function POST(req:NextRequest){
 const usuario=await acesso(req,true)
 if(!usuario)return erro('Sem permissão de edição na Produção.',403)
 const body=await req.json().catch(()=>({}))
 const ordemId=String(body.ordemId||'')
 const indices=body.indices
 if(!uuid.test(ordemId)||!Array.isArray(indices)||!indices.length||
   indices.length>300||indices.some((x:unknown)=>!Number.isInteger(x)||Number(x)<1)||
   new Set(indices).size!==indices.length)return erro('Seleção de unidades inválida.')
 try{
  const {data,error}=await supabaseAdmin.rpc('fn_marcar_producao_unidades_v1',{
   p_empresa:usuario.empresa_id,p_ordem:ordemId,p_indices:indices,p_usuario:usuario.id,p_nome:usuario.nome,
  })
  if(error)return erro(error.message,409)
  return NextResponse.json({ok:true,unidades:data||[]},{headers:{'Cache-Control':'private,no-store'}})
 }catch(e){console.error('[Produção][Unidades][POST]',e);return erro('Falha ao registrar a produção parcial.',500)}
}
