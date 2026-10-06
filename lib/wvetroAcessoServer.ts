import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type UsuarioWVetro = {
  id: string
  nome: string | null
  role: string
  empresa_id: string
}

async function autenticarUsuarioBaseWVetro(req: NextRequest): Promise<UsuarioWVetro | null> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !authData?.user) return null

  const { data: usuario, error: usuarioError } = await supabaseAdmin
    .from('usuarios')
    .select('id,nome,role,empresa_id')
    .eq('id', authData.user.id)
    .maybeSingle()
  if (usuarioError || !usuario?.empresa_id) return null

  const { data: empresa, error: empresaError } = await supabaseAdmin
    .from('empresas')
    .select('id,slug,ativo')
    .eq('id', usuario.empresa_id)
    .maybeSingle()

  const slugPermitido = String(process.env.WVETRO_EMPRESA_SLUG || 'esquadrifacio').trim().toLowerCase()
  if (empresaError || !empresa?.ativo || String(empresa.slug || '').toLowerCase() !== slugPermitido) return null

  return usuario as UsuarioWVetro
}

export async function autenticarUsuarioWVetro(req: NextRequest): Promise<UsuarioWVetro | null> {
  return autenticarUsuarioBaseWVetro(req)
}

export async function autenticarMasterWVetro(req: NextRequest): Promise<UsuarioWVetro | null> {
  const usuario = await autenticarUsuarioBaseWVetro(req)
  return usuario?.role === 'master' ? usuario : null
}
