import { supabase } from './supabase'
import { tokenAtual } from './auth'
import type { Notificacao, NotificacaoPreferencias } from './tipos'

export const PREFERENCIAS_PADRAO: NotificacaoPreferencias = {
  usuario_id: '',
  som_ativo: true,
  som_volume: 0.6,
  tarefas: true,
  agenda: true,
  chat: true,
  operacao: true,
  push_ativo: true,
  nao_perturbe_ativo: false,
  nao_perturbe_inicio: '22:00:00',
  nao_perturbe_fim: '07:00:00',
  timezone: 'America/Sao_Paulo',
}

export async function listarNotificacoes(usuarioId: string, limite = 30): Promise<Notificacao[]> {
  const { data, error } = await supabase
    .from('notificacoes')
    .select('*')
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false })
    .limit(limite)
  if (error || !data) return []
  return data as Notificacao[]
}

export async function marcarNotificacaoLida(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('notificacoes')
    .update({ lida_em: new Date().toISOString() })
    .eq('id', id)
  return !error
}

export async function marcarTodasNotificacoesLidas(usuarioId: string): Promise<boolean> {
  const { error } = await supabase
    .from('notificacoes')
    .update({ lida_em: new Date().toISOString() })
    .eq('usuario_id', usuarioId)
    .is('lida_em', null)
  return !error
}

export async function carregarPreferenciasNotificacao(usuarioId: string): Promise<NotificacaoPreferencias> {
  const { data, error } = await supabase
    .from('notificacao_preferencias')
    .select('*')
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  if (error || !data) return { ...PREFERENCIAS_PADRAO, usuario_id: usuarioId }
  return data as NotificacaoPreferencias
}

export async function salvarPreferenciasNotificacao(
  usuarioId: string,
  patch: Partial<Omit<NotificacaoPreferencias, 'usuario_id'>>,
): Promise<NotificacaoPreferencias | null> {
  const atual = await carregarPreferenciasNotificacao(usuarioId)
  const payload = {
    ...atual,
    ...patch,
    usuario_id: usuarioId,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('notificacao_preferencias')
    .upsert(payload, { onConflict: 'usuario_id' })
    .select('*')
    .single()
  if (error || !data) return null
  return data as NotificacaoPreferencias
}

export function assinarNovasNotificacoes(
  usuarioId: string,
  callback: (notificacao: Notificacao) => void,
  comRecuperacao = false,
) {
  const inicio = new Date().toISOString()
  const recebidas = new Set<string>()
  let ativo = true
  let consultando = false
  function entregar(n: Notificacao) {
    if (!ativo || n.usuario_id !== usuarioId || recebidas.has(n.id)) return
    recebidas.add(n.id)
    callback(n)
  }
  async function recuperar() {
    if (!ativo || consultando || document.visibilityState !== 'visible') return
    consultando = true
    try {
      const { data } = await supabase.from('notificacoes').select('*')
        .eq('usuario_id', usuarioId).gte('created_at', inicio)
        .in('categoria', ['tarefas', 'agenda', 'chat'])
        .order('created_at', { ascending: false }).limit(100)
      if (data) for (const n of [...data].reverse()) entregar(n as Notificacao)
    } catch { /* Realtime e próxima consulta continuam disponíveis. */ }
    finally { consultando = false }
  }
  const canal = supabase
    .channel(`notificacoes-${usuarioId}-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notificacoes', filter: `usuario_id=eq.${usuarioId}` },
      payload => entregar(payload.new as Notificacao),
    )
    .subscribe()
  const intervalo = comRecuperacao ? window.setInterval(() => void recuperar(), 15000) : null
  const aoFocar = () => { void recuperar() }
  const aoPush = (event: MessageEvent) => {
    if (event.data?.type === 'ATLAS_PUSH_RECEBIDO') void recuperar()
  }
  if (comRecuperacao) {
    window.addEventListener('focus', aoFocar)
    document.addEventListener('visibilitychange', aoFocar)
    navigator.serviceWorker?.addEventListener('message', aoPush)
  }
  return () => {
    ativo = false
    if (intervalo !== null) window.clearInterval(intervalo)
    if (comRecuperacao) {
      window.removeEventListener('focus', aoFocar)
      document.removeEventListener('visibilitychange', aoFocar)
      navigator.serviceWorker?.removeEventListener('message', aoPush)
    }
    void supabase.removeChannel(canal)
  }
}

// O navegador exige uma interação para liberar o áudio, inclusive no iPhone.
let contextoNotificacao: AudioContext | null = null
function obterContextoNotificacao() {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  if (!contextoNotificacao || contextoNotificacao.state === 'closed') contextoNotificacao = new Ctx()
  return contextoNotificacao
}
export function prepararSomNotificacao() {
  const liberar = () => {
    try {
      const ctx = obterContextoNotificacao()
      if (ctx?.state === 'suspended') void ctx.resume().catch(() => {})
    } catch {}
  }
  window.addEventListener('pointerdown', liberar)
  window.addEventListener('keydown', liberar)
  return () => {
    window.removeEventListener('pointerdown', liberar)
    window.removeEventListener('keydown', liberar)
  }
}
export function tocarSomNotificacao(volume = 0.6) {
  try {
    if (volume <= 0) return
    const ctx = obterContextoNotificacao()
    if (!ctx) return
    const tocar = () => {
      if (ctx.state !== 'running') return
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      gain.gain.setValueAtTime(Math.max(0.02, Math.min(0.2, volume * 0.18)), ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.22)
      osc.onended = () => { osc.disconnect(); gain.disconnect() }
    }
    if (ctx.state === 'running') tocar()
    else if (navigator.userActivation?.isActive) void ctx.resume().then(tocar).catch(() => {})
  } catch {}
}
export function emHorarioSilencioso(prefs: NotificacaoPreferencias) {
  if (!prefs.nao_perturbe_ativo) return false
  try {
    const horario = new Intl.DateTimeFormat('en-GB', {
      timeZone: prefs.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(new Date())
    const inicio = prefs.nao_perturbe_inicio.slice(0, 5)
    const fim = prefs.nao_perturbe_fim.slice(0, 5)
    return inicio <= fim ? horario >= inicio && horario < fim : horario >= inicio || horario < fim
  } catch { return true }
}

export type StatusPushDispositivo = {
  suportado: boolean
  permissao: NotificationPermission | 'indisponivel'
  inscrito: boolean
  dispositivosAtivos: number
}

function base64UrlParaUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

async function headersPush() {
  const token = await tokenAtual()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token || ''}`,
  }
}

export function precisaInstalarAtlasNoIOS() {
  if (typeof window === 'undefined') return false
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const instalado = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  return ios && !instalado
}

function nomeDispositivoAtual() {
  if (typeof navigator === 'undefined') return 'Dispositivo'
  const ua = navigator.userAgent
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iPad'
  if (/Android/i.test(ua)) return 'Android'
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac'
  if (/Windows/i.test(ua)) return 'Windows'
  return 'Navegador'
}

export async function statusPushNesteDispositivo(): Promise<StatusPushDispositivo> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { suportado: false, permissao: 'indisponivel', inscrito: false, dispositivosAtivos: 0 }
  }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  let dispositivosAtivos = 0
  let inscrito = false
  try {
    const resp = await fetch('/api/notificacoes/push', { method: 'POST', headers: await headersPush(),
      body: JSON.stringify({ acao: 'status', endpoint: subscription?.endpoint || '' }) })
    const json = await resp.json()
    if (!resp.ok) throw new Error('Não foi possível verificar o cadastro do dispositivo.')
    dispositivosAtivos = Number(json.dispositivosAtivos || 0)
    inscrito = Boolean(subscription && json.inscrito)
  } catch { /* Não afirmar que este dispositivo está inscrito sem confirmação do servidor. */ }

  return {
    suportado: true,
    permissao: Notification.permission,
    inscrito: Notification.permission === 'granted' && inscrito,
    dispositivosAtivos,
  }
}

export async function ativarPushNesteDispositivo() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { ok: false, error: 'Este navegador nao oferece notificacoes push.' }
  }

  const permissao = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission()
  if (permissao !== 'granted') {
    return {
      ok: false,
      error: permissao === 'denied'
        ? 'As notificacoes foram bloqueadas nas permissoes do navegador.'
        : 'Permissao de notificacao nao concedida.',
    }
  }

  const headers = await headersPush()
  const infoResp = await fetch('/api/notificacoes/push', { headers })
  const info = await infoResp.json()
  if (!infoResp.ok || !info.publicKey) {
    return { ok: false, error: info.error || 'Nao foi possivel obter a chave de notificacao.' }
  }

  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlParaUint8Array(String(info.publicKey)),
    })
  }

  const resp = await fetch('/api/notificacoes/push', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      acao: 'assinar',
      assinatura: subscription.toJSON(),
      dispositivoNome: nomeDispositivoAtual(),
    }),
  })
  const json = await resp.json()
  if (!resp.ok) return { ok: false, error: json.error || 'Nao foi possivel ativar as notificacoes.' }

  return { ok: true }
}

export async function desativarPushNesteDispositivo() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { ok: false, error: 'Este navegador nao oferece notificacoes push.' }
  }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return { ok: true }

  const resp = await fetch('/api/notificacoes/push', {
    method: 'POST',
    headers: await headersPush(),
    body: JSON.stringify({ acao: 'remover', endpoint: subscription.endpoint }),
  })
  const json = await resp.json()
  if (!resp.ok) return { ok: false, error: json.error || 'Nao foi possivel desativar as notificacoes.' }

  await subscription.unsubscribe().catch(() => false)
  return { ok: true }
}

