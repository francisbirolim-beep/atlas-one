import { nomeContatoAtlas } from '@/lib/atlasChatNomes'
import { COOKIE_TESTE_ATLAS,assinarTesteAtlas,lerTesteAtlas } from '@/lib/atlasChatTesteServer'
import { estadoConexaoAtlas,cursorLeituraAtlas } from '@/lib/atlasChatLeitura'
import { lerMensagensAtlas } from '@/lib/atlasChatLeituraServer'
import { historicoAtlasAtivo,ocultacoesAtlas } from '@/lib/atlasChatHistoricoServer'
import { conversaVisivelAtlas,mensagemVisivelAtlas } from '@/lib/atlasChatHistorico'
import { atlasChatHabilitado } from '@/lib/atlasChatAcessosServer'
import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { pilotoAtivo,pilotoSomenteLeitura,pilotoTesteEnvio,equipePilotoEmpresa,escopoPilotoLeitura } from '@/lib/atlasChatPiloto'
import { conversaDoAtlasChat, aberturaContatoAtlasChat, telefoneAtlasChat, telefoneLiberadoNoPiloto } from '@/lib/atlasChatIndividual'
import { enviarTextoWhatsApp, iniciarConversaWhatsApp, prepararUploadMidiaAtendimento, enviarMidiaWhatsApp, reagirMensagemWhatsApp, assumirConversa } from '@/lib/whatsappServer'
import { mimeAtlasChat,tamanhoAtlasChat,caminhoAtlasChat } from '@/lib/atlasChatMidia'
import { assinarUploadAtlas,validarUploadAtlas } from '@/lib/atlasChatUploadServer'
import { EMOJIS_REACAO } from '@/lib/chatEmojis'
export const dynamic = 'force-dynamic'
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
async function contexto(req: NextRequest) {
  // Desativado por padrão. Não conectar ambiente de homologação à produção.
  if (!pilotoAtivo()) return null
  const u = await autenticarTenant(req)
  if (!u || (pilotoSomenteLeitura()&&!equipePilotoEmpresa(u.empresa_id)&&u.role!=='master') || !await atlasChatHabilitado(u.empresa_id,u.id)) return null
  const { data, error } = await supabaseAdmin.from('atendimento_whatsapp_canais').select('id,gateway_status,conexao_pausada')
    .eq('empresa_id', u.empresa_id).eq('principal', true).eq('ativo', true).maybeSingle()
  if (error || !data) return null
  return { u, principal: data.id as string, conectado: estadoConexaoAtlas(data), testeManual:pilotoTesteEnvio()&&u.role==='master'&&escopoPilotoLeitura(u.empresa_id,u.id) }
}
function testeAtual(req:NextRequest,ctx:NonNullable<Awaited<ReturnType<typeof contexto>>>){
  if(!ctx.testeManual)return null
  return lerTesteAtlas(req.cookies.get(COOKIE_TESTE_ATLAS)?.value||'',process.env.SUPABASE_SECRET_KEY||'',{empresa:ctx.u.empresa_id,usuario:ctx.u.id,canal:ctx.principal})
}
async function propria(id: string, ctx: NonNullable<Awaited<ReturnType<typeof contexto>>>) {
  const { data, error } = await supabaseAdmin.from('atendimento_conversas').select('*')
    .eq('id', id).eq('empresa_id', ctx.u.empresa_id).eq('responsavel_id', ctx.u.id).maybeSingle()
  return !error && data && conversaDoAtlasChat(data, ctx.u, ctx.principal) ? data : null
}
export async function GET(req: NextRequest) {
  try {
    const ctx = await contexto(req)
    if (!ctx) return reply({ error: 'Atlas Chat não liberado para esta sessão.' }, 403)
    const expected = req.nextUrl.searchParams.get('usuario')
    if (expected && expected !== ctx.u.id) return reply({ error: 'Este atalho pertence a outro usuário.' }, 403)
    const id = req.nextUrl.searchParams.get('conversaId')
    if (id) {
      if (!await propria(id, ctx)) return reply({ error: 'Conversa indisponível.' }, 403)
      const em=req.nextUrl.searchParams.get('antesEm'),anteriorId=req.nextUrl.searchParams.get('antesId')
      const antes=cursorLeituraAtlas(em,anteriorId)
      if((em!==null||anteriorId!==null)&&!antes)return reply({error:'Página inválida.'},400)
      const result = await lerMensagensAtlas(ctx.u.empresa_id,id,antes)
      if (!result || !await propria(id, ctx)) return reply({ error: 'Conversa indisponível.' }, 403)
      const ocultas=await ocultacoesAtlas(ctx.u.empresa_id,ctx.u.id)
      return reply({...result,mensagens:result.mensagens.filter(m=>mensagemVisivelAtlas(m,ocultas,id))})
    }
    // Consulta restrita no banco; não executar rotinas da caixa geral ou de grupos.
    const { data: rows, error } = await supabaseAdmin.from('atendimento_conversas')
      .select('id,empresa_id,responsavel_id,whatsapp_canal_id,whatsapp_chat_tipo,ocultar_da_caixa,telefone,contato_nome,ultimo_preview,nao_lidas,status,ultima_mensagem_em')
      .eq('empresa_id',ctx.u.empresa_id).eq('responsavel_id',ctx.u.id).eq('whatsapp_canal_id',ctx.principal)
      .eq('whatsapp_chat_tipo','contato').eq('ocultar_da_caixa',false).order('ultima_mensagem_em',{ascending:false})
    if(error)throw error
    const ocultas=await ocultacoesAtlas(ctx.u.empresa_id,ctx.u.id)
    const nomes=new Map<string,string>()
    const nomesAtivos=ctx.testeManual&&process.env.ATLAS_CHAT_NOMES_PESSOAIS==='true'
    if(nomesAtivos){
      const {data:apelidos,error:erroNomes}=await supabaseAdmin.from('atlas_chat_nomes_pessoais').select('telefone,nome')
        .eq('empresa_id',ctx.u.empresa_id).eq('usuario_id',ctx.u.id).eq('canal_id',ctx.principal)
      if(erroNomes)throw erroNomes
      for(const a of apelidos||[])nomes.set(a.telefone,a.nome)
    }
    return reply({ nomesAtivos,testeManual:ctx.testeManual,testeConversaId:testeAtual(req,ctx)?.conversa||null,somenteLeitura:pilotoSomenteLeitura(),historicoAtivo:historicoAtlasAtivo(),conectado:ctx.conectado,envioAtivo:(!pilotoSomenteLeitura()||ctx.testeManual)&&ctx.conectado&&process.env.ATLAS_CHAT_ENVIO_PILOTO==='true',cadastroAtivo:(!pilotoSomenteLeitura()||ctx.testeManual)&&ctx.conectado&&process.env.ATLAS_CHAT_ENVIO_PILOTO==='true'&&process.env.ATLAS_CHAT_CADASTRO_PILOTO==='true',usuario: { id: ctx.u.id, nome: ctx.u.nome }, conversas: (rows||[]).filter(c => conversaDoAtlasChat(c, ctx.u, ctx.principal)&&conversaVisivelAtlas(c,ocultas)).map(c=>({id:c.id,telefone:c.telefone,contato_nome:nomes.get(telefoneAtlasChat(c.telefone))||c.contato_nome,ultimo_preview:c.ultimo_preview,nao_lidas:c.nao_lidas,status:c.status})) })
  } catch { return reply({ error: 'Não foi possível consultar o Atlas Chat.' }, 500) }
}
export async function POST(req: NextRequest) {
  if(pilotoSomenteLeitura()&&!pilotoTesteEnvio())return reply({error:'Piloto somente para consulta.'},403)
  try {
    const ctx = await contexto(req)
    // Segundo bloqueio: piloto pode ser somente leitura. Nunca envia por padrão.
    if (!ctx||(pilotoSomenteLeitura()&&!ctx.testeManual)) return reply({ error: 'Envio real ainda não liberado.' }, 403)
    const expected = req.nextUrl.searchParams.get('usuario')
    if (expected && expected !== ctx.u.id) return reply({ error: 'Este atalho pertence a outro usuário.' }, 403)
    const body = await req.json()
    if(body.acao==='editar_nome'){
      if(!pilotoTesteEnvio()||process.env.ATLAS_CHAT_NOMES_PESSOAIS!=='true')return reply({error:'Edição não liberada.'},403)
      const c=await propria(typeof body.conversaId==='string'?body.conversaId:'',ctx)
      const nome=nomeContatoAtlas(body.nome)
      const telefone=c?telefoneAtlasChat(c.telefone):''
      if(!c||!telefone)return reply({error:'Contato indisponível.'},403)
      if(!nome)return reply({error:'Informe um nome de até 120 caracteres.'},400)
      const {error}=await supabaseAdmin.from('atlas_chat_nomes_pessoais').upsert({empresa_id:ctx.u.empresa_id,usuario_id:ctx.u.id,canal_id:ctx.principal,telefone,nome,updated_at:new Date().toISOString()},{onConflict:'empresa_id,usuario_id,canal_id,telefone'})
      if(error)throw error
      return reply({ok:true,nome})
    }
    if(body.acao==='ocultar'){
      if(!historicoAtlasAtivo())return reply({error:'Ocultação ainda não liberada.'},403)
      const id=typeof body.conversaId==='string'?body.conversaId:''
      if(!await propria(id,ctx))return reply({error:'Conversa indisponível.'},403)
      const mensagemId=typeof body.mensagemId==='string'?body.mensagemId:null
      if(mensagemId){
        const {data,error}=await supabaseAdmin.from('atendimento_mensagens').select('id').eq('empresa_id',ctx.u.empresa_id).eq('conversa_id',id).eq('id',mensagemId).maybeSingle()
        if(error||!data)return reply({error:'Mensagem indisponível nesta conversa.'},403)
      }
      if(!await propria(id,ctx))return reply({error:'Conversa indisponível.'},403)
      const {error}=await supabaseAdmin.from('atlas_chat_ocultacoes').insert({empresa_id:ctx.u.empresa_id,usuario_id:ctx.u.id,conversa_id:id,mensagem_id:mensagemId})
      if(error&&error.code!=='23505')throw error
      return reply({ok:true})
    }
    if(!ctx.conectado)return reply({error:'WhatsApp desconectado. O histórico permanece disponível.'},409)
    if(process.env.ATLAS_CHAT_ENVIO_PILOTO !== 'true')return reply({error:'Envio real ainda não liberado.'},403)
    if (body.acao === 'novo_contato') {
      // Somente números expressamente autorizados no ambiente isolado.
      if (process.env.ATLAS_CHAT_CADASTRO_PILOTO !== 'true') return reply({error:'Cadastro real não liberado. Utilize a homologação.'},403)
      const telefone = typeof body.telefone === 'string' ? telefoneAtlasChat(body.telefone) : ''
      const nome = typeof body.nome === 'string' ? body.nome.trim() : ''
      if (!telefone || !nome || nome.length > 120) return reply({error:'Informe nome e telefone com DDD.'},400)
      if(pilotoTesteEnvio()&&body.autorizado!==true)return reply({error:'Confirme que o destinatário autorizou o teste.'},400)
      if (!pilotoTesteEnvio()&&!telefoneLiberadoNoPiloto(telefone,process.env.ATLAS_CHAT_NUMEROS_TESTE || '')) return reply({error:'Número não autorizado para o piloto.'},403)
      const {data: existentes,error} = await supabaseAdmin.from('atendimento_conversas').select('*')
        .eq('empresa_id',ctx.u.empresa_id).eq('canal','whatsapp').eq('whatsapp_canal_id',ctx.principal)
        .or('telefone.eq.'+telefone+',whatsapp_chat_jid.eq.'+telefone+'@s.whatsapp.net')
      if (error) throw error
      const decisao=aberturaContatoAtlasChat(existentes||[],ctx.u,ctx.principal)
      if(decisao==='central')return reply({error:'Contato já registrado ou vínculo ambíguo. Solicite à central.'},409)
      // Não alterar nomes, reabrir ou assumir contatos existentes neste piloto.
      const contato=decisao==='proprio' ? existentes![0] : await iniciarConversaWhatsApp(ctx.u,{canalId:ctx.principal,tipo:'contato',jid:telefone+'@s.whatsapp.net',telefone,nome,somenteNovoAtlas:pilotoTesteEnvio()})
      if(!conversaDoAtlasChat(contato,ctx.u,ctx.principal))return reply({error:'Vínculo indisponível.'},409)
      const r=reply({ok:true,conversa:{id:contato.id,telefone:contato.telefone,contato_nome:contato.contato_nome,status:contato.status}})
      if(pilotoTesteEnvio()){
        if(contato.whatsapp_chat_jid!==telefone+'@s.whatsapp.net'||contato.status==='finalizado')return reply({error:'Contato encerrado ou identificação ambígua. Escolha outro número de teste.'},409)
        const ticket=assinarTesteAtlas({empresa:ctx.u.empresa_id,usuario:ctx.u.id,canal:ctx.principal,conversa:contato.id,telefone,exp:Date.now()+7200000},process.env.SUPABASE_SECRET_KEY||'')
        r.cookies.set(COOKIE_TESTE_ATLAS,ticket,{httpOnly:true,secure:true,sameSite:'strict',path:'/api/atlas-chat',maxAge:7200})
      }
      return r
    }
    const id = String(body.conversaId || '')
    const c = await propria(id, ctx)
    if (!c) return reply({ error: 'Conversa indisponível.' }, 403)
    if(pilotoTesteEnvio()){
      const teste=testeAtual(req,ctx)
      if(!teste||teste.conversa!==c.id||teste.telefone!==c.telefone||c.whatsapp_chat_jid!==teste.telefone+'@s.whatsapp.net')return reply({error:'Selecione um contato autorizado pelo botão +.'},403)
    }else if (!telefoneLiberadoNoPiloto(c.telefone,process.env.ATLAS_CHAT_NUMEROS_TESTE || '')) return reply({error:'Número não autorizado para envio no piloto.'},403)
    if(pilotoTesteEnvio()&&(body.acao==='reagir'||body.respostaMensagemId)){
      const mensagemId=body.acao==='reagir'?body.mensagemId:body.respostaMensagemId
      if(typeof mensagemId!=='string')return reply({error:'Mensagem inválida.'},400)
      const {data,error}=await supabaseAdmin.from('atendimento_mensagens').select('id').eq('empresa_id',ctx.u.empresa_id).eq('conversa_id',c.id).eq('id',mensagemId).maybeSingle()
      if(error||!data)return reply({error:'Mensagem fora da conversa de teste.'},403)
    }
    if(body.acao==='assumir_proprio'){
      if(c.status==='em_atendimento')return reply({ok:true})
      if(c.status!=='aguardando')return reply({error:'Este atendimento não pode ser iniciado por aqui.'},409)
      if(!await propria(id,ctx))return reply({error:'Conversa indisponível.'},403)
      await assumirConversa(id,ctx.u,{somentePropria:true})
      return reply({ok:true})
    }
    if (c.status !== 'em_atendimento') return reply({ error: 'Atendimento ainda não iniciado. Solicite à central.' }, 409)
    if (body.acao === 'preparar_midia' || body.acao === 'enviar_midia') {
      const nome=typeof body.nome==='string'?body.nome.trim():''
      const mime=typeof body.mimeType==='string'?mimeAtlasChat(nome,body.mimeType):''
      const bytes=typeof body.tamanho==='number'?body.tamanho:0
      if(!nome||nome.length>240||!mime||!tamanhoAtlasChat(bytes))return reply({error:'Arquivo inválido ou não suportado (até 50 MB).'},400)
      const secret=process.env.SUPABASE_SECRET_KEY||''
      if(body.acao==='preparar_midia'){
        const prep=await prepararUploadMidiaAtendimento(id,{nome,mimeType:mime,tamanho:bytes},ctx.u)
        const ticket=assinarUploadAtlas({usuario:ctx.u.id,empresa:ctx.u.empresa_id,conversa:id,path:prep.path,mime,bytes,nome,exp:Date.now()+10*60*1000},secret)
        return reply({...prep,ticket})
      }
      const path=String(body.mediaPath||'')
      const expectedUpload={usuario:ctx.u.id,empresa:ctx.u.empresa_id,conversa:id,path,mime,bytes,nome}
      if(!caminhoAtlasChat(path,ctx.u.empresa_id,id)||!validarUploadAtlas(String(body.ticket||''),secret,expectedUpload))return reply({error:'Autorização de mídia inválida ou vencida.'},403)
      const partes=path.split('/'),arquivo=partes.pop()!
      const {data:objetos,error:erroObjetos}=await supabaseAdmin.storage.from('whatsapp-midia').list(partes.join('/'),{search:arquivo,limit:100})
      if(erroObjetos||!objetos?.some(o=>o.name===arquivo&&Number(o.metadata?.size)===bytes))return reply({error:'Arquivo não encontrado ou tamanho divergente.'},409)
      if(!await propria(id,ctx))return reply({error:'Conversa indisponível.'},403)
      await enviarMidiaWhatsApp(id,{mediaPath:path,mimeType:mime,fileName:nome,tamanho:bytes,legenda:typeof body.legenda==='string'?body.legenda.slice(0,1024):null,ptt:body.ptt===true},ctx.u)
      return reply({ok:true})
    }
    if(body.acao==='reagir'){
      if(!EMOJIS_REACAO.includes(body.emoji))return reply({error:'Reação inválida.'},400)
      await reagirMensagemWhatsApp(id,String(body.mensagemId||''),body.emoji,ctx.u)
      return reply({ok:true})
    }
    if(body.acao&&body.acao!=='enviar_texto')return reply({error:'Operação não reconhecida.'},400)
    const texto = typeof body.texto === 'string' ? body.texto.trim() : ''
    if (!texto || texto.length > 4096) return reply({ error: 'Mensagem inválida.' }, 400)
    // Não assumir fila nem reabrir automaticamente nesta fase. A API existente
    // também valida responsável e status antes de enviar pelo gateway.
    if (c.status !== 'em_atendimento') return reply({ error: 'Atendimento ainda não iniciado. Solicite à central.' }, 409)
    await enviarTextoWhatsApp(id, texto, ctx.u, typeof body.respostaMensagemId==='string'?body.respostaMensagemId:null)
    return reply({ ok: true })
  } catch { return reply({ error: 'Não foi possível enviar a mensagem.' }, 400) }
}
