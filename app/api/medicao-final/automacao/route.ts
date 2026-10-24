import { createHash } from 'crypto'
import { NextRequest,NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin as db } from '@/lib/supabaseAdmin'
import { EVENTO_AUTOMACAO_MEDIDA_FINAL } from '@/lib/medicaoFinalAutomacaoServer'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const fail=(error:string,status=400)=>NextResponse.json({error},{status})

function idDaConfiguracao(empresa:string){
 const bytes=createHash('sha256').update('atlas-automacao-medida-final:'+empresa).digest()
 bytes[6]=(bytes[6]&0x0f)|0x80
 bytes[8]=(bytes[8]&0x3f)|0x80
 const h=bytes.toString('hex')
 return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`
}
async function validarMaster(req:NextRequest){
 const u=await autenticarTenant(req)
 if(!u)return {user:null,status:401}
 if(u.role!=='master')return {user:null,status:403}
 return {user:u,status:200}
}
export async function GET(req:NextRequest){
 const auth=await validarMaster(req)
 if(!auth.user)return fail('Apenas usuário Master pode configurar automações.',auth.status)
 const [r,u]=await Promise.all([
  db.from('workflow_automacoes').select('id,ativo,criar_tarefa,notificar_usuario_ids')
   .eq('empresa_id',auth.user.empresa_id).eq('evento_chave',EVENTO_AUTOMACAO_MEDIDA_FINAL)
   .order('created_at',{ascending:false}).limit(1).maybeSingle(),
  db.from('usuarios').select('id,nome').eq('empresa_id',auth.user.empresa_id).order('nome'),
 ])
 if(r.error||u.error)return fail('Não foi possível carregar configurações.',500)
 return NextResponse.json({ativo:!!r.data?.ativo,responsaveis:r.data?.notificar_usuario_ids||[],usuarios:u.data||[]})
}
export async function POST(req:NextRequest){
 const auth=await validarMaster(req)
 if(!auth.user)return fail('Apenas usuário Master pode configurar automações.',auth.status)
 const body=await req.json().catch(()=>({}))
 const ids=[...new Set(Array.isArray(body.responsaveis)?body.responsaveis:[])]
 if(ids.length>15||ids.some(id=>typeof id!=='string'||!uuid.test(id)))return fail('Escolha até 15 responsáveis válidos.')
 const ativo=body.ativo===true
 if(ativo&&ids.length===0)return fail('Selecione pelo menos um responsável para ativar.')
 if(ids.length){
  const {data,error}=await db.from('usuarios').select('id')
   .eq('empresa_id',auth.user.empresa_id).in('id',ids)
  if(error||data?.length!==ids.length)return fail('Responsável não pertence à empresa.',403)
 }
 const {data:existente,error:erroBusca}=await db.from('workflow_automacoes')
  .select('id').eq('empresa_id',auth.user.empresa_id)
  .eq('evento_chave',EVENTO_AUTOMACAO_MEDIDA_FINAL)
  .order('created_at',{ascending:false}).limit(1).maybeSingle()
 if(erroBusca)return fail('Não foi possível conferir a automação.',500)
 const payload={
  ativo,criar_tarefa:ativo,notificar_usuario_ids:ids,
  nome:'Medida Final enviada → tarefas de conferência',
  acao_tipo:'reservado',evento_chave:EVENTO_AUTOMACAO_MEDIDA_FINAL,
  prioridade_tarefa:'alta',evitar_duplicidade:true,notificar_responsavel:false,
  updated_at:new Date().toISOString(),
 }
 const {error}=existente
  ?await db.from('workflow_automacoes').update(payload).eq('id',existente.id).eq('empresa_id',auth.user.empresa_id)
  :await db.from('workflow_automacoes').insert({
    id:idDaConfiguracao(auth.user.empresa_id),empresa_id:auth.user.empresa_id,...payload,
   })
 if(error)return fail('Não foi possível salvar a configuração.',500)
 return NextResponse.json({ok:true,ativo,responsaveis:ids})
}
