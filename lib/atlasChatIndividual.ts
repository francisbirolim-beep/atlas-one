export type ChatScope = { id: string; empresa_id: string }
export type ChatRow = { id: string; empresa_id: string; responsavel_id?: string | null; whatsapp_canal_id?: string | null; whatsapp_chat_tipo?: string | null; ocultar_da_caixa?: boolean | null }
export function conversaDoAtlasChat(c: ChatRow, u: ChatScope, principal: string) {
  return Boolean(principal && c.empresa_id === u.empresa_id && c.responsavel_id === u.id && c.whatsapp_canal_id === principal && c.whatsapp_chat_tipo === 'contato' && !c.ocultar_da_caixa)
}
export function telefoneAtlasChat(raw: string) {
  if (!/^[+\d\s().-]+$/.test(raw.trim())) return ''
  let n = raw.replace(/\D/g, '')
  if (n.length === 10 || n.length === 11) n = '55' + n
  return /^55[1-9]\d{9,10}$/.test(n) ? n : ''
}
export function destinoAtlasChat(responsavel: string | null, autorizados: ReadonlySet<string>) {
  return responsavel && autorizados.has(responsavel) ? responsavel : null
}

// A central continua responsável por qualquer contato sem vínculo ou de terceiros.
export function aberturaContatoAtlasChat(rows: ChatRow[], u: ChatScope, principal: string): 'novo' | 'proprio' | 'central' {
  if (!rows.length) return 'novo'
  if (rows.length !== 1 || !conversaDoAtlasChat(rows[0], u, principal)) return 'central'
  return 'proprio'
}
export function telefoneLiberadoNoPiloto(telefone: string, lista: string) {
  const n = telefoneAtlasChat(telefone)
  return Boolean(n && lista.split(',').map(telefoneAtlasChat).includes(n))
}
