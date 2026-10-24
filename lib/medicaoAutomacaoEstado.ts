export type ResultadoAutomacaoApi = {
  ativa?: boolean
  criadas?: number
  existentes?: number
  total?: number
  erro?: string
}

export function avaliarEstadoAutomacaoMedicao(data: ResultadoAutomacaoApi | null | undefined) {
  const mensagemBase = 'Medição Final confirmada no Kanban de Produção.'
  if (!data || data.ativa === false) {
    return { ativa: false, pendente: false, mensagem: mensagemBase }
  }
  if (data.erro) {
    return {
      ativa: true, pendente: true,
      mensagem: mensagemBase + ' Tarefas e notificações pendentes. Use Conferir / reenviar à Produção para tentar novamente.',
    }
  }
  const total = Number(data.total)
  const criadas = Number(data.criadas) || 0
  const existentes = Number(data.existentes) || 0
  if (!Number.isFinite(total) || total < 1 || criadas + existentes < total) {
    return {
      ativa: true, pendente: true,
      mensagem: mensagemBase + ' Não foi possível confirmar todas as tarefas. Reenvie à Produção para conferir.',
    }
  }
  return {
    ativa: true, pendente: false,
    mensagem: mensagemBase + ' ' + criadas + ' tarefa(s) criada(s), ' + existentes + ' já existente(s); responsáveis notificados.',
  }
}
