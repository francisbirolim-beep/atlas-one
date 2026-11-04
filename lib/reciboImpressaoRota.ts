/** Página de impressão independente do painel, sem menus de usuários. */
export function rotaReciboAutenticado(pathname: string): boolean {
  return /^\/financeiro\/recibo\/(?:consolidado|(?:receber|pagar)\/[^/]+)\/?$/.test(pathname)
    || /^\/clientes\/[^/]+\/vendas\/[^/]+\/recibo\/[^/]+\/?$/.test(pathname)
}
