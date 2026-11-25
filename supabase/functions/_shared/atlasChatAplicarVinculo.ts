import {avaliarRoteamentoAtlas} from './atlasChatRoteamento.ts'
type Entrada=Parameters<typeof avaliarRoteamentoAtlas>[1]
const principal='urtqbvjpwnrfaayolymt'
export function ambienteVinculoIsolado(ativo:boolean,url:string,ref:string){
 if(!ativo||!(/^[a-z0-9]{20}$/).test(ref)||ref===principal)return false
 try{const u=new URL(url);return u.origin==='https://'+ref+'.supabase.co'&&u.pathname==='/'&&!u.search&&!u.hash&&!u.username&&!u.password}catch{return false}
}
export async function aplicarVinculoEncerrado(db:any,e:Entrada & {existente:(NonNullable<Entrada['existente']>&{updated_at?:string|null})|null},opts:{ativo:boolean;url:string;ref:string}){
 if(!ambienteVinculoIsolado(opts.ativo,opts.url,opts.ref)||!e.existente||e.existente.status!=='finalizado'||!e.existente.updated_at)return null
 const decisao=await avaliarRoteamentoAtlas(db,e)
 if(decisao.motivo!=='vendedor'||!decisao.destino)return null
 const {data,error}=await db.rpc('atlas_chat_atribuir_encerrada',{
  p_empresa:e.empresa,p_canal:e.canal.id,p_conversa:e.existente.id,p_telefone:e.telefone,
  p_responsavel_anterior:e.existente.responsavel_id||null,p_atualizado_em:e.existente.updated_at,p_destino:decisao.destino,
 })
 // Nunca voltar a uma atualização de responsável baseada na leitura antiga,
 // mesmo se a RPC detectar conflito ou não puder confirmar a gravação.
 if(error)throw Error('Atribuição de homologação indisponível; repetir entrada')
 const {data:atual,error:leitura}=await db.from('atendimento_conversas').select('*')
  .eq('empresa_id',e.empresa).eq('whatsapp_canal_id',e.canal.id).eq('id',e.existente.id).maybeSingle()
 if(leitura||!atual)throw Error('Conversa indisponível após avaliação')
 if(data==='atribuido')return atual
 if(data==='conflito'&&atual.status!=='finalizado')return atual
 // A entrada precisa ser reavaliada sem assumir a propriedade antiga.
 throw Error('Vínculo alterado durante atribuição; repetir entrada')
}
