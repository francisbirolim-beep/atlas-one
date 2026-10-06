import { supabase } from './supabase'
import { Usuario } from './tipos'

const CHAVE_USUARIO_OFFLINE = 'atlas_usuario_offline_v1'

async function resolverEmail(identificador: string): Promise<{ email: string | null; error: string | null }> {
  const valor = identificador.trim()
  if (!valor) return { email: null, error: 'Informe usuário ou e-mail' }

  if (valor.includes('@')) {
    return { email: valor.toLowerCase(), error: null }
  }

  try {
    const resp = await fetch('/api/resolver-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador: valor }),
    })
    const json = await resp.json()
    if (!resp.ok || !json.email) {
      return { email: null, error: json.error || 'Usuário não encontrado' }
    }
    return { email: String(json.email).toLowerCase(), error: null }
  } catch {
    return { email: null, error: 'Não foi possível localizar o usuário' }
  }
}

export async function login(identificador: string, senha: string) {
  if (typeof window !== 'undefined') {
    try { window.localStorage.removeItem(CHAVE_USUARIO_OFFLINE) } catch {}
  }
  const resolvido = await resolverEmail(identificador)
  if (!resolvido.email) {
    return {
      data: { user: null, session: null },
      error: { message: resolvido.error || 'Usuário ou senha incorretos', name: 'AuthApiError', status: 400 } as any,
    } as any
  }

  return supabase.auth.signInWithPassword({ email: resolvido.email, password: senha })
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

export async function sessaoAtualValida() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const expiraEmMs = Number(session?.expires_at || 0) * 1000
    const aindaValida = Boolean(session?.access_token && (!expiraEmMs || expiraEmMs - Date.now() > 60_000))
    if (session && aindaValida) return session

    // Se existe refresh token, renova antes de qualquer chamada protegida.
    if (session?.refresh_token) {
      const { data, error } = await supabase.auth.refreshSession({ refresh_token: session.refresh_token })
      if (!error && data.session?.access_token) return data.session
    }

    // refreshSession sem argumento também recupera a sessão persistida quando disponível.
    const { data, error } = await supabase.auth.refreshSession()
    if (!error && data.session?.access_token) return data.session
    return null
  } catch {
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
