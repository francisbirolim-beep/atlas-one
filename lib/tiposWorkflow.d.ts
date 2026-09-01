import './tipos'

declare module './tipos' {
  interface SetorKanbanItem {
    cliente_id?: string | null
    obra_id?: string | null
    responsavel_id?: string | null
    responsavel_nome?: string | null
    atualizado_por_id?: string | null
    atualizado_por_nome?: string | null
  }
}

export {}
