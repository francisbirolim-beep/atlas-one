import { repasseHomologacaoAtivo } from '@/lib/atlasChatRepasseServer'
import { acessoPersistenteAtivo } from '@/lib/atlasChatAcessosServer'
import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { obterDistribuicaoWhatsApp } from '@/lib/whatsappEscalonamento'
import { atalhoAtlasChat, pilotoAtivo, usuariosPiloto, escopoPilotoLeitura, pilotoTesteEnvio, equipePilotoEmpresa } from '@/lib/atlasChatPiloto'
export const dynamic = 'force-dynamic'
const reply = (body: object, status=200) => NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}})
export async function GET(req: NextRequest) {
  try {
    if (!pilotoAtivo()) return reply({error:'Piloto desativado.'},403)
    const u=await autenticarTenant(req)
    if (!u || u.role !== 'master'||!escopoPilotoLeitura(u.empresa_id,u.id)) return reply({error:'Acesso exclusivo do Master.'},403)
    const {data,error}=await supabaseAdmin.from('usuarios').select('id,nome,cargo,role').eq('empresa_id',u.empresa_id).order('nome')
    if(error) return reply({error:'Não foi possível consultar usuários.'},500)
    const enabled=usuariosPiloto()
    const distribuicao=await obterDistribuicaoWhatsApp(u.empresa_id)
    const persistente=acessoPersistenteAtivo()
    let liberados=enabled
    if(equipePilotoEmpresa(u.empresa_id)){
      const {data:acessos,error:erroAcesso}=await supabaseAdmin.from('atlas_chat_acessos').select('usuario_id,habilitado').eq('empresa_id',u.empresa_id)
      if(erroAcesso)throw erroAcesso
      const mapa=new Map((acessos||[]).map(a=>[a.usuario_id,a.habilitado]))
      liberados=new Set((data||[]).filter(x=>mapa.has(x.id)?mapa.get(x.id)===true:enabled.has(x.id)).map(x=>x.id))
    }else if(persistente){
      const {data:acessos,error:erroAcesso}=await supabaseAdmin.from('atlas_chat_acessos').select('usuario_id').eq('empresa_id',u.empresa_id).eq('habilitado',true)
      if(erroAcesso)throw erroAcesso
      liberados=new Set((acessos||[]).map(x=>x.usuario_id).filter(id=>enabled.has(id)))
    }
    return reply({distribuicao,persistente,arrobasConfig:pilotoTesteEnvio()&&process.env.ATLAS_CHAT_ARROBAS_CONFIG==='true',repasseHomologacao:repasseHomologacaoAtivo(),vinculosAtivos:persistente&&process.env.ATLAS_CHAT_VINCULOS_PILOTO==='true',usuarios:(data || []).map(x=>({id:x.id,nome:x.nome,cargo:x.cargo,role:x.role,elegivel:enabled.has(x.id),habilitado:liberados.has(x.id),atalho:liberados.has(x.id)?atalhoAtlasChat(x.id):null}))})
  } catch { return reply({error:'Falha ao consultar a homologação.'},500) }
}
