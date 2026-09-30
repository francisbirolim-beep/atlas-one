/** Only the canonical measurement detail route can mount measurement controls. */
export function medicaoIdDaRota(pathname: string): string | null {
  return pathname.match(/^\/producao\/medicao-final\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i)?.[1] || null
}
