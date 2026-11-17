import { createHash } from 'crypto'
import { supabaseAdmin as db } from './supabaseAdmin'

// Cartão específico da etapa parcial. O envio total cria outro cartão para
// que a tarefa final seja visível mesmo após a conferência da parcial.
function idDaTarefa(medicaoId: string, usuarioId: string) {
  const bytes = createHash('sha256').update(`atlas:medicao:revisao-parcial:${medicaoId}:${usuarioId}`).digest()
  bytes[6] = (bytes[6] & 0x0f) | 0x80
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`
}

export async function validarDestinatariosParcial(empresaId: string, ids: string[]) {
  const unicos = [...new Set(ids)]
  if (!unicos.length || unicos.length > 15 || unicos.some(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
    return { ok: false as const, error: 'Selecione de 1 a 15 responsáveis válidos para a conferência.' }
  }
  const { data: usuarios, error } = await db.from('usuarios')
    .select('id,nome').eq('empresa_id', empresaId).in('id', unicos)
  if (error) throw error
  if ((usuarios || []).length !== unicos.length) {
    return { ok: false as const, error: 'Um dos responsáveis não pertence à empresa.' }
  }
  return { ok: true as const, usuarios: usuarios || [] }
}

export async function avisarConferenciaParcial(
  empresaId: string,
  medicao: { id: string; cliente_id?: string | null; cliente_nome?: string | null; obra_id?: string | null; orcamento_id?: string | null },
  solicitante: { id: string; nome: string },
  usuarios: { id: string; nome: string }[],
  documentadas: number,
  total: number,
) {
  const { data: obra } = medicao.obra_id
    ? await db.from('obras').select('nome').eq('empresa_id', empresaId).eq('id', medicao.obra_id).maybeSingle()
    : { data: null }
  const nomeObra = obra?.nome || medicao.cliente_nome || 'Obra'
  const href = `/producao/medicao-final/${medicao.id}`
  let criadas = 0
  let existentes = 0
  for (const usuario of usuarios) {
    const tarefaId = idDaTarefa(medicao.id, usuario.id)
    const { data: jaExiste, error: erroBusca } = await db.from('tarefas')
      .select('id').eq('id', tarefaId).eq('empresa_id', empresaId).maybeSingle()
    if (erroBusca) throw erroBusca
    if (!jaExiste) {
      const { data: colunas, error: erroColunas } = await db.from('tarefa_colunas')
        .select('id').eq('empresa_id', empresaId).eq('usuario_id', usuario.id)
        .order('ordem', { ascending: true }).limit(1)
      if (erroColunas) throw erroColunas
      let colunaId = colunas?.[0]?.id
      if (!colunaId) {
        const { data: nova, error: erroCriarColuna } = await db.from('tarefa_colunas')
          .insert({ empresa_id: empresaId, usuario_id: usuario.id, nome: 'A fazer', ordem: 0 })
          .select('id').single()
        if (erroCriarColuna) throw erroCriarColuna
        colunaId = nova.id
      }
      const { error: erroTarefa } = await db.from('tarefas').insert({
        id: tarefaId, empresa_id: empresaId, usuario_id: usuario.id, coluna_id: colunaId,
        titulo: `Conferir Medida Final (parcial) · ${nomeObra}`,
        descricao: `[atlas-medicao-final:${medicao.id}]\nMedição parcial: ${documentadas} de ${total} peça(s) documentada(s).\nCliente: ${medicao.cliente_nome || '—'}\nObra: ${nomeObra}\nAbrir medição: ${href}\nVerificar fotos e medidas e completar o checklist técnico antes de aprovar ou liberar fabricação.`,
        prioridade: 'alta', solicitante_id: solicitante.id, solicitante_nome: solicitante.nome,
        atribuida_em: new Date().toISOString(), orcamento_id: medicao.orcamento_id,
        cliente_id: medicao.cliente_id, obra_id: medicao.obra_id,
      })
      if (erroTarefa && erroTarefa.code !== '23505') throw erroTarefa
      if (erroTarefa) existentes++
      else criadas++
    } else existentes++

    const { error: erroNotificacao } = await db.from('notificacoes').insert({
      empresa_id: empresaId, usuario_id: usuario.id, categoria: 'operacao', tipo: 'tarefa',
      titulo: 'Medição Final parcial para conferir',
      mensagem: `Recebida medição parcial de ${nomeObra}: ${documentadas} de ${total} peça(s) com registro. Checklists técnicos ainda precisam ser conferidos.`,
      href, origem_tipo: 'medicao_final_parcial', origem_id: medicao.id,
      criado_por_id: solicitante.id, criado_por_nome: solicitante.nome,
    })
    if (erroNotificacao && erroNotificacao.code !== '23505') throw erroNotificacao
  }
  return { criadas, existentes, notificados: usuarios.length }
}
