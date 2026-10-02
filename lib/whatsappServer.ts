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
  whatsapp_chat_tipo?: 'contato' | 'grupo' | null
  whatsapp_chat_jid?: string | null
  grupo_nome?: string | null
  ocultar_da_caixa?: boolean | null
  status: string
  responsavel_id?: string | null
  responsavel_nome?: string | null
  setor?: string | null
  ultimo_preview?: string | null
  nao_lidas?: number | null
  ultima_mensagem_em?: string | null
  transferida_em?: string | null
  acompanhando?: boolean
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
  mime_type?: string | null
  arquivo_nome?: string | null
  payload?: Record<string, unknown> | null
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

type AcessoCanal = {
  visualizar: boolean
  atender: boolean
  transferir: boolean
  supervisionar: boolean
  dono: boolean
  principal: boolean
}

function ehStatusOuBroadcastPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') return false
  const valor = payload as Record<string, any>
  const jids = [
    valor.remoteJid,
    valor.chatJid,
    valor.remote_jid,
    valor.key?.remoteJid,
  ]
    .map(item => String(item || '').trim().toLowerCase())
    .filter(Boolean)

  return jids.some(jid =>
    jid === 'status@broadcast' || jid.endsWith('@broadcast') || jid.endsWith('@newsletter')
  )
}

async function acessoCanalWhatsApp(
  usuario: UsuarioTenant,
  canalId: string | null | undefined,
): Promise<AcessoCanal> {
  if (usuario.role === 'master') {
    return { visualizar: true, atender: true, transferir: true, supervisionar: true, dono: true, principal: false }
  }
  if (!canalId) {
    return { visualizar: true, atender: true, transferir: false, supervisionar: false, dono: false, principal: true }
  }

  const [{ data: canal }, { data: permissao }] = await Promise.all([
    supabaseAdmin
      .from('atendimento_whatsapp_canais')
      .select('id,empresa_id,principal,usuario_id,ativo,gateway_status')
      .eq('id', canalId)
      .eq('empresa_id', usuario.empresa_id)
      .eq('ativo', true)
      .eq('gateway_status', 'connected')
      .maybeSingle(),
    supabaseAdmin
      .from('atendimento_whatsapp_permissoes')
      .select('pode_visualizar,pode_atender,pode_transferir,pode_supervisionar')
      .eq('empresa_id', usuario.empresa_id)
      .eq('canal_id', canalId)
      .eq('usuario_id', usuario.id)
      .maybeSingle(),
  ])

  if (!canal) {
    return { visualizar: false, atender: false, transferir: false, supervisionar: false, dono: false, principal: false }
  }

  const dono = canal.usuario_id === usuario.id
  const principal = canal.principal === true
  return {
    visualizar: dono || Boolean(
      permissao?.pode_visualizar || permissao?.pode_atender ||
      permissao?.pode_transferir || permissao?.pode_supervisionar
    ),
    atender: dono || Boolean(permissao?.pode_atender),
    transferir: dono || Boolean(permissao?.pode_transferir),
    supervisionar: dono || Boolean(permissao?.pode_supervisionar),
    dono,
    principal,
  }
}

async function usuarioPodeAtenderCanal(
  empresaId: string,
  canalId: string | null | undefined,
  usuarioId: string,
  role?: string | null,
) {
  if (role === 'master' || !canalId) return true
  const { data: canal } = await supabaseAdmin
    .from('atendimento_whatsapp_canais')
    .select('id,principal,usuario_id,gateway_status')
    .eq('id', canalId)
    .eq('empresa_id', empresaId)
    .eq('ativo', true)
    .eq('gateway_status', 'connected')
    .maybeSingle()
  if (!canal) return false
  if (canal.usuario_id === usuarioId) return true
  const { data: permissao } = await supabaseAdmin
    .from('atendimento_whatsapp_permissoes')
    .select('pode_atender')
    .eq('empresa_id', empresaId)
    .eq('canal_id', canalId)
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  return permissao?.pode_atender === true
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
    reaction: 'reacao',
    reacao: 'reacao',
    system: 'sistema',
    sistema: 'sistema',
  }
  return mapa[tipo] || 'sistema'
}

const WHATSAPP_MEDIA_BUCKET = 'whatsapp-midia'
const WHATSAPP_MEDIA_MAX_BYTES = 50 * 1024 * 1024
const MIME_MIDIA_ACEITOS = new Set([
  'image/jpeg','image/png','image/webp','image/heic',
  'video/mp4','video/quicktime',
  'audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/opus','audio/aac',
  'application/pdf','text/plain','application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

function mimeBase(valor: string | null | undefined) {
  return String(valor || 'application/octet-stream').split(';')[0].trim().toLowerCase()
}

function nomeArquivoSeguro(valor: string | null | undefined) {
  const bruto = String(valor || 'arquivo').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  return bruto.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 120) || 'arquivo'
}

function tipoMidiaPorMime(mime: string, nome?: string | null) {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('video/')) return 'video'
  if (mime || nome) return 'document'
  return 'document'
}

function validarArquivoMidia(mimeType: string | null | undefined, tamanho: number | null | undefined) {
  const mime = mimeBase(mimeType)
  const bytes = Number(tamanho || 0)
  if (bytes <= 0 || !Number.isFinite(bytes)) throw new Error('Arquivo de mídia inválido.')
  if (bytes > WHATSAPP_MEDIA_MAX_BYTES) throw new Error('O arquivo excede o limite de 50 MB.')
  if (!MIME_MIDIA_ACEITOS.has(mime)) throw new Error('Tipo de arquivo não permitido no WhatsApp do Atlas.')
  return { mime, bytes }
}

async function criarUploadAssinadoMidia(params: {
  empresaId: string
  direcao: 'entrada' | 'saida'
  referencia: string
  nomeArquivo?: string | null
  mimeType?: string | null
  tamanho?: number | null
}) {
  const { mime, bytes } = validarArquivoMidia(params.mimeType, params.tamanho)
  const nome = nomeArquivoSeguro(params.nomeArquivo || `midia-${Date.now()}`)
  const mes = new Date().toISOString().slice(0, 7)
  const caminho = `${params.empresaId}/${params.direcao}/${mes}/${params.referencia}/${crypto.randomUUID()}-${nome}`
  const { data, error } = await supabaseAdmin.storage
    .from(WHATSAPP_MEDIA_BUCKET)
    .createSignedUploadUrl(caminho)
  if (error || !data?.token) throw new Error(error?.message || 'Não foi possível preparar o envio da mídia.')
  return { path: caminho, token: data.token, signedUrl: data.signedUrl, mimeType: mime, tamanho: bytes }
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
    .select('id,nome,whatsapp,telefone')
    .eq('empresa_id', empresaId)
    .limit(1000)
  const alvo = normalizarTelefone(telefone)
  return (data || []).find((c: any) =>
    normalizarTelefone(c.whatsapp) === alvo || normalizarTelefone(c.telefone) === alvo
  ) || null
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

export async function prepararUploadMidiaGateway(
  config: ConfigAtendimento,
  dados: {
    channelId: string
    whatsappMessageId?: string | null
    fileName?: string | null
    mimeType?: string | null
    size?: number | null
  },
) {
  const { data: canal } = await supabaseAdmin
    .from('atendimento_whatsapp_canais')
    .select('id')
    .eq('id', dados.channelId)
    .eq('empresa_id', config.empresa_id)
    .eq('ativo', true)
    .maybeSingle()
  if (!canal) throw new Error('Canal WhatsApp inválido para upload de mídia.')

  return criarUploadAssinadoMidia({
    empresaId: config.empresa_id,
    direcao: 'entrada',
    referencia: dados.whatsappMessageId || dados.channelId,
    nomeArquivo: dados.fileName,
    mimeType: dados.mimeType,
    tamanho: dados.size,
  })
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
    mediaPath?: string | null
    mimeType?: string | null
    fileName?: string | null
    mediaSize?: number | null
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
    media_url: dados.mediaPath || null,
    mime_type: dados.mimeType ? mimeBase(dados.mimeType) : null,
    whatsapp_message_id: dados.whatsappMessageId || null,
    provider_timestamp: agora,
    payload: {
      transporte: 'qr_gateway',
      fileName: dados.fileName || null,
      mediaSize: dados.mediaSize || null,
      ...(dados.payload || {}),
    },
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

  const payload = (item.payload && typeof item.payload === 'object') ? { ...item.payload } as Record<string, unknown> : {}
  const mediaPath = typeof payload.mediaPath === 'string' ? payload.mediaPath : null
  if (mediaPath) {
    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from(WHATSAPP_MEDIA_BUCKET)
      .createSignedUrl(mediaPath, 10 * 60)
    if (signedError || !signed?.signedUrl) {
      await supabaseAdmin.from('atendimento_fila_saida').update({
        status: 'erro',
        erro: signedError?.message || 'Não foi possível gerar URL temporária da mídia.',
        updated_at: new Date().toISOString(),
      }).eq('id', item.id)
      throw new Error(signedError?.message || 'Não foi possível gerar URL temporária da mídia.')
    }
    payload.mediaUrl = signed.signedUrl
  }

  return { ...item, payload }
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

  if (dados.sucesso && fila.mensagem_id) {
    await supabaseAdmin.from('atendimento_mensagens').update({
      whatsapp_message_id: dados.whatsappMessageId || null,
      provider_timestamp: agora,
    }).eq('id', fila.mensagem_id).eq('empresa_id', config.empresa_id)
  }

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
  const { data } = await supabaseAdmin
    .from('atendimento_conversas')
    .select('*')
    .eq('id', conversaId)
    .maybeSingle()
  if (!data || data.empresa_id !== usuario.empresa_id) return null
  if (!data.whatsapp_canal_id) return null

  const { data: canalConectado } = await supabaseAdmin
    .from('atendimento_whatsapp_canais')
    .select('id')
    .eq('id', data.whatsapp_canal_id)
    .eq('empresa_id', usuario.empresa_id)
    .eq('ativo', true)
    .eq('gateway_status', 'connected')
    .maybeSingle()
  if (!canalConectado) return null
  if (usuario.role === 'master') return data as AtendimentoConversa

  const acesso = await acessoCanalWhatsApp(usuario, data.whatsapp_canal_id)
  if (!acesso.visualizar) return null
  if (data.whatsapp_chat_tipo === 'grupo' && acesso.atender) return data as AtendimentoConversa
  if (data.responsavel_id === usuario.id) return data as AtendimentoConversa
  if (acesso.supervisionar) return data as AtendimentoConversa
  if (incluirFila && !data.responsavel_id && acesso.atender) return data as AtendimentoConversa
  return null
}

export async function listarAcessosCanaisAtendimento(usuario: UsuarioTenant) {
  const [{ data: canais, error: canaisError }, { data: permissoes, error: permissoesError }] = await Promise.all([
    supabaseAdmin
      .from('atendimento_whatsapp_canais')
      .select('id,principal,usuario_id,ativo,gateway_status')
      .eq('empresa_id', usuario.empresa_id)
      .eq('ativo', true)
      .eq('gateway_status', 'connected'),
    supabaseAdmin
      .from('atendimento_whatsapp_permissoes')
      .select('canal_id,pode_visualizar,pode_atender,pode_transferir,pode_supervisionar')
      .eq('empresa_id', usuario.empresa_id)
      .eq('usuario_id', usuario.id),
  ])
  if (canaisError) throw canaisError
  if (permissoesError) throw permissoesError

  const porCanal = new Map((permissoes || []).map((p: any) => [p.canal_id, p]))
  return (canais || []).map((canal: any) => {
    const permissao: any = porCanal.get(canal.id) || null
    const dono = canal.usuario_id === usuario.id
    const principal = canal.principal === true
    const master = usuario.role === 'master'
    return {
      canal_id: canal.id as string,
      visualizar: master || dono || Boolean(
        permissao?.pode_visualizar || permissao?.pode_atender ||
        permissao?.pode_transferir || permissao?.pode_supervisionar
      ),
      atender: master || dono || Boolean(permissao?.pode_atender),
      transferir: master || dono || Boolean(permissao?.pode_transferir),
      supervisionar: master || dono || Boolean(permissao?.pode_supervisionar),
      dono,
      principal,
    }
  }).filter((acesso: any) => acesso.visualizar)
}

export async function listarConversasAtendimento(usuario: UsuarioTenant) {
  const acessos = await listarAcessosCanaisAtendimento(usuario)
  const canaisConectados = acessos.map(acesso => acesso.canal_id)
  if (!canaisConectados.length) return []

  const { data, error } = await supabaseAdmin
    .from('atendimento_conversas')
    .select('*')
    .eq('empresa_id', usuario.empresa_id)
    .eq('canal', 'whatsapp')
    .eq('ocultar_da_caixa', false)
    .in('whatsapp_canal_id', canaisConectados)
    .order('ultima_mensagem_em', { ascending: false, nullsFirst: false })
  if (error) throw error

  const acessoPorCanal = new Map(acessos.map(acesso => [acesso.canal_id, acesso]))
  const permitidas = ((data || []) as AtendimentoConversa[]).filter(conversa => {
    if (usuario.role === 'master') return true
    if (!conversa.whatsapp_canal_id) return false
    const acesso = acessoPorCanal.get(conversa.whatsapp_canal_id)
    if (!acesso?.visualizar) return false
    if (acesso.dono || acesso.supervisionar) return true
    if (conversa.responsavel_id === usuario.id) return true
    return !conversa.responsavel_id && acesso.atender
  })

  const ids = permitidas.map(conversa => conversa.id)
  if (!ids.length) return permitidas
  const [transferenciasResp, acompanhamentosResp] = await Promise.all([
    supabaseAdmin
      .from('atendimento_eventos')
      .select('conversa_id,created_at')
      .eq('empresa_id', usuario.empresa_id)
      .eq('tipo', 'conversa_transferida')
      .in('conversa_id', ids)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('atendimento_acompanhamentos')
      .select('conversa_id')
      .eq('empresa_id', usuario.empresa_id)
      .eq('usuario_id', usuario.id)
      .in('conversa_id', ids),
  ])
  if (transferenciasResp.error) throw transferenciasResp.error
  if (acompanhamentosResp.error) throw acompanhamentosResp.error

  const ultimaTransferencia = new Map<string, string>()
  for (const evento of transferenciasResp.data || []) {
    if (!ultimaTransferencia.has(evento.conversa_id)) {
      ultimaTransferencia.set(evento.conversa_id, evento.created_at)
    }
  }
  const acompanhadas = new Set((acompanhamentosResp.data || []).map(item => item.conversa_id))
  return permitidas.map(conversa => ({
    ...conversa,
    transferida_em: ultimaTransferencia.get(conversa.id) || null,
    acompanhando: acompanhadas.has(conversa.id),
  }))
}

export async function listarDiretorioWhatsApp(
  usuario: UsuarioTenant,
  canalId: string,
  busca = '',
) {
  const acesso = await acessoCanalWhatsApp(usuario, canalId)
  if (!acesso.visualizar) throw new Error('Você não possui acesso a este canal.')

  const [{ data: contatos, error: contatosError }, { data: grupos, error: gruposError }] = await Promise.all([
    supabaseAdmin
      .from('atendimento_whatsapp_contatos')
      .select('id,whatsapp_canal_id,contato_jid,telefone,nome,nome_verificado,sincronizado_em')
      .eq('empresa_id', usuario.empresa_id)
      .eq('whatsapp_canal_id', canalId)
      .eq('ativo', true)
      .limit(3000),
    supabaseAdmin
      .from('atendimento_whatsapp_grupos')
      .select('id,whatsapp_canal_id,grupo_jid,nome,participantes,sincronizado_em')
      .eq('empresa_id', usuario.empresa_id)
      .eq('whatsapp_canal_id', canalId)
      .eq('ativo', true)
      .limit(1000),
  ])
  if (contatosError) throw contatosError
  if (gruposError) throw gruposError

  const q = busca.toLocaleLowerCase('pt-BR').trim()
  const itens = [
    ...(contatos || []).map((item: any) => ({
      id: item.id,
      tipo: 'contato' as const,
      jid: item.contato_jid,
      telefone: item.telefone || null,
      nome: item.nome || item.nome_verificado || item.telefone || 'Contato WhatsApp',
      participantes: null,
    })),
    ...(grupos || []).map((item: any) => ({
      id: item.id,
      tipo: 'grupo' as const,
      jid: item.grupo_jid,
      telefone: null,
      nome: item.nome || 'Grupo WhatsApp',
      participantes: Number(item.participantes || 0),
    })),
  ].filter(item => {
    if (!q) return true
    return `${item.nome} ${item.telefone || ''}`.toLocaleLowerCase('pt-BR').includes(q)
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  return itens.slice(0, 250)
}

export async function iniciarConversaWhatsApp(
  usuario: UsuarioTenant,
  dados: {
    canalId: string
    tipo: 'contato' | 'grupo'
    jid: string
    telefone?: string | null
    nome?: string | null
  },
) {
  const acesso = await acessoCanalWhatsApp(usuario, dados.canalId)
  if (!acesso.atender) throw new Error('Você não possui permissão para iniciar conversa neste canal.')

  const { data: canal } = await supabaseAdmin
    .from('atendimento_whatsapp_canais')
    .select('id,numero_declarado,gateway_status,ativo')
    .eq('id', dados.canalId)
    .eq('empresa_id', usuario.empresa_id)
    .eq('ativo', true)
    .eq('gateway_status', 'connected')
    .maybeSingle()
  if (!canal) throw new Error('Canal WhatsApp não encontrado.')

  const jid = String(dados.jid || '').trim()
  if (!jid) throw new Error('Contato ou grupo inválido.')
  const tipo = dados.tipo === 'grupo' ? 'grupo' : 'contato'
  if (tipo === 'grupo' && !jid.endsWith('@g.us')) throw new Error('Grupo WhatsApp inválido.')

  const telefone = tipo === 'grupo'
    ? jid.split('@')[0].replace(/\D/g, '')
    : normalizarTelefone(dados.telefone || jid.split('@')[0])
  if (!telefone) throw new Error('Contato sem telefone válido.')

  const { data: existente } = await supabaseAdmin
    .from('atendimento_conversas')
    .select('*')
    .eq('empresa_id', usuario.empresa_id)
    .eq('canal', 'whatsapp')
    .eq('whatsapp_canal_id', dados.canalId)
    .eq('whatsapp_chat_jid', jid)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const cliente = tipo === 'contato'
    ? await clientePorTelefone(usuario.empresa_id, telefone)
    : null
  const nome = String(dados.nome || '').trim() || (cliente as any)?.nome || (tipo === 'grupo' ? 'Grupo WhatsApp' : telefone)

  const responsavel = tipo === 'contato' ? usuario.id : null
  const responsavelNome = tipo === 'contato' ? usuario.nome : null
  const status = tipo === 'contato' ? 'em_atendimento' : 'aguardando'

  if (existente) {
    const { data, error } = await supabaseAdmin
      .from('atendimento_conversas')
      .update({
        telefone,
        contato_nome: nome,
        cliente_id: tipo === 'contato' ? ((cliente as any)?.id || existente.cliente_id || null) : null,
        whatsapp_chat_tipo: tipo,
        whatsapp_chat_jid: jid,
        grupo_nome: tipo === 'grupo' ? nome : null,
        whatsapp_numero: canal.numero_declarado,
        ocultar_da_caixa: false,
        responsavel_id: tipo === 'contato' ? (existente.responsavel_id || responsavel) : null,
        responsavel_nome: tipo === 'contato' ? (existente.responsavel_nome || responsavelNome) : null,
        status: tipo === 'contato' ? (existente.responsavel_id ? existente.status : status) : 'aguardando',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existente.id)
      .select('*')
      .single()
    if (error) throw error
    if (tipo === 'contato') await garantirSessao(data as AtendimentoConversa)
    return data as AtendimentoConversa
  }

  const { data, error } = await supabaseAdmin
    .from('atendimento_conversas')
    .insert({
      empresa_id: usuario.empresa_id,
      canal: 'whatsapp',
      telefone,
      contato_nome: nome,
      cliente_id: tipo === 'contato' ? ((cliente as any)?.id || null) : null,
      whatsapp_canal_id: dados.canalId,
      whatsapp_numero: canal.numero_declarado,
      whatsapp_chat_tipo: tipo,
      whatsapp_chat_jid: jid,
      grupo_nome: tipo === 'grupo' ? nome : null,
      ocultar_da_caixa: false,
      status,
      responsavel_id: responsavel,
      responsavel_nome: responsavelNome,
    })
    .select('*')
    .single()
  if (error) throw error

  if (tipo === 'contato') await garantirSessao(data as AtendimentoConversa)
  return data as AtendimentoConversa
}

export async function listarMensagensAtendimento(conversaId: string, usuario: UsuarioTenant) {
  const conversa = await conversaAcessivel(conversaId, usuario, true)
  if (!conversa) return null
  const { data, error } = await supabaseAdmin.from('atendimento_mensagens')
    .select('id,conversa_id,sessao_id,direcao,tipo,texto,media_url,media_id,mime_type,payload,whatsapp_message_id,usuario_id,usuario_nome,created_at')
    .eq('conversa_id', conversaId)
    .order('created_at', { ascending: true })
  if (error) throw error

  const mensagens = ((data || []) as any[])
    .filter(m => !ehStatusOuBroadcastPayload(m.payload))
  const caminhos = [...new Set(
    mensagens
      .map(m => String(m.media_url || ''))
      .filter(valor => valor && !/^https?:\/\//i.test(valor))
  )]

  const assinadas = new Map<string, string>()
  if (caminhos.length) {
    const { data: urls } = await supabaseAdmin.storage
      .from(WHATSAPP_MEDIA_BUCKET)
      .createSignedUrls(caminhos, 60 * 60)
    for (const item of urls || []) {
      if (item?.path && item?.signedUrl) assinadas.set(item.path, item.signedUrl)
    }
  }

  return mensagens.map(m => ({
    ...m,
    media_url: m.media_url
      ? (/^https?:\/\//i.test(m.media_url) ? m.media_url : assinadas.get(m.media_url) || null)
      : null,
    arquivo_nome: m.payload && typeof m.payload === 'object'
      ? String((m.payload as any).fileName || '') || null
      : null,
  })) as AtendimentoMensagem[]
}

export async function prepararUploadMidiaAtendimento(
  conversaId: string,
  arquivo: { nome?: string | null; mimeType?: string | null; tamanho?: number | null },
  usuario: UsuarioTenant,
) {
  const conversa = await conversaAcessivel(conversaId, usuario, false)
  if (!conversa) throw new Error('Conversa não disponível para este usuário.')
  if (!conversa.whatsapp_canal_id) throw new Error('Esta conversa ainda não possui um número de WhatsApp associado.')

  const acesso = await acessoCanalWhatsApp(usuario, conversa.whatsapp_canal_id)
  if (!acesso.atender) throw new Error('Você não possui permissão para responder por este canal.')
  if (usuario.role !== 'master' && conversa.responsavel_id && conversa.responsavel_id !== usuario.id) {
    throw new Error('Este atendimento está com outro atendente.')
  }

  return criarUploadAssinadoMidia({
    empresaId: usuario.empresa_id,
    direcao: 'saida',
    referencia: conversa.id,
    nomeArquivo: arquivo.nome,
    mimeType: arquivo.mimeType,
    tamanho: arquivo.tamanho,
  })
}

export async function enviarMidiaWhatsApp(
  conversaId: string,
  dados: {
    mediaPath: string
    mimeType: string
    fileName?: string | null
    tamanho?: number | null
    legenda?: string | null
    ptt?: boolean
  },
  usuario: UsuarioTenant,
) {
  const conversa = await conversaAcessivel(conversaId, usuario, false)
  if (!conversa) throw new Error('Conversa não disponível para este usuário.')
  const { mime, bytes } = validarArquivoMidia(dados.mimeType, dados.tamanho)
  const mediaPath = String(dados.mediaPath || '')
  if (!mediaPath.startsWith(`${usuario.empresa_id}/saida/`)) {
    throw new Error('Arquivo de mídia inválido para esta empresa.')
  }

  const { data: config } = await supabaseAdmin.from('atendimento_configuracoes')
    .select('*').eq('empresa_id', usuario.empresa_id).eq('ativo', true).maybeSingle()
  if (!config) throw new Error('WhatsApp ainda não foi configurado para esta empresa.')
  if ((config.modo_integracao || 'qr') !== 'qr') {
    throw new Error('Envio de mídia nesta etapa está disponível para os canais conectados por QR.')
  }

  const canalId = conversa.whatsapp_canal_id
  if (!canalId) throw new Error('Esta conversa ainda não possui um número de WhatsApp associado.')
  const { data: canal } = await supabaseAdmin.from('atendimento_whatsapp_canais')
    .select('id,nome,numero_declarado,gateway_status,ativo')
    .eq('id', canalId).eq('empresa_id', usuario.empresa_id).eq('ativo', true).maybeSingle()
  if (!canal) throw new Error('O número usado nesta conversa não está mais disponível.')
  if (canal.gateway_status !== 'connected') throw new Error('O número WhatsApp desta conversa não está conectado.')

  const acesso = await acessoCanalWhatsApp(usuario, canalId)
  if (!acesso.atender) throw new Error('Você não possui permissão para responder por este canal.')
  if (usuario.role !== 'master' && conversa.responsavel_id && conversa.responsavel_id !== usuario.id) {
    throw new Error('Este atendimento está com outro atendente.')
  }

  const tipoGateway = tipoMidiaPorMime(mime, dados.fileName)
  const tipoAtlas = atlasTipoMensagem(tipoGateway)
  const nome = nomeArquivoSeguro(dados.fileName || 'arquivo')
  const legenda = String(dados.legenda || '').trim()
  const preview =
    tipoGateway === 'audio' ? '🎤 Áudio' :
    tipoGateway === 'image' ? (legenda || '📷 Imagem') :
    tipoGateway === 'video' ? (legenda || '🎥 Vídeo') :
    `📎 ${nome}`

  const sessao = await garantirSessao(conversa)
  const agora = new Date().toISOString()
  const payload = {
    transporte: 'qr_gateway',
    status: 'pendente',
    chatTipo: conversa.whatsapp_chat_tipo || 'contato',
    chatJid: conversa.whatsapp_chat_tipo === 'grupo' ? conversa.whatsapp_chat_jid || null : null,
    fileName: nome,
    mediaSize: bytes,
    mediaPath,
    mimeType: mime,
    ptt: tipoGateway === 'audio' ? dados.ptt !== false : false,
  }

  const { data: mensagem, error: mensagemError } = await supabaseAdmin
    .from('atendimento_mensagens')
    .insert({
      empresa_id: usuario.empresa_id,
      conversa_id: conversa.id,
      sessao_id: sessao?.id || null,
      direcao: 'saida',
      tipo: tipoAtlas,
      texto: preview,
      media_url: mediaPath,
      mime_type: mime,
      usuario_id: usuario.id,
      usuario_nome: usuario.nome,
      provider_timestamp: agora,
      payload,
    })
    .select('id')
    .single()
  if (mensagemError) throw mensagemError

  const { error: filaError } = await supabaseAdmin.from('atendimento_fila_saida').insert({
    empresa_id: usuario.empresa_id,
    conversa_id: conversa.id,
    mensagem_id: mensagem.id,
    telefone: conversa.telefone,
    tipo: tipoGateway,
    texto: legenda || null,
    payload,
    status: 'pendente',
    whatsapp_canal_id: canalId,
  })
  if (filaError) throw filaError

  await supabaseAdmin.from('atendimento_conversas').update({
    ultimo_preview: preview,
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
    tipo: 'midia_enfileirada_qr',
    usuarioId: usuario.id,
    usuarioNome: usuario.nome,
    dados: { mensagem_id: mensagem.id, tipo: tipoGateway, fileName: nome },
  })

  return { queued: true, mensagemId: mensagem.id }
}

export async function enviarTextoWhatsApp(conversaId: string, texto: string, usuario: UsuarioTenant) {
  const conversa = await conversaAcessivel(conversaId, usuario, false)
  if (!conversa) throw new Error('Conversa não disponível para este usuário.')
  const corpo = texto.trim()
  if (!corpo) throw new Error('Mensagem vazia.')
  const nomeAtendente = String(usuario.nome || 'Equipe Esquadrifácio').trim() || 'Equipe Esquadrifácio'
  const corpoCliente = `*${nomeAtendente}:* ${corpo}`

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

    const acessoCanal = await acessoCanalWhatsApp(usuario, canalId)
    if (!acessoCanal.atender) {
      throw new Error('Você pode acompanhar este canal, mas não possui permissão para responder por ele.')
    }
    if (
      usuario.role !== 'master' &&
      conversa.responsavel_id &&
      conversa.responsavel_id !== usuario.id
    ) {
      throw new Error('Este atendimento está com outro atendente. Supervisão não permite responder em nome dele.')
    }

    const destinoPayload = {
      transporte: 'qr_gateway',
      status: 'pendente',
      chatTipo: conversa.whatsapp_chat_tipo || 'contato',
      chatJid: conversa.whatsapp_chat_tipo === 'grupo' ? conversa.whatsapp_chat_jid || null : null,
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
        payload: destinoPayload,
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
      texto: corpoCliente,
      payload: destinoPayload,
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
      text: { preview_url: false, body: corpoCliente },
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

export async function marcarConversaComoLida(conversaId: string, usuario: UsuarioTenant) {
  const conversa = await conversaAcessivel(conversaId, usuario, true)
  if (!conversa) throw new Error('Conversa não disponível.')
  if (!conversa.nao_lidas) return
  const { error } = await supabaseAdmin
    .from('atendimento_conversas')
    .update({ nao_lidas: 0, updated_at: new Date().toISOString() })
    .eq('id', conversaId)
    .eq('empresa_id', usuario.empresa_id)
  if (error) throw error
}

export async function definirAcompanhamentoConversa(
  conversaId: string,
  acompanhar: boolean,
  usuario: UsuarioTenant,
) {
  const conversa = await conversaAcessivel(conversaId, usuario, true)
  if (!conversa) throw new Error('Conversa não disponível.')

  if (acompanhar) {
    const { error } = await supabaseAdmin
      .from('atendimento_acompanhamentos')
      .upsert({
        empresa_id: usuario.empresa_id,
        conversa_id: conversaId,
        usuario_id: usuario.id,
      }, { onConflict: 'conversa_id,usuario_id' })
    if (error) throw error
  } else {
    const { error } = await supabaseAdmin
      .from('atendimento_acompanhamentos')
      .delete()
      .eq('empresa_id', usuario.empresa_id)
      .eq('conversa_id', conversaId)
      .eq('usuario_id', usuario.id)
    if (error) throw error
  }

  await registrarEvento({
    empresaId: usuario.empresa_id,
    conversaId,
    tipo: acompanhar ? 'conversa_acompanhada' : 'conversa_acompanhamento_removido',
    usuarioId: usuario.id,
    usuarioNome: usuario.nome,
  })
}

export async function assumirConversa(conversaId: string, usuario: UsuarioTenant) {
  const conversa = await conversaAcessivel(conversaId, usuario, true)
  if (!conversa) throw new Error('Conversa não disponível.')
  const acessoCanal = await acessoCanalWhatsApp(usuario, conversa.whatsapp_canal_id)
  if (!acessoCanal.atender) {
    throw new Error('Você não possui permissão para atender por este canal.')
  }
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
  const conversa = await conversaAcessivel(conversaId, usuario, true)
  if (!conversa) throw new Error('Conversa não encontrada.')
  const acessoCanal = await acessoCanalWhatsApp(usuario, conversa.whatsapp_canal_id)
  if (usuario.role !== 'master' && !acessoCanal.transferir) {
    throw new Error('Você não possui permissão para transferir atendimentos deste canal.')
  }
  const { data: destino } = await supabaseAdmin.from('usuarios')
    .select('id,nome,role,empresa_id').eq('id', destinoId).maybeSingle()
  if (!destino || destino.empresa_id !== usuario.empresa_id) throw new Error('Usuário de destino inválido.')
  const destinoPodeAtender = await usuarioPodeAtenderCanal(
    usuario.empresa_id,
    conversa.whatsapp_canal_id,
    destino.id,
    destino.role,
  )
  if (!destinoPodeAtender) {
    throw new Error('O usuário de destino não possui permissão para atender por este canal.')
  }
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
  if (usuario.role !== 'master' && conversa.responsavel_id !== usuario.id) {
    throw new Error('A supervisão permite acompanhar, mas somente o atendente responsável pode finalizar.')
  }
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