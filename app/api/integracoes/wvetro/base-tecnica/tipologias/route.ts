import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Endpoint só de leitura. Não interfere na carga histórica (execuções/pendências/cursor) —
// lê exclusivamente as tabelas de referência já preenchidas por ela.

async function master(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return null
  const { data: usuario } = await supabaseAdmin.from('usuarios').select('id,nome,role').eq('id', data.user.id).maybeSingle()
  return usuario?.role === 'master' ? usuario : null
}

export async function GET(req: NextRequest) {
  if (!await master(req)) return NextResponse.json({ error: 'Área restrita ao Master.' }, { status: 403 })

  try {
    const [{ data: referencias, error: erroRefs }, { data: componentes, error: erroComp }, { data: variaveis, error: erroVar }, { data: formulas, error: erroFormulas }, { data: catalogoComponentes, error: erroCatalogo }] = await Promise.all([
      supabaseAdmin
        .from('wvetro_referencias_tipologias')
        .select('id,linha_raw,modelo_raw,tipologia_atlas_id,imagem_url,ocorrencias,status_mapeamento,primeiro_visto,ultimo_visto')
        .order('linha_raw', { ascending: true })
        .order('modelo_raw', { ascending: true }),
      supabaseAdmin
        .from('wvetro_tipologia_componentes')
        .select('referencia_tipologia_id,tipo,produto_atlas_id'),
      supabaseAdmin
        .from('wvetro_referencias_variaveis')
        .select('referencia_tipologia_id'),
      supabaseAdmin
        .from('engenharia_tipologia_formulas_corte')
        .select('tipologia_id,status')
        .eq('ativo', true),
      // Catálogo de referência (identidade + histórico de preço) — separado do BOM por
      // tipologia acima. Reaproveita a mesma tabela já usada pela auditoria/backfill.
      supabaseAdmin
        .from('wvetro_referencias_componentes')
        .select('tipo,produto_atlas_id'),
    ])
    if (erroRefs) throw erroRefs
    if (erroComp) throw erroComp
    if (erroVar) throw erroVar
    if (erroFormulas) throw erroFormulas
    if (erroCatalogo) throw erroCatalogo

    const compPorRef = new Map<string, { total: number; vinculados: number; perfil: number; acessorio: number; vidro: number }>()
    for (const c of componentes || []) {
      const atual = compPorRef.get(c.referencia_tipologia_id) || { total: 0, vinculados: 0, perfil: 0, acessorio: 0, vidro: 0 }
      atual.total += 1
      if (c.produto_atlas_id) atual.vinculados += 1
      if (c.tipo === 'perfil') atual.perfil += 1
      else if (c.tipo === 'acessorio') atual.acessorio += 1
      else if (c.tipo === 'vidro') atual.vidro += 1
      compPorRef.set(c.referencia_tipologia_id, atual)
    }

    const varPorRef = new Map<string, number>()
    for (const v of variaveis || []) {
      varPorRef.set(v.referencia_tipologia_id, (varPorRef.get(v.referencia_tipologia_id) || 0) + 1)
    }

    const formulaPorTipologia = new Map<string, string[]>()
    for (const f of formulas || []) {
      if (!f.tipologia_id) continue
      const lista = formulaPorTipologia.get(f.tipologia_id) || []
      if (f.status) lista.push(f.status)
      formulaPorTipologia.set(f.tipologia_id, lista)
    }

    const linhas = (referencias || []).map(r => {
      const comp = compPorRef.get(r.id) || { total: 0, vinculados: 0, perfil: 0, acessorio: 0, vidro: 0 }
      const statusFormulas = r.tipologia_atlas_id ? (formulaPorTipologia.get(r.tipologia_atlas_id) || []) : []
      return {
        id: r.id,
        linha: r.linha_raw,
        modelo: r.modelo_raw,
        tipologiaAtlasId: r.tipologia_atlas_id,
        imagemUrl: r.imagem_url,
        ocorrencias: Number(r.ocorrencias || 0),
        statusMapeamento: r.status_mapeamento,
        primeiroVisto: r.primeiro_visto,
        ultimoVisto: r.ultimo_visto,
        componentes: comp,
        variaveis: varPorRef.get(r.id) || 0,
        temReceitaOficial: statusFormulas.length > 0,
        receitasOficiaisStatus: statusFormulas,
      }
    })

    const componentesBomTotal = (componentes || []).length
    const componentesBomVinculados = (componentes || []).filter(c => !!c.produto_atlas_id).length

    const resumo = {
      totalTipologias: linhas.length,
      vinculadasAtlas: linhas.filter(l => !!l.tipologiaAtlasId).length,
      comImagem: linhas.filter(l => !!l.imagemUrl).length,
      comComposicao: linhas.filter(l => l.componentes.total > 0).length,
      semComposicao: linhas.filter(l => l.componentes.total === 0).length,
      comReceitaOficial: linhas.filter(l => l.temReceitaOficial).length,
      componentesBomTotal,
      componentesBomVinculados,
      componentesBomSemVinculo: componentesBomTotal - componentesBomVinculados,
    }

    // Catálogo de referência (perfis/acessórios identificados historicamente, independente
    // de já terem entrado na composição de alguma tipologia).
    const catalogo = {
      perfis: {
        total: (catalogoComponentes || []).filter(c => c.tipo === 'perfil').length,
        vinculados: (catalogoComponentes || []).filter(c => c.tipo === 'perfil' && !!c.produto_atlas_id).length,
      },
      acessorios: {
        total: (catalogoComponentes || []).filter(c => c.tipo === 'acessorio').length,
        vinculados: (catalogoComponentes || []).filter(c => c.tipo === 'acessorio' && !!c.produto_atlas_id).length,
      },
      vidros: {
        total: (catalogoComponentes || []).filter(c => c.tipo === 'vidro').length,
        vinculados: (catalogoComponentes || []).filter(c => c.tipo === 'vidro' && !!c.produto_atlas_id).length,
      },
    }

    return NextResponse.json({ tipologias: linhas, resumo, catalogo })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao carregar tipologias.' }, { status: 500 })
  }
}
