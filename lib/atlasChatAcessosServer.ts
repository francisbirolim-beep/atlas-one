import {permissoesEntradaAtlas} from '@/lib/atlasChatEntrada'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import {pilotoAtivo,usuariosPiloto,pilotoSomenteLeitura,escopoPilotoLeitura,equipePilotoEmpresa} from '@/lib/atlasChatPiloto'
export const acessoPersistenteAtivo=()=>!pilotoSomenteLeitura()&&process.env.ATLAS_CHAT_ACESSOS_PERSISTENTES==='true'
export async function atlasChatHabilitado(empresa:string,usuario:string){
  if(!pilotoAtivo())return false
  if(equipePilotoEmpresa(empresa)){
    const {data,error}=await supabaseAdmin.from('atlas_chat_acessos').select('habilitado,central_habilitado').eq('empresa_id',empresa).eq('usuario_id',usuario).maybeSingle()
    return !error&&permissoesEntradaAtlas(data,escopoPilotoLeitura(empresa,usuario)).chat
  }
  if(!usuariosPiloto().has(usuario)||!escopoPilotoLeitura(empresa,usuario))return false
  if(!acessoPersistenteAtivo())return true
  const {data,error}=await supabaseAdmin.from('atlas_chat_acessos').select('habilitado').eq('empresa_id',empresa).eq('usuario_id',usuario).maybeSingle()
  return !error&&data?.habilitado===true
}
