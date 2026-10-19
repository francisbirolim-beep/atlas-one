export type PeriodoPreset = 'todos' | 'hoje' | 'semana' | 'mes' | 'proximo_mes' | 'personalizado'
export type PeriodoFinanceiro = { inicio:string; fim:string; preset:PeriodoPreset }
export function isoLocal(d:Date):string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
export function periodoRapido(preset:PeriodoPreset, atual:Date=new Date()):PeriodoFinanceiro {
  const d=new Date(atual.getFullYear(),atual.getMonth(),atual.getDate());
  if(preset==='todos'||preset==='personalizado')return {inicio:'',fim:'',preset}
  if(preset==='hoje')return {inicio:isoLocal(d),fim:isoLocal(d),preset}
  if(preset==='semana') {
    const dia=(d.getDay()+6)%7;const ini=new Date(d.getFullYear(),d.getMonth(),d.getDate()-dia)
    const fim=new Date(ini.getFullYear(),ini.getMonth(),ini.getDate()+6)
    return {inicio:isoLocal(ini),fim:isoLocal(fim),preset}
  }
  const primeiro=preset==='proximo_mes'?new Date(d.getFullYear(),d.getMonth()+1,1):new Date(d.getFullYear(),d.getMonth(),1)
  const ultimo=new Date(primeiro.getFullYear(),primeiro.getMonth()+1,0)
  return {inicio:isoLocal(primeiro),fim:isoLocal(ultimo),preset}
}
export function noPeriodo(data:string|null|undefined,inicio:string,fim:string) {
  if(!inicio&&!fim)return true
  if(!data)return false
  const d=data.slice(0,10)
  return (!inicio||d>=inicio)&&(!fim||d<=fim)
}
export function tituloPeriodo(p:PeriodoFinanceiro){return p.inicio||p.fim?`${p.inicio||'início'} a ${p.fim||'sem limite'}`:'Todos os vencimentos'}
export function dinheiro(v:number){return (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
export function formatarData(v?:string|null){return v?`${v.slice(8,10)}/${v.slice(5,7)}/${v.slice(0,4)}`:'—'}
export function csvFinanceiro(linhas:(string|number|null|undefined)[][]):string {
  return '\ufeff'+linhas.map(row=>row.map(v=>{let t=String(v??'');if(/^[=+\-@\t\r]/.test(t))t="'"+t;return `"${t.replace(/"/g,'""')}"`}).join(';')).join('\r\n')
}
export function baixarCSV(nome:string,conteudo:string){
  const link=document.createElement('a')
  const href=URL.createObjectURL(new Blob([conteudo],{type:'text/csv;charset=utf-8;'}))
  link.href=href;link.download=nome;link.click();URL.revokeObjectURL(href)
}
