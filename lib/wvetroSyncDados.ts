// Consultas administrativas devem percorrer todo o catálogo, não só o limite REST.
export async function lerTodasPaginas<T>(consulta: (inicio: number, fim: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const resultado: T[] = []
  const tamanho = 500
  for (let inicio = 0; ; inicio += tamanho) {
    const { data, error } = await consulta(inicio, inicio + tamanho - 1)
    if (error) throw error
    resultado.push(...(data || []))
    if (!data || data.length < tamanho) return resultado
  }
}

export function mensagemErroWVetro(erro: unknown): string {
  if (erro && typeof erro === 'object' && 'message' in erro && typeof erro.message === 'string') return erro.message
  return 'Erro sem mensagem disponível.'
}

export function candidatosUnicos<T extends { id: string }>(itens: T[]): T[] {
  return Array.from(new Map(itens.map(item => [item.id, item])).values())
}

export function normalizarLinhaWVetro(nome: unknown): string {
  return String(nome || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toUpperCase()
}
