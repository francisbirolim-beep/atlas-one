import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { neonStaging, statusNeonStaging } from '@/lib/neonStaging'
import { compararItemWVetroComFormulaAtlas, inferirOpcoesTecnicasWVetro, type FormulaAtlasComparacao, type WVetroItemTecnico } from '@/lib/wvetroComparadorTecnico'
import { FIXTURE_PC2_SUPREMA_ATLAS, FIXTURE_PC2_SUPREMA_WVETRO } from '@/lib/wvetroComparadorFixtures'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function autenticarMaster(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return null
  const { data: usuario } = await supabaseAdmin
    .from('usuarios')
    .select('id,nome,role,empresa_id')
    .eq('id', data.user.id)
    .maybeSingle()
  if (!usuario || usuario.role !== 'master') return null
  return usuario
}

function rankStatus(status: string | null | undefined) {
  const mapa: Record<string, number> = { validada: 0, em_validacao: 1, referencia: 2, em_desenvolvimento: 3 }
  return mapa[String(status || '')] ?? 9
}

function formulaDoBanco(row: any): FormulaAtlasComparacao {
  return {
    tipologia_id: row.tipologia_id,
    configuracao_label: row.configuracao_label || 'Padrão',
    variaveis: Array.isArray(row.variaveis) ? row.variaveis : [],
    pecas: Array.isArray(row.pecas) ? row.pecas : [],
    vidro: row.vidro && typeof row.vidro === 'object' && !Array.isArray(row.vidro) ? row.vidro : {},
    acessorios: Array.isArray(row.acessorios) ? row.acessorios : [],
  }
}

function itensDoPayload(payload: any): WVetroItemTecnico[] {
  const itens = Array.isArray(payload?.Itens) ? payload.Itens : []
  return itens.filter((x: unknown) => x && typeof x === 'object') as WVetroItemTecnico[]
}

async function carregarFormula(item: WVetroItemTecnico, formulaId?: string) {
  if (formulaId) {
    const { data, error } = await supabaseAdmin
      .from('engenharia_tipologia_formulas_corte')
      .select('id,tipologia_id,configuracao_label,status,ativo,variaveis,pecas,vidro,acessorios')
      .eq('id', formulaId)
      .maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Fórmula Atlas não encontrada.')
    const { data: irmas, error: erroIrmas } = await supabaseAdmin
      .from('engenharia_tipologia_formulas_corte')
      .select('id,tipologia_id,configuracao_label,status,ativo,variaveis,pecas,vidro,acessorios')
      .eq('tipologia_id', data.tipologia_id)
    if (erroIrmas) throw erroIrmas
    const disponiveis = [...(irmas || [])].sort((a: any, b: any) => {
      const ativo = Number(Boolean(b.ativo)) - Number(Boolean(a.ativo))
      return ativo !== 0 ? ativo : rankStatus(a.status) - rankStatus(b.status)
    }).map((f: any) => ({
      id: f.id,
      configuracao_label: f.configuracao_label,
      status: f.status,
      ativo: f.ativo,
    }))
    return { formula: formulaDoBanco(data), formulaBanco: data, referencia: null, disponiveis }
  }

  const { data: referencia, error: refError } = await supabaseAdmin
    .from('wvetro_referencias_tipologias')
    .select('id,linha_raw,modelo_raw,tipologia_atlas_id,status_mapeamento')
    .eq('linha_raw', String(item.Linha || ''))
    .eq('modelo_raw', String(item.Modelo || ''))
    .maybeSingle()

  if (refError) throw refError
  if (!referencia?.tipologia_atlas_id) throw new Error('A tipologia W.Vetro ainda não está vinculada a uma tipologia Atlas.')

  const { data: formulas, error } = await supabaseAdmin
    .from('engenharia_tipologia_formulas_corte')
    .select('id,tipologia_id,configuracao_label,status,ativo,variaveis,pecas,vidro,acessorios')
    .eq('tipologia_id', referencia.tipologia_atlas_id)
  if (error) throw error

  const ordenadas = [...(formulas || [])].sort((a: any, b: any) => {
    const ativo = Number(Boolean(b.ativo)) - Number(Boolean(a.ativo))
    return ativo !== 0 ? ativo : rankStatus(a.status) - rankStatus(b.status)
  })
  if (!ordenadas.length) throw new Error('A tipologia Atlas vinculada ainda não possui fórmula técnica.')

  return {
    formula: formulaDoBanco(ordenadas[0]),
    formulaBanco: ordenadas[0],
    referencia,
    disponiveis: ordenadas.map((f: any) => ({
      id: f.id,
      configuracao_label: f.configuracao_label,
      status: f.status,
      ativo: f.ativo,
    })),
  }
}

function opcoesDaUrl(req: NextRequest): Record<string, string> {
  const raw = String(req.nextUrl.searchParams.get('opcoes') || '').trim()
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, valor]) => typeof valor === 'string')
        .map(([chave, valor]) => [chave, String(valor)])
    )
  } catch {
    throw new Error('Opções técnicas inválidas.')
  }
}

export async function GET(req: NextRequest) {
  const usuario = await autenticarMaster(req)
  if (!usuario) return NextResponse.json({ error: 'Acesso restrito a usuário master.' }, { status: 401 })

  const modo = String(req.nextUrl.searchParams.get('modo') || 'fixture')
  try {
    if (modo === 'fixture') {
      const resultado = compararItemWVetroComFormulaAtlas({
        item: FIXTURE_PC2_SUPREMA_WVETRO,
        formula: FIXTURE_PC2_SUPREMA_ATLAS,
      })
      return NextResponse.json({
        ok: true,
        modo: 'fixture',
        origem: 'Amostra técnica sanitizada do histórico W.Vetro',
        resultado,
        formula: {
          id: 'fixture-pc2-suprema',
          configuracao_label: FIXTURE_PC2_SUPREMA_ATLAS.configuracao_label,
          status: 'snapshot_validada',
          ativo: true,
        },
        formulasDisponiveis: [],
      })
    }

    const neon = statusNeonStaging()
    if (!neon.configurado) return NextResponse.json({ error: 'Staging Neon não configurado para consulta histórica real.' }, { status: 503 })

    const numero = String(req.nextUrl.searchParams.get('numero') || '').trim()
    const itemId = String(req.nextUrl.searchParams.get('itemId') || '').trim()
    const formulaId = String(req.nextUrl.searchParams.get('formulaId') || '').trim() || undefined
    const opcoesInformadas = opcoesDaUrl(req)
    if (!numero) return NextResponse.json({ error: 'Informe o número do orçamento/pedido W.Vetro.' }, { status: 400 })

    const sql = neonStaging()
    const rows = await sql`
      select recurso, chave_externa_canonica as chave, payload
      from wvetro_migracao.raw_canonico
      where recurso in ('orcamentos','pedidos')
        and payload->>'Nro' = ${numero}
      order by case when recurso='orcamentos' then 0 else 1 end
      limit 1
    `
    const registro = rows[0] as any
    if (!registro) return NextResponse.json({ error: 'Registro W.Vetro não encontrado no staging.' }, { status: 404 })

    const itens = itensDoPayload(registro.payload)
    const item = itemId ? itens.find((x: any) => String(x.Id || '') === itemId) : itens[0]
    if (!item) return NextResponse.json({ error: 'Item técnico não encontrado neste registro.' }, { status: 404 })

    const carregada = await carregarFormula(item, formulaId)
    const inferencia = inferirOpcoesTecnicasWVetro(item, carregada.formula, opcoesInformadas)
    const resultado = compararItemWVetroComFormulaAtlas({
      item,
      formula: carregada.formula,
      opcoes: inferencia.opcoes,
    })

    return NextResponse.json({
      ok: true,
      modo: 'historico',
      origem: { recurso: registro.recurso, chave: registro.chave, numero },
      resultado,
      referencia: carregada.referencia,
      formula: {
        id: carregada.formulaBanco.id,
        configuracao_label: carregada.formulaBanco.configuracao_label,
        status: carregada.formulaBanco.status,
        ativo: carregada.formulaBanco.ativo,
      },
      variaveis: carregada.formula.variaveis,
      opcoes: inferencia.opcoes,
      inferencias: inferencia.inferencias,
      formulasDisponiveis: carregada.disponiveis,
      itensDisponiveis: itens.map((x: any) => ({
        id: String(x.Id || ''),
        nome: String(x.Nome || ''),
        modelo: String(x.Modelo || ''),
        linha: String(x.Linha || ''),
        largura: Number(x.Largura || 0),
        altura: Number(x.Altura || 0),
      })),
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha no comparador técnico.' }, { status: 500 })
  }
}
