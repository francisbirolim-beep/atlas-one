import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

type Action = 'enviar' | 'aprovar' | 'remediar' | 'sincronizar_contramarco'

async function autenticar(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const { data: authData } = await supabaseAdmin.auth.getUser(token)
  if (!authData?.user) return null

  const { data: usuario } = await supabaseAdmin
    .from('usuarios')
    .select('id,nome,role,empresa_id')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (!usuario?.empresa_id) return null
  return usuario
}

async function proximaVersao(medicaoId: string) {
  const { data } = await supabaseAdmin
    .from('medicao_revisoes')
    .select('versao')
    .eq('medicao_id', medicaoId)
    .order('versao', { ascending: false })
    .limit(1)

  return (data?.[0]?.versao || 0) + 1
}

async function criarSnapshot(medicaoId: string, usuario: any, motivo: string) {
  const [{ data: medicao }, { data: itens }] = await Promise.all([
    supabaseAdmin.from('medicoes_finais').select('*').eq('id', medicaoId).maybeSingle(),
    supabaseAdmin.from('medicao_itens').select('*').eq('medicao_id', medicaoId).order('ordem', { ascending: true }),
  ])
  if (!medicao) return null

  const versao = await proximaVersao(medicaoId)
  const { data, error } = await supabaseAdmin
    .from('medicao_revisoes')
    .insert({
      medicao_id: medicaoId,
      versao,
      motivo,
      snapshot: { medicao, itens: itens || [] },
      criado_por_id: usuario.id,
      criado_por_nome: usuario.nome,
    })
    .select('id,versao')
    .single()

  if (error) throw error
  return data
}

function numero(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function itemRef(item: any, indice: number) {
  return String(item?.id || `item-${indice + 1}`)
}

async function sincronizarOrdensContramarco(
  medicao: { id: string; empresa_id: string; orcamento_id?: string | null; tipo_medicao?: string | null; status_operacional?: string | null },
  usuario: { id: string; nome: string; empresa_id: string },
) {
  if (medicao.tipo_medicao !== 'contramarco') {
    return { ok: false as const, code: 'TIPO_INVALIDO', error: 'Esta medição não é de contramarco.' }
  }
  if (medicao.status_operacional !== 'contramarco_aprovado') {
    return { ok: false as const, code: 'MEDICAO_NAO_APROVADA', error: 'A medição de contramarco precisa estar aprovada antes de liberar a produção.' }
  }
  if (!medicao.orcamento_id) {
    return { ok: false as const, code: 'SEM_ORCAMENTO', error: 'Medição avulsa não gera ordem automática de produção.' }
  }

  const [{ data: venda }, { data: orcamento }, { data: itensMedicao }, { data: colunasProducao }] = await Promise.all([
    supabaseAdmin
      .from('vendas_obras')
      .select('id,cliente_id,obra_id,versao')
      .eq('orcamento_id', medicao.orcamento_id)
      .eq('empresa_id', usuario.empresa_id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('orcamentos')
      .select('id,itens')
      .eq('id', medicao.orcamento_id)
      .eq('empresa_id', usuario.empresa_id)
      .maybeSingle(),
    supabaseAdmin
      .from('medicao_itens')
      .select('id,ordem,tipo_esquadria,tipo_outro_texto,descricao,ambiente,quantidade,contramarco,producao_largura_mm,producao_altura_mm,medido,status_medicao')
      .eq('medicao_id', medicao.id)
      .eq('empresa_id', usuario.empresa_id)
      .order('ordem', { ascending: true }),
    supabaseAdmin
      .from('setor_kanban_colunas')
      .select('id')
      .eq('empresa_id', usuario.empresa_id)
      .eq('setor_id', 'producao'),
  ])

  if (!venda?.id) {
    return { ok: false as const, code: 'VENDA_OPERACIONAL_AUSENTE', error: 'Confirme a venda antes de liberar a produção de contramarcos.' }
  }
  if (!orcamento) {
    return { ok: false as const, code: 'ORCAMENTO_NAO_ENCONTRADO', error: 'Orçamento da medição não encontrado.' }
  }

  const idsColunas = (colunasProducao || []).map((coluna: any) => coluna.id)
  const { data: cardProducao } = idsColunas.length
    ? await supabaseAdmin
        .from('setor_kanban_itens')
        .select('id')
        .eq('empresa_id', usuario.empresa_id)
        .eq('orcamento_id', medicao.orcamento_id)
        .in('coluna_id', idsColunas)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
    : { data: null }

  if (!cardProducao?.id) {
    return {
      ok: false as const,
      code: 'PROJETO_NAO_CONFERIDO',
      error: 'A medição está aprovada, mas o Projeto ainda precisa ser conferido para criar o card de Produção.',
    }
  }

  const itensBase = Array.isArray(orcamento.itens) ? orcamento.itens : []
  const itens = Array.isArray(itensMedicao) ? itensMedicao : []
  const mapeados: Array<{ medicao: any; base: any; ref: string; indice: number }> = []

  for (const med of itens) {
    const ordem = Math.max(0, Math.floor(numero(med?.ordem)))
    const indice = ordem >= 100 ? Math.floor(ordem / 100) : ordem
    const base = itensBase[indice]
    if (!base) {
      return { ok: false as const, code: 'MAPEAMENTO_INVALIDO', error: `Não foi possível ligar a posição ${ordem + 1} ao item vendido. Nada foi liberado.` }
    }
    const tipoMed = String(med?.tipo_esquadria || '').trim()
    const tipoBase = String(base?.tipo_esquadria || '').trim()
    if (tipoMed && tipoBase && tipoMed !== tipoBase) {
      return { ok: false as const, code: 'MAPEAMENTO_DIVERGENTE', error: `A posição ${ordem + 1} diverge da tipologia vendida. Confira antes de liberar.` }
    }
    mapeados.push({ medicao: med, base, ref: itemRef(base, indice), indice })
  }

  const { data: revisao } = await supabaseAdmin
    .from('venda_obra_revisoes')
    .select('id')
    .eq('empresa_id', usuario.empresa_id)
    .eq('venda_obra_id', venda.id)
    .order('versao', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let liberadas = 0
  let canceladas = 0

  for (const linha of mapeados) {
    const med = linha.medicao
    const usaContramarco = med?.contramarco === 'sim'
    const { data: existente } = await supabaseAdmin
      .from('ordens_producao')
      .select('id,status')
      .eq('empresa_id', usuario.empresa_id)
      .eq('venda_obra_id', venda.id)
      .eq('item_ref', linha.ref)
      .eq('tipo_producao', 'contramarco')
      .maybeSingle()

    if (!usaContramarco) {
      if (existente?.id && !['concluida', 'cancelada'].includes(String(existente.status || ''))) {
        const { error } = await supabaseAdmin
          .from('ordens_producao')
          .update({
            status: 'cancelada',
            bloqueada: true,
            bloqueio_motivo: 'Item definido como sem contramarco na medição aprovada.',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existente.id)
          .eq('empresa_id', usuario.empresa_id)
        if (error) return { ok: false as const, code: 'ERRO_ORDEM', error: error.message }
        canceladas += 1
      }
      continue
    }

    const largura = numero(med?.producao_largura_mm)
    const altura = numero(med?.producao_altura_mm)
    if (!med?.medido || largura <= 0 || altura <= 0) {
      return { ok: false as const, code: 'MEDIDA_INVALIDA', error: `Contramarco de ${med?.ambiente || med?.descricao || linha.ref} sem medida de produção válida.` }
    }

    if (existente?.id && existente.status === 'concluida') {
      return {
        ok: false as const,
        code: 'ORDEM_CONCLUIDA',
        error: `A ordem de contramarco de ${med?.ambiente || med?.descricao || linha.ref} já foi concluída. Abra uma revisão antes de alterar a medida.`,
      }
    }

    const tituloBase = String(
      linha.base?.tipo_outro_texto ||
      linha.base?.tipo_esquadria ||
      linha.base?.descricao ||
      linha.base?.ambiente ||
      `Item ${linha.indice + 1}`
    )
    const snapshot = {
      ...linha.base,
      contramarco: 'sim',
      medicao_contramarco: {
        medicao_id: medicao.id,
        medicao_item_id: med.id,
        largura_mm: largura,
        altura_mm: altura,
        aprovado_em: new Date().toISOString(),
      },
    }
    const payload = {
      empresa_id: usuario.empresa_id,
      setor_card_id: cardProducao.id,
      cliente_id: venda.cliente_id || null,
      obra_id: venda.obra_id || null,
      venda_obra_id: venda.id,
      orcamento_id: medicao.orcamento_id,
      revisao_id: revisao?.id || null,
      item_ref: linha.ref,
      item_snapshot: snapshot,
      tipo_producao: 'contramarco',
      titulo: `Contramarco — ${tituloBase}`,
      quantidade: Math.max(1, numero(med?.quantidade) || numero(linha.base?.quantidade) || 1),
      largura_mm: largura,
      altura_mm: altura,
      status: 'liberada',
      bloqueada: false,
      bloqueio_motivo: null,
      origem: 'medicao_contramarco',
      criado_por_id: usuario.id,
      criado_por_nome: usuario.nome,
      updated_at: new Date().toISOString(),
    }

    if (existente?.id) {
      const { error } = await supabaseAdmin
        .from('ordens_producao')
        .update(payload)
        .eq('id', existente.id)
        .eq('empresa_id', usuario.empresa_id)
      if (error) return { ok: false as const, code: 'ERRO_ORDEM', error: error.message }
    } else {
      const { error } = await supabaseAdmin
        .from('ordens_producao')
        .insert(payload)
      if (error) return { ok: false as const, code: 'ERRO_ORDEM', error: error.message }
    }
    liberadas += 1
  }

  return { ok: true as const, liberadas, canceladas, cardProducaoId: cardProducao.id }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await autenticar(req)
    if (!usuario) return NextResponse.json({ error: 'Sessao invalida.' }, { status: 401 })

    const { id } = await context.params
    const body = await req.json().catch(() => ({}))
    const action = body?.action as Action

    const { data: medicao } = await supabaseAdmin
      .from('medicoes_finais')
      .select('id,empresa_id,orcamento_id,status_operacional,tipo_medicao')
      .eq('id', id)
      .eq('empresa_id', usuario.empresa_id)
      .maybeSingle()

    if (!medicao) return NextResponse.json({ error: 'Medicao Final nao encontrada.' }, { status: 404 })

    if (action === 'sincronizar_contramarco') {
      const resultado = await sincronizarOrdensContramarco(medicao as any, usuario as any)
      return NextResponse.json(resultado, { status: resultado.ok ? 200 : resultado.code === 'PROJETO_NAO_CONFERIDO' ? 409 : 400 })
    }

    if (action === 'enviar') {
      if (medicao.orcamento_id) {
        const { data: venda } = await supabaseAdmin
          .from('vendas_obras')
          .select('id')
          .eq('orcamento_id', medicao.orcamento_id)
          .eq('empresa_id', usuario.empresa_id)
          .limit(1)
          .maybeSingle()

        if (!venda?.id) {
          return NextResponse.json({
            error: 'Este orçamento ainda não entrou no fluxo Vendido. Confirme a venda antes de enviar a medição para liberação.',
            code: 'VENDA_OPERACIONAL_AUSENTE',
            orcamentoId: medicao.orcamento_id,
          }, { status: 409 })
        }
      }

      const { data: itens } = await supabaseAdmin
        .from('medicao_itens')
        .select('id,medido,status_medicao')
        .eq('medicao_id', id)

      if (!itens?.length) return NextResponse.json({ error: 'A medicao nao possui posicoes.' }, { status: 400 })
      const prontas = itens.filter(i => i.medido && i.status_medicao === 'concluida')
      if (!prontas.length) {
        return NextResponse.json({ error: 'Nao existem posicoes concluidas aguardando envio.' }, { status: 409 })
      }

      await criarSnapshot(id, usuario, prontas.length === itens.length ? 'Envio para conferencia' : 'Envio parcial para conferencia')
      const { data: colunaFinalizada } = await supabaseAdmin
        .from('medicao_colunas')
        .select('id')
        .eq('empresa_id', usuario.empresa_id)
        .ilike('nome', '%finalizada%')
        .order('ordem', { ascending: false })
        .limit(1)
        .maybeSingle()

      const { error } = await supabaseAdmin
        .from('medicoes_finais')
        .update({
          status_operacional: 'aguardando_conferencia',
          coluna_id: colunaFinalizada?.id || undefined,
          coluna_atualizada_em: colunaFinalizada?.id ? new Date().toISOString() : undefined,
        })
        .eq('id', id)
        .eq('empresa_id', usuario.empresa_id)

      if (error) throw error
      await supabaseAdmin
        .from('medicao_itens')
        .update({ status_medicao: 'aguardando_conferencia', updated_at: new Date().toISOString() })
        .eq('medicao_id', id)
        .eq('medido', true)
        .eq('status_medicao', 'concluida')

      return NextResponse.json({ ok: true, action, enviados: prontas.length, pendentes: itens.length - prontas.length })
    }

    const itemId = String(body?.itemId || '')
    if (!itemId) return NextResponse.json({ error: 'itemId obrigatorio.' }, { status: 400 })

    const { data: item } = await supabaseAdmin
      .from('medicao_itens')
      .select('*')
      .eq('id', itemId)
      .eq('medicao_id', id)
      .maybeSingle()

    if (!item) return NextResponse.json({ error: 'Posicao nao encontrada nesta Medicao Final.' }, { status: 404 })

    if (action === 'aprovar') {
      if (!item.medido) return NextResponse.json({ error: 'A posicao ainda nao possui medida concluida.' }, { status: 409 })
      await criarSnapshot(id, usuario, `Aprovacao da posicao: ${item.descricao || item.tipo_esquadria}`)
      const { error } = await supabaseAdmin
        .from('medicao_itens')
        .update({
          status_medicao: 'aprovada',
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId)
        .eq('medicao_id', id)
      if (error) throw error

      const { data: restantes } = await supabaseAdmin
        .from('medicao_itens')
        .select('id,status_medicao')
        .eq('medicao_id', id)
        .neq('status_medicao', 'aprovada')

      let producaoContramarco: any = null
      if (!restantes?.length) {
        const statusFinal = medicao.tipo_medicao === 'contramarco' ? 'contramarco_aprovado' : 'aprovado'
        await supabaseAdmin
          .from('medicoes_finais')
          .update({
            status_operacional: statusFinal,
            aprovado_em: new Date().toISOString(),
            aprovado_por_id: usuario.id,
            aprovado_por_nome: usuario.nome,
          })
          .eq('id', id)
          .eq('empresa_id', usuario.empresa_id)

        if (medicao.tipo_medicao === 'contramarco') {
          producaoContramarco = await sincronizarOrdensContramarco(
            { ...(medicao as any), status_operacional: 'contramarco_aprovado' },
            usuario as any,
          )
        }
      }

      return NextResponse.json({ ok: true, action, allApproved: !restantes?.length, producaoContramarco })
    }

    if (action === 'remediar') {
      const motivo = String(body?.motivo || '').trim()
      if (!motivo) return NextResponse.json({ error: 'Informe o motivo da nova medicao.' }, { status: 400 })

      await criarSnapshot(id, usuario, `Remediacao solicitada: ${motivo}`)
      const { error: itemError } = await supabaseAdmin
        .from('medicao_itens')
        .update({
          status_medicao: 'remedicao_solicitada',
          medido: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId)
        .eq('medicao_id', id)
      if (itemError) throw itemError

      const { error: medicaoError } = await supabaseAdmin
        .from('medicoes_finais')
        .update({ status_operacional: 'com_pendencia' })
        .eq('id', id)
        .eq('empresa_id', usuario.empresa_id)

      if (medicaoError) throw medicaoError

      const { error: pendenciaError } = await supabaseAdmin
        .from('medicao_pendencias')
        .insert({
          medicao_id: id,
          item_id: itemId,
          categoria: 'remedicao',
          descricao: motivo,
          status: 'aberta',
          responsavel_solucao: item.medido_por_nome || null,
          criado_por_id: usuario.id,
          criado_por_nome: usuario.nome,
        })

      if (pendenciaError) throw pendenciaError

      return NextResponse.json({ ok: true, action })
    }

    return NextResponse.json({ error: 'Acao de conferencia invalida.' }, { status: 400 })
  } catch (error) {
    console.error('Erro na conferencia da Medicao Final:', error)
    return NextResponse.json({ error: 'Erro interno ao processar a conferencia.' }, { status: 500 })
  }
}
