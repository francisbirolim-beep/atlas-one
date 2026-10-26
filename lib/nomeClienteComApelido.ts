/** Apresenta o cliente pelo nome cadastrado, seguido do apelido quando informado. */
export function nomeClienteComApelido(nome?: string | null, apelido?: string | null): string {
  const nomeLimpo = (nome || '').trim() || 'CLIENTE'
  const apelidoLimpo = (apelido || '').trim()
  if (!apelidoLimpo || nomeLimpo.toLocaleLowerCase('pt-BR') === apelidoLimpo.toLocaleLowerCase('pt-BR')) {
    return nomeLimpo
  }
  return `${nomeLimpo} (${apelidoLimpo})`
}
