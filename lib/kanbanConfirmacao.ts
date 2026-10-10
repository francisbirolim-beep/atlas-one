/**
 * Atlas One: confirmação obrigatória antes de persistir arrasto.
 * Retorno de etapa preserva histórico. Transações efetivas exigem estorno formal.
 */
export function confirmarMovimentoKanban(opcoes: {
  card: string; origem: string; destino: string; retrocesso?: boolean; aviso?: string
}): boolean {
  const {card, origem, destino, retrocesso, aviso} = opcoes
  return window.confirm([
    'Confirmar movimentação do Kanban?',
    '',
    card,
    origem + ' → ' + destino,
    retrocesso ? '\nRetorno de etapa: documentos, pedidos enviados, pagamentos e estoque já movimentado exigem conferência ou estorno específico. Nenhum histórico será apagado.' : '',
    aviso || '',
    '\nCancelar mantém o card na etapa anterior.',
  ].filter(Boolean).join('\n'))
}
