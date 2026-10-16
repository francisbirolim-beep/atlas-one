export type EscopoIA = 'nenhum' | 'proprio' | 'setor' | 'empresa'

const ordem: Record<EscopoIA, number> = { nenhum: 0, proprio: 1, setor: 2, empresa: 3 }

/** A configuração específica só restringe o teto já autorizado pelo Atlas. */
export function restringirEscopoIA(base: EscopoIA, override?: { permitido?: unknown; escopo?: unknown } | null): EscopoIA {
  if (!override) return base
  const escopo = override.escopo
  if (override.permitido !== true || typeof escopo !== 'string' || !Object.prototype.hasOwnProperty.call(ordem, escopo)) return 'nenhum'
  const configurado = escopo as EscopoIA
  return ordem[configurado] < ordem[base] ? configurado : base
}
