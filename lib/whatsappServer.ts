import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { UsuarioTenant } from '@/lib/tenantServer'

export type AtendimentoConversa = {
  id: string
  empresa_id: string
  canal: string
  telefone: string
  contato_nome?: string | null
  cliente_id?: string | null
  whatsapp_canal_id?: string | null
  whatsapp_numero?: string | null
  status: string
  responsavel_id?: string | null
  responsavel_nome?: string | null
  setor?: string | null
  ultimo_preview?: string | null
  nao_lidas?: number | null
  ultima_mensagem_em?: string | null
  created_at: string
  updated_at: string
}

export type AtendimentoMensagem = {
  id: string
  conversa_id: string
  sessao_id?: string | null
  direcao: 'entrada' | 'saida'
  tipo: string
  texto?: string | null
  media_url?: string | null
  media_id?: string | null
  whatsapp_message_id?: string | null
  usuario_id?: string | null
  usuario_nome?: string | null
  created_at: string
}

type ConfigAtendimento = {
  empresa_id: string
  numero_principal: string
  phone_number_id?: string | null
  setor_padrao?: string | null
  usuario_padrao_id?: string | null
  modo_integracao?: 'qr' | 'cloud_api' | null
  gateway_token_hash?: string | null
  gateway_status?: string | null
  gateway_qr_data_url?: string | null
  gateway_connected_jid?: string | null
  ativo: boolean
}

export function normalizarTelefone(valor: string | null | undefined) {
  const digitos = String(valor || '').replace(/\D/g, '')
  if (!digitos) return ''
  if (digitos.startsWith('55')) return digitos
  return `55${digitos}`
}

function atlasTipoMensagem(valor: string | null | undefined) {
  const tipo = String(valor || 'text').toLowerCase()
  const mapa: Record<string, string> = {
    text: 'texto',
    texto: 'texto',
    image: 'imagem',
    imagem: 'imagem',
    sticker: 'imagem',
    audio: 'audio',
    video: 'video',
    document: 'documento',
    documento: 'documento',
    location: 'localizacao',
    localizacao: 'localizacao',
    contact: 'contato',
    contacts: 'contato',
    contato: 'contato',
    system: 'sistema',
    sistema: 'sistema',
  }
  return mapa[tipo] || 'sistema'
}

export function configuracaoMeta() {
  return {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    appSecret: process.env.WHATSAPP_APP_SECRET || '',
    verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  }
}

export function validarAssinaturaMeta(rawBody: string, assinatura: string | null) {
  const segredo = configuracaoMeta().appSecret
  if (!segredo) return process.env.NODE_ENV !== 'production'
  if (!assinatura?.startsWith('sha256=')) return false
  const esperado = 'sha256=' + crypto.createHmac('sha256', segredo).update(rawBody).digest('hex')
  const a = Buffer.from(esperado)
  const b = Buffer.from(assinatura)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function textoDaMensagem(msg: any): string | null {
  if (msg?.type === 'text') return msg.text?.body || null
  if (msg?.type === 'button') return msg.button?.text || msg.button?.payload || null
  if (msg?.type === 'interactive') {
    return msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || null
  }
  if (msg?.type === 'image') return msg.image?.caption || '📷 Imagem'
  if (msg?.type === 'video') return msg.video?.caption || '🎥 Vídeo'
  if (msg?.type === 'audio') return '🎤 Áudio'
  if (msg?.type === 'document') return msg.document?.filename || '📎 Documento'
  if (msg?.type === 'sticker') return '🖼️ Figurinha'
  if (msg?.type === 'location') return '📍 Localização'
  if (msg?.type === 'contacts') return '👤 Contato'
  return msg?.type ? `[${msg.type}]` : null
}

function mediaDaMensagem(msg: any) {
  const obj = msg?.[msg?.type]
  if (!obj || !['image','video','audio','document','sticker'].includes(msg.type)) {
    return { mediaId: null, mimeType: null }
  }
  return { mediaId: obj.id || null, mimeType: obj.mime_type || null }
}

async function configuracaoPorNumero(phoneNumberId: string | null): Promise<ConfigAtendimento | null> {
  if (phoneNumberId) {
    const { data } = await supabaseAdmin
      .from('atendimento_configuracoes')
      .select('empresa_id,numero_principal,phone_number_id,setor_padrao,usuario_padrao_id,ativo')
      .eq('phone_number_id', phoneNumberId)
      .eq('ativo', true)
      .maybeSingle()
    if (data) return data as ConfigAtendimento
  }

  const { data } = await supabaseAdmin
    .from('atendimento_configuracoes')
    .select('empresa_id,numero_principal,phone_number_id,setor_padrao,usuario_padrao_id,ativo')
    .eq('ativo', true)
    .limit(2)

  return data?.length === 1 ? data[0] as ConfigAtendimento : null
}

async function nomeUsuario(usuarioId: string | null | undefined) {
  if (!usuarioId) return null
  const { data } = await supabaseAdmin.from('usuarios').select('nome').eq('id', usuarioId).maybeSingle()
  return data?.nome || null
}

async function clientePorTelefone(empresaId: string, telefone: string) {
  const { data } = await supabaseAdmin
    .from('clientes')
    .select('id,nome,whatsapp')
    .eq('empresa_id', empresaId)
    .limit(1000)
  const alvo = normalizarTelefone(telefone)
  return (data || []).find((c: any) => normalizarTelefone(c.whatsapp) === alvo) || null
}

async function regraDeRoteamento(empresaId: string, texto: string | null) {
  const { data } = await supabaseAdmin
    .from('atendimento_regras_roteamento')
    .select('id,nome,prioridade,palavras_chave,setor,usuario_id')
    .eq('empresa_id', empresaId)
    .eq('ativo', true)
    .order('prioridade', { ascending: true })
  const normal = (texto || '').toLocaleLowerCase('pt-BR')
  return (data || []).find((regra: any) => {
    const palavras = Array.isArray(regra.palavras_chave) ? regra.palavras_chave : []
    return palavras.length === 0 || palavras.some((p: string) => normal.includes(p.toLocaleLowerCase('pt-BR')))
  }) || null
}

async function garantirSessao(conversa: AtendimentoConversa) {
  const { data: aberta } = await supabaseAdmin
    .from('atendimento_sessoes')
    .select('*')
    .eq('conversa_id', conversa.id)
    .is('closed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (aberta) return aberta

  const { data } = await supabaseAdmin.from('atendimento_sessoes').insert({
    empresa_id: conversa.empresa_id,
    conversa_id: conversa.id,
    status: conversa.responsavel_id ? 'em_atendimento' : 'aguardando',
    responsavel_id: conversa.responsavel_id || null,
    responsavel_nome: conversa.responsavel_nome || null,
    setor: conversa.setor || null,
    assigned_at: conversa.responsavel_id ? new Date().toISOString() : null,
  }).select('*').single()
  return data
}

async function registrarEvento(params: {
  empresaId: string
  conversaId: string
  sessaoId?: string | null
  tipo: string
  usuarioId?: string | null
  usuarioNome?: string | null
  dados?: Record<string, unknown>
}) {
  await supabaseAdmin.from('atendimento_eventos').insert({
    empresa_id: params.empresaId,
    conversa_id: params.conversaId,
    sessao_id: params.sessaoId || null,
    tipo: params.tipo,
    usuario_id: params.usuarioId || null,
    usuario_nome: params.usuarioNome || null,
    dados: params.dados || {},
  })
}

async function criarOuAtualizarConversa(params: {
  config: ConfigAtendimento
  telefone: string
  contatoNome?: string | null
  texto?: string | null
}) {
  const telefone = normalizarTelefone(params.telefone)
  const { data: existente } = await supabaseAdmin
    .from('atendimento_conversas')
    .select('*')
    .eq('empresa_id', params.config.empresa_id)
    .eq('canal', 'whatsapp')
    .eq('telefone', telefone)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const cliente = await clientePorTelefone(params.config.empresa_id, telefone)
  if (existente) {
    const atual = existente as AtendimentoConversa
    if (atual.responsavel_id) return atual
    const regra = await regraDeRoteamento(params.config.empresa_id, params.texto || null)
    const responsavelId = regra?.usuario_id || params.config.usuario_padrao_id || null
    const responsavelNome = await nomeUsuario(responsavelId)
    const { data } = await supabaseAdmin.from('atendimento_conversas').update({
      contato_nome: params.contatoNome || (cliente as any)?.nome || atual.contato_nome || null,
      cliente_id: (cliente as any)?.id || atual.cliente_id || null,
      responsavel_id: responsavelId,
      responsavel_nome: responsavelNome,
      setor: regra?.setor || params.config.setor_padrao || atual.setor || null,
      status: responsavelId ? 'em_atendimento' : 'aguardando',
      updated_at: new Date().toISOString(),
    }).eq('id', atual.id).select('*').single()
    return data as AtendimentoConversa
  }

  const regra = await regraDeRoteamento(params.config.empresa_id, params.texto || null)
  const responsavelId = regra?.usuario_id || params.config.usuario_padrao_id || null
  const responsavelNome = await nomeUsuario(responsavelId)
  const { data, error } = await supabaseAdmin.from('atendimento_conversas').insert({
    empresa_id: params.config.empresa_id,
    canal: 'whatsapp',
    telefone,
    contato_nome: params.contatoNome || (cliente as any)?.nome || null,
    cliente_id: (cliente as any)?.id || null,
    status: responsavelId ? 'em_atendimento' : 'aguardando',
    responsavel_id: responsavelId,
    responsavel_nome: responsavelNome,
    setor: regra?.setor || params.config.setor_padrao || null,
  }).select('*').single()
  if (error) throw error
  return data as AtendimentoConversa
}

export async function processarWebhookMeta(payload: any) {
  let recebidas = 0
  let statusRecebidos = 0

  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      if (change?.field !== 'messages') continue
      const value = change?.value || {}
      const phoneNumberId = value?.metadata?.phone_number_id || null
      const config = await configuracaoPorNumero(phoneNumberId)
      if (!config) continue
      const contatoPorWa = new Map((value.contacts || []).map((c: any) => [String(c.wa_id), c.profile?.name || null]))

      for (const msg of value.messages || []) {
        const telefone = normalizarTelefone(msg.from)
        const texto = textoDaMensagem(msg)
        const conversa = await criarOuAtualizarConversa({
          config,
          telefone,
          contatoNome: contatoPorWa.get(String(msg.from)) as string | null,
          texto,
        })
        const sessao = await garantirSessao(conversa)
        const media = mediaDaMensagem(msg)
        const dataMeta = msg.timestamp ? new Date(Number(msg.timestamp) * 1000).toISOString() : null
        const { error } = await supabaseAdmin.from('atendimento_mensagens').insert({
          empresa_id: config.empresa_id,
          conversa_id: conversa.id,
          sessao_id: sessao?.id || null,
          direcao: 'entrada',
          tipo: atlasTipoMensagem(msg.type),
          texto,
          media_id: media.mediaId,
          mime_type: media.mimeType,
          whatsapp_message_id: msg.id || null,
          provider_timestamp: dataMeta,
          payload: msg,
        })
        if (error?.code === '23505') continue
        if (error) throw error
        recebidas += 1
        await supabaseAdmin.from('atendimento_conversas').update({
          status: conversa.responsavel_id ? 'em_atendimento' : 'aguardando',
          ultimo_preview: texto,
          nao_lidas: (conversa.nao_lidas || 0) + 1,
          ultima_mensagem_em: dataMeta || new Date().toISOString(),
          ultima_entrada_em: dataMeta || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', conversa.id)
        await registrarEvento({
          empresaId: config.empresa_id,
          conversaId: conversa.id,
          sessaoId: sessao?.id || null,
          tipo: 'mensagem_recebida',
          dados: { whatsapp_message_id: msg.id || null, tipo: msg.type || null },
        })
      }

      for (const status of value.statuses || []) {
        const { data: mensagem } = await supabaseAdmin
          .from('atendimento_mensagens')
          .select('empresa_id,conversa_id,sessao_id')
          .eq('empresa_id', config.empresa_id)
          .eq('whatsapp_message_id', status.id)
          .maybeSingle()
        if (!mensagem) continue
        statusRecebidos += 1
        await registrarEvento({
          empresaId: mensagem.empresa_id,
          conversaId: mensagem.conversa_id,
          sessaoId: mensagem.sessao_id,
          tipo: 'status_whatsapp',
          dados: {
            whatsapp_message_id: status.id,
            status: status.status,
            timestamp: status.timestamp,
            recipient_id: status.recipient_id,
            errors: status.errors || null,
          },
        })
      }
    }
  }
  return { recebidas, statusRecebidos }
}

export async function autenticarGatewayWhatsApp(token: string | null | undefined) {
  const valor = String(token || '').trim()
  if (!valor) return null
  const hash = crypto.createHash('sha256').update(valor).digest('hex')
  const { data } = await supabaseAdmin
    .from('atendimento_configuracoes')
    .select('*')
    .eq('gateway_token_hash', hash)
    .eq('ativo', true)
    .eq('modo_integracao', 'qr')
    .maybeSingle()
  return data ? data as ConfigAtendimento : null
}

export async function atualizarEstadoGateway(
  config: ConfigAtendimento,
  dados: {
    status: 'offline' | 'connecting' | 'qr' | 'connected' | 'disconnected'
    qrDataUrl?: string | null
    connectedJid?: string | null
    deviceName?: string | null
  },
) {
  const agora = new Date().toISOString()
  const payload: Record<string, unknown> = {
    gateway_status: dados.status,
    gateway_last_seen_at: agora,
    updated_at: agora,
  }

  if (dados.status === 'qr') {
    payload.gateway_qr_data_url = dados.qrDataUrl || null
    payload.gateway_qr_updated_at = agora
  }
  if (dados.status === 'connected') {
    payload.gateway_qr_data_url = null
    payload.gateway_connected_jid = dados.connectedJid || null
  }
  if (dados.deviceName) payload.gateway_device_name = dados.deviceName

  const { error } = await supabaseAdmin
    .from('atendimento_configuracoes')
    .update(payload)
    .eq('empresa_id', config.empresa_id)
  if (error) throw error
}

export async function registrarEntradaGateway(
  config: ConfigAtendimento,
  dados: {
    telefone: string
    contatoNome?: string | null
    whatsappMessageId?: string | null
    tipo?: string | null
    texto?: string | null
    timestamp?: string | null
    payload?: Record<string, unknown> | null
  },
) {
  const telefone = normalizarTelefone(dados.telefone)
  if (!telefone) throw new Error('Telefone de origem invalido.')

  if (dados.whatsappMessageId) {
    const { data: duplicada } = await supabaseAdmin
      .from('atendimento_mensagens')
      .select('id')
      .eq('empresa_id', config.empresa_id)
      .eq('whatsapp_message_id', dados.whatsappMessageId)
      .maybeSingle()
    if (duplicada) return { duplicate: true }
  }

  const conversa = await criarOuAtualizarConversa({
    config,
    telefone,
    contatoNome: dados.contatoNome || null,
    texto: dados.texto || null,
  })
  const sessao = await garantirSessao(conversa)
  const agora = dados.timestamp || new Date().toISOString()
  const texto = dados.texto || (
    dados.tipo === 'image' ? '📷 Imagem' :
    dados.tipo === 'video' ? '🎥 Vídeo' :
    dados.tipo === 'audio' ? '🎤 Áudio' :
    dados.tipo === 'document' ? '📎 Documento' :
    dados.tipo === 'sticker' ? '🖼️ Figurinha' :
    '[Mensagem]'
  )

  const { error } = await supabaseAdmin.from('atendimento_mensagens').insert({
    empresa_id: config.empresa_id,
    conversa_id: conversa.id,
    sessao_id: sessao?.id || null,
    direcao: 'entrada',
    tipo: atlasTipoMensagem(dados.tipo),
    texto,
    whatsapp_message_id: dados.whatsappMessageId || null,
    provider_timestamp: agora,
    payload: { transporte: 'qr_gateway', ...(dados.payload || {}) },
  })
  if (error) throw error

  await supabaseAdmin.from('atendimento_conversas').update({
    ultimo_preview: texto,
    nao_lidas: (conversa.nao_lidas || 0) + 1,
    ultima_mensagem_em: agora,
    ultima_entrada_em: agora,
    status: conversa.responsavel_id ? 'em_atendimento' : 'aguardando',
    updated_at: new Date().toISOString(),
  }).eq('id', conversa.id)

  await registrarEvento({
    empresaId: config.empresa_id,
    conversaId: conversa.id,
    sessaoId: sessao?.id || null,
    tipo: 'mensagem_recebida_qr',
    dados: { whatsapp_message_id: dados.whatsappMessageId || null, tipo: dados.tipo || 'text' },
  })

  return { duplicate: false, conversaId: conversa.id }
}

export async function proximaSaidaGateway(config: ConfigAtendimento) {
  const { data: item, error } = await supabaseAdmin
    .from('atendimento_fila_saida')
    .select('id,conversa_id,mensagem_id,telefone,tipo,texto,payload,tentativas,created_at')
    .eq('empresa_id', config.empresa_id)
    .eq('status', 'pendente')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!item) return null

  const { error: updateError } = await supabaseAdmin
    .from('atendimento_fila_saida')
    .update({
      status: 'processando',
      tentativas: Number(item.tentativas || 0) + 1,
      processando_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', item.id)
    .eq('status', 'pendente')
  if (updateError) throw updateError
  return item
}

export async function confirmarSaidaGateway(
  config: ConfigAtendimento,
  dados: {
    filaId: string
    sucesso: boolean
    whatsappMessageId?: string | null
    erro?: string | null
  },
) {
  const { data: fila } = await supabaseAdmin
    .from('atendimento_fila_saida')
    .select('id,conversa_id,mensagem_id')
    .eq('id', dados.filaId)
    .eq('empresa_id', config.empresa_id)
    .maybeSingle()
  if (!fila) throw new Error('Item da fila nao encontrado.')

  const agora = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from('atendimento_fila_saida')
    .update({
      status: dados.sucesso ? 'enviado' : 'erro',
      erro: dados.sucesso ? null : (dados.erro || 'Falha no envio pelo gateway.'),
      enviado_em: dados.sucesso ? agora : null,
      updated_at: agora,
    })
    .eq('id', fila.id)
  if (error) throw error

  await registrarEvento({
    empresaId: config.empresa_id,
    conversaId: fila.conversa_id,
    tipo: dados.sucesso ? 'mensagem_enviada_qr' : 'mensagem_erro_qr',
    dados: {
      fila_id: fila.id,
      mensagem_id: fila.mensagem_id,
      whatsapp_message_id: dados.whatsappMessageId || null,
      erro: dados.erro || null,
    },
  })

  return { ok: true }
}

export async function conversaAcessivel(conversaId: string, usuario: UsuarioTenant, incluirFila = true) {
  const { data } = await supabaseAdmin.from('atendimento_conversas').select('*').eq('id', conversaId).maybeSingle()
  if (!data || data.empresa_id !== usuario.empresa_id) return null
  if (usuario.role === 'master') return data as AtendimentoConversa
  if (data.responsavel_id === usuario.id) return data as AtendimentoConversa
  if (incluirFila && !data.responsavel_id) return data as AtendimentoConversa
  return null
}

export async function listarConversasAtendimento(usuario: UsuarioTenant) {
  let query = supabaseAdmin.from('atendimento_conversas').select('*')
    .eq('empresa_id', usuario.empresa_id)
    .eq('canal', 'whatsapp')
    .order('ultima_mensagem_em', { ascending: false, nullsFirst: false })
  if (usuario.role !== 'master') query = query.or(`responsavel_id.eq.${usuario.id},responsavel_id.is.null`)
  const { data, error } = await query
  if (error) throw error
  return (data || []) as AtendimentoConversa[]
}

export async function listarMensagensAtendimento(conversaId: string, usuario: UsuarioTenant) {
  const conversa = await conversaAcessivel(conversaId, usuario, true)
  if (!conversa) return null
  const { data, error } = await supabaseAdmin.from('atendimento_mensagens')
    .select('id,conversa_id,sessao_id,direcao,tipo,texto,media_url,media_id,whatsapp_message_id,usuario_id,usuario_nome,created_at')
    .eq('conversa_id', conversaId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []) as AtendimentoMensagem[]
}

export async function enviarTextoWhatsApp(conversaId: string, texto: string, usuario: UsuarioTenant) {
  const conversa = await conversaAcessivel(conversaId, usuario, false)
  if (!conversa) throw new Error('Conversa não disponível para este usuário.')
  const corpo = texto.trim()
  if (!corpo) throw new Error('Mensagem vazia.')

  const { data: config } = await supabaseAdmin.from('atendimento_configuracoes')
    .select('*').eq('empresa_id', usuario.empresa_id).eq('ativo', true).maybeSingle()
  if (!config) throw new Error('WhatsApp ainda não foi configurado para esta empresa.')

  const sessao = await garantirSessao(conversa)
  const agora = new Date().toISOString()
  const modo = config.modo_integracao || 'qr'

  if (modo === 'qr') {
    const canalId = conversa.whatsapp_canal_id
    if (!canalId) throw new Error('Esta conversa ainda não possui um número de WhatsApp associado.')

    const { data: canal } = await supabaseAdmin
      .from('atendimento_whatsapp_canais')
      .select('id,nome,numero_declarado,principal,usuario_id,gateway_status,ativo')
      .eq('id', canalId)
      .eq('empresa_id', usuario.empresa_id)
      .eq('ativo', true)
      .maybeSingle()

    if (!canal) throw new Error('O número usado nesta conversa não está mais disponível.')
    if (canal.gateway_status !== 'connected') {
      throw new Error(`O número ${canal.numero_declarado} não está conectado. O Master precisa escanear o QR Code desse canal.`)
    }

    if (usuario.role !== 'master' && canal.usuario_id && canal.usuario_id !== usuario.id) {
      throw new Error('Este número está vinculado a outro usuário.')
    }

    const { data: mensagem, error: mensagemError } = await supabaseAdmin
      .from('atendimento_mensagens')
      .insert({
        empresa_id: usuario.empresa_id,
        conversa_id: conversa.id,
        sessao_id: sessao?.id || null,
        direcao: 'saida',
        tipo: 'texto',
        texto: corpo,
        usuario_id: usuario.id,
        usuario_nome: usuario.nome,
        provider_timestamp: agora,
        payload: { transporte: 'qr_gateway', status: 'pendente' },
      })
      .select('id')
      .single()
    if (mensagemError) throw mensagemError

    const { error: filaError } = await supabaseAdmin.from('atendimento_fila_saida').insert({
      empresa_id: usuario.empresa_id,
      conversa_id: conversa.id,
      mensagem_id: mensagem.id,
      telefone: conversa.telefone,
      tipo: 'text',
      texto: corpo,
      payload: {},
      status: 'pendente',
      whatsapp_canal_id: canalId,
    })
    if (filaError) throw filaError

    await supabaseAdmin.from('atendimento_conversas').update({
      ultimo_preview: corpo,
      ultima_mensagem_em: agora,
      ultima_saida_em: agora,
      nao_lidas: 0,
      status: 'em_atendimento',
      updated_at: agora,
    }).eq('id', conversa.id)

    await registrarEvento({
      empresaId: usuario.empresa_id,
      conversaId: conversa.id,
      sessaoId: sessao?.id || null,
      tipo: 'mensagem_enfileirada_qr',
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      dados: { mensagem_id: mensagem.id },
    })

    return { messageId: null, queued: true }
  }

  const meta = configuracaoMeta()
  const phoneNumberId = config.phone_number_id || meta.phoneNumberId
  if (!meta.accessToken || !meta.graphVersion || !phoneNumberId) {
    throw new Error('Faltam credenciais da Meta no ambiente do Atlas.')
  }

  const resposta = await fetch(`https://graph.facebook.com/${meta.graphVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${meta.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: conversa.telefone,
      type: 'text',
      text: { preview_url: false, body: corpo },
    }),
  })
  const json = await resposta.json().catch(() => ({}))
  if (!resposta.ok) throw new Error(json?.error?.message || 'A Meta recusou o envio da mensagem.')

  const messageId = json?.messages?.[0]?.id || null
  const { error } = await supabaseAdmin.from('atendimento_mensagens').insert({
    empresa_id: usuario.empresa_id,
    conversa_id: conversa.id,
    sessao_id: sessao?.id || null,
    direcao: 'saida',
    tipo: 'texto',
    texto: corpo,
    whatsapp_message_id: messageId,
    usuario_id: usuario.id,
    usuario_nome: usuario.nome,
    provider_timestamp: agora,
    payload: json,
  })
  if (error) throw error

  await supabaseAdmin.from('atendimento_conversas').update({
    ultimo_preview: corpo,
    ultima_mensagem_em: agora,
    ultima_saida_em: agora,
    nao_lidas: 0,
    status: 'em_atendimento',
    updated_at: agora,
  }).eq('id', conversa.id)

  await registrarEvento({
    empresaId: usuario.empresa_id,
    conversaId: conversa.id,
    sessaoId: sessao?.id || null,
    tipo: 'mensagem_enviada',
    usuarioId: usuario.id,
    usuarioNome: usuario.nome,
    dados: { whatsapp_message_id: messageId },
  })

  return { messageId, queued: false }
}

export async function assumirConversa(conversaId: string, usuario: UsuarioTenant) {
  const conversa = await conversaAcessivel(conversaId, usuario, true)
  if (!conversa) throw new Error('Conversa não disponível.')
  if (conversa.responsavel_id && conversa.responsavel_id !== usuario.id && usuario.role !== 'master') {
    throw new Error('Esta conversa já está com outro atendente.')
  }
  const agora = new Date().toISOString()
  await supabaseAdmin.from('atendimento_conversas').update({
    responsavel_id: usuario.id,
    responsavel_nome: usuario.nome,
    status: 'em_atendimento',
    nao_lidas: 0,
    updated_at: agora,
  }).eq('id', conversaId)
  const sessao = await garantirSessao({ ...conversa, responsavel_id: usuario.id, responsavel_nome: usuario.nome, status: 'em_atendimento' })
  if (sessao?.id) {
    await supabaseAdmin.from('atendimento_sessoes').update({
      responsavel_id: usuario.id,
      responsavel_nome: usuario.nome,
      status: 'em_atendimento',
      assigned_at: sessao.assigned_at || agora,
    }).eq('id', sessao.id)
  }
  await registrarEvento({
    empresaId: usuario.empresa_id,
    conversaId,
    sessaoId: sessao?.id || null,
    tipo: 'conversa_assumida',
    usuarioId: usuario.id,
    usuarioNome: usuario.nome,
  })
}

export async function transferirConversa(conversaId: string, destinoId: string, setor: string | null, usuario: UsuarioTenant) {
  if (usuario.role !== 'master') throw new Error('Somente o Master pode transferir conversas.')
  const conversa = await conversaAcessivel(conversaId, usuario, true)
  if (!conversa) throw new Error('Conversa não encontrada.')
  const { data: destino } = await supabaseAdmin.from('usuarios')
    .select('id,nome,empresa_id').eq('id', destinoId).maybeSingle()
  if (!destino || destino.empresa_id !== usuario.empresa_id) throw new Error('Usuário de destino inválido.')
  const agora = new Date().toISOString()
  await supabaseAdmin.from('atendimento_conversas').update({
    responsavel_id: destino.id,
    responsavel_nome: destino.nome,
    setor: setor || conversa.setor || null,
    status: 'em_atendimento',
    updated_at: agora,
  }).eq('id', conversaId)
  const sessao = await garantirSessao(conversa)
  if (sessao?.id) {
    await supabaseAdmin.from('atendimento_sessoes').update({
      responsavel_id: destino.id,
      responsavel_nome: destino.nome,
      setor: setor || conversa.setor || null,
      status: 'em_atendimento',
      assigned_at: agora,
    }).eq('id', sessao.id)
  }
  await registrarEvento({
    empresaId: usuario.empresa_id,
    conversaId,
    sessaoId: sessao?.id || null,
    tipo: 'conversa_transferida',
    usuarioId: usuario.id,
    usuarioNome: usuario.nome,
    dados: { destino_id: destino.id, destino_nome: destino.nome, setor: setor || null },
  })
}

export async function finalizarConversa(conversaId: string, usuario: UsuarioTenant) {
  const conversa = await conversaAcessivel(conversaId, usuario, false)
  if (!conversa) throw new Error('Conversa não disponível.')
  const agora = new Date().toISOString()
  await supabaseAdmin.from('atendimento_conversas').update({
    status: 'finalizado',
    nao_lidas: 0,
    updated_at: agora,
  }).eq('id', conversaId)
  const { data: sessao } = await supabaseAdmin.from('atendimento_sessoes')
    .select('id').eq('conversa_id', conversaId).is('closed_at', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (sessao?.id) {
    await supabaseAdmin.from('atendimento_sessoes').update({
      status: 'finalizado',
      closed_at: agora,
    }).eq('id', sessao.id)
  }
  await registrarEvento({
    empresaId: usuario.empresa_id,
    conversaId,
    sessaoId: sessao?.id || null,
    tipo: 'conversa_finalizada',
    usuarioId: usuario.id,
    usuarioNome: usuario.nome,
  })
}