import { supabase } from './supabase'
import { Usuario } from './tipos'

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
  await supabase.auth.signOut()
}

export async function usuarioAtual(): Promise<Usuario | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const { data } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle()
  return (data as Usuario) || null
}

export async function tokenAtual(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}
