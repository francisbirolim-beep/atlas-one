import { supabase } from './supabase'
import { Usuario } from './tipos'

export async function login(identificador: string, senha: string) {
  const valor = identificador.trim()
  let email = valor.toLowerCase()

  if (!valor.includes('@')) {
    const resp = await fetch('/api/resolver-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador: valor }),
    })
    const json = await resp.json()
    if (!resp.ok || !json.email) {
      return {
        data: { user: null, session: null },
        error: { message: json.error || 'Usuário ou senha incorretos', name: 'AuthApiError', status: resp.status } as any,
      } as any
    }
    email = json.email
  }

  return supabase.auth.signInWithPassword({ email, password: senha })
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
