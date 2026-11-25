export type VinculoAtlas = { empresa_id:string; canal_id:string; telefone:string; responsavel_id:string|null }
export type ContextoVinculo = {
  ativo:boolean; empresa:string; canal:string; principal:boolean; telefone:string; grupo:boolean;
  vinculo:VinculoAtlas|null; existente?:{status?:string|null;responsavel_id?:string|null}|null;
  responsavelAutorizado:boolean; centralId:string|null
}
export function normalizarVinculoAtlas(raw:string) {
  if (!/^[+\d\s().-]+$/.test(raw.trim())) return ''
  let n=raw.replace(/\D/g,'')
  if(n.length===10||n.length===11)n='55'+n
  return /^55[1-9]\d{9,10}$/.test(n)?n:''
}
// undefined = manter a regra antiga; null = fila geral sem responsável.
export function destinoVinculoAtlas(c:ContextoVinculo): string|null|undefined {
  if(!c.ativo||!c.principal||c.grupo||!c.vinculo||!c.empresa||!c.canal)return undefined
  if(c.vinculo.empresa_id!==c.empresa||c.vinculo.canal_id!==c.canal||
      c.vinculo.telefone!==normalizarVinculoAtlas(c.telefone)||!c.vinculo.telefone)return undefined
  // Não substituir atendimentos ativos, nem os que aguardam resposta de outro atendente.
  if(c.existente&&c.existente.status!=='finalizado')return undefined
  return c.vinculo.responsavel_id&&c.responsavelAutorizado?c.vinculo.responsavel_id:c.centralId
}
