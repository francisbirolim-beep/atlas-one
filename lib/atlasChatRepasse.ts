export type RepasseConfig = {
  modo: 'disponibilizar' | 'automatico'
  prazoMinutos: number
  destinoId: string | null
}
type Conversa = {
  id: string; empresa_id: string; whatsapp_canal_id?: string | null; whatsapp_chat_tipo?: string | null
  responsavel_id?: string | null; status?: string | null; ocultar_da_caixa?: boolean | null
  ultima_entrada_em?: string | null; ultima_saida_em?: string | null
}
type Contexto = {
  empresa: string; canalPrincipal: string; centralId: string; secundarios: readonly string[]
  usuariosAutorizados: readonly string[]; config: RepasseConfig; ativo: boolean
  agora: number
}
export function destinoRepasseAtlas(c: Conversa, ctx: Contexto): string | null {
  const d=ctx.config.destinoId
  if(!ctx.ativo||ctx.config.modo!=='automatico'||!d||!ctx.centralId||d===ctx.centralId||
    !ctx.secundarios.includes(d)||!ctx.usuariosAutorizados.includes(d))return null
  if(!ctx.empresa||!ctx.canalPrincipal||c.empresa_id!==ctx.empresa||
    c.whatsapp_canal_id!==ctx.canalPrincipal||c.whatsapp_chat_tipo!=='contato'||
    c.responsavel_id!==ctx.centralId||c.status!=='aguardando'||c.ocultar_da_caixa)return null
  const prazo=ctx.config.prazoMinutos
  const entrada=Date.parse(c.ultima_entrada_em||''),saida=Date.parse(c.ultima_saida_em||'')
  if(!Number.isInteger(prazo)||prazo<1||prazo>1440||!Number.isFinite(entrada)||!Number.isFinite(ctx.agora)||
    (Number.isFinite(saida)&&saida>=entrada)||ctx.agora-entrada<prazo*60000)return null
  return d
}
export function validarRepasseAtlas(config:RepasseConfig,centralId:string|null,secundarios:readonly string[]){
  return Number.isInteger(config.prazoMinutos)&&config.prazoMinutos>=1&&config.prazoMinutos<=1440&&
    (config.modo==='disponibilizar'&&config.destinoId===null||
    config.modo==='automatico'&&!!centralId&&!!config.destinoId&&config.destinoId!==centralId&&secundarios.includes(config.destinoId))
}
