import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SETOR = 'producao'
const NOME_ENTRADA = 'Liberar Produção'

function normalizar(v: unknown) {
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

async function garantirColunaEntrada(empresaId: string) {
  const { data: colunas, error } = await supabaseAdmin
    .from('setor_kanban_colunas')
    .select('id,nome,ordem')
    .eq('empresa_id', empresaId)
    .eq('setor_id', SETOR)
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error

  if (!colunas?.length) {
    const { data, error: insertError } = await supabaseAdmin
      .from('setor_kanban_colunas')
      .insert({ empresa_id: empresaId, setor_id: SETOR, nome: NOME_ENTRADA, ordem: 0 })
      .select('id,nome,ordem')
      .single()
    if (insertError) throw insertError
    return data
  }

  const primeira = colunas[0]
  const atual = normalizar(primeira.nome)
  if (['a fazer', 'aguardando producao', 'aguardando produção'].map(normalizar).includes(atual)) {
    const { data, error: updateError } = await supabaseAdmin
      .from('setor_kanban_colunas')
      .update({ nome: NOME_ENTRADA })
      .eq('empresa_id', empresaId)
      .eq('id', primeira.id)
      .select('id,nome,ordem')
      .single()
    if (updateError) throw updateError
    return data
  }

  return primeira
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  try {
    // A conclusão de uma medição sincroniza apenas ela; a tela da Produção
    // continua podendo recuperar itens pendentes em lote (sem reposicioná-los).
    const corpo = await req.json().catch(() => ({}))
    const medicaoId = typeof corpo?.medicaoId === 'string' ? corpo.medicaoId.trim() : ''
    if (medicaoId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(medicaoId)) {
      return NextResponse.json({ error: 'Identificador de medição inválido.' }, { status: 400 })
    }
    const colunaEntrada = await garantirColunaEntrada(usuario.empresa_id)

    const { data: colunasProducao, error: erroColunas } = await supabaseAdmin
      .from('setor_kanban_colunas')
      .select('id')
      .eq('empresa_id', usuario.empresa_id)
      .eq('setor_id', SETOR)
    if (erroColunas) throw erroColunas
    const idsColunas = (colunasProducao || []).map((c: any) => c.id)

    let consultaMedicoes = supabaseAdmin
      .from('medicoes_finais')
      .select('id,orcamento_id,cliente_id,cliente_nome,obra_id,status_operacional,concluido_em,aprovado_em,created_at')
      .eq('empresa_id', usuario.empresa_id)
      .eq('tipo_medicao', 'tipologia')
      .in('status_operacional', ['concluido', 'aguardando_conferencia', 'aprovado'])
    if (medicaoId) consultaMedicoes = consultaMedicoes.eq('id', medicaoId)
    const { data: medicoes, error: erroMedicoes } = await consultaMedicoes
      .order('concluido_em', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
    if (erroMedicoes) throw erroMedicoes
    if (medicaoId && !medicoes?.length) {
      return NextResponse.json({ error: 'Medição não encontrada ou ainda não concluída.' }, { status: 404 })
    }

    let criados = 0
    let atualizados = 0
    let ignorados = 0

    for (const medicao of medicoes || []) {
      let existente: any = null

      if (medicao.orcamento_id && idsColunas.length) {
        const { data, error: erroBusca } = await supabaseAdmin
          .from('setor_kanban_itens')
          .select('id,coluna_id,liberado_producao_em,descricao')
          .eq('empresa_id', usuario.empresa_id)
          .eq('orcamento_id', medicao.orcamento_id)
          .in('coluna_id', idsColunas)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()
        if (erroBusca) throw erroBusca // não criar duplicata se a consulta falhar
        existente = data
      } else if (idsColunas.length) {
        const marcador = `[medicao:${medicao.id}]`
        const { data, error: erroBusca } = await supabaseAdmin
          .from('setor_kanban_itens')
          .select('id,coluna_id,liberado_producao_em,descricao')
          .eq('empresa_id', usuario.empresa_id)
          .in('coluna_id', idsColunas)
          .ilike('descricao', `%${marcador}%`)
          .limit(1)
          .maybeSingle()
        if (erroBusca) throw erroBusca
        existente = data
      }

      const descricao = [
        'Medição Final enviada — aguardando liberação da Produção.',
        `[medicao:${medicao.id}]`,
      ].join('\n')

      if (existente?.id) {
        // Nunca devolver um card para a entrada, substituir sua descrição
        // editada ou remover o estágio escolhido pela equipe.
        ignorados += 1
        continue
      }

      const { error: erroInsert } = await supabaseAdmin
        .from('setor_kanban_itens')
        .insert({
          empresa_id: usuario.empresa_id,
          titulo: medicao.cliente_nome || 'Medição Final',
          descricao,
          coluna_id: colunaEntrada.id,
          cliente_id: medicao.cliente_id || null,
          obra_id: medicao.obra_id || null,
          orcamento_id: medicao.orcamento_id || null,
          criado_por_id: usuario.id,
          criado_por_nome: usuario.nome,
          atualizado_por_id: usuario.id,
          atualizado_por_nome: usuario.nome,
        })
      if (erroInsert) throw erroInsert
      criados += 1
    }

    return NextResponse.json({
      ok: true,
      colunaEntrada,
      criados,
      atualizados,
      ignorados,
      totalMedicoes: medicoes?.length || 0,
    })
  } catch (error: any) {
    console.error('Erro ao sincronizar Medição Final com Produção:', {
      mensagem: error?.message || String(error),
      codigo: error?.code || null,
    })
    return NextResponse.json({ error: 'Não foi possível sincronizar as Medições Finais com a Produção.' }, { status: 500 })
  }
}
