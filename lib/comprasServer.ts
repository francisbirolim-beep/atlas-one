import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type UsuarioCompras = {
  id: string
  nome: string
  role: string
}

export async function autenticarCompras(req: NextRequest): Promise<UsuarioCompras | null> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return null

  const { data: usuario } = await supabaseAdmin
    .from('usuarios')
    .select('id,nome,role')
    .eq('id', data.user.id)
    .maybeSingle()

  return usuario || null
}

export function limiteSeguro(valor: string | null, padrao = 100, maximo = 200) {
  const n = Number(valor)
  if (!Number.isFinite(n) || n <= 0) return padrao
  return Math.min(Math.floor(n), maximo)
}
