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

export async function GET(req: NextRequest) {
  if (!await autenticar(req)) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  try {
    const [{ data: refs, error: erroRefs }, { data: vars, error: erroVars }] = await Promise.all([
      supabaseAdmin
        .from('wvetro_referencias_tipologias')
        .select('id,tipologia_atlas_id,linha_raw,modelo_raw,imagem_url,ocorrencias,status_mapeamento')
        .not('tipologia_atlas_id', 'is', null),
      supabaseAdmin
        .from('wvetro_referencias_variaveis')
        .select('id,referencia_tipologia_id,tipologia_atlas_id,variavel_atlas_id,variavel_chave_raw,variavel_label_raw,valor_raw,valor_normalizado,origem_tipo,confianca,evidencia,status_mapeamento')
        .neq('status_mapeamento', 'descartada'),
    ])
    if (erroRefs) throw erroRefs
    if (erroVars) throw erroVars

    const variaveisPorRef = new Map<string, RefVariavel[]>()
    for (const variavel of (vars || []) as RefVariavel[]) {
      const lista = variaveisPorRef.get(variavel.referencia_tipologia_id) || []
      lista.push(variavel)
      variaveisPorRef.set(variavel.referencia_tipologia_id, lista)
    }

    const referencias: Record<string, unknown> = {}
    for (const ref of (refs || []) as RefTipologia[]) {
      if (!ref.tipologia_atlas_id) continue
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
      }
    }

    return NextResponse.json({ ok: true, referencias })
  } catch (error) {
    console.error('Erro ao carregar referências W.Vetro para orçamento:', error)
    return NextResponse.json({ error: 'Não foi possível carregar as referências W.Vetro.' }, { status: 500 })
  }
}
