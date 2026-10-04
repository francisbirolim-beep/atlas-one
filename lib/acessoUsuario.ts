import { supabase } from './supabase'
import type { Usuario } from './tipos'

export type EscopoCRM = 'proprios' | 'todos'

export interface AcessoUsuarioConfig {
  crmEscopo: EscopoCRM
}

function chave(usuarioId: string) {
  return `acesso_usuario:${usuarioId}`
}

export function acessoUsuarioPadrao(role: Usuario['role'] = 'funcionario'): AcessoUsuarioConfig {
  return {
    crmEscopo: role === 'master' ? 'todos' : 'proprios',
  }
}

function normalizarConfig(valor: unknown, role: Usuario['role']): AcessoUsuarioConfig {
  if (role === 'master') return acessoUsuarioPadrao(role)
  if (!valor || typeof valor !== 'object') return acessoUsuarioPadrao(role)
  const bruto = valor as Partial<AcessoUsuarioConfig>
  return {
    crmEscopo: bruto.crmEscopo === 'todos' ? 'todos' : 'proprios',
  }
}

export async function lerAcessoUsuarioConfig(usuario: Pick<Usuario, 'id' | 'role'>): Promise<AcessoUsuarioConfig> {
  try {
    const { data, error } = await supabase
      .from('configuracoes_gerais')
      .select('valor')
      .eq('chave', chave(usuario.id))
      .maybeSingle()
    if (error || !data?.valor) return acessoUsuarioPadrao(usuario.role)
    const parsed = typeof data.valor === 'string' ? JSON.parse(data.valor) : data.valor
    return normalizarConfig(parsed, usuario.role)
  } catch {
    return acessoUsuarioPadrao(usuario.role)
  }
}

export async function salvarAcessoUsuarioConfig(usuarioId: string, config: AcessoUsuarioConfig): Promise<boolean> {
  const normalizada: AcessoUsuarioConfig = {
    crmEscopo: config.crmEscopo === 'todos' ? 'todos' : 'proprios',
  }
  const { error } = await supabase
    .from('configuracoes_gerais')
    .upsert({
      chave: chave(usuarioId),
      valor: JSON.stringify(normalizada),
      updated_at: new Date().toISOString(),
    })
  if (error) console.error('Erro ao salvar escopos de acesso:', error)
  return !error
}