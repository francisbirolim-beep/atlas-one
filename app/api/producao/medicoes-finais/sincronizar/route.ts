import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { usuarioPodeAcaoServer } from '@/lib/acessoUsuarioServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { medicoesElegiveisParaProducao } from '@/lib/producaoMedicaoElegibilidade'
import { executarAutomacaoMedidaFinal } from '@/lib/medicaoFinalAutomacaoServer'
import { idCardMedicaoFinal } from '@/lib/idCardMedicaoFinal'

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
    const corpo = await req.json().catch(() => ({}))
    const medicaoId = typeof corpo?.medicaoId === 'string' ? corpo.medicaoId.trim() : null
    if (medicaoId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(medicaoId)) {
      return NextResponse.json({ error: 'Identificador de medição inválido.' }, { status: 400 })
    }
    const acoesPermitidas = medicaoId
      ? [
          ['producao','producao.geral.editar'],
          ['medida-final-msdwtt9y','producao.medida_final.preencher'],
          ['medida-final-msdwtt9y','producao.medida_final.editar'],
          ['medida-final-msdwtt9y','producao.medida_final.aprovar'],
        ]
      : [['producao','producao.geral.editar']]
    // Esta API grava com credencial administrativa, portanto jamais deve
    // sincronizar um quadro por solicitação de quem possui somente consulta.
    let autorizado = false
    try {
      const verificacoes = await Promise.all(acoesPermitidas.map(([setorId,acaoId]) =>
        usuarioPodeAcaoServer({usuarioId:usuario.id,role:usuario.role,empresaId:usuario.empresa_id,
          setorId,acaoId,minimo:'edicao'})))
      autorizado = verificacoes.some(Boolean)
    } catch {
      return NextResponse.json({error:'Não foi possível conferir a autorização de sincronização.'},{status:503})
    }
    if (!autorizado) return NextResponse.json({error:'Sem permissão para sincronizar a Produção.'},{status:403})
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
      .order('concluido_em', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
    if (medicaoId) consultaMedicoes = consultaMedicoes.eq('id', medicaoId)
    const { data: medicoes, error: erroMedicoes } = await consultaMedicoes
    if (erroMedicoes) throw erroMedicoes
    // Além de medições concluídas, incluir medições parciais com ao menos
    // uma peça medida e aprovada. Não cria card para unidades sem aprovação.
    let consultaAprovadas = supabaseAdmin.from('medicao_itens')
      .select('medicao_id').eq('empresa_id', usuario.empresa_id)
      .eq('medido', true).eq('status_medicao', 'aprovada').eq('quantidade', 1).limit(2000)
    if (medicaoId) consultaAprovadas = consultaAprovadas.eq('medicao_id', medicaoId)
    const { data: itensAprovados, error: erroAprovados } = await consultaAprovadas
    if (erroAprovados) throw erroAprovados
    const idsParciais = [...new Set((itensAprovados || []).map(i => i.medicao_id))]
    const { data: medicoesParciais, error: erroParciais } = idsParciais.length
      ? await supabaseAdmin.from('medicoes_finais')
          .select('id,orcamento_id,cliente_id,cliente_nome,obra_id,status_operacional,concluido_em,aprovado_em,created_at')
          .eq('empresa_id', usuario.empresa_id).eq('tipo_medicao', 'tipologia')
          .in('id', idsParciais)
      : { data: [], error: null }
    if (erroParciais) throw erroParciais
    // A validação original de medição completa continua obrigatória para
    // cards completos. Apenas as unidades aprovadas entram como parciais.
    const idsMedicoes = (medicoes||[]).map(m=>m.id)
    const {data:unidades,error:erroUnidades}=idsMedicoes.length
      ?await supabaseAdmin.from('medicao_itens')
       .select('medicao_id,medido,quantidade')
       .eq('empresa_id',usuario.empresa_id).in('medicao_id',idsMedicoes)
      :{data:[],error:null}
    if(erroUnidades)throw erroUnidades
    const elegiveis = medicoesElegiveisParaProducao(medicoes || [], unidades || [])
    // Não enfraquecer a regra de medição completa; somar somente posições
    // parcialmente medidas E aprovadas individualmente.
    const todasMedicoes = [...new Map([...elegiveis, ...(medicoesParciais || [])]
      .map(m => [m.id, m])).values()]
    if (medicaoId && todasMedicoes.length === 0) {
      return NextResponse.json({
        error: 'Esta medição não tem posições integralmente concluídas nem peças aprovadas para separação.',
      }, { status: 409 })
    }

    let criados = 0
    let atualizados = 0
    let ignorados = 0

    for (const medicao of todasMedicoes) {
      // A identificação é pela Medição Final, nunca só pelo orçamento:
      // dois envios do mesmo orçamento não podem sobrescrever o card um do outro.
      const marcador = '[medicao:' + medicao.id + ']'
      const { data: existente, error: erroExistente } = await supabaseAdmin
        .from('setor_kanban_itens')
        .select('id,coluna_id,liberado_producao_em')
        .eq('empresa_id', usuario.empresa_id)
        .in('coluna_id', idsColunas)
        .ilike('descricao', '%' + marcador + '%')
        .limit(1)
        .maybeSingle()
      if (erroExistente) throw erroExistente

      const descricao = [
        'Medição Final enviada — aguardando liberação da Produção.',
        `[medicao:${medicao.id}]`,
      ].join('\n')

      if (existente?.id) {
        // Não mover nem alterar um card que a equipe já pode ter trabalhado.
        ignorados += 1
        continue
      }

      // Idempotência no banco, inclusive em dois envios simultâneos:
      // a chave é a empresa + a medição, nunca a venda ou orçamento.
      const cardId = idCardMedicaoFinal(usuario.empresa_id, medicao.id)
      const { error: erroInsert } = await supabaseAdmin
        .from('setor_kanban_itens')
        .insert({
          id: cardId,
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
      if (erroInsert) {
        if (erroInsert.code !== '23505') throw erroInsert

        // Só tratar como reenvio quando a colisão é o mesmo card da
        // mesma medição e empresa, jamais qualquer outro erro unique.
        const { data: cardJaCriado, error: erroCardDuplicado } = await supabaseAdmin
          .from('setor_kanban_itens')
          .select('id')
          .eq('empresa_id', usuario.empresa_id)
          .eq('id', cardId)
          .ilike('descricao', '%' + marcador + '%')
          .maybeSingle()
        if (erroCardDuplicado || !cardJaCriado) throw erroInsert
        ignorados += 1
        continue
      }
      criados += 1
    }

    // Dispara somente para a medição enviada explicitamente. Sincronizações
    // em lote não devem gerar notificações retroativas de obras antigas.
    let automacao:{ativa:boolean;criadas:number;existentes:number;erro?:string}={
      ativa:false,criadas:0,existentes:0,
    }
    if(medicaoId&&todasMedicoes.some(m=>m.id===medicaoId)&&
      criados+atualizados+ignorados>0){
      try{
       automacao=await executarAutomacaoMedidaFinal(
        usuario.empresa_id,medicaoId,{id:usuario.id,nome:usuario.nome})
      }catch(e){
       console.error('Automação Medida Final: card mantido, atribuições pendentes',e)
       automacao={ativa:true,criadas:0,existentes:0,erro:'Tarefas pendentes: confira a automação.'}
      }
    }
    return NextResponse.json({
      ok: true,
      automacao,
      colunaEntrada,
      criados,
      atualizados,
      ignorados,
      totalMedicoes: todasMedicoes.length,
      medicoesElegiveis: todasMedicoes.length,
      ...(medicaoId ? { medicaoSincronizada: criados + atualizados + ignorados > 0 } : {}),
    })
  } catch (error: any) {
    console.error('Erro ao sincronizar Medição Final com Produção:', {
      mensagem: error?.message || String(error),
      codigo: error?.code || null,
    })
    return NextResponse.json({ error: 'Não foi possível sincronizar as Medições Finais com a Produção.' }, { status: 500 })
  }
}
