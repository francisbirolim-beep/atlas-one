// Favoritos de setores: lista de ids marcados pelo usuario com a estrela,
// salva no localStorage do navegador (por dispositivo/usuario logado).
// Segue o mesmo padrao usado em lib/guias.ts para os favoritos da sidebar.

const CHAVE_FAVORITOS_SETORES = 'atlas_setores_favoritos'
export const EVENTO_FAVORITOS_SETORES_MUDOU = 'atlas-setores-favoritos-changed'

export function lerFavoritosSetores(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const bruto = window.localStorage.getItem(CHAVE_FAVORITOS_SETORES)
    if (!bruto) return []
    const lista = JSON.parse(bruto)
    return Array.isArray(lista) ? lista : []
  } catch {
    return []
  }
}

function salvarFavoritosSetores(lista: string[]) {
  try {
    window.localStorage.setItem(CHAVE_FAVORITOS_SETORES, JSON.stringify(lista))
    window.dispatchEvent(new Event(EVENTO_FAVORITOS_SETORES_MUDOU))
  } catch {}
}

// Adiciona ou remove um setor da lista de favoritos e retorna a lista atualizada.
export function alternarFavoritoSetor(setorId: string): string[] {
  const atuais = lerFavoritosSetores()
  const novo = atuais.includes(setorId)
    ? atuais.filter((id) => id !== setorId)
    : [...atuais, setorId]
  salvarFavoritosSetores(novo)
  return novo
}
