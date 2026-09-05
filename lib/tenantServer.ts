import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type UsuarioTenant = {
  id: string
  nome: string
  role: string
  empresa_id: string
}

export async function autenticarTenant(req: NextRequest): Promise<UsuarioTenant | null> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return null

  const { data: usuario, error: perfilError } = await supabaseAdmin
    .from('usuarios')
    .select('id,nome,role,empresa_id')
    .eq('id', data.user.id)
    .maybeSingle()

  if (perfilError || !usuario?.empresa_id) return null
  return usuario as UsuarioTenant
}

export function aplicarEmpresa<T extends Record<string, unknown>>(payload: T, empresaId: string): T & { empresa_id: string } {
  return { ...payload, empresa_id: empresaId }
}
