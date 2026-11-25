// Compartilha somente uma leitura em andamento por chave. Sem cache de dados.
export function leiturasEmCurso<T>() {
  const pendentes = new Map<string, Promise<T>>()
  return (chave: string, ler: () => Promise<T>): Promise<T> => {
    const atual = pendentes.get(chave)
    if (atual) return atual
    const pedido = Promise.resolve().then(ler)
    pendentes.set(chave, pedido)
    const limpar = () => { if (pendentes.get(chave) === pedido) pendentes.delete(chave) }
    void pedido.then(limpar, limpar)
    return pedido
  }
}
