export type RepeticaoEquipe = 'uma_vez' | 'semanal' | 'mensal' | 'dia_util_mes'
const ZONA = 'America/Sao_Paulo'

// Converte uma data civil de São Paulo em instante UTC sem depender do TZ do servidor.
// O Brasil não aplica horário de verão em 2026. Usar Date.UTC evita drift com o servidor da Vercel.
export function instanteSaoPaulo(ano: number, mes: number, dia: number, hora: number, minuto: number) {
  return new Date(Date.UTC(ano, mes - 1, dia, hora + 3, minuto))
}
export function camposSaoPaulo(valor: string | Date) {
  const d = typeof valor === 'string' ? new Date(valor) : valor
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d)
  const numero = (tipo: string) => Number(partes.find(p => p.type === tipo)?.value || 0)
  return { ano: numero('year'), mes: numero('month'), dia: numero('day'), hora: numero('hour'), minuto: numero('minute') }
}
function pascoa(ano: number) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19*a + b-d-g+15)%30
  const i = Math.floor(c/4), k=c%4
  const l=(32+2*e+2*i-h-k+7)%7
  const m=Math.floor((a+11*h+22*l)/451)
  const mes=Math.floor((h+l-7*m+114)/31)
  const dia=((h+l-7*m+114)%31)+1
  return new Date(Date.UTC(ano,mes-1,dia,12))
}
function dataUTCdia(d: Date, deslocamento: number) {
  const nova = new Date(d)
  nova.setUTCDate(nova.getUTCDate() + deslocamento)
  return `${nova.getUTCMonth()+1}-${nova.getUTCDate()}`
}
function feriadoBancario(ano: number, mes: number, dia: number) {
  const fixos = new Set(['1-1','4-21','5-1','9-7','10-12','11-2','11-15','11-20','12-25'])
  const chave = `${mes}-${dia}`
  if (fixos.has(chave)) return true
  const dataPascoa = pascoa(ano)
  return [-48,-47,-2,60].some(offset => dataUTCdia(dataPascoa,offset)===chave)
}
export function quintoDiaUtil(ano: number, mes: number, indice = 5) {
  let n = 0
  const total = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  for(let dia=1;dia<=total;dia++) {
    const diaSemana = new Date(Date.UTC(ano,mes-1,dia)).getUTCDay()
    if(diaSemana===0||diaSemana===6||feriadoBancario(ano,mes,dia)) continue
    n++
    if(n===indice) return dia
  }
  return total
}

export function gerarDatasEquipe(inicioISO: string, tipo: RepeticaoEquipe, valor?: number, diasSemana: number[] = [], meses = 6): string[] {
  const inicio = new Date(inicioISO)
  if(Number.isNaN(inicio.getTime())) return []
  if(tipo==='uma_vez') return [inicio.toISOString()]
  const base = camposSaoPaulo(inicio)
  const limite = new Date(inicio)
  limite.setUTCMonth(limite.getUTCMonth()+meses)
  const datas = new Set<string>()
  const add = (ano:number, mes:number, dia:number) => {
    if(dia<1||dia>new Date(Date.UTC(ano,mes,0)).getUTCDate()) return
    const valor = instanteSaoPaulo(ano,mes,dia,base.hora,base.minuto)
    if(valor>=inicio&&valor<=limite) datas.add(valor.toISOString())
  }
  if(tipo==='semanal') {
    const dias = diasSemana.length?diasSemana:[new Date(Date.UTC(base.ano,base.mes-1,base.dia)).getUTCDay()]
    const data = new Date(Date.UTC(base.ano,base.mes-1,base.dia,12))
    const maxDias=Math.min(4000,Math.ceil((limite.getTime()-inicio.getTime())/86400000)+2)
    for(let i=0;i<=maxDias;i++){
      if(i>0)data.setUTCDate(data.getUTCDate()+1)
      if(dias.includes(data.getUTCDay())) add(data.getUTCFullYear(),data.getUTCMonth()+1,data.getUTCDate())
      if(instanteSaoPaulo(data.getUTCFullYear(),data.getUTCMonth()+1,data.getUTCDate(),base.hora,base.minuto)>limite) break
    }
  }else{
    for(let i=0;i<=meses+1;i++) {
      const d = new Date(Date.UTC(base.ano,base.mes-1+i,1))
      const ano=d.getUTCFullYear(), mes=d.getUTCMonth()+1
      const dia=tipo==='dia_util_mes'?quintoDiaUtil(ano,mes,valor||5)
        :Math.min(valor||base.dia,new Date(Date.UTC(ano,mes,0)).getUTCDate())
      add(ano,mes,dia)
    }
  }
  return [...datas].sort()
}
