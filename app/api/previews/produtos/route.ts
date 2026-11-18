import { NextRequest, NextResponse } from 'next/server'
import { autenticarBalcao, type UsuarioBalcao } from '@/lib/balcaoServer'
import { supabaseAdmin as db } from '@/lib/supabaseAdmin'
import { arredondarMoeda, margemRealPorPreco, precoPorAcrescimoSobreCusto } from '@/lib/precificacaoBalcao'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const categorias = new Set(['produto', 'perfil', 'acessorio', 'vidro', 'porta_janela_padrao', 'kit', 'pu', 'outro'])
const respostaErro = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })

async function usuarioComercial(request: NextRequest) {
  return await autenticarBalcao(request, 'venda-balcao', 'consulta')
    || await autenticarBalcao(request, 'fazer-orcamento-msanfyvj', 'consulta')
}

async function autorizadoCriar(usuario: UsuarioBalcao) {
  if (usuario.role === 'master') return true
  const [setor, permissoes] = await Promise.all([
    db.from('permissoes').select('nivel')
      .eq('empresa_id', usuario.empresa_id).eq('usuario_id', usuario.id).eq('setor_id', 'cadastro').maybeSingle(),
    db.from('usuario_cadastros_360_permissoes').select('config')
      .eq('usuario_id', usuario.id).maybeSingle(),
  ])
  if (setor.error || permissoes.error) throw new Error('Falha ao validar permissão de cadastro.')
  if (setor.data?.nivel !== 'edicao') return false
  const config = permissoes.data?.config as
    | { visiveis?: unknown; acoes?: Record<string, unknown> } | null | undefined
  return !!config && Array.isArray(config.visiveis) && config.visiveis.includes('produtos')
    && Array.isArray(config.acoes?.produtos) && config.acoes.produtos.includes('criar')
}

export async function GET(request: NextRequest) {
  const usuario = await usuarioComercial(request)
  if (!usuario) return respostaErro('Sem acesso ao setor comercial.', 403)
  try {
    return NextResponse.json({ podeCriar: await autorizadoCriar(usuario) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return respostaErro('Não foi possível validar a permissão.', 503)
  }
}

export async function POST(request: NextRequest) {
  const usuario = await usuarioComercial(request)
  if (!usuario) return respostaErro('Sem acesso ao setor comercial.', 403)
  try {
    if (!await autorizadoCriar(usuario)) return respostaErro('Somente o Master ou usuário autorizado pode cadastrar produtos.', 403)
    const dados = await request.json().catch(() => null)
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return respostaErro('Dados inválidos.', 400)

    const nome = String(dados.nome || '').trim()
    const codigoDigitado = String(dados.codigo || '').trim().toUpperCase()
    const categoria = String(dados.categoria || '').trim()
    const unidade = String(dados.unidade || '').trim()
    const descricao = String(dados.descricao || '').trim()
    // Compatibilidade com telas antigas abertas antes do deploy: continuam podendo cadastrar.
    // No novo formulário, custo e modo de precificação são validados sempre no servidor.
    const legado = !Object.prototype.hasOwnProperty.call(dados, 'modoPreco')
      && !Object.prototype.hasOwnProperty.call(dados, 'custo')
    const modoPreco = dados.modoPreco == null && legado ? 'direto' : dados.modoPreco
    if (modoPreco !== 'direto' && modoPreco !== 'percentual')
      return respostaErro('Selecione uma forma válida de definir o preço.', 400)
    const custo = typeof dados.custo === 'number' ? dados.custo : Number(String(dados.custo ?? '').trim().replace(',', '.'))
    const acrescimo = typeof dados.acrescimo === 'number'
      ? dados.acrescimo : Number(String(dados.acrescimo ?? '').trim().replace(',', '.'))
    const precoDigitado = typeof dados.preco === 'number'
      ? dados.preco : Number(String(dados.preco ?? '').trim().replace(',', '.'))
    const preco = modoPreco === 'percentual'
      ? arredondarMoeda(precoPorAcrescimoSobreCusto(custo, acrescimo))
      : precoDigitado
    const margemReal = !legado && preco !== null ? margemRealPorPreco(custo, preco) : null
    const fotoUrl = typeof dados.fotoUrl === 'string' ? dados.fotoUrl.trim() : ''
    const pesoKgM = dados.pesoKgM === '' || dados.pesoKgM == null ? null : Number(dados.pesoKgM)
    const tamanhoBarraMm = dados.tamanhoBarraMm === '' || dados.tamanhoBarraMm == null ? null : Number(dados.tamanhoBarraMm)

    if (!nome || nome.length > 200 || codigoDigitado.length > 60 || unidade.length < 1 || unidade.length > 40
      || descricao.length > 2000 || !categorias.has(categoria))
      return respostaErro('Informe nome, código, categoria e unidade válidos.', 400)
    if (!legado && (dados.custo == null || String(dados.custo).trim() === ''
      || !Number.isFinite(custo) || custo <= 0 || custo > 100000000))
      return respostaErro('Informe um custo de produto válido e maior que zero.', 400)
    if (modoPreco === 'percentual' && (dados.acrescimo == null || String(dados.acrescimo).trim() === ''
      || !Number.isFinite(acrescimo) || acrescimo < 0))
      return respostaErro('Informe um acréscimo válido, igual ou maior que zero.', 400)
    if (preco === null || !Number.isFinite(preco) || preco <= 0 || preco > 100000000)
      return respostaErro('Informe um preço de venda válido e maior que zero.', 400)
    const urlFotos = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '') + '/storage/v1/object/public/fotos/produtos/'
    if (fotoUrl && (!fotoUrl.startsWith(urlFotos) || fotoUrl.length > 2000))
      return respostaErro('Imagem do produto inválida.', 400)
    if ((categoria === 'perfil' || categoria === 'acessorio') && !fotoUrl)
      return respostaErro('Perfis e acessórios precisam de foto do produto.', 400)
    if (categoria === 'perfil' && (!Number.isFinite(pesoKgM) || pesoKgM === null || pesoKgM <= 0 || pesoKgM >= 50
      || !Number.isInteger(tamanhoBarraMm) || tamanhoBarraMm === null || tamanhoBarraMm <= 0))
      return respostaErro('Para perfis, informe peso em kg/m e comprimento da barra em mm.', 400)

    if (codigoDigitado) {
      const { data: existente, error: erroConsulta } = await db.from('produtos')
        .select('id').eq('empresa_id', usuario.empresa_id).eq('codigo', codigoDigitado).limit(1)
      if (erroConsulta) throw erroConsulta
      if (existente?.length) return respostaErro('Já existe um produto com este código.', 409)
    }

    const id = crypto.randomUUID()
    const codigo = codigoDigitado || 'AVU-' + id.replace(/-/g, '').slice(0, 12).toUpperCase()
    const { data, error } = await db.from('produtos').insert({
      id, empresa_id: usuario.empresa_id,
      codigo, nome, categoria, unidade, descricao: descricao || null,
      preco: Math.round(preco * 100) / 100, foto_url: fotoUrl || null,
      ...(!legado ? {
        custo: Math.round(custo * 100) / 100,
        // A coluna margem_percentual armazena margem real, não acréscimo sobre custo.
        // Negociação abaixo do custo não pode gravar margem negativa (restrição SQL).
        margem_percentual: margemReal !== null && margemReal >= 0 && margemReal < 100
          ? margemReal : null,
      } : {}),
      ...(categoria === 'perfil' ? { peso_kg_m: pesoKgM, tamanho_barra_mm: tamanhoBarraMm } : {}),
      ativo: true, criado_por_id: usuario.id, criado_por_nome: usuario.nome,
    }).select('id,codigo,nome,descricao,categoria,unidade,preco,foto_url').single()
    if (error) throw error
    return NextResponse.json({ produto: {
      id: data.id, codigo: data.codigo || '', nome: data.nome, descricao: data.descricao || '',
      categoria: data.categoria, unidade: data.unidade || 'unidade', linha: null,
      fotoUrl: data.foto_url || null, fotoCandidataUrl: null,
      preco: Number(data.preco), precoPromocional: null,
    } }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[cadastro produto avulso]', error)
    return respostaErro('Não foi possível cadastrar o produto.', 503)
  }
}
