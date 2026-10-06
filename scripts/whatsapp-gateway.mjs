import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { execFile } from 'node:child_process'
import http from 'node:http'
import QRCode from 'qrcode'
import webpush from 'web-push'
import makeWASocket, {
  Browsers,
  DisconnectReason,
  downloadMediaMessage,
  extractMessageContent,
  fetchLatestWaWebVersion,
  getContentType,
  jidNormalizedUser,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys'

const ENV_PATH = process.env.ATLAS_GATEWAY_ENV ||
  path.join(process.env.HOME || '.', '.atlas-one', 'whatsapp-gateway.env')

function loadEnv(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const value = line.trim()
    if (!value || value.startsWith('#')) continue
    const pos = value.indexOf('=')
    if (pos <= 0) continue
    const key = value.slice(0, pos).trim()
    const val = value.slice(pos + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}
loadEnv(ENV_PATH)

const BASE_URL = String(process.env.ATLAS_BASE_URL || '').replace(/\/$/, '')
const GATEWAY_URL = String(
  process.env.ATLAS_GATEWAY_URL ||
  (BASE_URL ? `${BASE_URL}/api/integracoes/whatsapp/gateway` : '')
).replace(/\/$/, '')
const TOKEN = String(process.env.ATLAS_GATEWAY_TOKEN || '')
const VAPID_PUBLIC_KEY = String(process.env.ATLAS_VAPID_PUBLIC_KEY || '')
const VAPID_PRIVATE_KEY = String(process.env.ATLAS_VAPID_PRIVATE_KEY || '')
const VAPID_SUBJECT = String(process.env.ATLAS_VAPID_SUBJECT || 'https://atlas-one.vercel.app')
const PUSH_READY = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)
if (PUSH_READY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}
const SESSIONS_DIR = process.env.ATLAS_WHATSAPP_SESSIONS_DIR ||
  path.join(process.env.HOME || '.', '.atlas-one', 'whatsapp-sessions')
const DEVICE_NAME = 'Atlas One Mac Gateway'

if (!GATEWAY_URL || !TOKEN) {
  console.error('Faltam ATLAS_GATEWAY_URL/ATLAS_BASE_URL ou ATLAS_GATEWAY_TOKEN em', ENV_PATH)
  process.exit(1)
}

fs.mkdirSync(SESSIONS_DIR, { recursive: true })

const sessions = new Map()
const qrStates = new Map()
const groupSyncTimers = new Map()
const groupSyncLastAt = new Map()
const groupSyncInFlight = new Set()
let shuttingDown = false
let refreshTimer = null
let queueTimer = null
let pushTimer = null
let pushSending = false
let panelBrowserOpened = false

const LOCAL_PANEL_PORT = 3337
const localPanel = http.createServer((req, res) => {
  if (req.url?.startsWith('/state')) {
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    })
    res.end(JSON.stringify([...qrStates.values()]))
    return
  }

  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Atlas One · WhatsApp QR</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f1f5f9;margin:0;padding:32px;color:#0f172a}
.wrap{max-width:980px;margin:auto}.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:22px}
h1{font-size:24px;margin:0}.sub{color:#64748b;font-size:14px;margin-top:6px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:18px}
.card{background:white;border:1px solid #e2e8f0;border-radius:18px;padding:20px;box-shadow:0 2px 10px #0000000a}
.badge{display:inline-block;padding:5px 10px;border-radius:999px;font-size:12px;font-weight:700;background:#fef3c7;color:#92400e}
.badge.ok{background:#dcfce7;color:#166534}.badge.qr{background:#dbeafe;color:#1d4ed8}
.qr{display:block;width:300px;height:300px;object-fit:contain;margin:18px auto 10px;border-radius:12px}
.number{font-weight:700;font-size:17px;margin-top:8px}.hint{font-size:13px;color:#475569;line-height:1.45}
.empty{text-align:center;color:#94a3b8;padding:40px}
</style>
</head>
<body>
<div class="wrap">
  <div class="top"><div><h1>Atlas One · WhatsApp</h1><div class="sub">QR Codes atualizados automaticamente</div></div></div>
  <div id="grid" class="grid"><div class="empty">Carregando canais...</div></div>
</div>
<script>
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
async function refresh(){
  try{
    const r=await fetch('/state?ts='+Date.now(),{cache:'no-store'});
    const data=await r.json();
    const grid=document.getElementById('grid');
    if(!data.length){grid.innerHTML='<div class="empty">Nenhum canal ativo.</div>';return}
    grid.innerHTML=data.map(c=>{
      const st=c.status==='connected'?'Conectado':c.status==='qr'?'Aguardando leitura':'Conectando';
      const cls=c.status==='connected'?'ok':c.status==='qr'?'qr':'';
      const visual=c.qrDataUrl&&c.status==='qr'
        ? '<img class="qr" src="'+c.qrDataUrl+'" alt="QR Code"/>'
        : c.status==='connected'
          ? '<div class="empty">✓ Dispositivo conectado</div>'
          : '<div class="empty">Gerando QR...</div>';
      return '<div class="card"><span class="badge '+cls+'">'+st+'</span><div class="number">'+esc(c.nome)+'</div><div class="sub">'+esc(c.numero||'Número identificado após o QR')+'</div>'+visual+'<div class="hint">No celular: WhatsApp → Aparelhos conectados → Conectar aparelho. Esta tela troca o QR automaticamente quando ele expira.</div></div>'
    }).join('');
  }catch(e){}
}
setInterval(refresh,700);refresh();
</script>
</body></html>`)
})

localPanel.listen(LOCAL_PANEL_PORT, '127.0.0.1', () => {
  console.log(`[gateway] painel QR ao vivo: http://127.0.0.1:${LOCAL_PANEL_PORT}`)
})

async function atlas(query = '', options = {}) {
  const url = query ? `${GATEWAY_URL}?${query}` : GATEWAY_URL
  const resp = await fetch(url, {
    ...options,
    headers: {
      'x-atlas-gateway-token': TOKEN,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(json?.error || `Atlas respondeu HTTP ${resp.status}`)
  return json
}

async function listChannels() {
  const json = await atlas('mode=channels', { method: 'GET' })
  return Array.isArray(json.channels) ? json.channels : []
}

async function reportState(channelId, status, extra = {}) {
  try {
    return await atlas('', {
      method: 'POST',
      body: JSON.stringify({
        type: 'state',
        channelId,
        status,
        deviceName: DEVICE_NAME,
        ...extra,
      }),
    })
  } catch (error) {
    console.error(`[gateway:${channelId}] estado:`, error.message)
    return null
  }
}

function phoneFromJid(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const jid = jidNormalizedUser(raw)
  if (!jid.endsWith('@s.whatsapp.net')) return null
  return jid.split('@')[0].split(':')[0].replace(/\D/g, '') || null
}

function phoneFromKey(key) {
  return phoneFromJid(key?.remoteJidAlt) || phoneFromJid(key?.remoteJid)
}

function chatIdentity(key) {
  const remote = String(key?.remoteJid || '').trim()
  if (!remote || remote === 'status@broadcast' || remote.endsWith('@broadcast') || remote.endsWith('@newsletter')) {
    return { kind: 'ignore', chatJid: null, telefone: null }
  }

  if (remote.endsWith('@g.us')) {
    const telefone = phoneFromJid(key?.participantAlt) ||
      phoneFromJid(key?.participant) ||
      phoneFromJid(key?.remoteJidAlt)
    return { kind: 'grupo', chatJid: remote, telefone }
  }

  const telefone = phoneFromKey(key)
  if (!telefone) return { kind: 'ignore', chatJid: null, telefone: null }
  const chatJid = [key?.remoteJidAlt, key?.remoteJid]
    .filter(Boolean)
    .map(jidNormalizedUser)
    .find((value) => value.endsWith('@s.whatsapp.net')) || `${telefone}@s.whatsapp.net`
  return { kind: 'contato', chatJid, telefone }
}

function isStatusOrBroadcastJid(value) {
  const jid = String(value || '').trim().toLowerCase()
  return jid === 'status@broadcast' || jid.endsWith('@broadcast') || jid.endsWith('@newsletter')
}

async function syncContacts(channel, contacts) {
  const rows = (contacts || []).map((c) => ({
    id: c?.id || null,
    name: c?.name || null,
    notify: c?.notify || null,
    short: c?.short || null,
    verifiedName: c?.verifiedName || null,
  })).filter((c) => c.id && !isStatusOrBroadcastJid(c.id) && !String(c.id).endsWith('@g.us'))

  for (let i = 0; i < rows.length; i += 250) {
    await atlas('', {
      method: 'POST',
      body: JSON.stringify({
        type: 'contacts_sync',
        channelId: channel.id,
        contacts: rows.slice(i, i + 250),
      }),
    })
  }
}

async function syncGroups(channel, sock) {
  if (groupSyncInFlight.has(channel.id)) return
  groupSyncInFlight.add(channel.id)
  groupSyncLastAt.set(channel.id, Date.now())
  try {
    const encontrados = await sock.groupFetchAllParticipating()
    const entries = Object.entries(encontrados || {})
    const groups = []
    let metadataErros = 0

    for (const [jidChave, grupo] of entries) {
      const jid = String(grupo?.id || jidChave || '').trim()
      if (!jid.endsWith('@g.us')) continue
      let meta = grupo || {}
      if (!meta?.subject || !Array.isArray(meta?.participants)) {
        try { meta = await sock.groupMetadata(jid) || meta }
        catch { metadataErros += 1 }
        await new Promise((resolve) => setTimeout(resolve, 220))
      }
      const nome = String(meta?.subject || meta?.name || '').trim() || 'Grupo WhatsApp'
      const participantes = Array.isArray(meta?.participants)
        ? meta.participants.length
        : Math.max(0, Number(meta?.size || 0))
      groups.push({ jid, id: jid, nome, subject: nome, name: nome, participantes, size: participantes })
    }

    await atlas('', {
      method: 'POST',
      body: JSON.stringify({
        type: 'groups_sync',
        channelId: channel.id,
        groups,
      }),
    })
    const nomeados = groups.filter((g) => g.nome !== 'Grupo WhatsApp').length
    console.log(`[gateway:${channel.id}] grupos sincronizados: ${groups.length}; nomeados: ${nomeados}; metadataErros: ${metadataErros}`)
  } catch (error) {
    console.error(`[gateway:${channel.id}] grupos:`, error instanceof Error ? error.message : String(error))
  } finally {
    groupSyncLastAt.set(channel.id, Date.now())
    groupSyncInFlight.delete(channel.id)
  }
}

function agendarSyncGroups(channel, sock, atrasoMs = 1500) {
  const ultima = Number(groupSyncLastAt.get(channel.id) || 0)
  if (groupSyncInFlight.has(channel.id) || Date.now() - ultima < 30_000) return
  const anterior = groupSyncTimers.get(channel.id)
  if (anterior) clearTimeout(anterior)
  const timer = setTimeout(() => {
    groupSyncTimers.delete(channel.id)
    void syncGroups(channel, sock)
  }, atrasoMs)
  groupSyncTimers.set(channel.id, timer)
}

function extensaoPorMime(mimeType, fallback = 'bin') {
  const mime = String(mimeType || '').split(';')[0].toLowerCase()
  const mapa = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'audio/ogg': 'ogg',
    'audio/opus': 'opus',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'audio/webm': 'webm',
    'application/pdf': 'pdf',
  }
  return mapa[mime] || fallback
}

function extractMessage(message, messageId = '') {
  const content = extractMessageContent(message)
  const type = getContentType(content || {}) || 'unknown'
  const base = messageId || Date.now()

  if (type === 'conversation') {
    return { messageType: 'text', texto: content?.conversation || '' }
  }
  if (type === 'extendedTextMessage') {
    return { messageType: 'text', texto: content?.extendedTextMessage?.text || '' }
  }
  if (type === 'imageMessage') {
    const media = content?.imageMessage || {}
    const mimeType = media.mimetype || 'image/jpeg'
    return {
      messageType: 'image',
      texto: media.caption || '📷 Imagem',
      isMedia: true,
      mimeType,
      fileName: media.fileName || `imagem-${base}.${extensaoPorMime(mimeType, 'jpg')}`,
    }
  }
  if (type === 'videoMessage') {
    const media = content?.videoMessage || {}
    const mimeType = media.mimetype || 'video/mp4'
    return {
      messageType: 'video',
      texto: media.caption || '🎥 Vídeo',
      isMedia: true,
      mimeType,
      fileName: media.fileName || `video-${base}.${extensaoPorMime(mimeType, 'mp4')}`,
    }
  }
  if (type === 'audioMessage') {
    const media = content?.audioMessage || {}
    const mimeType = media.mimetype || 'audio/ogg'
    return {
      messageType: 'audio',
      texto: '🎤 Áudio',
      isMedia: true,
      mimeType,
      fileName: `audio-${base}.${extensaoPorMime(mimeType, 'ogg')}`,
      ptt: media.ptt === true,
    }
  }
  if (type === 'documentMessage') {
    const media = content?.documentMessage || {}
    const mimeType = media.mimetype || 'application/pdf'
    return {
      messageType: 'document',
      texto: media.fileName || '📎 Documento',
      isMedia: true,
      mimeType,
      fileName: media.fileName || `documento-${base}.${extensaoPorMime(mimeType, 'bin')}`,
    }
  }
  if (type === 'stickerMessage') {
    const media = content?.stickerMessage || {}
    const mimeType = media.mimetype || 'image/webp'
    return {
      messageType: 'sticker',
      texto: '🖼️ Figurinha',
      isMedia: true,
      mimeType,
      fileName: `figurinha-${base}.${extensaoPorMime(mimeType, 'webp')}`,
    }
  }
  if (type === 'reactionMessage') {
    const reaction = content?.reactionMessage || {}
    return {
      messageType: 'reaction',
      texto: reaction.text ? `Reagiu ${reaction.text}` : 'Reação removida',
      reactionKey: reaction.key || null,
    }
  }
  if (type === 'locationMessage') return { messageType: 'location', texto: '📍 Localização' }
  if (type === 'contactMessage' || type === 'contactsArrayMessage') {
    return { messageType: 'contact', texto: '👤 Contato' }
  }
  return { messageType: 'system', texto: `Mensagem do WhatsApp (${type})` }
}

async function baixarMidia(sock, msg) {
  try {
    return await downloadMediaMessage(msg, 'buffer', {})
  } catch (primeiroErro) {
    try {
      const atualizada = await sock.updateMediaMessage(msg)
      return await downloadMediaMessage(atualizada || msg, 'buffer', {})
    } catch {
      throw primeiroErro
    }
  }
}

async function registerInbound(channel, msg, sock) {
  if (!msg?.message) return

  const identity = chatIdentity(msg.key)
  if (identity.kind === 'ignore') return

  const rawContent = extractMessageContent(msg.message)
  const rawType = getContentType(rawContent || {}) || 'unknown'
  const contextInfo = rawContent?.[rawType]?.contextInfo || null
  const isForwarded = contextInfo?.isForwarded === true || Number(contextInfo?.forwardingScore || 0) > 0
  const fromMe = msg?.key?.fromMe === true

  if (fromMe && identity.kind !== 'grupo') return
  if (fromMe && identity.kind === 'grupo' && !isForwarded) return

  let grupoNome = null
  if (identity.kind === 'grupo') {
    try {
      const meta = await sock.groupMetadata(identity.chatJid)
      grupoNome = meta?.subject || null
    } catch {}
  }

  const telefone = identity.telefone ||
    (identity.kind === 'grupo' ? String(identity.chatJid || '').split('@')[0].replace(/\D/g, '') : null)
  if (!telefone) return

  const whatsappMessageId = msg.key?.id || null
  const extracted = extractMessage(msg.message, whatsappMessageId || '')
  const rawTs = Number(msg.messageTimestamp || 0)
  const timestamp = rawTs > 0
    ? new Date(rawTs * 1000).toISOString()
    : new Date().toISOString()

  let mediaPath = null
  let mediaSize = null
  let mediaError = null
  let mediaMimeType = extracted.mimeType || null

  if (extracted.isMedia) {
    try {
      const buffer = await baixarMidia(sock, msg)
      if (!buffer?.length) throw new Error('Mídia recebida sem conteúdo.')
      if (buffer.length > 50 * 1024 * 1024) throw new Error('Mídia recebida excede 50 MB.')

      const preparado = await atlas('', {
        method: 'POST',
        body: JSON.stringify({
          type: 'media_prepare',
          channelId: channel.id,
          whatsappMessageId,
          fileName: extracted.fileName,
          mimeType: extracted.mimeType,
          size: buffer.length,
        }),
      })

      const mimeUpload = preparado.mimeType || String(extracted.mimeType || 'application/octet-stream').split(';')[0]
      mediaMimeType = mimeUpload
      const upload = await fetch(preparado.signedUrl, {
        method: 'PUT',
        headers: {
          'content-type': mimeUpload,
          'cache-control': 'max-age=3600',
          'x-upsert': 'false',
        },
        body: buffer,
      })
      if (!upload.ok) {
        const detalhe = await upload.text().catch(() => '')
        throw new Error(`Storage respondeu HTTP ${upload.status}${detalhe ? `: ${detalhe.slice(0, 160)}` : ''}`)
      }

      mediaPath = preparado.path
      mediaSize = buffer.length
    } catch (error) {
      mediaError = error instanceof Error ? error.message : String(error)
      console.error(`[gateway:${channel.id}] mídia ${whatsappMessageId || ''}:`, mediaError)
    }
  }

  await atlas('', {
    method: 'POST',
    body: JSON.stringify({
      type: 'inbound',
      channelId: channel.id,
      telefone,
      contatoNome: identity.kind === 'grupo' ? (grupoNome || 'Grupo WhatsApp') : (msg.pushName || null),
      chatTipo: identity.kind,
      chatJid: identity.chatJid,
      grupoNome,
      participanteJid: identity.kind === 'grupo' ? (msg.key?.participantAlt || msg.key?.participant || null) : null,
      participanteTelefone: identity.kind === 'grupo' ? (identity.telefone || null) : null,
      participanteNome: identity.kind === 'grupo' ? (msg.pushName || null) : null,
      fromMe,
      isForwarded,
      whatsappMessageId,
      messageType: extracted.messageType,
      texto: extracted.texto,
      timestamp,
      mediaPath,
      mimeType: mediaMimeType,
      fileName: extracted.fileName || null,
      mediaSize,
      payload: {
        remoteJid: msg.key?.remoteJid || null,
        remoteJidAlt: msg.key?.remoteJidAlt || null,
        participanteJid: msg.key?.participantAlt || msg.key?.participant || null,
        chatTipo: identity.kind,
        chatJid: identity.chatJid,
        grupoNome,
        participanteTelefone: identity.kind === 'grupo' ? (identity.telefone || null) : null,
        participanteNome: identity.kind === 'grupo' ? (msg.pushName || null) : null,
        fromMe,
        isForwarded,
        ptt: extracted.ptt === true,
        reactionKey: extracted.reactionKey || null,
        mediaError,
      },
    }),
  })
}


function lidMapFromHistory(lidPnMappings = []) {
  const map = new Map()
  for (const item of lidPnMappings || []) {
    const lid = String(item?.lid || '').trim()
    const pn = String(item?.pn || '').trim()
    if (!lid || !pn) continue
    map.set(jidNormalizedUser(lid), jidNormalizedUser(pn))
  }
  return map
}

function resolvePnJid(value, lidToPn) {
  const jid = String(value || '').trim()
  if (!jid) return ''
  const normalized = jidNormalizedUser(jid)
  return lidToPn?.get(normalized) || normalized
}

function historyChatPayload(chat, lidToPn) {
  const rawJid = String(chat?.id || chat?.jid || '').trim()
  if (!rawJid || isStatusOrBroadcastJid(rawJid)) return null

  if (rawJid.endsWith('@g.us')) {
    const telefone = rawJid.split('@')[0].replace(/\D/g, '')
    return {
      jid: rawJid,
      chatTipo: 'grupo',
      telefone: telefone || null,
      nome: String(chat?.name || chat?.subject || '').trim() || 'Grupo WhatsApp',
      grupoNome: String(chat?.name || chat?.subject || '').trim() || 'Grupo WhatsApp',
      archived: chat?.archived === true,
      unreadCount: Math.max(0, Number(chat?.unreadCount || 0)),
      timestamp: Number(chat?.conversationTimestamp || 0) || null,
    }
  }

  const pnJid = resolvePnJid(rawJid, lidToPn)
  const telefone = phoneFromJid(pnJid)
  if (!telefone) return null
  return {
    jid: pnJid,
    chatTipo: 'contato',
    telefone,
    nome: String(chat?.name || chat?.notify || '').trim() || null,
    grupoNome: null,
    archived: chat?.archived === true,
    unreadCount: Math.max(0, Number(chat?.unreadCount || 0)),
    timestamp: Number(chat?.conversationTimestamp || 0) || null,
  }
}

function historyMessagePayload(msg, lidToPn) {
  if (!msg?.message || !msg?.key?.id) return null

  const remoteRaw = String(msg.key?.remoteJid || '').trim()
  if (!remoteRaw || isStatusOrBroadcastJid(remoteRaw)) return null

  let chatTipo = 'contato'
  let chatJid = ''
  let telefone = null

  if (remoteRaw.endsWith('@g.us')) {
    chatTipo = 'grupo'
    chatJid = remoteRaw
    telefone = phoneFromJid(resolvePnJid(msg.key?.participantAlt || msg.key?.participant || '', lidToPn))
      || remoteRaw.split('@')[0].replace(/\D/g, '')
  } else {
    const candidate = resolvePnJid(msg.key?.remoteJidAlt || remoteRaw, lidToPn)
    telefone = phoneFromJid(candidate)
    if (!telefone) return null
    chatJid = candidate
  }

  const extracted = extractMessage(msg.message, msg.key.id)
  const rawTs = Number(msg.messageTimestamp?.toString?.() || msg.messageTimestamp || 0)
  const timestamp = rawTs > 0 ? new Date(rawTs * 1000).toISOString() : null

  return {
    telefone,
    contatoNome: msg.pushName || null,
    chatTipo,
    chatJid,
    grupoNome: null,
    participanteJid: chatTipo === 'grupo' ? resolvePnJid(msg.key?.participantAlt || msg.key?.participant || '', lidToPn) : null,
    participanteTelefone: chatTipo === 'grupo'
      ? phoneFromJid(resolvePnJid(msg.key?.participantAlt || msg.key?.participant || '', lidToPn))
      : null,
    participanteNome: chatTipo === 'grupo' ? (msg.pushName || null) : null,
    fromMe: msg.key?.fromMe === true,
    whatsappMessageId: msg.key.id,
    messageType: extracted.messageType,
    texto: extracted.texto,
    timestamp,
    mimeType: extracted.mimeType || null,
    fileName: extracted.fileName || null,
    payload: {
      remoteJid: msg.key?.remoteJid || null,
      remoteJidAlt: msg.key?.remoteJidAlt || null,
      participanteJid: msg.key?.participantAlt || msg.key?.participant || null,
      historico: true,
      ptt: extracted.ptt === true,
      reactionKey: extracted.reactionKey || null,
    },
  }
}

async function syncHistoryChats(channel, chats, lidToPn) {
  const rows = (chats || []).map((chat) => historyChatPayload(chat, lidToPn)).filter(Boolean)
  for (let i = 0; i < rows.length; i += 150) {
    await atlas('', {
      method: 'POST',
      body: JSON.stringify({
        type: 'chats_sync',
        channelId: channel.id,
        chats: rows.slice(i, i + 150),
      }),
    })
  }
  return rows.length
}

async function syncHistoryMessages(channel, messages, lidToPn) {
  const rows = (messages || []).map((msg) => historyMessagePayload(msg, lidToPn)).filter(Boolean)
  for (let i = 0; i < rows.length; i += 75) {
    await atlas('', {
      method: 'POST',
      body: JSON.stringify({
        type: 'history_messages_sync',
        channelId: channel.id,
        messages: rows.slice(i, i + 75),
      }),
    })
  }
  return rows.length
}

async function syncHistoryBundle(channel, data, lidToPnBase = null) {
  const lidToPn = lidToPnBase instanceof Map ? lidToPnBase : new Map()
  for (const [lid, pn] of lidMapFromHistory(data.lidPnMappings || [])) {
    lidToPn.set(lid, pn)
  }
  const contacts = (data.contacts || []).map((contact) => {
    const rawId = String(contact?.id || '').trim()
    const resolvedId = resolvePnJid(rawId, lidToPn)
    return { ...contact, id: resolvedId || rawId }
  })

  await syncContacts(channel, contacts)
  const chats = await syncHistoryChats(channel, data.chats || [], lidToPn)
  const messages = await syncHistoryMessages(channel, data.messages || [], lidToPn)

  console.log(
    `[gateway:${channel.id}] historico sincronizado: chats=${chats}; mensagens=${messages}; contatos=${contacts.length}; progresso=${data.progress ?? '?'}; tipo=${data.syncType ?? '?'}`,
  )
}


async function processQueue(channelId) {
  const state = sessions.get(channelId)
  if (!state?.sock?.user || state.sending) return
  state.sending = true
  try {
    const response = await atlas(`channelId=${encodeURIComponent(channelId)}`, { method: 'GET' })
    const item = response?.item
    if (!item) return

    try {
      const payload = item.payload && typeof item.payload === 'object' ? item.payload : {}
      const jid = payload.chatJid && String(payload.chatJid).endsWith('@g.us')
        ? String(payload.chatJid)
        : `${String(item.telefone).replace(/\D/g, '')}@s.whatsapp.net`
      let conteudo
      let sendOptions = undefined

      if (item.tipo === 'text') {
        conteudo = { text: String(item.texto || '') }
        if (payload.quotedWhatsappMessageId) {
          const quotedKey = {
            remoteJid: jid,
            id: String(payload.quotedWhatsappMessageId),
            fromMe: payload.quotedFromMe === true,
            ...(payload.quotedParticipantJid ? { participant: String(payload.quotedParticipantJid) } : {}),
          }
          sendOptions = {
            quoted: {
              key: quotedKey,
              message: { conversation: String(payload.quotedText || '') },
            },
          }
        }
      } else if (item.tipo === 'reaction') {
        if (!payload.reactionTargetWhatsappId) throw new Error('Mensagem alvo da reação não identificada.')
        const targetKey = {
          remoteJid: jid,
          id: String(payload.reactionTargetWhatsappId),
          fromMe: payload.reactionTargetFromMe === true,
          ...(payload.reactionTargetParticipantJid ? { participant: String(payload.reactionTargetParticipantJid) } : {}),
        }
        conteudo = {
          react: {
            text: String(item.texto || ''),
            key: targetKey,
          },
        }
      } else if (item.tipo === 'image') {
        if (!payload.mediaUrl) throw new Error('URL da imagem não disponível.')
        conteudo = {
          image: { url: String(payload.mediaUrl) },
          caption: item.texto ? String(item.texto) : undefined,
          mimetype: payload.mimeType ? String(payload.mimeType) : undefined,
        }
      } else if (item.tipo === 'video') {
        if (!payload.mediaUrl) throw new Error('URL do vídeo não disponível.')
        conteudo = {
          video: { url: String(payload.mediaUrl) },
          caption: item.texto ? String(item.texto) : undefined,
          mimetype: payload.mimeType ? String(payload.mimeType) : undefined,
        }
      } else if (item.tipo === 'audio') {
        if (!payload.mediaUrl) throw new Error('URL do áudio não disponível.')
        conteudo = {
          audio: { url: String(payload.mediaUrl) },
          mimetype: payload.mimeType ? String(payload.mimeType) : 'audio/ogg',
          ptt: payload.ptt !== false,
        }
      } else if (item.tipo === 'document') {
        if (!payload.mediaUrl) throw new Error('URL do documento não disponível.')
        conteudo = {
          document: { url: String(payload.mediaUrl) },
          mimetype: payload.mimeType ? String(payload.mimeType) : 'application/octet-stream',
          fileName: payload.fileName ? String(payload.fileName) : 'documento',
          caption: item.texto ? String(item.texto) : undefined,
        }
      } else if (item.tipo === 'block' || item.tipo === 'unblock') {
        await state.sock.updateBlockStatus(jid, item.tipo === 'block' ? 'block' : 'unblock')
        await atlas('', {
          method: 'POST',
          body: JSON.stringify({
            type: 'sent',
            channelId,
            filaId: item.id,
            sucesso: true,
            whatsappMessageId: null,
          }),
        })
        return
      } else {
        throw new Error(`Tipo de saida ainda nao suportado: ${item.tipo}`)
      }

      const sent = await state.sock.sendMessage(jid, conteudo, sendOptions)
      await atlas('', {
        method: 'POST',
        body: JSON.stringify({
          type: 'sent',
          channelId,
          filaId: item.id,
          sucesso: true,
          whatsappMessageId: sent?.key?.id || null,
        }),
      })
    } catch (error) {
      await atlas('', {
        method: 'POST',
        body: JSON.stringify({
          type: 'sent',
          channelId,
          filaId: item.id,
          sucesso: false,
          erro: error instanceof Error ? error.message : String(error),
        }),
      })
    }
  } catch (error) {
    console.error(`[gateway:${channelId}] fila:`, error.message)
  } finally {
    state.sending = false
  }
}

async function disconnectChannel(channelId, markOffline = true) {
  const state = sessions.get(channelId)
  if (!state) return
  state.stopping = true
  if (markOffline) await reportState(channelId, 'offline')
  try { state.sock?.end?.(new Error('Canal encerrado')) } catch {}
  sessions.delete(channelId)
}

async function connectChannel(channel) {
  if (shuttingDown || sessions.has(channel.id)) return

  const sessionDir = path.join(SESSIONS_DIR, channel.session_slug || channel.id)
  fs.mkdirSync(sessionDir, { recursive: true })

  const stateEntry = {
    channel,
    sessionDir,
    sock: null,
    stopping: false,
    sending: false,
    qrOpened: false,
    mismatch: false,
    lidToPn: new Map(),
  }
  sessions.set(channel.id, stateEntry)

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
    const versionInfo = await fetchLatestWaWebVersion().catch(() => null)
    await reportState(channel.id, 'connecting')

    const sock = makeWASocket({
      auth: state,
      browser: Browsers.macOS('Desktop'),
      markOnlineOnConnect: false,
      // O Atlas precisa reconstruir o histórico também após troca/reconexão de computador.
      // O backend deduplica pelo whatsapp_message_id, então reprocessar é seguro.
      syncFullHistory: true,
      shouldSyncHistoryMessage: () => true,
      ...(versionInfo?.version ? { version: versionInfo.version } : {}),
    })
    stateEntry.sock = sock

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        const qrDataUrl = await QRCode.toDataURL(qr, {
          margin: 1,
          width: 360,
          errorCorrectionLevel: 'M',
        })
        qrStates.set(channel.id, {
          id: channel.id,
          nome: channel.nome,
          numero: channel.numero_declarado || null,
          status: 'qr',
          qrDataUrl,
          updatedAt: new Date().toISOString(),
        })
        await reportState(channel.id, 'qr', { qrDataUrl })
        if (!panelBrowserOpened) {
          panelBrowserOpened = true
          execFile('open', [`http://127.0.0.1:${LOCAL_PANEL_PORT}`], () => {})
        }
        console.log(`[gateway] QR atualizado: ${channel.nome} (${channel.numero_declarado || 'a identificar'})`)
      }

      if (connection === 'open') {
        const connectedJid = sock?.user?.id || null
        const result = await reportState(channel.id, 'connected', { connectedJid })
        if (result?.accepted === false) {
          stateEntry.mismatch = true
          console.error(
            `[gateway] NUMERO INCORRETO em ${channel.nome}: esperado ${result.expectedNumber}, conectado ${result.connectedNumber}`,
          )
          try { await sock.logout() } catch {}
          return
        }
        qrStates.set(channel.id, {
          id: channel.id,
          nome: channel.nome,
          numero: result?.connectedNumber || channel.numero_declarado || null,
          status: 'connected',
          qrDataUrl: null,
          updatedAt: new Date().toISOString(),
        })
        console.log(
          `[gateway] conectado: ${channel.nome} -> ${result?.connectedNumber || connectedJid || 'ok'}`,
        )
        agendarSyncGroups(channel, sock, 250)
      }

      if (connection === 'close') {
        const statusCode =
          lastDisconnect?.error?.output?.statusCode ||
          lastDisconnect?.error?.statusCode
        const loggedOut = statusCode === DisconnectReason.loggedOut
        sessions.delete(channel.id)

        if (stateEntry.stopping || shuttingDown) return

        if (loggedOut || stateEntry.mismatch) {
          await reportState(channel.id, stateEntry.mismatch ? 'mismatch' : 'offline')
          fs.rmSync(sessionDir, { recursive: true, force: true })
          console.log(`[gateway] nova leitura de QR necessaria: ${channel.nome}`)
        } else {
          await reportState(channel.id, 'disconnected')
          console.log(`[gateway] reconectando: ${channel.nome}`)
        }

        setTimeout(() => void connectChannel(channel), 3000)
      }
    })

    sock.ev.on('messaging-history.set', async ({ chats, contacts, messages, lidPnMappings, progress, syncType }) => {
      try {
        await syncHistoryBundle(channel, {
          chats: chats || [],
          contacts: contacts || [],
          messages: messages || [],
          lidPnMappings: lidPnMappings || [],
          progress,
          syncType,
        }, stateEntry.lidToPn)
      } catch (error) {
        console.error(`[gateway:${channel.id}] historico:`, error.message)
      }
    })

    sock.ev.on('chats.upsert', async (chats) => {
      try { await syncHistoryChats(channel, chats || [], stateEntry.lidToPn) }
      catch (error) { console.error(`[gateway:${channel.id}] chats:`, error.message) }
    })

    sock.ev.on('chats.update', async (chats) => {
      try { await syncHistoryChats(channel, chats || [], stateEntry.lidToPn) }
      catch (error) { console.error(`[gateway:${channel.id}] chats update:`, error.message) }
    })

    sock.ev.on('contacts.upsert', async (contacts) => {
      try { await syncContacts(channel, contacts || []) }
      catch (error) { console.error(`[gateway:${channel.id}] contatos:`, error.message) }
    })

    sock.ev.on('contacts.update', async (contacts) => {
      try { await syncContacts(channel, contacts || []) }
      catch (error) { console.error(`[gateway:${channel.id}] contatos update:`, error.message) }
    })

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      const lote = messages || []

      if (type !== 'notify') {
        try {
          await syncHistoryMessages(channel, lote, stateEntry.lidToPn)
        } catch (error) {
          console.error(`[gateway:${channel.id}] mensagens de historico:`, error.message)
        }
        return
      }

      for (const msg of lote) {
        try {
          if (msg?.key?.fromMe === true) {
            // Mensagem enviada pelo celular/outro dispositivo também precisa aparecer no Atlas.
            // Pequeno atraso deixa a confirmação da fila do Atlas gravar o mesmo ID primeiro,
            // evitando duplicidade quando a própria mensagem saiu pelo Atlas.
            setTimeout(() => {
              void syncHistoryMessages(channel, [msg], stateEntry.lidToPn)
                .catch((error) => console.error(`[gateway:${channel.id}] saida do dispositivo:`, error.message))
            }, 800)
          } else {
            await registerInbound(channel, msg, sock)
          }
        } catch (error) {
          console.error(`[gateway:${channel.id}] entrada:`, error.message)
        }
      }
    })

    sock.ev.on('groups.upsert', () => { agendarSyncGroups(channel, sock) })
    sock.ev.on('groups.update', () => { agendarSyncGroups(channel, sock) })
  } catch (error) {
    sessions.delete(channel.id)
    console.error(`[gateway] falha ao iniciar ${channel.nome}:`, error.message)
    await reportState(channel.id, 'offline')
    if (!shuttingDown) setTimeout(() => void connectChannel(channel), 5000)
  }
}

async function refreshChannels() {
  if (shuttingDown) return
  try {
    const channels = await listChannels()
    const activeIds = new Set(channels.map((c) => c.id))

    for (const [id] of sessions) {
      if (!activeIds.has(id)) await disconnectChannel(id, false)
    }

    for (const channel of channels) {
      if (!sessions.has(channel.id)) void connectChannel(channel)
    }
  } catch (error) {
    console.error('[gateway] canais:', error.message)
  }
}

async function processAllQueues() {
  if (shuttingDown) return
  for (const [channelId, state] of sessions) {
    if (state.sock?.user) void processQueue(channelId)
  }
}

async function processPushQueue() {
  if (shuttingDown || pushSending || !PUSH_READY) return
  pushSending = true
  try {
    const response = await atlas('mode=push-pending', { method: 'GET' })
    const item = response?.item
    if (!item || item.skipped || !item.notificacao) return

    const notificacao = item.notificacao
    const payload = JSON.stringify({
      id: notificacao.id,
      title: String(notificacao.titulo || 'Atlas One'),
      body: String(notificacao.mensagem || '').slice(0, 800),
      href: String(notificacao.href || '/'),
      tag: `atlas-${notificacao.id}`,
      categoria: String(notificacao.categoria || 'operacao'),
      silent: notificacao.silent === true,
      forceShow: notificacao.tipo === 'push_teste',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    })

    const resultados = []
    for (const assinatura of item.assinaturas || []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: assinatura.endpoint,
            keys: { p256dh: assinatura.p256dh, auth: assinatura.auth },
          },
          payload,
          { TTL: 60 * 60, urgency: 'high' },
        )
        resultados.push({ assinaturaId: assinatura.id, sucesso: true })
      } catch (error) {
        resultados.push({
          assinaturaId: assinatura.id,
          sucesso: false,
          statusCode: Number(error?.statusCode || error?.status || 0) || null,
          erro: error instanceof Error ? error.message : String(error),
        })
      }
    }

    await atlas('', {
      method: 'POST',
      body: JSON.stringify({
        type: 'push_sent',
        notificationId: notificacao.id,
        resultados,
      }),
    })
  } catch (error) {
    console.error('[gateway] push:', error instanceof Error ? error.message : String(error))
  } finally {
    pushSending = false
  }
}

async function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[gateway] encerrando por ${signal}...`)
  if (refreshTimer) clearInterval(refreshTimer)
  if (queueTimer) clearInterval(queueTimer)
  if (pushTimer) clearInterval(pushTimer)

  const ids = [...sessions.keys()]
  for (const id of ids) await disconnectChannel(id, true)
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))

console.log('[gateway] iniciando gerenciador multicanal Atlas One...')
console.log(PUSH_READY ? '[gateway] Web Push ativo.' : '[gateway] Web Push desativado: chaves VAPID ausentes.')
await refreshChannels()
refreshTimer = setInterval(() => void refreshChannels(), 5000)
queueTimer = setInterval(() => void processAllQueues(), 1200)
pushTimer = setInterval(() => void processPushQueue(), 1500)