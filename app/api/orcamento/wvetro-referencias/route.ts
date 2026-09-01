import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function autenticar(req: NextRequest) {
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

type RefTipologia = {
  id: string
  tipologia_atlas_id: string | null
  linha_raw: string
  modelo_raw: string
  imagem_url: string | null
  ocorrencias: number | null
  status_mapeamento: string | null
}

type RefVariavel = {
  id: string
  referencia_tipologia_id: string
  tipologia_atlas_id: string | null
  variavel_atlas_id: string | null
  variavel_chave_raw: string
  variavel_label_raw: string | null
  valor_raw: string | null
  valor_normalizado: string | null
  origem_tipo: string
  confianca: number | null
  evidencia: string | null
  status_mapeamento: string | null
}

type RefComponente = {
  referencia_tipologia_id: string
  tipo: 'perfil' | 'acessorio' | 'vidro'
  produto_atlas_id: string | null
  codigo: string | null
  codigo_wvetro: string | null
  nome: string
  cor: string | null
  unidade_origem: string | null
  ncm: string | null
  imagem_url: string | null
  ocorrencias: number | null
  quantidade_min: number | null
  quantidade_max: number | null
  quantidade_soma: number | null
  medida_min: number | null
  medida_max: number | null
  custo_min: number | null
  custo_max: number | null
  custo_ultimo: number | null
  venda_min: number | null
  venda_max: number | null
  venda_ultimo: number | null
  ultimo_custo_em: string | null
  posicoes: unknown
  cortes: unknown
  status_mapeamento: string | null
}

export async function GET(req: NextRequest) {
  if (!await autenticar(req)) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  try {
    const [{ data: refs, error: erroRefs }, { data: vars, error: erroVars }, { data: comps, error: erroComps }] = await Promise.all([
      supabaseAdmin
        .from('wvetro_referencias_tipologias')
        .select('id,tipologia_atlas_id,linha_raw,modelo_raw,imagem_url,ocorrencias,status_mapeamento')
        .not('tipologia_atlas_id', 'is', null),
      supabaseAdmin
        .from('wvetro_referencias_variaveis')
        .select('id,referencia_tipologia_id,tipologia_atlas_id,variavel_atlas_id,variavel_chave_raw,variavel_label_raw,valor_raw,valor_normalizado,origem_tipo,confianca,evidencia,status_mapeamento')
        .neq('status_mapeamento', 'descartada'),
      supabaseAdmin
        .from('wvetro_tipologia_componentes')
        .select('referencia_tipologia_id,tipo,produto_atlas_id,codigo,codigo_wvetro,nome,cor,unidade_origem,ncm,imagem_url,ocorrencias,quantidade_min,quantidade_max,quantidade_soma,medida_min,medida_max,custo_min,custo_max,custo_ultimo,venda_min,venda_max,venda_ultimo,ultimo_custo_em,posicoes,cortes,status_mapeamento'),
    ])
    if (erroRefs) throw erroRefs
    if (erroVars) throw erroVars
    if (erroComps) throw erroComps

    const variaveisPorRef = new Map<string, RefVariavel[]>()
    for (const variavel of (vars || []) as RefVariavel[]) {
      const lista = variaveisPorRef.get(variavel.referencia_tipologia_id) || []
      lista.push(variavel)
      variaveisPorRef.set(variavel.referencia_tipologia_id, lista)
    }

    const componentesPorRef = new Map<string, RefComponente[]>()
    for (const componente of (comps || []) as RefComponente[]) {
      const lista = componentesPorRef.get(componente.referencia_tipologia_id) || []
      lista.push(componente)
      componentesPorRef.set(componente.referencia_tipologia_id, lista)
    }

    const referencias: Record<string, unknown> = {}
    for (const ref of (refs || []) as RefTipologia[]) {
      if (!ref.tipologia_atlas_id) continue
      const componentes = componentesPorRef.get(ref.id) || []
      referencias[ref.tipologia_atlas_id] = {
        referenciaId: ref.id,
        tipologiaId: ref.tipologia_atlas_id,
        linha: ref.linha_raw,
        modelo: ref.modelo_raw,
        imagemUrl: ref.imagem_url,
        ocorrencias: Number(ref.ocorrencias || 0),
        statusMapeamento: ref.status_mapeamento || 'referencia',
        variaveis: (variaveisPorRef.get(ref.id) || []).map(v => ({
          id: v.id,
          variavelId: v.variavel_atlas_id,
          chave: v.variavel_chave_raw,
          label: v.variavel_label_raw || v.variavel_chave_raw,
          valor: v.valor_normalizado || v.valor_raw || '',
          valorRaw: v.valor_raw,
          origemTipo: v.origem_tipo,
          confianca: Number(v.confianca ?? 1),
          evidencia: v.evidencia,
          statusMapeamento: v.status_mapeamento || 'referencia',
        })),
        componentes: componentes.map(c => ({
          tipo: c.tipo,
          produtoId: c.produto_atlas_id,
          codigo: c.codigo || c.codigo_wvetro,
          codigoWvetro: c.codigo_wvetro,
          nome: c.nome,
          cor: c.cor,
          unidadeOrigem: c.unidade_origem,
          ncm: c.ncm,
          imagemUrl: c.imagem_url,
          ocorrencias: Number(c.ocorrencias || 0),
          quantidadeMin: c.quantidade_min == null ? null : Number(c.quantidade_min),
          quantidadeMax: c.quantidade_max == null ? null : Number(c.quantidade_max),
          quantidadeMedia: Number(c.ocorrencias || 0) > 0 && c.quantidade_soma != null ? Number(c.quantidade_soma) / Number(c.ocorrencias) : null,
          medidaMin: c.medida_min == null ? null : Number(c.medida_min),
          medidaMax: c.medida_max == null ? null : Number(c.medida_max),
          custoMin: c.custo_min == null ? null : Number(c.custo_min),
          custoMax: c.custo_max == null ? null : Number(c.custo_max),
          custoUltimo: c.custo_ultimo == null ? null : Number(c.custo_ultimo),
          vendaMin: c.venda_min == null ? null : Number(c.venda_min),
          vendaMax: c.venda_max == null ? null : Number(c.venda_max),
          vendaUltimo: c.venda_ultimo == null ? null : Number(c.venda_ultimo),
          ultimoCustoEm: c.ultimo_custo_em,
          posicoes: Array.isArray(c.posicoes) ? c.posicoes : [],
          cortes: Array.isArray(c.cortes) ? c.cortes : [],
          statusMapeamento: c.status_mapeamento || 'referencia',
        })),
        resumoComponentes: {
          perfis: componentes.filter(c => c.tipo === 'perfil').length,
          acessorios: componentes.filter(c => c.tipo === 'acessorio').length,
          vidros: componentes.filter(c => c.tipo === 'vidro').length,
          mapeados: componentes.filter(c => Boolean(c.produto_atlas_id)).length,
        },
      }
    }

    return NextResponse.json({ ok: true, referencias })
  } catch (error) {
    console.error('Erro ao carregar referências W.Vetro para orçamento:', error)
    return NextResponse.json({ error: 'Não foi possível carregar as referências W.Vetro.' }, { status: 500 })
  }
}
