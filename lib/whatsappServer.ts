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

type AcessoGrupo = {
  grupoId: string | null
  configurado: boolean
  nivel: 'sem_acesso' | 'acompanhar' | 'atender' | 'gerenciar' | 'herdado'
  visualizar: boolean
  atender: boolean
  transferir: boolean
  responsavelPrincipalId: string | null
  responsavelPrincipalNome: string | null
  responsavelEfetivoId: string | null
  responsavelEfetivoNome: string | null
  delegacaoFimEm: string | null
  delegacaoAtiva: boolean
  delegacaoExpiradaDestinoId: string | null
  podeDelegar: boolean
}

async function acessoGrupoWhatsApp(
  conversa: AtendimentoConversa,
  usuario: UsuarioTenant,
  acessoCanal?: AcessoCanal,
): Promise<AcessoGrupo> {
  const canal = acessoCanal || await acessoCanalWhatsApp(usuario, conversa.whatsapp_canal_id)
  const herdado: AcessoGrupo = {
    grupoId: null,
    configurado: false,
    nivel: 'herdado',
    visualizar: canal.visualizar,
    atender: canal.atender,
    transferir: canal.transferir,
    responsavelPrincipalId: null,
    responsavelPrincipalNome: null,
    responsavelEfetivoId: null,
    responsavelEfetivoNome: null,
    delegacaoFimEm: null,
    delegacaoAtiva: false,
    delegacaoExpiradaDestinoId: null,
    podeDelegar: usuario.role === 'master',
  }
  if (conversa.whatsapp_chat_tipo !== 'grupo' || !conversa.whatsapp_canal_id || !conversa.whatsapp_chat_jid) {
    return herdado
  }

  const { data: grupo } = await supabaseAdmin
    .from('atendimento_whatsapp_grupos')
    .select('id')
    .eq('empresa_id', conversa.empresa_id)
    .eq('whatsapp_canal_id', conversa.whatsapp_canal_id)
    .eq('grupo_jid', conversa.whatsapp_chat_jid)
    .eq('ativo', true)
    .maybeSingle()
  if (!grupo?.id) return herdado

  const agora = new Date().toISOString()
  const [{ data: permissoes }, { data: delegacao }, { data: delegacaoExpirada }] = await Promise.all([
    supabaseAdmin
      .from('atendimento_whatsapp_grupo_permissoes')
      .select('usuario_id,nivel,responsavel_principal')
      .eq('empresa_id', conversa.empresa_id)
      .eq('grupo_id', grupo.id),
    supabaseAdmin
      .from('atendimento_whatsapp_grupo_delegacoes')
      .select('id,origem_usuario_id,destino_usuario_id,inicio_em,fim_em')
      .eq('empresa_id', conversa.empresa_id)
      .eq('grupo_id', grupo.id)
      .eq('ativo', true)
      .lte('inicio_em', agora)
      .gt('fim_em', agora)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('atendimento_whatsapp_grupo_delegacoes')
      .select('id,destino_usuario_id,fim_em')
      .eq('empresa_id', conversa.empresa_id)
      .eq('grupo_id', grupo.id)
      .eq('ativo', true)
      .lte('fim_em', agora)
      .order('fim_em', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const principal = (permissoes || []).find((p: any) => p.responsavel_principal === true) || null
  const regraUsuario = (permissoes || []).find((p: any) => p.usuario_id === usuario.id) || null
  const configurado = (permissoes || []).length > 0
  const principalId = principal?.usuario_id || null
  const efetivoId = delegacao?.destino_usuario_id || principalId
  const [principalNome, efetivoNome] = await Promise.all([
    principalId ? nomeUsuario(principalId) : Promise.resolve(null),
    efetivoId ? nomeUsuario(efetivoId) : Promise.resolve(null),
  ])

  if (usuario.role === 'master') {
    return {
      grupoId: grupo.id,
      configurado,
      nivel: 'gerenciar',
      visualizar: true,
      atender: true,
      transferir: true,
      responsavelPrincipalId: principalId,
      responsavelPrincipalNome: principalNome,
      responsavelEfetivoId: efetivoId,
      responsavelEfetivoNome: efetivoNome,
      delegacaoFimEm: delegacao?.fim_em || null,
      delegacaoAtiva: Boolean(delegacao),
      delegacaoExpiradaDestinoId: delegacaoExpirada?.destino_usuario_id || null,
      podeDelegar: true,
    }
  }

  const atribuicaoPontual = conversa.responsavel_id === usuario.id && conversa.status !== 'finalizado'
  const substitutoAtivo = delegacao?.destino_usuario_id === usuario.id
  const nivel = String(regraUsuario?.nivel || (configurado ? 'sem_acesso' : 'herdado')) as AcessoGrupo['nivel']

  let visualizar = false
  let atender = false
  let transferir = false
  if (atribuicaoPontual) {
    visualizar = true
    atender = true
  } else if (substitutoAtivo) {
    visualizar = true
    atender = true
    transferir = true
  } else if (!configurado) {
    visualizar = canal.visualizar
    atender = canal.atender
    transferir = canal.transferir
  } else if (nivel === 'acompanhar') {
    visualizar = true
  } else if (nivel === 'atender') {
    visualizar = true
    atender = true
  } else if (nivel === 'gerenciar') {
    visualizar = true
    atender = true
    transferir = true
  }

  if (principalId === usuario.id) {
    visualizar = true
    atender = true
    transferir = true
  }

  return {
    grupoId: grupo.id,
    configurado,
    nivel,
    visualizar,
    atender,
    transferir,
    responsavelPrincipalId: principalId,
    responsavelPrincipalNome: principalNome,
    responsavelEfetivoId: efetivoId,
    responsavelEfetivoNome: efetivoNome,
    delegacaoFimEm: delegacao?.fim_em || null,
    delegacaoAtiva: Boolean(delegacao),
    delegacaoExpiradaDestinoId: delegacaoExpirada?.destino_usuario_id || null,
    podeDelegar: principalId === usuario.id,
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

function normalizarNomeMencao(valor: string | null | undefined) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function extrairMencaoDirecionamento(texto: string | null | undefined) {
  const match = String(texto || '').match(/(?:^|\s)@([A-Za-zÀ-ÖØ-öø-ÿ0-9._-]+)/)
  if (!match?.[1]) return null
  const mencao = match[1].replace(/[.,;:!?]+$/g, '').trim()
  return mencao || null
}

async function direcionarConversaPorMencao(params: {
  conversa: AtendimentoConversa
  texto?: string | null
  sessaoId?: string | null
}) {
  const mencao = extrairMencaoDirecionamento(params.texto)
  if (!mencao) return params.conversa

  const alvo = normalizarNomeMencao(mencao)
  const { data: usuarios, error } = await supabaseAdmin
    .from('usuarios')
    .select('id,nome,role,empresa_id')
    .eq('empresa_id', params.conversa.empresa_id)
    .order('nome')
  if (error) throw error

  const candidatos = (usuarios || []).filter((usuario: any) => {
    const nome = normalizarNomeMencao(usuario.nome)
    const primeiroNome = nome.split(' ')[0]
    return nome === alvo || primeiroNome === alvo
  })

  if (candidatos.length !== 1) {
    await registrarEvento({
      empresaId: params.conversa.empresa_id,
      conversaId: params.conversa.id,
      sessaoId: params.sessaoId || null,
      tipo: 'mencao_direcionamento_nao_resolvida',
      dados: {
        mencao,
        motivo: candidatos.length > 1 ? 'ambiguo' : 'usuario_nao_encontrado',
        candidatos: candidatos.map((item: any) => ({ id: item.id, nome: item.nome })),
      },
    })
    return params.conversa
  }

  const destino = candidatos[0] as { id: string; nome: string; role?: string | null }
  const podeAtender = await usuarioPodeAtenderCanal(
    params.conversa.empresa_id,
    params.conversa.whatsapp_canal_id,
    destino.id,
    destino.role,
  )
  if (!podeAtender) {
    await registrarEvento({
      empresaId: params.conversa.empresa_id,
      conversaId: params.conversa.id,
      sessaoId: params.sessaoId || null,
      tipo: 'mencao_direcionamento_nao_resolvida',
      dados: { mencao, motivo: 'sem_permissao_no_canal', destino_id: destino.id, destino_nome: destino.nome },
    })
    return params.conversa
  }

  const agora = new Date().toISOString()
  const { data: atualizada, error: updateError } = await supabaseAdmin
    .from('atendimento_conversas')
    .update({
      responsavel_id: destino.id,
      responsavel_nome: destino.nome,
      status: 'aguardando',
      updated_at: agora,
    })
    .eq('id', params.conversa.id)
    .select('*')
    .single()
  if (updateError) throw updateError

  if (params.sessaoId) {
    const { error: sessaoError } = await supabaseAdmin
      .from('atendimento_sessoes')
      .update({
        responsavel_id: destino.id,
        responsavel_nome: destino.nome,
        status: 'aguardando',
        assigned_at: null,
      })
      .eq('id', params.sessaoId)
    if (sessaoError) throw sessaoError
  }

  await registrarEvento({
    empresaId: params.conversa.empresa_id,
    conversaId: params.conversa.id,
    sessaoId: params.sessaoId || null,
    tipo: 'conversa_direcionada_mencao',
    dados: { mencao, destino_id: destino.id, destino_nome: destino.nome },
  })
  return atualizada as AtendimentoConversa
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

  const emAtendimento = conversa.status === 'em_atendimento'
  const { data } = await supabaseAdmin.from('atendimento_sessoes').insert({
    empresa_id: conversa.empresa_id,
    conversa_id: conversa.id,
    status: emAtendimento ? 'em_atendimento' : 'aguardando',
    responsavel_id: conversa.responsavel_id || null,
    responsavel_nome: conversa.responsavel_nome || null,
    setor: conversa.setor || null,
    assigned_at: emAtendimento ? new Date().toISOString() : null,
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
      status: 'aguardando',
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
    status: 'aguardando',
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
        const conversaRoteada = await direcionarConversaPorMencao({
          conversa,
          texto,
          sessaoId: sessao?.id || null,
        })
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
          status: 'aguardando',
          ultimo_preview: texto,
          nao_lidas: (conversaRoteada.nao_lidas || 0) + 1,
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
  const conversaRoteada = await direcionarConversaPorMencao({
    conversa,
    texto: dados.texto || null,
    sessaoId: sessao?.id || null,
  })
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
    nao_lidas: (conversaRoteada.nao_lidas || 0) + 1,
    ultima_mensagem_em: agora,
    ultima_entrada_em: agora,
    status: 'aguardando',
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
  if (data.whatsapp_chat_tipo === 'grupo') {
    const grupo = await acessoGrupoWhatsApp(data as AtendimentoConversa, usuario, acesso)
    if (!grupo.visualizar) return null
    return data as AtendimentoConversa
  }
  if (!acesso.visualizar) return null
  if (data.responsavel_id === usuario.id) return data as AtendimentoConversa
  if (acesso.supervisionar) return data as AtendimentoConversa
  if (incluirFila && !data.responsavel_id && acesso.atender) return data as AtendimentoConversa
  return null
}

export async function listarAcessosCanaisAtendimento(usuario: UsuarioTenant) {
  const agora = new Date().toISOString()
  const [
    { data: canais, error: canaisError },
    { data: permissoes, error: permissoesError },
    { data: permissoesGrupo, error: permissoesGrupoError },
    { data: delegacoes, error: delegacoesError },
    { data: atribuidas, error: atribuidasError },
  ] = await Promise.all([
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
    supabaseAdmin
      .from('atendimento_whatsapp_grupo_permissoes')
      .select('grupo_id,nivel')
      .eq('empresa_id', usuario.empresa_id)
      .eq('usuario_id', usuario.id)
      .neq('nivel', 'sem_acesso'),
    supabaseAdmin
      .from('atendimento_whatsapp_grupo_delegacoes')
      .select('grupo_id')
      .eq('empresa_id', usuario.empresa_id)
      .eq('destino_usuario_id', usuario.id)
      .eq('ativo', true)
      .lte('inicio_em', agora)
      .gt('fim_em', agora),
    supabaseAdmin
      .from('atendimento_conversas')
      .select('whatsapp_canal_id')
      .eq('empresa_id', usuario.empresa_id)
      .eq('responsavel_id', usuario.id)
      .neq('status', 'finalizado'),
  ])
  if (canaisError) throw canaisError
  if (permissoesError) throw permissoesError
  if (permissoesGrupoError) throw permissoesGrupoError
  if (delegacoesError) throw delegacoesError
  if (atribuidasError) throw atribuidasError

  const grupoIds = [...new Set([
    ...(permissoesGrupo || []).map((p: any) => p.grupo_id),
    ...(delegacoes || []).map((d: any) => d.grupo_id),
  ].filter(Boolean))]
  const canaisGrupo = new Set<string>()
  if (grupoIds.length) {
    const { data: grupos, error: gruposError } = await supabaseAdmin
      .from('atendimento_whatsapp_grupos')
      .select('id,whatsapp_canal_id')
      .eq('empresa_id', usuario.empresa_id)
      .in('id', grupoIds)
    if (gruposError) throw gruposError
    for (const grupo of grupos || []) if (grupo.whatsapp_canal_id) canaisGrupo.add(grupo.whatsapp_canal_id)
  }
  for (const conversa of atribuidas || []) {
    if (conversa.whatsapp_canal_id) canaisGrupo.add(conversa.whatsapp_canal_id)
  }

  const porCanal = new Map((permissoes || []).map((p: any) => [p.canal_id, p]))
  return (canais || []).map((canal: any) => {
    const permissao: any = porCanal.get(canal.id) || null
    const dono = canal.usuario_id === usuario.id
    const principal = canal.principal === true
    const master = usuario.role === 'master'
    const acessoPorGrupo = canaisGrupo.has(canal.id)
    return {
      canal_id: canal.id as string,
      visualizar: master || dono || acessoPorGrupo || Boolean(
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
  const avaliadas = await Promise.all(((data || []) as AtendimentoConversa[]).map(async conversa => {
    if (!conversa.whatsapp_canal_id) return { conversa, permitido: false, grupo: null as AcessoGrupo | null }
    const acesso = acessoPorCanal.get(conversa.whatsapp_canal_id)
    if (!acesso?.visualizar && usuario.role !== 'master') return { conversa, permitido: false, grupo: null as AcessoGrupo | null }

    if (conversa.whatsapp_chat_tipo === 'grupo') {
      const grupo = await acessoGrupoWhatsApp(conversa, usuario, acesso)
      if (!grupo.visualizar) return { conversa, permitido: false, grupo }

      // Delegacao vencida volta automaticamente ao responsavel principal.
      // Transferencias pontuais continuam com o destinatario ate ele finalizar.
      if (
        grupo.responsavelEfetivoId &&
        grupo.delegacaoExpiradaDestinoId &&
        conversa.status !== 'em_atendimento' &&
        conversa.responsavel_id === grupo.delegacaoExpiradaDestinoId
      ) {
        const agora = new Date().toISOString()
        await supabaseAdmin.from('atendimento_conversas').update({
          responsavel_id: grupo.responsavelEfetivoId,
          responsavel_nome: grupo.responsavelEfetivoNome,
          updated_at: agora,
        }).eq('id', conversa.id)
        if (grupo.grupoId) {
          await supabaseAdmin.from('atendimento_whatsapp_grupo_delegacoes').update({
            ativo: false,
            encerrado_em: agora,
          })
            .eq('empresa_id', usuario.empresa_id)
            .eq('grupo_id', grupo.grupoId)
            .eq('ativo', true)
            .lte('fim_em', agora)
        }
        conversa = {
          ...conversa,
          responsavel_id: grupo.responsavelEfetivoId,
          responsavel_nome: grupo.responsavelEfetivoNome,
        }
      }
      return { conversa, permitido: true, grupo }
    }

    if (usuario.role === 'master') return { conversa, permitido: true, grupo: null }
    if (acesso?.dono || acesso?.supervisionar) return { conversa, permitido: true, grupo: null }
    if (conversa.responsavel_id === usuario.id) return { conversa, permitido: true, grupo: null }
    return { conversa, permitido: !conversa.responsavel_id && Boolean(acesso?.atender), grupo: null }
  }))
  const permitidasComGrupo = avaliadas.filter(item => item.permitido)
  const permitidas = permitidasComGrupo.map(item => item.conversa)

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
  const grupoPorConversa = new Map(
    permitidasComGrupo
      .filter(item => item.grupo)
      .map(item => [item.conversa.id, item.grupo as AcessoGrupo])
  )
  return permitidas.map(conversa => {
    const grupo = grupoPorConversa.get(conversa.id)
    return {
      ...conversa,
      transferida_em: ultimaTransferencia.get(conversa.id) || null,
      acompanhando: acompanhadas.has(conversa.id),
      grupo_id: grupo?.grupoId || null,
      grupo_nivel_acesso: grupo?.nivel || null,
      grupo_pode_atender: grupo?.atender ?? null,
      grupo_pode_transferir: grupo?.transferir ?? null,
      grupo_pode_delegar: grupo?.podeDelegar ?? null,
      grupo_responsavel_principal_id: grupo?.responsavelPrincipalId || null,
      grupo_responsavel_principal_nome: grupo?.responsavelPrincipalNome || null,
      grupo_responsavel_efetivo_id: grupo?.responsavelEfetivoId || null,
      grupo_responsavel_efetivo_nome: grupo?.responsavelEfetivoNome || null,
      grupo_delegacao_fim_em: grupo?.delegacaoFimEm || null,
      grupo_delegacao_ativa: grupo?.delegacaoAtiva || false,
    }
  })
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
    ...(await Promise.all((grupos || []).map(async (item: any) => {
      const conversa: AtendimentoConversa = {
        id: '',
        empresa_id: usuario.empresa_id,
        canal: 'whatsapp',
        telefone: '0',
        whatsapp_canal_id: canalId,
        whatsapp_chat_tipo: 'grupo',
        whatsapp_chat_jid: item.grupo_jid,
        grupo_nome: item.nome,
        status: 'finalizado',
        created_at: '',
        updated_at: '',
      }
      const acessoGrupo = await acessoGrupoWhatsApp(conversa, usuario, acesso)
      if (!acessoGrupo.visualizar) return null
      return {
        id: item.id,
        tipo: 'grupo' as const,
        jid: item.grupo_jid,
        telefone: null,
        nome: item.nome || 'Grupo WhatsApp',
        participantes: Number(item.participantes || 0),
      }
    }))).filter(Boolean) as any[],
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
  if (tipo === 'grupo') {
    const conversaGrupo: AtendimentoConversa = {
      id: '',
      empresa_id: usuario.empresa_id,
      canal: 'whatsapp',
      telefone: '0',
      whatsapp_canal_id: dados.canalId,
      whatsapp_chat_tipo: 'grupo',
      whatsapp_chat_jid: jid,
      grupo_nome: dados.nome || null,
      status: 'finalizado',
      created_at: '',
      updated_at: '',
    }
    const grupo = await acessoGrupoWhatsApp(conversaGrupo, usuario, acesso)
    if (!grupo.visualizar) throw new Error('Você não possui acesso a este grupo.')
  } else if (!acesso.atender) {
    throw new Error('Você não possui permissão para iniciar conversa neste canal.')
  }

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
  const podeAtender = conversa.whatsapp_chat_tipo === 'grupo'
    ? (await acessoGrupoWhatsApp(conversa, usuario, acesso)).atender
    : acesso.atender
  if (!podeAtender) throw new Error('Você pode acompanhar esta conversa, mas não possui permissão para responder.')
  if (conversa.responsavel_id !== usuario.id || conversa.status !== 'em_atendimento') {
    throw new Error('Assuma o atendimento antes de enviar arquivos.')
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
  const podeAtender = conversa.whatsapp_chat_tipo === 'grupo'
    ? (await acessoGrupoWhatsApp(conversa, usuario, acesso)).atender
    : acesso.atender
  if (!podeAtender) throw new Error('Você pode acompanhar esta conversa, mas não possui permissão para responder.')
  if (conversa.responsavel_id !== usuario.id || conversa.status !== 'em_atendimento') {
    throw new Error('Assuma o atendimento antes de responder.')
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

export async function enviarTextoWhatsApp(
  conversaId: string,
  texto: string,
  usuario: UsuarioTenant,
  respostaMensagemId?: string | null,
) {
  const conversa = await conversaAcessivel(conversaId, usuario, false)
  if (!conversa) throw new Error('Conversa não disponível para este usuário.')
  const corpo = texto.trim()
  if (!corpo) throw new Error('Mensagem vazia.')

  let mensagemRespondida: any = null
  if (respostaMensagemId) {
    const { data: alvo } = await supabaseAdmin
      .from('atendimento_mensagens')
      .select('id,direcao,tipo,texto,whatsapp_message_id,payload')
      .eq('id', respostaMensagemId)
      .eq('conversa_id', conversa.id)
      .eq('empresa_id', usuario.empresa_id)
      .maybeSingle()
    if (!alvo?.whatsapp_message_id) throw new Error('A mensagem original ainda não pode ser respondida pelo WhatsApp.')
    mensagemRespondida = alvo
  }

  const nomeAtendente = String(usuario.nome || 'Equipe Esquadrifácio').trim() || 'Equipe Esquadrifácio'
  const corpoCliente = `${nomeAtendente} diz:\n${corpo}`

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
    const podeAtender = conversa.whatsapp_chat_tipo === 'grupo'
      ? (await acessoGrupoWhatsApp(conversa, usuario, acessoCanal)).atender
      : acessoCanal.atender
    if (!podeAtender) {
      throw new Error('Você pode acompanhar esta conversa, mas não possui permissão para responder.')
    }
    if (conversa.responsavel_id !== usuario.id || conversa.status !== 'em_atendimento') {
      throw new Error('Assuma o atendimento antes de responder.')
    }

    const alvoPayload = mensagemRespondida?.payload && typeof mensagemRespondida.payload === 'object'
      ? mensagemRespondida.payload as Record<string, any>
      : {}
    const destinoPayload = {
      transporte: 'qr_gateway',
      status: 'pendente',
      chatTipo: conversa.whatsapp_chat_tipo || 'contato',
      chatJid: conversa.whatsapp_chat_tipo === 'grupo' ? conversa.whatsapp_chat_jid || null : null,
      quotedWhatsappMessageId: mensagemRespondida?.whatsapp_message_id || null,
      quotedMessageId: mensagemRespondida?.id || null,
      quotedText: mensagemRespondida?.texto || null,
      quotedFromMe: mensagemRespondida ? mensagemRespondida.direcao === 'saida' : null,
      quotedParticipantJid:
        alvoPayload.participanteJid || alvoPayload.participante_jid ||
        alvoPayload.participanteJidAlt || alvoPayload.participante_jid_alt || null,
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
      dados: {
        mensagem_id: mensagem.id,
        resposta_mensagem_id: mensagemRespondida?.id || null,
        resposta_whatsapp_message_id: mensagemRespondida?.whatsapp_message_id || null,
      },
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
      ...(mensagemRespondida?.whatsapp_message_id
        ? { context: { message_id: mensagemRespondida.whatsapp_message_id } }
        : {}),
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
    payload: {
      provider: json,
      quotedWhatsappMessageId: mensagemRespondida?.whatsapp_message_id || null,
      quotedMessageId: mensagemRespondida?.id || null,
      quotedText: mensagemRespondida?.texto || null,
    },
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
    dados: {
      whatsapp_message_id: messageId,
      resposta_mensagem_id: mensagemRespondida?.id || null,
      resposta_whatsapp_message_id: mensagemRespondida?.whatsapp_message_id || null,
    },
  })

  return { messageId, queued: false }
}

export async function reagirMensagemWhatsApp(
  conversaId: string,
  mensagemId: string,
  emoji: string,
  usuario: UsuarioTenant,
) {
  const conversa = await conversaAcessivel(conversaId, usuario, false)
  if (!conversa) throw new Error('Conversa não disponível para este usuário.')
  const reacao = String(emoji || '').trim()
  if (!reacao || reacao.length > 16) throw new Error('Emoji inválido.')

  const acessoCanal = await acessoCanalWhatsApp(usuario, conversa.whatsapp_canal_id)
  const podeAtender = conversa.whatsapp_chat_tipo === 'grupo'
    ? (await acessoGrupoWhatsApp(conversa, usuario, acessoCanal)).atender
    : acessoCanal.atender
  if (!podeAtender) throw new Error('Você pode acompanhar esta conversa, mas não pode reagir às mensagens.')
  if (conversa.responsavel_id !== usuario.id || conversa.status !== 'em_atendimento') {
    throw new Error('Assuma o atendimento antes de reagir.')
  }

  const { data: alvo } = await supabaseAdmin
    .from('atendimento_mensagens')
    .select('id,direcao,texto,whatsapp_message_id,payload')
    .eq('id', mensagemId)
    .eq('conversa_id', conversaId)
    .eq('empresa_id', usuario.empresa_id)
    .maybeSingle()
  if (!alvo?.whatsapp_message_id) throw new Error('Esta mensagem ainda não aceita reação.')

  const { data: config } = await supabaseAdmin.from('atendimento_configuracoes')
    .select('modo_integracao').eq('empresa_id', usuario.empresa_id).eq('ativo', true).maybeSingle()
  if ((config?.modo_integracao || 'qr') !== 'qr') {
    throw new Error('Reações pelo Atlas estão disponíveis nos canais conectados por QR.')
  }
  if (!conversa.whatsapp_canal_id) throw new Error('Canal WhatsApp não identificado.')

  const alvoPayload = alvo.payload && typeof alvo.payload === 'object' ? alvo.payload as Record<string, any> : {}
  const agora = new Date().toISOString()
  const payload = {
    transporte: 'qr_gateway',
    status: 'pendente',
    chatTipo: conversa.whatsapp_chat_tipo || 'contato',
    chatJid: conversa.whatsapp_chat_tipo === 'grupo' ? conversa.whatsapp_chat_jid || null : null,
    reactionTargetWhatsappId: alvo.whatsapp_message_id,
    reactionTargetMessageId: alvo.id,
    reactionTargetFromMe: alvo.direcao === 'saida',
    reactionTargetParticipantJid:
      alvoPayload.participanteJid || alvoPayload.participante_jid ||
      alvoPayload.participanteJidAlt || alvoPayload.participante_jid_alt || null,
  }

  const sessao = await garantirSessao(conversa)
  const { data: mensagem, error: mensagemError } = await supabaseAdmin
    .from('atendimento_mensagens')
    .insert({
      empresa_id: usuario.empresa_id,
      conversa_id: conversa.id,
      sessao_id: sessao?.id || null,
      direcao: 'saida',
      tipo: 'reacao',
      texto: reacao,
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
    tipo: 'reaction',
    texto: reacao,
    payload,
    status: 'pendente',
    whatsapp_canal_id: conversa.whatsapp_canal_id,
  })
  if (filaError) throw filaError

  await registrarEvento({
    empresaId: usuario.empresa_id,
    conversaId: conversa.id,
    sessaoId: sessao?.id || null,
    tipo: 'mensagem_reagida',
    usuarioId: usuario.id,
    usuarioNome: usuario.nome,
    dados: {
      mensagem_id: alvo.id,
      whatsapp_message_id: alvo.whatsapp_message_id,
      emoji: reacao,
    },
  })

  return { queued: true, mensagemId: mensagem.id }
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
  await registrarEvento({
    empresaId: usuario.empresa_id,
    conversaId,
    tipo: 'conversa_baixada',
    usuarioId: usuario.id,
    usuarioNome: usuario.nome,
    dados: { nao_lidas_antes: Number(conversa.nao_lidas || 0) },
  })
}

export async function registrarVisualizacaoConversa(conversaId: string, usuario: UsuarioTenant) {
  const conversa = await conversaAcessivel(conversaId, usuario, true)
  if (!conversa) throw new Error('Conversa não disponível.')
  await registrarEvento({
    empresaId: usuario.empresa_id,
    conversaId,
    tipo: 'conversa_visualizada',
    usuarioId: usuario.id,
    usuarioNome: usuario.nome,
  })
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
  const podeAtender = conversa.whatsapp_chat_tipo === 'grupo'
    ? (await acessoGrupoWhatsApp(conversa, usuario, acessoCanal)).atender
    : acessoCanal.atender
  if (!podeAtender) {
    throw new Error('Você pode acompanhar esta conversa, mas não possui permissão para atender.')
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
  const podeTransferir = conversa.whatsapp_chat_tipo === 'grupo'
    ? (await acessoGrupoWhatsApp(conversa, usuario, acessoCanal)).transferir
    : acessoCanal.transferir
  if (usuario.role !== 'master' && !podeTransferir) {
    throw new Error('Você não possui permissão para transferir este atendimento.')
  }
  const { data: destino } = await supabaseAdmin.from('usuarios')
    .select('id,nome,role,empresa_id').eq('id', destinoId).maybeSingle()
  if (!destino || destino.empresa_id !== usuario.empresa_id) throw new Error('Usuário de destino inválido.')
  if (conversa.whatsapp_chat_tipo !== 'grupo') {
    const destinoPodeAtender = await usuarioPodeAtenderCanal(
      usuario.empresa_id,
      conversa.whatsapp_canal_id,
      destino.id,
      destino.role,
    )
    if (!destinoPodeAtender) {
      throw new Error('O usuário de destino não possui permissão para atender por este canal.')
    }
  }
  const agora = new Date().toISOString()
  await supabaseAdmin.from('atendimento_conversas').update({
    responsavel_id: destino.id,
    responsavel_nome: destino.nome,
    setor: setor || conversa.setor || null,
    status: 'aguardando',
    updated_at: agora,
  }).eq('id', conversaId)
  const sessao = await garantirSessao(conversa)
  if (sessao?.id) {
    await supabaseAdmin.from('atendimento_sessoes').update({
      responsavel_id: destino.id,
      responsavel_nome: destino.nome,
      setor: setor || conversa.setor || null,
      status: 'aguardando',
      assigned_at: null,
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
  await supabaseAdmin.from('notificacoes').insert({
    empresa_id: usuario.empresa_id,
    usuario_id: destino.id,
    categoria: 'chat',
    tipo: 'whatsapp_transferencia',
    titulo: 'WhatsApp · atendimento transferido',
    mensagem: `${usuario.nome} transferiu ${conversa.contato_nome || conversa.grupo_nome || conversa.telefone} para você.`,
    href: `/whatsapp?conversaId=${conversaId}`,
    origem_tipo: 'whatsapp_transferencia',
    origem_id: `${conversaId}:${agora}`,
    push_status: 'pendente',
  })
}

export async function finalizarConversa(conversaId: string, usuario: UsuarioTenant) {
  const conversa = await conversaAcessivel(conversaId, usuario, false)
  if (!conversa) throw new Error('Conversa não disponível.')
  if (usuario.role !== 'master' && conversa.responsavel_id !== usuario.id) {
    throw new Error('A supervisão permite acompanhar, mas somente o atendente responsável pode finalizar.')
  }
  const agora = new Date().toISOString()
  let responsavelDepois = conversa.responsavel_id || null
  let responsavelNomeDepois = conversa.responsavel_nome || null
  if (conversa.whatsapp_chat_tipo === 'grupo') {
    const grupo = await acessoGrupoWhatsApp(conversa, usuario)
    if (grupo.responsavelEfetivoId) {
      responsavelDepois = grupo.responsavelEfetivoId
      responsavelNomeDepois = grupo.responsavelEfetivoNome
    }
  }
  await supabaseAdmin.from('atendimento_conversas').update({
    status: 'finalizado',
    nao_lidas: 0,
    responsavel_id: responsavelDepois,
    responsavel_nome: responsavelNomeDepois,
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