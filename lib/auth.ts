import { supabase } from './supabase'
import { Usuario } from './tipos'

const CHAVE_USUARIO_OFFLINE = 'atlas_usuario_offline_v1'

async function resolverEmail(identificador: string): Promise<{ email: string | null; error: string | null; status: number }> {
  const valor = identificador.trim()
  if (!valor) return { email: null, error: 'Informe usuário ou e-mail', status: 400 }

  if (valor.includes('@')) {
    return { email: valor.toLowerCase(), error: null, status: 200 }
  }

  try {
    const resp = await fetch('/api/resolver-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador: valor }),
    })
    const json = await resp.json().catch(() => ({}))
    if (!resp.ok || !json.email) {
      if (resp.status >= 500) {
        return {
          email: null,
          error: 'O Atlas está temporariamente sem conexão com o servidor. Tente novamente em instantes.',
          status: resp.status,
        }
      }
      return { email: null, error: json.error || 'Usuário não encontrado', status: resp.status || 400 }
    }
    return { email: String(json.email).toLowerCase(), error: null, status: 200 }
  } catch {
    return {
      email: null,
      error: 'O Atlas está temporariamente sem conexão com o servidor. Tente novamente em instantes.',
      status: 503,
    }
  }
}


export function prepararLoginLimpo() {
  if (typeof window === 'undefined') return
  try { supabase.auth.stopAutoRefresh() } catch {}
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const chave = window.localStorage.key(i)
      if (chave?.startsWith('sb-') && chave.endsWith('-auth-token')) {
        window.localStorage.removeItem(chave)
      }
    }
  } catch {}
}

export async function login(identificador: string, senha: string) {
  prepararLoginLimpo()
  const resolvido = await resolverEmail(identificador)
  if (!resolvido.email) {
    return {
      data: { user: null, session: null },
      error: {
        message: resolvido.error || 'Usuário ou senha incorretos',
        name: resolvido.status >= 500 ? 'AuthRetryableFetchError' : 'AuthApiError',
        status: resolvido.status,
      } as any,
    } as any
  }

  const resultado = await supabase.auth.signInWithPassword({ email: resolvido.email, password: senha })
  if (!resultado.error && resultado.data.session) {
    try { supabase.auth.startAutoRefresh() } catch {}
  }
  return resultado
}

export async function solicitarRedefinicaoSenha(identificador: string) {
  const resolvido = await resolverEmail(identificador)
  if (!resolvido.email) {
    return { error: { message: resolvido.error || 'Não foi possível localizar o usuário' } }
  }

  const redirectTo = typeof window !== 'undefined'
    ? `${window.location.origin}/redefinir-senha`
    : undefined

  const { error } = await supabase.auth.resetPasswordForEmail(
    resolvido.email,
    redirectTo ? { redirectTo } : undefined,
  )

  return { error }
}

export async function redefinirMinhaSenha(novaSenha: string) {
  return supabase.auth.updateUser({ password: novaSenha })
}

export async function logout() {
  if (typeof window !== 'undefined') {
    try { window.localStorage.removeItem(CHAVE_USUARIO_OFFLINE) } catch {}
  }
  await supabase.auth.signOut()
}



export function usuarioCacheLocal(): Usuario | null {
  if (typeof window === 'undefined') return null
  try {
    const bruto = window.localStorage.getItem(CHAVE_USUARIO_OFFLINE)
    return bruto ? JSON.parse(bruto) as Usuario : null
  } catch {
    return null
  }
}

function salvarUsuarioOffline(usuario: Usuario) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(CHAVE_USUARIO_OFFLINE, JSON.stringify(usuario)) } catch {}
}

function erroAuthTransitorio(error: any) {
  const status = Number(error?.status || 0)
  const nome = String(error?.name || '').toLowerCase()
  const mensagem = String(error?.message || '').toLowerCase()
  return status >= 500
    || status === 0
    || nome.includes('retryable')
    || nome.includes('fetch')
    || mensagem.includes('failed to fetch')
    || mensagem.includes('network')
    || mensagem.includes('timeout')
}

function tokenAindaPodeSerUsado(session: any) {
  if (!session?.access_token) return false
  const expiraEmMs = Number(session?.expires_at || 0) * 1000
  return !expiraEmMs || expiraEmMs > Date.now()
}

export async function sessaoAtualValida() {
  let sessionLocal: any = null
  try {
    const { data: { session } } = await supabase.auth.getSession()
    sessionLocal = session
    const expiraEmMs = Number(session?.expires_at || 0) * 1000
    const aindaValida = Boolean(session?.access_token && (!expiraEmMs || expiraEmMs - Date.now() > 60_000))
    if (session && aindaValida) return session

    // Se existe refresh token, renova antes de qualquer chamada protegida.
    if (session?.refresh_token) {
      const { data, error } = await supabase.auth.refreshSession({ refresh_token: session.refresh_token })
      if (!error && data.session?.access_token) return data.session
      if (erroAuthTransitorio(error) && session.access_token) {
        if (tokenAindaPodeSerUsado(session)) return session
      }
    }

    // refreshSession sem argumento também recupera a sessão persistida quando disponível.
    const { data, error } = await supabase.auth.refreshSession()
    if (!error && data.session?.access_token) return data.session
    if (erroAuthTransitorio(error) && sessionLocal?.access_token) {
      if (tokenAindaPodeSerUsado(sessionLocal)) return sessionLocal
    }
    return null
  } catch {
    // Em falha transitória de rede, não força logout imediato de uma sessão
    // que já existia localmente, desde que o JWT ainda seja aceito pelo backend.
    if (tokenAindaPodeSerUsado(sessionLocal)) return sessionLocal
    return null
  }
}

export async function usuarioAtual(): Promise<Usuario | null> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return usuarioCacheLocal()

  try {
    const session = await sessaoAtualValida()
    if (!session) return null
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()
    if (data) {
      salvarUsuarioOffline(data as Usuario)
      return data as Usuario
    }
    const cache = usuarioCacheLocal()
    return cache?.id === session.user.id ? cache : null
  } catch {
    return null
  }
}

export async function tokenAtual(): Promise<string | null> {
  const session = await sessaoAtualValida()
  return session?.access_token || null
}
