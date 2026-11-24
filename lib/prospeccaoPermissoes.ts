import { usuarioAtual } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { Usuario } from '@/lib/tipos'

export interface PermissaoProspeccao {
  usuario_id: string
  pode_ver_mapa: boolean
  pode_assumir: boolean
  atualizado_em?: string | null
}

export type UsuarioPermissaoProspeccao = Pick<Usuario, 'id' | 'nome' | 'role'>

export const PERMISSAO_PROSPECCAO_PADRAO = {
  pode_ver_mapa: false,
  pode_assumir: false,
} as const

export async function buscarMinhaPermissaoProspeccao(): Promise<Pick<PermissaoProspeccao, 'pode_ver_mapa' | 'pode_assumir'>> {
  const usuario = await usuarioAtual()
  if (!usuario) throw new Error('Sessão expirada.')
  if (usuario.role === 'master') return { pode_ver_mapa: true, pode_assumir: true }

  const { data, error } = await supabase.from('prospeccao_permissoes_usuarios')
    .select('pode_ver_mapa,pode_assumir')
    .eq('usuario_id', usuario.id)
    .maybeSingle()
  if (error) throw new Error('Não foi possível verificar suas autorizações.')
  return {
    pode_ver_mapa: Boolean(data?.pode_ver_mapa),
    pode_assumir: Boolean(data?.pode_ver_mapa && data?.pode_assumir),
  }
}

export async function listarPermissoesProspeccao(): Promise<{
  usuarios: UsuarioPermissaoProspeccao[]
  permissoes: PermissaoProspeccao[]
}> {
  const usuario = await usuarioAtual()
  if (!usuario || usuario.role !== 'master') throw new Error('Somente o Master pode gerenciar as autorizações.')

  const [usuarios, permissoes] = await Promise.all([
    supabase.from('usuarios').select('id,nome,role').order('nome'),
    supabase.from('prospeccao_permissoes_usuarios').select('usuario_id,pode_ver_mapa,pode_assumir,atualizado_em'),
  ])
  if (usuarios.error) throw new Error('Não foi possível listar os usuários: ' + usuarios.error.message)
  if (permissoes.error) throw new Error('Não foi possível listar as autorizações: ' + permissoes.error.message)
  return {
    usuarios: (usuarios.data || []) as UsuarioPermissaoProspeccao[],
    permissoes: (permissoes.data || []) as PermissaoProspeccao[],
  }
}

export async function salvarPermissaoProspeccao(
  usuarioId: string,
  podeVerMapa: boolean,
  podeAssumir: boolean
): Promise<{ ok: boolean; error?: string }> {
  const master = await usuarioAtual()
  if (!master?.empresa_id || master.role !== 'master') {
    return { ok: false, error: 'Somente o Master pode alterar as autorizações.' }
  }
  if (usuarioId === master.id) return { ok: false, error: 'O Master já possui acesso completo.' }

  const { error } = await supabase.from('prospeccao_permissoes_usuarios').upsert({
    empresa_id: master.empresa_id,
    usuario_id: usuarioId,
    pode_ver_mapa: podeVerMapa,
    pode_assumir: podeVerMapa && podeAssumir,
    autorizado_por: master.id,
    atualizado_em: new Date().toISOString(),
  }, { onConflict: 'empresa_id,usuario_id' })
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function assumirProspeccao(
  prospeccaoId: string,
  responsavelEsperado: string
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('fn_assumir_prospeccao_v1', {
    p_prospeccao_id: prospeccaoId,
    p_responsavel_esperado: responsavelEsperado,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: Boolean(data?.ok), error: data?.ok ? undefined : 'Não foi possível assumir a prospecção.' }
}
