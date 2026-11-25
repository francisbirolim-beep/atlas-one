// Controle de homologação: nenhum usuário é habilitado por padrão.
// Não usar esta lista como substituto das permissões de atendimento existentes.
export function usuariosPiloto() {
  return new Set((process.env.ATLAS_CHAT_USUARIOS || '').split(',').map(s => s.trim()).filter(Boolean))
}
export function entradaProducaoAtiva(){
 return process.env.VERCEL_ENV==='production'&&process.env.ATLAS_CHAT_ENTRADA_PRODUCAO==='true'&&!!process.env.ATLAS_CHAT_EMPRESA_PILOTO
}
export function pilotoSomenteLeitura() {
  return entradaProducaoAtiva()||process.env.ATLAS_CHAT_SOMENTE_LEITURA === 'true'
}
export function pilotoAtivo() {
  return entradaProducaoAtiva()||(process.env.ATLAS_CHAT_PILOTO === 'true' &&
    (!pilotoSomenteLeitura() || process.env.VERCEL_ENV === 'preview'))
}
export function escopoPilotoLeitura(empresa:string,usuario:string) {
  return !pilotoSomenteLeitura() || (pilotoAtivo() &&
    empresa === process.env.ATLAS_CHAT_EMPRESA_PILOTO && usuariosPiloto().has(usuario))
}
export function atalhoAtlasChat(id: string) {
  return '/atlas-chat?usuario=' + encodeURIComponent(id)
}

// Mantém todas as proteções do preview somente leitura, exceto o envio manual
// para uma conversa de teste explicitamente autorizada pelo Master.
export function pilotoTesteEnvio() {
  return pilotoAtivo() && pilotoSomenteLeitura() &&
    process.env.VERCEL_ENV==='preview' && process.env.ATLAS_CHAT_TESTE_MANUAL==='true'
}

export function equipePilotoAtivo(){
 return entradaProducaoAtiva()||(pilotoAtivo()&&pilotoSomenteLeitura()&&process.env.VERCEL_ENV==='preview'&&process.env.ATLAS_CHAT_ACESSO_EQUIPE==='true')
}
export function equipePilotoEmpresa(empresa:string){
 return equipePilotoAtivo()&&!!empresa&&empresa===process.env.ATLAS_CHAT_EMPRESA_PILOTO
}
