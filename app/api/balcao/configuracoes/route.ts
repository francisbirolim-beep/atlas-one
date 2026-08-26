import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarBalcao, nivelBalcaoUsuario } from '@/lib/balcaoServer'
import { correspondeBuscaAtlas, normalizarBuscaAtlas } from '@/lib/buscaAtlas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function lerLista(valor: string | null | undefined): string[] {
  if (!valor) return []
  try {
    const parsed = JSON.parse(valor)
    return Array.isArray(parsed) ? parsed.map(v => typeof v === 'string' ? v.trim() : '').filter(Boolean) : []
  } catch { return [] }
}

function lerCategorias(valor: string | null | undefined): Array<{ valor:string; label:string; ordem:number }> {
  if (!valor) return []
  try {
    const parsed = JSON.parse(valor)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(v => v && typeof v.valor === 'string' && typeof v.label === 'string').map((v,i) => ({ valor:v.valor.trim(), label:v.label.trim(), ordem:Number(v.ordem)||200+i*10 })).filter(v => v.valor && v.label)
  } catch { return [] }
}

function chave(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')
}

function bool(valor: string | null | undefined, padrao = true) {
  if (valor == null) return padrao
  return ['1','true','sim','yes','on'].includes(valor.trim().toLowerCase())
}

async function exigirGestao(req: NextRequest) {
  const usuario = await autenticarBalcao(req, 'venda-balcao', 'consulta')
  if (!usuario) return null
  const nivel = await nivelBalcaoUsuario(usuario.id, usuario.role, 'relatorios-balcao')
  return nivel === 'edicao' ? usuario : null
}

export async function GET(req: NextRequest) {
  const usuario = await exigirGestao(req)
  if (!usuario) return NextResponse.json({ error:'Somente gestão pode alterar as configurações do balcão.' }, { status:403 })
  const q = (req.nextUrl.searchParams.get('q') || '').trim()
  try {
    const [estoqueCfg, caixaCfg, gruposCfg, categoriasCfg, produtosResp] = await Promise.all([
      supabaseAdmin.from('configuracoes_gerais').select('valor').eq('chave','balcao_permitir_venda_sem_estoque').maybeSingle(),
      supabaseAdmin.from('configuracoes_gerais').select('valor').eq('chave','balcao_exigir_caixa_aberto').maybeSingle(),
      supabaseAdmin.from('configuracoes_gerais').select('valor').eq('chave','catalogo_grupos_dinamicos').maybeSingle(),
      supabaseAdmin.from('configuracoes_gerais').select('valor').eq('chave','categorias_produto_dinamicas').maybeSingle(),
      q.length >= 2
        ? supabaseAdmin.from('produtos').select('id,codigo,nome,descricao,categoria,grupo,permite_venda_sem_estoque').eq('ativo',true).limit(1000)
        : Promise.resolve({ data: [] as any[], error: null }),
    ])
    if (produtosResp.error) throw produtosResp.error
    const produtos = (produtosResp.data || []).filter((p:any) => correspondeBuscaAtlas(q,p.codigo,p.nome,p.descricao,p.categoria,p.grupo)).slice(0,40)
    return NextResponse.json({
      ok:true,
      permitirVendaSemEstoque:bool(estoqueCfg.data?.valor,true),
      exigirCaixaAberto:bool(caixaCfg.data?.valor,false),
      grupos:lerLista(gruposCfg.data?.valor),
      categorias:lerCategorias(categoriasCfg.data?.valor),
      produtos,
    })
  } catch (e) {
    console.error('Erro configurações balcão',e)
    return NextResponse.json({ error:'Não foi possível carregar as configurações.' }, { status:500 })
  }
}

export async function POST(req: NextRequest) {
  const usuario = await exigirGestao(req)
  if (!usuario) return NextResponse.json({ error:'Somente gestão pode alterar as configurações do balcão.' }, { status:403 })
  try {
    const body = await req.json()
    const acao = String(body.acao || '')

    if (acao === 'estoque-global') {
      const valor = Boolean(body.permitir)
      const { error } = await supabaseAdmin.from('configuracoes_gerais').upsert({ chave:'balcao_permitir_venda_sem_estoque', valor:String(valor), updated_at:new Date().toISOString() })
      if (error) throw error
      return NextResponse.json({ ok:true, permitir:valor })
    }

    if (acao === 'caixa-obrigatorio') {
      const valor = Boolean(body.exigir)
      const { error } = await supabaseAdmin.from('configuracoes_gerais').upsert({ chave:'balcao_exigir_caixa_aberto', valor:String(valor), updated_at:new Date().toISOString() })
      if (error) throw error
      return NextResponse.json({ ok:true, exigir:valor })
    }

    if (acao === 'produto-estoque') {
      const produtoId = String(body.produtoId || '')
      if (!produtoId) return NextResponse.json({ error:'Produto obrigatório.' }, { status:400 })
      const valor = body.valor === null ? null : Boolean(body.valor)
      const { error } = await supabaseAdmin.from('produtos').update({ permite_venda_sem_estoque:valor, updated_at:new Date().toISOString() }).eq('id',produtoId)
      if (error) throw error
      return NextResponse.json({ ok:true })
    }

    if (acao === 'adicionar-grupo' || acao === 'remover-grupo') {
      const nome = String(body.nome || '').trim()
      if (!nome) return NextResponse.json({ error:'Informe o nome do grupo/filtro.' }, { status:400 })
      const { data } = await supabaseAdmin.from('configuracoes_gerais').select('valor').eq('chave','catalogo_grupos_dinamicos').maybeSingle()
      const atuais = lerLista(data?.valor)
      const alvo = normalizarBuscaAtlas(nome)
      const nova = acao === 'adicionar-grupo'
        ? (atuais.some(v => normalizarBuscaAtlas(v) === alvo) ? atuais : [...atuais,nome])
        : atuais.filter(v => normalizarBuscaAtlas(v) !== alvo)
      const { error } = await supabaseAdmin.from('configuracoes_gerais').upsert({ chave:'catalogo_grupos_dinamicos', valor:JSON.stringify(nova), updated_at:new Date().toISOString() })
      if (error) throw error
      return NextResponse.json({ ok:true, grupos:nova })
    }

    if (acao === 'adicionar-categoria' || acao === 'remover-categoria') {
      const nome = String(body.nome || '').trim()
      if (!nome) return NextResponse.json({ error:'Informe o nome da categoria.' }, { status:400 })
      const { data } = await supabaseAdmin.from('configuracoes_gerais').select('valor').eq('chave','categorias_produto_dinamicas').maybeSingle()
      const atuais = lerCategorias(data?.valor)
      const valor = chave(nome)
      if (!valor) return NextResponse.json({ error:'Nome de categoria inválido.' }, { status:400 })
      let nova = atuais
      if (acao === 'adicionar-categoria') {
        if (!atuais.some(c => c.valor === valor || normalizarBuscaAtlas(c.label) === normalizarBuscaAtlas(nome))) {
          const maior = atuais.reduce((m,c)=>Math.max(m,c.ordem),100)
          nova = [...atuais,{ valor,label:nome,ordem:maior+10 }]
        }
      } else {
        nova = atuais.filter(c => c.valor !== valor && normalizarBuscaAtlas(c.label) !== normalizarBuscaAtlas(nome))
      }
      const { error } = await supabaseAdmin.from('configuracoes_gerais').upsert({ chave:'categorias_produto_dinamicas', valor:JSON.stringify(nova), updated_at:new Date().toISOString() })
      if (error) throw error
      return NextResponse.json({ ok:true, categorias:nova })
    }

    return NextResponse.json({ error:'Ação inválida.' }, { status:400 })
  } catch (e) {
    console.error('Erro ao salvar configuração balcão',e)
    return NextResponse.json({ error:'Não foi possível salvar a configuração.' }, { status:500 })
  }
}
