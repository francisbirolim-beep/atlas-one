import {pilotoSomenteLeitura} from '@/lib/atlasChatPiloto'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import type {OcultacaoAtlas} from '@/lib/atlasChatHistorico'
export const historicoAtlasAtivo=()=>!pilotoSomenteLeitura()&&process.env.ATLAS_CHAT_HISTORICO_PILOTO==='true'
export async function ocultacoesAtlas(empresa:string,usuario:string):Promise<OcultacaoAtlas[]>{
 if(!historicoAtlasAtivo())return []
 const rows:OcultacaoAtlas[]=[]
 for(let offset=0;;offset+=500){
  const {data,error}=await supabaseAdmin.from('atlas_chat_ocultacoes').select('conversa_id,mensagem_id,ocultado_em').eq('empresa_id',empresa).eq('usuario_id',usuario).is('restaurado_em',null).order('id').range(offset,offset+499)
  if(error)throw error
  rows.push(...(data||[]))
  if(!data||data.length<500)return rows
  if(offset>=9500)throw Error('Limite de ocultações atingido; solicite revisão ao Master.')
 }
}
