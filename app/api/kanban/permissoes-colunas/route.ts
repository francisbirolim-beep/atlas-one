import {NextRequest,NextResponse} from 'next/server'
import {autenticarCompras} from '@/lib/comprasServer'
import {supabaseAdmin as db} from '@/lib/supabaseAdmin'
import {QUADROS} from '@/lib/centralKanban'
export const dynamic='force-dynamic'
const erro=(m:string,s=400)=>NextResponse.json({erro:m},{status:s})
const permitidos=['oculto','consultar','gerenciar'] as const
async function autenticarMaster(req:NextRequest){const u=await autenticarCompras(req);return u?.role==='master'?u:null}
async function catalogoQuadros(empresa:string){
 const [central,comercial,setores]=await Promise.all([
  db.from('central_kanban_colunas').select('setor').eq('empresa_id',empresa),
  db.from('kanban_colunas').select('id').eq('empresa_id',empresa).limit(1),
  db.from('setor_kanban_colunas').select('setor_id').eq('empresa_id',empresa),
 ])
 if(central.error||comercial.error||setores.error)throw central.error||comercial.error||setores.error
 const nomes=new Map(QUADROS.map(q=>[q.id,q.nome]))
 const chaves=[...new Set([
  ...(central.data||[]).map(c=>'central:'+c.setor),
  ...((comercial.data||[]).length?['orcamento:comercial']:[]),
  ...(setores.data||[]).map(c=>'setor:'+c.setor_id)
 ])]
 return chaves.map(id=>{const [tipo,setor]=id.split(':');return{id,nome:
  (tipo==='central'?'Central':tipo==='setor'?'Setor':'Orçamento')+' · '+(nomes.get(setor as typeof QUADROS[number]['id'])||setor.replaceAll('-',' '))}})
  .sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'))
}
export async function GET(req:NextRequest){
 const u=await autenticarMaster(req);if(!u)return erro('Somente Master pode gerenciar liberações dos Kanbans',403)
 try{
  const [usuarios,permissoes,quadros]=await Promise.all([
   db.from('usuarios').select('id,nome,role').eq('empresa_id',u.empresa_id).order('nome'),
   db.from('kanban_layout_permissoes').select('usuario_id,quadro,nivel,updated_at').eq('empresa_id',u.empresa_id),
   catalogoQuadros(u.empresa_id)
  ])
  if(usuarios.error||permissoes.error)throw usuarios.error||permissoes.error
  return NextResponse.json({usuarios:(usuarios.data||[]).filter(x=>x.role!=='master'),permissoes:permissoes.data||[],quadros,
   aviso:'Nenhum usuário recebe acesso automaticamente. Autorizações aplicam-se somente à organização das colunas, não aos dados financeiros ou à movimentação dos cards.'},
   {headers:{'Cache-Control':'no-store'}})
 }catch(e){console.error('[kanban permission GET]',e);return erro('Não foi possível consultar as autorizações',503)}
}
export async function POST(req:NextRequest){
 const u=await autenticarMaster(req);if(!u)return erro('Somente Master pode autorizar usuários',403)
 try{
  const b=await req.json().catch(()=>null)
  const usuarioId=String(b?.usuarioId||''),quadro=String(b?.quadro||''),nivel=String(b?.nivel||'')
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(usuarioId)||!permitidos.includes(nivel as typeof permitidos[number]))return erro('Usuário ou nível inválido')
  const quadroValido=(await catalogoQuadros(u.empresa_id)).some(x=>x.id===quadro)
  if(!quadroValido)return erro('Quadro inválido ou inexistente')
  const {data:usuario,error:eUsuario}=await db.from('usuarios').select('id,role').eq('empresa_id',u.empresa_id).eq('id',usuarioId).maybeSingle()
  if(eUsuario)throw eUsuario
  if(!usuario||usuario.role==='master')return erro('Usuário não encontrado ou acesso Master protegido',404)
  const {error}=await db.from('kanban_layout_permissoes').upsert({empresa_id:u.empresa_id,usuario_id:usuarioId,
   quadro,nivel,atualizado_por_id:u.id,updated_at:new Date().toISOString()},
   {onConflict:'empresa_id,usuario_id,quadro'})
  if(error)throw error
  return NextResponse.json({ok:true,usuarioId,quadro,nivel,documentado:true})
 }catch(e){console.error('[kanban permission POST]',e);return erro('Não foi possível alterar a autorização',503)}
}
