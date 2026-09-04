import '@/lib/tipos'

declare module '@/lib/tipos' {
  interface ItemEsquadria {
    /** Tipo de medição específico desta esquadria no pedido. */
    tipo_medida?: 'comum' | 'final' | null
  }
}
