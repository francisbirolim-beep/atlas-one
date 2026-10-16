import { NextRequest, NextResponse } from 'next/server'
import { autenticarCompras } from '@/lib/comprasServer'
import { supabaseAdmin as db } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const categorias = new Set(['produto', 'perfil', 'acessorio', 'vidro', 'outro'])
const falha = (erro: string, status: number) =>
  NextResponse.json({ error: erro }, { status, headers: { 'Cache-Control': 'no-store' } })

async function podeCriar(usuario: { id: string; role: string; empresa_id: string }) {
  if (usuario.role === 'master') return true
  const [setor, matriz] = await Promise.all([
    db.from('permissoes').select('nivel').eq('empresa_id', usuario.empresa_id)
      .eq('usuario_id', usuario.id).eq('setor_id', 'cadastro').maybeSingle(),
    db.from('usuario_cadastros_360_permissoes').select('config')
      .eq('usuario_id', usuario.id).maybeSingle(),
  ])
  if (setor.error || matriz.error) throw new Error('Falha ao consultar permissões.')
  if (setor.data?.nivel !== 'edicao') return false
  const config = matriz.data?.config as
    | { visiveis?: unknown; acoes?: Record<string, unknown> } | null | undefined
  if (!config || !Array.isArray(config.visiveis) || !config.visiveis.includes('produtos'))
    return false
  const acoes = config.acoes?.produtos
  return !Array.isArray(acoes) || acoes.includes('criar')
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarCompras(req)
  if (!usuario) return falha('Sessão inválida.', 401)
  try {
    if (!await podeCriar(usuario))
      return falha('Sem permissão para cadastrar produtos.', 403)

    const dados = await req.json().catch(() => null)
    if (!dados || typeof dados !== 'object') return falha('Dados inválidos.', 400)
    const nome = String(dados.nome || '').trim()
    const categoria = String(dados.categoria || '')
    const unidade = String(dados.unidade || '').trim()
    const fornecedorId = dados.fornecedorId || null
    const foto = dados.fotoUrl ? String(dados.fotoUrl).trim() : null
    const custo = dados.custo === null || dados.custo === '' ? null : Number(dados.custo)

    if (!nome || nome.length > 200 || !unidade || unidade.length > 40
      || !categorias.has(categoria))
      return falha('Informe nome, categoria e unidade válidos.', 400)
    if (custo !== null && (!Number.isFinite(custo) || custo < 0 || custo > 100000000))
      return falha('Custo do produto inválido.', 400)
    if (fornecedorId && (typeof fornecedorId !== 'string' || !uuid.test(fornecedorId)))
      return falha('Fornecedor inválido.', 400)
    const baseFotos = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '') +
      '/storage/v1/object/public/fotos/produtos/'
    if (foto && (!foto.startsWith(baseFotos) || foto.length > 2000))
      return falha('Imagem do produto inválida.', 400)
    if (['perfil', 'acessorio'].includes(categoria) && !foto)
      return falha('Perfis e acessórios precisam ter imagem cadastrada.', 400)
    if (fornecedorId) {
      const fornecedor = await db.from('fornecedores').select('id')
        .eq('empresa_id', usuario.empresa_id).eq('id', fornecedorId).eq('ativo', true).maybeSingle()
      if (fornecedor.error) throw fornecedor.error
      if (!fornecedor.data) return falha('Fornecedor não encontrado nesta empresa.', 409)
    }
    const id = crypto.randomUUID()
    const codigo = 'MAN-' + id.replace(/-/g, '').slice(0, 12).toUpperCase()
    const { data, error } = await db.from('produtos')
      .insert({
        id, empresa_id: usuario.empresa_id, codigo,
        nome, categoria, unidade, custo, preco: 0,
        foto_url: foto, fornecedor_id: fornecedorId,
        ativo: true, criado_por_id: usuario.id, criado_por_nome: usuario.nome,
      })
      .select('id,codigo,nome,unidade,custo,foto_url')
      .single()
    if (error) throw error
    return NextResponse.json({ produto: data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[cadastro rápido entrada manual]', error)
    return falha('Não foi possível cadastrar o produto.', 503)
  }
}
