import { atlasChatHabilitado } from '@/lib/atlasChatAcessosServer'
import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { obterDistribuicaoWhatsApp } from '@/lib/whatsappEscalonamento'
import { pilotoAtivo,escopoPilotoLeitura } from '@/lib/atlasChatPiloto'
import { destinoRepasseAtlas,validarRepasseAtlas,type RepasseConfig } from '@/lib/atlasChatRepasse'
export const dynamic='force-dynamic'
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}})
export async function POST(req:NextRequest){
  try{
    if(!pilotoAtivo())return reply({error:'Piloto desativado.'},403)
    const u=await autenticarTenant(req)
    if(!u||u.role!=='master'||!escopoPilotoLeitura(u.empresa_id,u.id))return reply({error:'Acesso exclusivo do Master.'},403)
    const d=await obterDistribuicaoWhatsApp(u.empresa_id)
    if(!d?.ativo||!d.usuario_principal_id)return reply({error:'Configure primeiro a distribuição existente.'},409)
    const body=await req.json()
    const cfg:RepasseConfig={modo:'automatico',prazoMinutos:Number(body.prazoMinutos),destinoId:typeof body.destinoId==='string'?body.destinoId:null}
    if(!validarRepasseAtlas(cfg,d.usuario_principal_id,d.secundarios_ids))return reply({error:'Selecione um secundário autorizado e um prazo válido.'},400)
    if(!cfg.destinoId||!await atlasChatHabilitado(u.empresa_id,cfg.destinoId))return reply({error:'O destino não está liberado no piloto.'},403)
    const {data:destino,error:errDestino}=await supabaseAdmin.from('usuarios').select('id').eq('empresa_id',u.empresa_id).eq('id',cfg.destinoId).maybeSingle()
    if(errDestino||!destino)return reply({error:'Usuário indisponível.'},403)
    const {data:canal,error:errCanal}=await supabaseAdmin.from('atendimento_whatsapp_canais').select('id').eq('empresa_id',u.empresa_id).eq('principal',true).eq('ativo',true).maybeSingle()
    if(errCanal||!canal)return reply({error:'Canal principal indisponível.'},409)
    const agora=Date.now(),limite=new Date(agora-cfg.prazoMinutos*60000).toISOString()
    // Somente leitura, sem nomes, telefones, mensagens ou alterações de responsabilidade.
    const {data:rows,error}=await supabaseAdmin.from('atendimento_conversas')
      .select('id,empresa_id,whatsapp_canal_id,whatsapp_chat_tipo,responsavel_id,status,ocultar_da_caixa,ultima_entrada_em,ultima_saida_em')
      .eq('empresa_id',u.empresa_id).eq('whatsapp_canal_id',canal.id).eq('whatsapp_chat_tipo','contato')
      .eq('responsavel_id',d.usuario_principal_id).eq('status','aguardando').eq('ocultar_da_caixa',false)
      .lte('ultima_entrada_em',limite).limit(501)
    if(error)throw error
    const ctx={ativo:true,empresa:u.empresa_id,canalPrincipal:canal.id,centralId:d.usuario_principal_id,secundarios:d.secundarios_ids,usuariosAutorizados:[destino.id],config:cfg,agora}
    const amostra=(rows||[]).slice(0,500)
    return reply({simulacao:true,analisadas:amostra.length,elegiveis:amostra.filter(c=>destinoRepasseAtlas(c,ctx)).length,limitado:(rows||[]).length>500})
  }catch{return reply({error:'Não foi possível simular o repasse.'},500)}
}
