// Separação somente leitura: cancelamento mantém registro e auditoria,
// mas não participa dos somatórios operacionais e gerenciais.
export function separarLancamentosCmv<T extends {cancelado_em?:string|null}>(linhas:readonly T[]){
 return {
  ativos:linhas.filter(l=>!l.cancelado_em),
  excluidos:linhas.filter(l=>Boolean(l.cancelado_em)),
 }
}
