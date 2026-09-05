import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type NivelBalcao = 'oculto' | 'consulta' | 'edicao'
export type UsuarioBalcao = { id: string; nome: string; role: string; empresa_id: string; nivel: NivelBalcao }

const peso: Record<NivelBalcao, number> = { oculto: 0, consulta: 1, edicao: 2 }

export async function autenticarBalcao(
  req: NextRequest,
  setorId = 'venda-balcao',
  minimo: NivelBalcao = 'consulta'
): Promise<UsuarioBalcao | null> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return null

  const { data: usuario } = await supabaseAdmin
    .from('usuarios')
    .select('id,nome,role,empresa_id')
    .eq('id', data.user.id)
    .maybeSingle()
  if (!usuario?.empresa_id) return null

  let nivel: NivelBalcao = 'oculto'
  if (usuario.role === 'master') nivel = 'edicao'
  else {
    const { data: permissao } = await supabaseAdmin
      .from('permissoes')
      .select('nivel')
      .eq('empresa_id', usuario.empresa_id)
      .eq('usuario_id', usuario.id)
      .eq('setor_id', setorId)
      .maybeSingle()
    nivel = (permissao?.nivel as NivelBalcao) || 'oculto'
  }

  if (peso[nivel] < peso[minimo]) return null
  return { ...usuario, nivel }
}

export async function nivelBalcaoUsuario(usuarioId: string, role: string, setorId: string): Promise<NivelBalcao> {
  if (role === 'master') return 'edicao'

  const { data: usuario } = await supabaseAdmin
    .from('usuarios')
    .select('empresa_id')
    .eq('id', usuarioId)
    .maybeSingle()
  if (!usuario?.empresa_id) return 'oculto'

  const { data } = await supabaseAdmin
    .from('permissoes')
    .select('nivel')
    .eq('empresa_id', usuario.empresa_id)
    .eq('usuario_id', usuarioId)
    .eq('setor_id', setorId)
    .maybeSingle()
  return (data?.nivel as NivelBalcao) || 'oculto'
}

export function parseNumero(v: unknown, padrao = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : padrao
}
