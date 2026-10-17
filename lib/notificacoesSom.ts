import type { NotificacaoPreferencias } from './tipos'

/**
 * Web apps não têm API confiável para consultar a chave de silencioso,
 * o volume físico ou o Foco/Não Perturbe do iPhone e do Android.
 *
 * Política: em CELULARES, nunca reproduzir áudio por AudioContext/HTMLAudio
 * para alertas. O Web Push utiliza o canal de notificação do sistema
 * operacional (que decide som, silencioso e Foco). No computador mantém
 * o som opcional já existente, respeitando o Não Perturbe do Atlas.
 */
export function ehCelularParaNotificacoes(opts: {
  userAgent?: string
  platform?: string
  maxTouchPoints?: number
  mobileHint?: boolean
}): boolean {
  if (opts.mobileHint === true) return true
  const ua = String(opts.userAgent || '')
  if (/(iphone|ipod|ipad|android|mobile|windows phone)/i.test(ua)) return true
  // iPadOS pode reportar o perfil "MacIntel" no Safari.
  return opts.platform === 'MacIntel' && Number(opts.maxTouchPoints || 0) > 1
}

function horarioSilencio(
  prefs: Pick<NotificacaoPreferencias,
    'nao_perturbe_ativo' | 'nao_perturbe_inicio' | 'nao_perturbe_fim' | 'timezone'>,
  instante: Date,
): boolean {
  if (!prefs.nao_perturbe_ativo) return false
  let horario = ''
  try {
    horario = new Intl.DateTimeFormat('en-GB', {
      timeZone: prefs.timezone || 'America/Sao_Paulo',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(instante)
  } catch {
    // Falha fechada: não emitir som com timezone inválido.
    return true
  }
  const inicio = String(prefs.nao_perturbe_inicio || '').slice(0, 5)
  const fim = String(prefs.nao_perturbe_fim || '').slice(0, 5)
  if (!/^\d{2}:\d{2}$/.test(inicio) || !/^\d{2}:\d{2}$/.test(fim)) return true
  if (inicio === fim) return false
  return inicio < fim
    ? horario >= inicio && horario < fim
    : horario >= inicio || horario < fim
}

export function podeTocarAlertaNoNavegador(
  prefs: Pick<NotificacaoPreferencias,
    'som_ativo' | 'nao_perturbe_ativo' | 'nao_perturbe_inicio' | 'nao_perturbe_fim' | 'timezone'>,
  dispositivo: Parameters<typeof ehCelularParaNotificacoes>[0],
  instante: Date,
): boolean {
  if (!prefs.som_ativo) return false
  if (ehCelularParaNotificacoes(dispositivo)) return false
  if (horarioSilencio(prefs, instante)) return false
  return true
}
