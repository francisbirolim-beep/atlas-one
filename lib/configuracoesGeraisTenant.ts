import { supabase } from './supabase'

async function empresaAtualId(): Promise<string | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) return null

  const { data: perfil, error: perfilError } = await supabase
    .from('usuarios')
    .select('empresa_id')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (perfilError || !perfil?.empresa_id) return null
  return String(perfil.empresa_id)
}

export async function salvarConfiguracaoGeralTenant(chave: string, valor: string): Promise<boolean> {
  const empresaId = await empresaAtualId()
  if (!empresaId) return false

  const { error } = await supabase
    .from('configuracoes_gerais')
    .upsert({
      empresa_id: empresaId,
      chave,
      valor,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'empresa_id,chave' })

  if (error) console.error('Erro ao salvar configuração geral tenant-aware:', error)
  return !error
}
