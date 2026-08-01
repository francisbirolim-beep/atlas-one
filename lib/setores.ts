import { supabase } from './supabase'
import { Setor, Permissao, NivelPermissao, Usuario } from './tipos'

export const GRUPOS_ORDEM = [
  'Comercial',
  'Técnico',
  'Operações',
  'Administrativo',
  'Relacionamento',
  'Conhecimento',
  'Sistema',
] as const

export async function listarSetores(): Promise<Setor[]> {
  const { data } = await supabase.from('setores').select('*').order('grupo').order('ordem')
  return (data as Setor[]) || []
}

export async function listarPermissoesUsuario(usuarioId: string): Promise<Record<string, NivelPermissao>> {
  const { data } = await supabase
    .from('permissoes')
    .select('setor_id, nivel')
    .eq('usuario_id', usuarioId)
  const mapa: Record<string, NivelPermissao> = {}
  ;(data as Permissao[] | null)?.forEach(p => {
    mapa[p.setor_id] = p.nivel
  })
  return mapa
}

export async function salvarPermissoesUsuario(usuarioId: string, permissoes: Record<string, NivelPermissao>) {
  const linhas = Object.entries(permissoes).map(([setor_id, nivel]) => ({
    usuario_id: usuarioId,
    setor_id,
    nivel,
    updated_at: new Date().toISOString(),
  }))
  if (linhas.length === 0) return { error: null }
  return supabase.from('permissoes').upsert(linhas, { onConflict: 'usuario_id,setor_id' })
}

// Master sempre tem acesso total. Funcionário depende do mapa de permissões
// (setor sem registro = oculto, por padrão).
export function nivelEfetivo(
  usuario: Usuario | null,
  setorId: string,
  permissoes: Record<string, NivelPermissao>
): NivelPermissao {
  if (usuario?.role === 'master') return 'edicao'
  return permissoes[setorId] || 'oculto'
}

export function agruparSetores(setores: Setor[]): Record<string, Setor[]> {
  const grupos: Record<string, Setor[]> = {}
  setores.forEach(s => {
    if (!grupos[s.grupo]) grupos[s.grupo] = []
    grupos[s.grupo].push(s)
  })
  return grupos
}
