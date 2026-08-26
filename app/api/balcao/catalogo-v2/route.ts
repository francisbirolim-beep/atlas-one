import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarBalcao, nivelBalcaoUsuario } from '@/lib/balcaoServer'
import { correspondeBuscaAtlas, normalizarBuscaAtlas } from '@/lib/buscaAtlas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ProdutoCatalogo = {
  id: string
  codigo: string | null
  codigo_origem: string | null
  nome: string
  descricao: string | null
  categoria: string | null
  grupo: string | null
  marca: string | null
  ncm: string | null
  unidade: string | null
  custo: number | string | null
  preco: number | string | null
  margem_percentual: number | string | null
  preco_minimo: number | string | null
  preco_promocional: number | string | null
  foto_url: string | null
  peso_kg_m: number | string | null
  tamanho_barra_mm: number | string | null
  ativo: boolean
  permite_venda_sem_estoque: boolean | null
}

type LinhaRede = {
  produto_id: string
  local_id: string
  unidade_id: string
  unidade_codigo: string
  unidade_nome: string
  local_codigo: string
  local_nome: string
  unidade: string | null
  quantidade_fisica: number | string | null
  quantidade_reservada: number | string | null
  quantidade_disponivel: number | string | null
  custo_medio: number | string | null
}

type LinhaTecnica = { id: string; nome: string; ativo: boolean }
type VinculoLinha = { produto_id: string; linha_id: string }

const CATEGORIAS_BASE = [
  { valor: 'produto', label: 'Produto', ordem: 10 },
  { valor: 'acessorio', label: 'Acessório', ordem: 20 },
  { valor: 'perfil', label: 'Perfil', ordem: 30 },
  { valor: 'vidro', label: 'Vidro', ordem: 40 },
  { valor: 'porta_janela_padrao', label: 'Produto pronto', ordem: 50 },
  { valor: 'pu', label: 'PU', ordem: 90 },
  { valor: 'outro', label: 'Outro', ordem: 100 },
]

const CAMPOS_PRODUTO = 'id,codigo,codigo_origem,nome,descricao,categoria,grupo,marca,ncm,unidade,custo,preco,margem_percentual,preco_minimo,preco_promocional,foto_url,peso_kg_m,tamanho_barra_mm,ativo,permite_venda_sem_estoque'

function lerListaConfig(valor: string | null | undefined): string[] {
  if (!valor) return []
  try {
    const parsed = JSON.parse(valor)
    if (!Array.isArray(parsed)) return []
    return parsed.map(v => typeof v === 'string' ? v.trim() : '').filter(Boolean)
  } catch {
    return []
  }
}

function lerCategoriasConfig(valor: string | null | undefined) {
  if (!valor) return [] as Array<{ valor: string; label: string; ordem: number }>
  try {
    const parsed = JSON.parse(valor)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(v => v && typeof v.valor === 'string' && typeof v.label === 'string')
      .map((v, i) => ({ valor: v.valor.trim(), label: v.label.trim(), ordem: Number(v.ordem) || 200 + i * 10 }))
      .filter(v => v.valor && v.label)
  } catch {
    return []
  }
}

function valorBooleano(valor: string | null | undefined, padrao: boolean) {
  if (valor == null || valor === '') return padrao
  return ['1', 'true', 'sim', 'yes', 'on'].includes(String(valor).trim().toLowerCase())
}

async function localPadrao(usuarioId: string, localSolicitado?: string | null) {
  if (localSolicitado) {
    const { data } = await supabaseAdmin.from('estoque_locais').select('id,nome,codigo,unidade_id,unidades_operacionais(id,nome,codigo)').eq('id', localSolicitado).eq('ativo', true).maybeSingle()
    if (data) return data as any
  }
  const { data: caixa } = await supabaseAdmin.from('balcao_caixas').select('local_estoque_id').eq('operador_id', usuarioId).eq('status', 'aberto').order('aberto_em', { ascending: false }).limit(1).maybeSingle()
  if (caixa?.local_estoque_id) {
    const { data } = await supabaseAdmin.from('estoque_locais').select('id,nome,codigo,unidade_id,unidades_operacionais(id,nome,codigo)').eq('id', caixa.local_estoque_id).maybeSingle()
    if (data) return data as any
  }
  const { data } = await supabaseAdmin.from('estoque_locais').select('id,nome,codigo,unidade_id,unidades_operacionais!inner(id,nome,codigo)').eq('codigo', 'GERAL').eq('unidades_operacionais.codigo', 'MATRIZ').limit(1).maybeSingle()
  return data as any
}

export async function GET(req: NextRequest) {
  const usuario = await autenticarBalcao(req, 'venda-balcao', 'consulta')
  if (!usuario) return NextResponse.json({ error: 'Sem acesso à Venda Balcão.' }, { status: 403 })

  const q = (req.nextUrl.searchParams.get('q') || '').trim()
  const categoria = (req.nextUrl.searchParams.get('categoria') || '').trim()
  const grupo = (req.nextUrl.searchParams.get('grupo') || '').trim()
  const deveListar = q.length >= 2 || Boolean(categoria) || Boolean(grupo) || req.nextUrl.searchParams.get('listar') === '1'

  try {
    const [prodResp, linhasResp, vincResp, catCfgResp, grupoCfgResp, estoqueCfgResp] = await Promise.all([
      supabaseAdmin.from('produtos').select(CAMPOS_PRODUTO).eq('ativo', true).not('unidade', 'is', null).order('nome').limit(5000),
      supabaseAdmin.from('linhas_tecnicas').select('id,nome,ativo').eq('ativo', true).order('ordem').order('nome'),
      supabaseAdmin.from('linha_produtos').select('produto_id,linha_id').limit(10000),
      supabaseAdmin.from('configuracoes_gerais').select('valor').eq('chave', 'categorias_produto_dinamicas').maybeSingle(),
      supabaseAdmin.from('configuracoes_gerais').select('valor').eq('chave', 'catalogo_grupos_dinamicos').maybeSingle(),
      supabaseAdmin.from('configuracoes_gerais').select('valor').eq('chave', 'balcao_permitir_venda_sem_estoque').maybeSingle(),
    ])
    if (prodResp.error) throw prodResp.error
    if (linhasResp.error) throw linhasResp.error
    if (vincResp.error) throw vincResp.error

    const produtos = (prodResp.data || []) as unknown as ProdutoCatalogo[]
    const linhas = (linhasResp.data || []) as LinhaTecnica[]
    const vinculos = (vincResp.data || []) as VinculoLinha[]
    const linhaPorId = new Map(linhas.map(l => [l.id, l]))
    const linhasPorProduto = new Map<string, LinhaTecnica[]>()
    for (const v of vinculos) {
      const linha = linhaPorId.get(v.linha_id)
      if (!linha) continue
      const atual = linhasPorProduto.get(v.produto_id) || []
      atual.push(linha)
      linhasPorProduto.set(v.produto_id, atual)
    }

    const mapaCategorias = new Map(CATEGORIAS_BASE.map(c => [c.valor, c]))
    for (const c of lerCategoriasConfig(catCfgResp.data?.valor)) mapaCategorias.set(c.valor, c)
    for (const p of produtos) {
      const valor = String(p.categoria || '').trim()
      if (valor && !mapaCategorias.has(valor)) mapaCategorias.set(valor, { valor, label: valor.replace(/_/g, ' ').replace(/\b\w/g, x => x.toUpperCase()), ordem: 1000 })
    }
    const categorias = Array.from(mapaCategorias.values()).sort((a, b) => a.ordem - b.ordem || a.label.localeCompare(b.label, 'pt-BR'))

    const produtosDaCategoria = categoria ? produtos.filter(p => p.categoria === categoria) : produtos
    const gruposConfigurados = lerListaConfig(grupoCfgResp.data?.valor)
    const gruposMapa = new Map<string, string>()
    const adicionarGrupo = (nome: string | null | undefined) => {
      const texto = String(nome || '').trim()
      if (!texto) return
      const chave = normalizarBuscaAtlas(texto)
      if (!gruposMapa.has(chave)) gruposMapa.set(chave, texto)
    }
    gruposConfigurados.forEach(adicionarGrupo)
    produtosDaCategoria.forEach(p => {
      adicionarGrupo(p.grupo)
      ;(linhasPorProduto.get(p.id) || []).forEach(l => adicionarGrupo(l.nome))
    })
    const grupos = Array.from(gruposMapa.values()).sort((a, b) => {
      const ia = gruposConfigurados.findIndex(g => normalizarBuscaAtlas(g) === normalizarBuscaAtlas(a))
      const ib = gruposConfigurados.findIndex(g => normalizarBuscaAtlas(g) === normalizarBuscaAtlas(b))
      if (ia >= 0 || ib >= 0) return (ia >= 0 ? ia : 9999) - (ib >= 0 ? ib : 9999)
      return a.localeCompare(b, 'pt-BR')
    })

    let filtrados = produtosDaCategoria
    if (grupo) {
      filtrados = filtrados.filter(p => correspondeBuscaAtlas(
        grupo,
        p.grupo,
        p.nome,
        p.descricao,
        ...(linhasPorProduto.get(p.id) || []).map(l => l.nome)
      ))
    }
    if (q.length >= 2) {
      filtrados = filtrados.filter(p => correspondeBuscaAtlas(
        q,
        p.codigo,
        p.codigo_origem,
        p.nome,
        p.descricao,
        p.categoria,
        p.grupo,
        p.marca,
        p.ncm,
        ...(linhasPorProduto.get(p.id) || []).map(l => l.nome)
      ))
    }
    if (!deveListar) filtrados = []
    filtrados = filtrados.slice(0, 250)

    const local = await localPadrao(usuario.id, req.nextUrl.searchParams.get('localId'))
    if (!local?.id) return NextResponse.json({ error: 'Nenhum local de estoque foi configurado para o balcão.' }, { status: 409 })

    const ids = filtrados.map(p => p.id)
    const { data: rede, error: erroRede } = ids.length
      ? await supabaseAdmin.from('estoque_disponibilidade_rede').select('produto_id,local_id,unidade_id,unidade_codigo,unidade_nome,local_codigo,local_nome,unidade,quantidade_fisica,quantidade_reservada,quantidade_disponivel,custo_medio').in('produto_id', ids)
      : { data: [] as LinhaRede[], error: null }
    if (erroRede) throw erroRede

    const redePorProduto = new Map<string, LinhaRede[]>()
    for (const r of (rede || []) as LinhaRede[]) {
      const atual = redePorProduto.get(r.produto_id) || []
      atual.push(r)
      redePorProduto.set(r.produto_id, atual)
    }

    const nivelGestao = await nivelBalcaoUsuario(usuario.id, usuario.role, 'relatorios-balcao')
    const podeVerGestao = nivelGestao !== 'oculto'
    const vendaSemEstoqueGlobal = valorBooleano(estoqueCfgResp.data?.valor, true)

    const lista = filtrados.map(p => {
      const linhasRede = redePorProduto.get(p.id) || []
      const agrupados = new Map<string, {localId:string;unidadeId:string;unidadeCodigo:string;unidadeNome:string;localCodigo:string;localNome:string;fisico:number;reservado:number;disponivel:number;custoValor:number;custoQtd:number;unidade:string}>()
      for (const r of linhasRede) {
        const a = agrupados.get(r.local_id) || { localId:r.local_id,unidadeId:r.unidade_id,unidadeCodigo:r.unidade_codigo,unidadeNome:r.unidade_nome,localCodigo:r.local_codigo,localNome:r.local_nome,fisico:0,reservado:0,disponivel:0,custoValor:0,custoQtd:0,unidade:r.unidade||p.unidade||'' }
        const fisico=Number(r.quantidade_fisica||0), reservado=Number(r.quantidade_reservada||0), disponivel=Number(r.quantidade_disponivel||0), custo=r.custo_medio==null?null:Number(r.custo_medio)
        a.fisico += fisico; a.reservado += reservado; a.disponivel += disponivel
        if (custo != null && fisico > 0) { a.custoValor += custo * fisico; a.custoQtd += fisico }
        agrupados.set(r.local_id, a)
      }
      const estoquesRede = Array.from(agrupados.values()).map(a => ({
        localId:a.localId, unidadeId:a.unidadeId, unidadeCodigo:a.unidadeCodigo, unidadeNome:a.unidadeNome,
        localCodigo:a.localCodigo, localNome:a.localNome, fisico:a.fisico, reservado:a.reservado, disponivel:a.disponivel,
        unidade:a.unidade, custoMedio:a.custoQtd>0?a.custoValor/a.custoQtd:null,
      })).sort((a,b)=>(a.localId===local.id?-1:b.localId===local.id?1:b.disponivel-a.disponivel))
      const atual = estoquesRede.find(e => e.localId === local.id)
      const estoqueLocal = Number(atual?.disponivel || 0)
      const estoqueRede = estoquesRede.reduce((s,e)=>s+Number(e.disponivel||0),0)
      const precoNormal = Number(p.preco || 0)
      const promocional = p.preco_promocional == null ? null : Number(p.preco_promocional)
      const precoEfetivo = promocional != null && promocional >= 0 ? promocional : precoNormal
      const gruposProduto = [p.grupo, ...(linhasPorProduto.get(p.id) || []).map(l => l.nome)].filter(Boolean)
      const permiteVendaSemEstoque = p.permite_venda_sem_estoque == null ? vendaSemEstoqueGlobal : Boolean(p.permite_venda_sem_estoque)
      return {
        id:p.id, codigo:p.codigo||'', nome:p.nome, descricao:p.descricao||null, categoria:p.categoria, grupo:p.grupo,
        grupos:gruposProduto, unidade:p.unidade, fotoUrl:p.foto_url||null,
        pesoKgM:p.peso_kg_m==null?null:Number(p.peso_kg_m), tamanhoBarraMm:p.tamanho_barra_mm==null?null:Number(p.tamanho_barra_mm),
        estoque:estoqueLocal, estoqueLocal, estoqueRede, estoquesRede, unidadeEstoque:atual?.unidade||p.unidade,
        preco:precoNormal, precoPromocional:promocional, precoEfetivo, permiteVendaSemEstoque,
        ...(podeVerGestao ? {
          custo:atual?.custoMedio==null?(p.custo==null?null:Number(p.custo)):Number(atual.custoMedio),
          margem:p.margem_percentual==null?null:Number(p.margem_percentual),
          precoMinimo:p.preco_minimo==null?null:Number(p.preco_minimo),
        } : {}),
      }
    })

    return NextResponse.json({
      ok:true,
      produtos:lista,
      categorias,
      grupos,
      vendaSemEstoqueGlobal,
      podeVerGestao,
      localAtual:{id:local.id,nome:local.nome,codigo:local.codigo,unidadeId:local.unidade_id,unidadeNome:(local.unidades_operacionais as any)?.nome||'Unidade',unidadeCodigo:(local.unidades_operacionais as any)?.codigo||''},
    })
  } catch (e) {
    console.error('Erro catálogo v2 balcão', e)
    return NextResponse.json({ error: 'Não foi possível carregar o catálogo.' }, { status: 500 })
  }
}
