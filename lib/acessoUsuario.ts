import { supabase } from './supabase'
import type { NivelPermissao, Usuario } from './tipos'

export type EscopoCRM = 'proprios' | 'todos'

export interface AcessoUsuarioConfig {
  crmEscopo: EscopoCRM
  acoes: Record<string, NivelPermissao>
}

function chave(usuarioId: string) {
  return `acesso_usuario:${usuarioId}`
}

export function acessoUsuarioPadrao(role: Usuario['role'] = 'funcionario'): AcessoUsuarioConfig {
  return {
    crmEscopo: role === 'master' ? 'todos' : 'proprios',
    acoes: {},
  }
}

function nivelValido(valor: unknown): valor is NivelPermissao {
  return valor === 'oculto' || valor === 'consulta' || valor === 'edicao'
}

function normalizarConfig(valor: unknown, role: Usuario['role']): AcessoUsuarioConfig {
  if (role === 'master') return acessoUsuarioPadrao(role)
  if (!valor || typeof valor !== 'object') return acessoUsuarioPadrao(role)
  const bruto = valor as Partial<AcessoUsuarioConfig>
  const acoes: Record<string, NivelPermissao> = {}
  if (bruto.acoes && typeof bruto.acoes === 'object') {
    Object.entries(bruto.acoes).forEach(([id, nivel]) => {
      if (nivelValido(nivel)) acoes[id] = nivel
    })
  }
  return {
    crmEscopo: bruto.crmEscopo === 'todos' ? 'todos' : 'proprios',
    acoes,
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
    acoes: Object.fromEntries(Object.entries(config.acoes || {}).filter(([, nivel]) => nivelValido(nivel))),
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

export function nivelAcaoConfig(config: AcessoUsuarioConfig, acaoId: string, fallback: NivelPermissao = 'oculto'): NivelPermissao {
  return config.acoes?.[acaoId] || fallback
}