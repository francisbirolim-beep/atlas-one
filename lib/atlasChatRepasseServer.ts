import {atlasChatHabilitado} from '@/lib/atlasChatAcessosServer'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import {pilotoAtivo,pilotoSomenteLeitura} from '@/lib/atlasChatPiloto'
export function repasseHomologacaoAtivo(){
 const ref=process.env.ATLAS_CHAT_REF_HOMOLOGACAO||''
 if(!pilotoAtivo()||pilotoSomenteLeitura()||process.env.ATLAS_CHAT_REPASSE_HOMOLOGACAO!=='true'||!(/^[a-z0-9]{20}$/).test(ref)||ref==='urtqbvjpwnrfaayolymt')return false
 try{const u=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL||'');return u.origin==='https://'+ref+'.supabase.co'&&u.pathname==='/'&&!u.search&&!u.hash&&!u.username&&!u.password}catch{return false}
}
export async function executarRepasseHomologacao(empresa:string,numeroPermitido:(n:string)=>boolean){
 if(!repasseHomologacaoAtivo())throw Error('Repasse fora da homologação.')
 const {data:cfg,error:ec}=await supabaseAdmin.from('atlas_chat_repasse_config').select('ativo,destino_id,prazo_minutos').eq('empresa_id',empresa).maybeSingle()
 if(ec)throw ec
 if(!cfg?.ativo||!await atlasChatHabilitado(empresa,cfg.destino_id))return {repassados:0,analisados:0}
 const {data:d,error:ed}=await supabaseAdmin.from('atendimento_whatsapp_distribuicao').select('ativo,usuario_principal_id').eq('empresa_id',empresa).maybeSingle()
 if(ed)throw ed
 if(!d?.ativo||!d.usuario_principal_id)return {repassados:0,analisados:0}
 const limite=new Date(Date.now()-cfg.prazo_minutos*60000).toISOString()
 const {data:rows,error}=await supabaseAdmin.from('atendimento_conversas').select('id,telefone')
 .eq('empresa_id',empresa).eq('responsavel_id',d.usuario_principal_id).eq('status','aguardando').eq('whatsapp_chat_tipo','contato').eq('ocultar_da_caixa',false).lte('ultima_entrada_em',limite).order('ultima_entrada_em').limit(100)
 if(error)throw error
 let repassados=0,analisados=0
 for(const c of rows||[]){
  if(!numeroPermitido(c.telefone))continue
  analisados++
  const {data,error:e}=await supabaseAdmin.rpc('atlas_chat_repassar_pendencia',{p_empresa:empresa,p_conversa:c.id,p_destino_esperado:cfg.destino_id})
  if(e)throw e
  if(data==='repassado')repassados++
 }
 return {repassados,analisados}
}
