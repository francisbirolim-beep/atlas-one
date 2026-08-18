import '@/lib/tipos'

declare module '@/lib/tipos' {
  interface ItemEsquadria {
    // Snapshot do fluxo Linha -> Tipologia -> Configuracao. Campos opcionais
    // preservam compatibilidade com orcamentos antigos.
    linha_id?: string | null
    linha_nome?: string | null
    tipologia_id?: string | null
    configuracao_preset_id?: string | null
    configuracao_nome?: string | null
    configuracao_validada?: boolean
    modo_configuracao?: 'rapido' | 'assistido'
    configuracao_status?: 'pendente' | 'preenchida' | 'validada'
    variaveis?: Record<string, string>
  }
}

export {}
