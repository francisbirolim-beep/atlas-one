import { NextRequest, NextResponse } from 'next/server'
import { autenticarMasterWVetro } from '@/lib/wvetroAcessoServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalizar(v: unknown) {
  return String(v ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

function chaveTipologia(linha: unknown, modelo: unknown) {
  return `${normalizar(linha)}::${normalizar(modelo)}`
}

async function carregarHistoricoComercial() {
  const pagina = 1000
  const registros: Array<{ itens: unknown }> = []
  for (let inicio = 0; ; inicio += pagina) {
    const { data, error } = await supabaseAdmin
      .from('wvetro_historico_comercial')
      .select('itens')
      .not('itens', 'is', null)
      .range(inicio, inicio + pagina - 1)
    if (error) throw error
    const lote = (data || []) as Array<{ itens: unknown }>
    registros.push(...lote)
    if (lote.length < pagina) break
  }
  return registros
}

// Endpoint só de leitura. Não interfere na carga histórica (execuções/pendências/cursor) —
// lê exclusivamente as tabelas de referência já preenchidas por ela.

export async function GET(req: NextRequest) {
  if (!await autenticarMasterWVetro(req)) return NextResponse.json({ error: 'Área restrita ao Master.' }, { status: 403 })

  try {
    const [{ data: referencias, error: erroRefs }, { data: componentes, error: erroComp }, { data: variaveis, error: erroVar }, { data: formulas, error: erroFormulas }, { data: catalogoComponentes, error: erroCatalogo }, historicoComercial] = await Promise.all([
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
      carregarHistoricoComercial(),
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

    const frequenciaHistorica = new Map<string, { ocorrencias: number; pecas: number }>()
    for (const registro of historicoComercial || []) {
      const itens = Array.isArray(registro.itens) ? registro.itens : []
      for (const item of itens) {
        if (!item || typeof item !== 'object') continue
        const linha = (item as Record<string, unknown>).linha ?? (item as Record<string, unknown>).Linha
        const modelo = (item as Record<string, unknown>).modelo ?? (item as Record<string, unknown>).Modelo
        if (!String(linha || '').trim() || !String(modelo || '').trim()) continue
        const chave = chaveTipologia(linha, modelo)
        const atual = frequenciaHistorica.get(chave) || { ocorrencias: 0, pecas: 0 }
        atual.ocorrencias += 1
        const quantidade = Number((item as Record<string, unknown>).quantidade ?? (item as Record<string, unknown>).Qtde ?? 1)
        atual.pecas += Number.isFinite(quantidade) && quantidade > 0 ? quantidade : 1
        frequenciaHistorica.set(chave, atual)
      }
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
        ocorrencias: frequenciaHistorica.get(chaveTipologia(r.linha_raw, r.modelo_raw))?.ocorrencias ?? Number(r.ocorrencias || 0),
        pecasHistoricas: frequenciaHistorica.get(chaveTipologia(r.linha_raw, r.modelo_raw))?.pecas ?? Number(r.ocorrencias || 0),
        ocorrenciasFonte: frequenciaHistorica.has(chaveTipologia(r.linha_raw, r.modelo_raw)) ? 'historico_materializado' : 'referencia_agregada',
        statusMapeamento: r.status_mapeamento,
        primeiroVisto: r.primeiro_visto,
        ultimoVisto: r.ultimo_visto,
        componentes: comp,
        variaveis: varPorRef.get(r.id) || 0,
        temReceitaOficial: statusFormulas.length > 0,
        receitasOficiaisStatus: statusFormulas,
      }
    })

    linhas.sort((a, b) =>
      b.ocorrencias - a.ocorrencias ||
      b.pecasHistoricas - a.pecasHistoricas ||
      String(a.linha).localeCompare(String(b.linha), 'pt-BR') ||
      String(a.modelo).localeCompare(String(b.modelo), 'pt-BR')
    )

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
