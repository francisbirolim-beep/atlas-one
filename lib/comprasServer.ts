import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type UsuarioCompras = {
  id: string
  nome: string
  role: string
  empresa_id: string
}

type NivelPermissao = 'oculto' | 'consulta' | 'edicao'

function setorDaRota(req: NextRequest): 'compras' | 'estoque' | 'financeiro' {
  const pathname = req.nextUrl.pathname.toLowerCase()
  if (pathname.startsWith('/api/estoque/')) return 'estoque'
  if (pathname.startsWith('/api/financeiro/')) return 'financeiro'
  return 'compras'
}

function nivelSuficiente(nivel: NivelPermissao, precisaEdicao: boolean) {
  if (precisaEdicao) return nivel === 'edicao'
  return nivel === 'consulta' || nivel === 'edicao'
}

export async function autenticarCompras(req: NextRequest): Promise<UsuarioCompras | null> {
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
  if (usuario.role === 'master') return usuario as UsuarioCompras

  const setorId = setorDaRota(req)
  const precisaEdicao = req.method !== 'GET' && req.method !== 'HEAD'
  const { data: permissao, error: permissaoError } = await supabaseAdmin
    .from('permissoes')
    .select('nivel')
    .eq('empresa_id', usuario.empresa_id)
    .eq('usuario_id', usuario.id)
    .eq('setor_id', setorId)
    .maybeSingle()

  if (permissaoError) return null
  const nivel = (permissao?.nivel || 'oculto') as NivelPermissao
  if (!nivelSuficiente(nivel, precisaEdicao)) return null

  return usuario as UsuarioCompras
}

export function limiteSeguro(valor: string | null, padrao = 100, maximo = 200) {
  const n = Number(valor)
  if (!Number.isFinite(n) || n <= 0) return padrao
  return Math.min(Math.floor(n), maximo)
}
