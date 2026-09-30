import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import QRCode from 'qrcode'
import makeWASocket, {
  Browsers,
  DisconnectReason,
  extractMessageContent,
  fetchLatestWaWebVersion,
  getContentType,
  jidNormalizedUser,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys'

const ENV_PATH = process.env.ATLAS_GATEWAY_ENV || path.join(process.env.HOME || '.', '.atlas-one', 'whatsapp-gateway.env')

function carregarEnv(arquivo) {
  if (!fs.existsSync(arquivo)) return
  for (const linha of fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const t = linha.trim()
    if (!t || t.startsWith('#')) continue
    const pos = t.indexOf('=')
    if (pos <= 0) continue
    const chave = t.slice(0, pos).trim()
    const valor = t.slice(pos + 1).trim()
    if (!process.env[chave]) process.env[chave] = valor
  }
}

carregarEnv(ENV_PATH)

const BASE_URL = String(process.env.ATLAS_BASE_URL || '').replace(/\/$/, '')
const TOKEN = String(process.env.ATLAS_GATEWAY_TOKEN || '')
const SESSION_DIR = process.env.ATLAS_WHATSAPP_SESSION_DIR || path.join(process.env.HOME || '.', '.atlas-one', 'whatsapp-session')
const DEVICE_NAME = 'Atlas One Mac Gateway'

if (!BASE_URL || !TOKEN) {
  console.error('Faltam ATLAS_BASE_URL ou ATLAS_GATEWAY_TOKEN em', ENV_PATH)
  process.exit(1)
}

fs.mkdirSync(SESSION_DIR, { recursive: true })

let sock = null
let polling = null
let encerrando = false

async function atlas(pathname = '', options = {}) {
  const resp = await fetch(`${BASE_URL}/api/integracoes/whatsapp/gateway${pathname}`, {
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

async function informarEstado(status, extra = {}) {
  try {
    await atlas('', {
      method: 'POST',
      body: JSON.stringify({
        type: 'state',
        status,
        deviceName: DEVICE_NAME,
        ...extra,
      }),
    })
  } catch (error) {
    console.error('[gateway] falha ao atualizar estado:', error.message)
  }
}

function telefoneDoJid(key) {
  const candidatos = [key?.remoteJidAlt, key?.remoteJid]
    .filter(Boolean)
    .map(jidNormalizedUser)

  const jid = candidatos.find(v => v.endsWith('@s.whatsapp.net'))
  if (!jid) return null
  return jid.split('@')[0].replace(/\D/g, '')
}

function extrairMensagem(message) {
  const conteudo = extractMessageContent(message)
  const tipo = getContentType(conteudo || {}) || 'unknown'

  if (tipo === 'conversation') {
    return { messageType: 'text', texto: conteudo?.conversation || '' }
  }
  if (tipo === 'extendedTextMessage') {
    return { messageType: 'text', texto: conteudo?.extendedTextMessage?.text || '' }
  }
  if (tipo === 'imageMessage') {
    return { messageType: 'image', texto: conteudo?.imageMessage?.caption || '📷 Imagem' }
  }
  if (tipo === 'videoMessage') {
    return { messageType: 'video', texto: conteudo?.videoMessage?.caption || '🎥 Vídeo' }
  }
  if (tipo === 'audioMessage') {
    return { messageType: 'audio', texto: '🎤 Áudio' }
  }
  if (tipo === 'documentMessage') {
    return { messageType: 'document', texto: conteudo?.documentMessage?.fileName || '📎 Documento' }
  }
  if (tipo === 'stickerMessage') {
    return { messageType: 'sticker', texto: '🖼️ Figurinha' }
  }
  if (tipo === 'locationMessage') {
    return { messageType: 'location', texto: '📍 Localização' }
  }
  if (tipo === 'contactMessage' || tipo === 'contactsArrayMessage') {
    return { messageType: 'contact', texto: '👤 Contato' }
  }

  return { messageType: tipo, texto: `[${tipo}]` }
}

async function registrarEntrada(msg) {
  if (!msg?.message || msg?.key?.fromMe) return
  const telefone = telefoneDoJid(msg.key)
  if (!telefone) return

  const extraido = extrairMensagem(msg.message)
  const ts = Number(msg.messageTimestamp || 0)
  const timestamp = ts > 0 ? new Date(ts * 1000).toISOString() : new Date().toISOString()

  await atlas('', {
    method: 'POST',
    body: JSON.stringify({
      type: 'inbound',
      telefone,
      contatoNome: msg.pushName || null,
      whatsappMessageId: msg.key?.id || null,
      messageType: extraido.messageType,
      texto: extraido.texto,
      timestamp,
      payload: {
        remoteJid: msg.key?.remoteJid || null,
        remoteJidAlt: msg.key?.remoteJidAlt || null,
      },
    }),
  })
}

async function processarFila() {
  if (!sock?.user) return
  try {
    const resposta = await atlas('', { method: 'GET' })
    const item = resposta?.item
    if (!item) return

    let result
    try {
      if (item.tipo !== 'text') throw new Error(`Tipo de saida ainda nao suportado: ${item.tipo}`)
      const jid = `${String(item.telefone).replace(/\D/g, '')}@s.whatsapp.net`
      result = await sock.sendMessage(jid, { text: String(item.texto || '') })
      await atlas('', {
        method: 'POST',
        body: JSON.stringify({
          type: 'sent',
          filaId: item.id,
          sucesso: true,
          whatsappMessageId: result?.key?.id || null,
        }),
      })
    } catch (error) {
      await atlas('', {
        method: 'POST',
        body: JSON.stringify({
          type: 'sent',
          filaId: item.id,
          sucesso: false,
          erro: error instanceof Error ? error.message : String(error),
        }),
      })
    }
  } catch (error) {
    console.error('[gateway] fila:', error.message)
  }
}

async function iniciarPolling() {
  if (polling) clearInterval(polling)
  polling = setInterval(() => void processarFila(), 1200)
}

async function conectar() {
  if (encerrando) return

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
  const versao = await fetchLatestWaWebVersion().catch(() => null)

  await informarEstado('connecting')

  sock = makeWASocket({
    auth: state,
    browser: Browsers.macOS('Atlas One'),
    printQRInTerminal: true,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    ...(versao?.version ? { version: versao.version } : {}),
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async update => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      const qrDataUrl = await QRCode.toDataURL(qr, {
        margin: 1,
        width: 360,
        errorCorrectionLevel: 'M',
      })
      await informarEstado('qr', { qrDataUrl })
      console.log('[gateway] QR Code disponível no Atlas.')
    }

    if (connection === 'open') {
      const connectedJid = sock?.user?.id || null
      await informarEstado('connected', { connectedJid })
      console.log('[gateway] WhatsApp conectado:', connectedJid || 'dispositivo vinculado')
      await iniciarPolling()
    }

    if (connection === 'close') {
      if (polling) {
        clearInterval(polling)
        polling = null
      }

      const statusCode = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.statusCode
      const saiu = statusCode === DisconnectReason.loggedOut
      await informarEstado(saiu ? 'offline' : 'disconnected')

      if (saiu) {
        console.error('[gateway] Sessão encerrada no WhatsApp. Será necessário ler um novo QR Code.')
        return
      }

      console.log('[gateway] Conexão caiu. Reconectando...')
      setTimeout(() => void conectar(), 3000)
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages || []) {
      try {
        await registrarEntrada(msg)
      } catch (error) {
        console.error('[gateway] mensagem recebida:', error.message)
      }
    }
  })
}

async function desligar(signal) {
  if (encerrando) return
  encerrando = true
  console.log(`[gateway] encerrando por ${signal}...`)
  if (polling) clearInterval(polling)
  await informarEstado('offline')
  try { sock?.end?.(new Error('Gateway encerrado')) } catch {}
  process.exit(0)
}

process.on('SIGINT', () => void desligar('SIGINT'))
process.on('SIGTERM', () => void desligar('SIGTERM'))

console.log('[gateway] iniciando Atlas One WhatsApp QR...')
void conectar()