import { supabase } from './supabase'
import { normalizarMatrizCliente360, type MatrizCliente360 } from './cliente360Permissoes'
import type { NivelPermissao, Usuario } from './tipos'

export type EscopoCRM = 'proprios' | 'todos'

export interface AcessoUsuarioConfig {
  cliente360?: MatrizCliente360
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
    cliente360: normalizarMatrizCliente360(bruto.cliente360),
    crmEscopo: bruto.crmEscopo === 'todos' ? 'todos' : 'proprios',
    acoes,
  }
}

export async function lerAcessoUsuarioConfig(usuario: Pick<Usuario, 'id' | 'role'>): Promise<AcessoUsuarioConfig> {
  if(usuario.role==='master')return acessoUsuarioPadrao('master')
  try {
    const segura = await supabase.from('usuario_acessos_etapas').select('config').eq('usuario_id', usuario.id).maybeSingle()
    if (!segura.error && segura.data) return normalizarConfig(segura.data.config, usuario.role)
    if (segura.error && !['42P01','PGRST205'].includes(segura.error.code)) throw new Error('Não foi possível conferir as permissões.')
    const { data, error } = await supabase
      .from('configuracoes_gerais')
      .select('valor')
      .eq('chave', chave(usuario.id))
      .maybeSingle()
    if (error) throw new Error('Não foi possível conferir as permissões.')
    if (!data?.valor) return acessoUsuarioPadrao(usuario.role)
    const parsed = typeof data.valor === 'string' ? JSON.parse(data.valor) : data.valor
    return normalizarConfig(parsed, usuario.role)
  } catch {
    throw new Error('Não foi possível conferir as permissões. Atualize para tentar novamente.')
  }
}

export async function salvarAcessoUsuarioConfig(usuarioId: string, config: AcessoUsuarioConfig): Promise<boolean> {
  const normalizada: AcessoUsuarioConfig = {
    crmEscopo: config.crmEscopo === 'todos' ? 'todos' : 'proprios',
    cliente360: normalizarMatrizCliente360(config.cliente360),
    acoes: Object.fromEntries(Object.entries(config.acoes || {}).filter(([, nivel]) => nivelValido(nivel))),
  }
  const { tokenAtual } = await import('./auth')
  const token = await tokenAtual()
  if (!token) return false
  try {
    const resp = await fetch('/api/usuarios/acessos-etapas', {
      method:'PUT', headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify({usuarioId,config:normalizada}),
    })
    return resp.ok
  } catch { return false }
}

export function nivelAcaoConfig(config: AcessoUsuarioConfig, acaoId: string, fallback: NivelPermissao = 'oculto'): NivelPermissao {
  return config.acoes?.[acaoId] || fallback
}