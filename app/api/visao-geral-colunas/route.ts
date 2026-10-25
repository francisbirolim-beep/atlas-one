import {NextRequest,NextResponse} from 'next/server'
import {autenticarCompras} from '@/lib/comprasServer'
import {supabaseAdmin as db} from '@/lib/supabaseAdmin'
import {COLUNAS_GERAIS_PADRAO,validarColunasGerais,type ColunaVisualProjeto} from '@/lib/visaoGeralProjetos'
export const dynamic='force-dynamic'
export const runtime='nodejs'
const erro=(mensagem:string,status:number)=>NextResponse.json({erro:mensagem},{status,headers:{'Cache-Control':'no-store'}})
const ausente=(e:any)=>['42P01','PGRST205','PGRST202'].includes(String(e?.code||''))
export async function GET(req:NextRequest){
 try{
  const u=await autenticarCompras(req)
  if(!u)return erro('Sessão inválida',401)
  if(u.role!=='master')return erro('Configuração reservada ao Master.',403)
  const r=await db.from('visao_geral_configuracoes').select('colunas,updated_at').eq('empresa_id',u.empresa_id).maybeSingle()
  if(ausente(r.error))return NextResponse.json({colunas:COLUNAS_GERAIS_PADRAO,configuravel:false,aviso:'A migração visual ainda não foi aplicada.'},{headers:{'Cache-Control':'no-store'}})
  if(r.error)throw r.error
  const colunas=r.data?.colunas||COLUNAS_GERAIS_PADRAO
  const falhas=validarColunasGerais(colunas as ColunaVisualProjeto[])
  if(falhas.length)throw Error('Configuração persistida inconsistente.')
  return NextResponse.json({colunas,configuravel:true,atualizadoEm:r.data?.updated_at||null},{headers:{'Cache-Control':'no-store'}})
 }catch(e){console.error('visao geral colunas GET',e);return erro('Não foi possível carregar a configuração.',500)}
}
export async function POST(req:NextRequest){
 try{
  const u=await autenticarCompras(req)
  if(!u)return erro('Sessão inválida',401)
  if(u.role!=='master')return erro('Somente o Master pode alterar as colunas.',403)
  const b=await req.json().catch(()=>null)
  if(!b||!Array.isArray(b.colunas)||b.colunas.length>30)return erro('Configuração inválida.',400)
  const dados=b.colunas as ColunaVisualProjeto[]
  if(validarColunasGerais(dados).length)return erro('Os vínculos das etapas estão incompletos ou repetidos.',400)
  const r=await db.rpc('salvar_visao_geral_colunas_v1',{p_empresa:u.empresa_id,p_usuario:u.id,p_colunas:dados})
  if(ausente(r.error))return erro('A migração de configuração ainda não foi aplicada.',409)
  if(r.error)throw r.error
  return NextResponse.json({ok:true,colunas:r.data?.colunas||dados},{headers:{'Cache-Control':'no-store'}})
 }catch(e){console.error('visao geral colunas POST',e);return erro('Não foi possível salvar a configuração.',500)}
}
