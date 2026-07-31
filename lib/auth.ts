import { supabase } from './supabase'
import { Usuario } from './tipos'

export async function login(email: string, senha: string) {
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
