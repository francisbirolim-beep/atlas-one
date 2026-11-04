// Cálculos somente de leitura. Não altera títulos, baixas ou saldos.
export type TipoConta='pagar'|'receber'
export type TituloFinanceiro={
 id:string;tipo:TipoConta;pessoaId:string|null;pessoa:string;documento:string|null;
 emissao:string|null;vencimento:string|null;dataPagamento:string|null;
 valor:number;pago:number;desconto:number;saldo:number;
 status:string;forma:string|null;parcela:number|null;totalParcelas:number|null;
 referencia:string|null;obraId:string|null;observacoes:string|null;
}
export type MovimentoFinanceiro={
 id:string;tipo:TipoConta;pessoa:string;data:string;valor:number;forma:string|null;
 referencia:string|null;tituloId:string|null;formas?:Array<{forma:string;valor:number;parcelas?:number|null}>
}
export type Faixa='vencidas'|'ate7'|'ate30'|'mais30'|'semData'
export type ResumoFinanceiro={
 aberto:number;vencidas:number;ate7:number;ate30:number;mais30:number;semData:number;
 parciais:number;inconsistentes:number;quitados:number;
 realizadoPeriodo:number;previstoPeriodo:number;quantidade:number;
}
export type RankingFinanceiro={id:string;nome:string;saldo:number;titulos:number}
const arredondar=(n:number)=>Math.round((n+Number.EPSILON)*100)/100
export function quantia(v:unknown):number{
 const n=Number(v??0)
 return Number.isFinite(n)?Math.max(0,n):0
}
export function normalizarTitulo(raw:Record<string,unknown>,tipo:TipoConta):TituloFinanceiro{
 const valor=quantia(raw.valor)
 const pago=quantia(raw.valor_pago)
 const desconto=tipo==='receber'?quantia(raw.valor_desconto):0
 const nome=String((tipo==='pagar'?raw.fornecedor_nome:raw.cliente_nome)||'Não informado')
 return {
  id:String(raw.id||''),tipo,pessoaId:String((tipo==='pagar'?raw.fornecedor_id:raw.cliente_id)||'')||null,
  pessoa:nome,documento:String(raw.documento||'')||null,
  emissao:String(raw.data_emissao||'')||null,vencimento:String(raw.vencimento||'')||null,
  dataPagamento:String(raw.data_pagamento||'')||null,
  valor,pago,desconto,saldo:arredondar(Math.max(0,valor-pago-desconto)),
  status:String(raw.status||'aberto'),forma:String((tipo==='pagar'?raw.forma_pagamento:raw.forma)||'')||null,
  parcela:raw.parcela===null||raw.parcela===undefined?null:Number(raw.parcela),
  totalParcelas:raw.total_parcelas===null||raw.total_parcelas===undefined?null:Number(raw.total_parcelas),
  referencia:String(raw.origem||'')||null,obraId:String(raw.obra_id||'')||null,
  observacoes:String(raw.observacoes||'')||null,
 }
}
export function ativa(t:TituloFinanceiro):boolean{
 return t.status!=='cancelado'&&t.status!=='estornado'
}
export function aberta(t:TituloFinanceiro):boolean{
 return ativa(t)&&t.saldo>0.009
}
export function faixaVencimento(t:TituloFinanceiro,hoje:string):Faixa|null{
 if(!aberta(t))return null
 if(!t.vencimento)return 'semData'
 const venc=t.vencimento.slice(0,10)
 if(venc<hoje)return 'vencidas'
 const diff=Math.round((Date.parse(venc+'T12:00:00Z')-Date.parse(hoje+'T12:00:00Z'))/86400000)
 return diff<=7?'ate7':diff<=30?'ate30':'mais30'
}
export function noPeriodo(d:string|null,inicio:string,fim:string):boolean{
 if(!d)return false
 const iso=d.slice(0,10)
 return iso>=inicio&&iso<=fim
}
export function resumirTitulos(titulos:TituloFinanceiro[],hoje:string,inicio:string,fim:string,movimentos:MovimentoFinanceiro[]):ResumoFinanceiro{
 const resultado:ResumoFinanceiro={aberto:0,vencidas:0,ate7:0,ate30:0,mais30:0,semData:0,parciais:0,inconsistentes:0,quitados:0,realizadoPeriodo:0,previstoPeriodo:0,quantidade:0}
 for(const t of titulos){
  if(!ativa(t))continue
  resultado.quantidade++
  if(t.status==='pago'&&t.saldo>0.009)resultado.inconsistentes++
  if(t.saldo<0.01){resultado.quitados++;continue}
  resultado.aberto+=t.saldo
  if(t.pago>0)resultado.parciais++
  const faixa=faixaVencimento(t,hoje)
  if(faixa)resultado[faixa]+=t.saldo
  if(noPeriodo(t.vencimento,inicio,fim))resultado.previstoPeriodo+=t.saldo
 }
 resultado.realizadoPeriodo=movimentos.filter(x=>noPeriodo(x.data,inicio,fim)).reduce((s,x)=>s+x.valor,0)
 for(const chave of ['aberto','vencidas','ate7','ate30','mais30','semData','realizadoPeriodo','previstoPeriodo'] as const){
  resultado[chave]=arredondar(resultado[chave])
 }
 return resultado
}
export function rankingDevedores(titulos:TituloFinanceiro[]):RankingFinanceiro[]{
 const m=new Map<string,RankingFinanceiro>()
 for(const t of titulos){
  if(!aberta(t))continue
  const chave=t.pessoaId||'nome:'+t.pessoa.trim().toLocaleLowerCase('pt-BR')
  const atual=m.get(chave)||{id:chave,nome:t.pessoa,saldo:0,titulos:0}
  atual.saldo=arredondar(atual.saldo+t.saldo);atual.titulos++
  m.set(chave,atual)
 }
 return [...m.values()].sort((a,b)=>b.saldo-a.saldo||a.nome.localeCompare(b.nome,'pt-BR'))
}
export function previsaoMensal(titulos:TituloFinanceiro[],inicio:string,fim:string){
 const valores=new Map<string,{mes:string;valor:number;titulos:number}>()
 for(const t of titulos){
  if(!aberta(t)||!noPeriodo(t.vencimento,inicio,fim))continue
  const mes=t.vencimento!.slice(0,7)
  const atual=valores.get(mes)||{mes,valor:0,titulos:0}
  atual.valor=arredondar(atual.valor+t.saldo);atual.titulos++
  valores.set(mes,atual)
 }
 return [...valores.values()].sort((a,b)=>a.mes.localeCompare(b.mes))
}
export function hojeSaoPaulo(d:Date=new Date()):string{
 const partes=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d)
 const get=(k:string)=>partes.find(p=>p.type===k)?.value||''
 return [get('year'),get('month'),get('day')].join('-')
}
