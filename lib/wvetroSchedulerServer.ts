import { createHash } from 'crypto'
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { UsuarioWVetro } from '@/lib/wvetroAcessoServer'

const SCHEDULER_TOKEN_SHA256 = 'fdbfff9c0835ce2a98d35b6fe66e76d23279ee077771ca5556b8ccffc358b2e0'

export async function autenticarSchedulerWVetro(req: NextRequest): Promise<UsuarioWVetro | null> {
  const token = (req.headers.get('x-atlas-scheduler-token') || '').trim()
  const hashRecebido = token ? createHash('sha256').update(token).digest('hex') : ''
  if (!token || hashRecebido !== SCHEDULER_TOKEN_SHA256) return null

  const slug = String(process.env.WVETRO_EMPRESA_SLUG || 'esquadrifacio').trim().toLowerCase()
  const { data: empresa, error: empresaError } = await supabaseAdmin
    .from('empresas')
    .select('id')
    .eq('slug', slug)
    .eq('ativo', true)
    .maybeSingle()
  if (empresaError || !empresa?.id) return null

  const { data: usuario, error: usuarioError } = await supabaseAdmin
    .from('usuarios')
    .select('id,nome,role,empresa_id')
    .eq('empresa_id', empresa.id)
    .eq('role', 'master')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (usuarioError || !usuario) return null

  return usuario as UsuarioWVetro
}