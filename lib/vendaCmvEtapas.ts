// Todos os lançamentos manuais possuem exatamente UM destino.
// Antes da migração: destino ausente => comprado, preservando o histórico.
export function separarEtapasCmv<T extends {valor:number;etapa_cmv?:string|null}>(lancamentos:readonly T[]){
 const comprados=lancamentos.filter(l=>l.etapa_cmv!=='recebido')
 const recebidos=lancamentos.filter(l=>l.etapa_cmv==='recebido')
 return {
  comprados,recebidos,
  totalComprado:comprados.reduce((s,l)=>s+Number(l.valor||0),0),
  totalRecebido:recebidos.reduce((s,l)=>s+Number(l.valor||0),0)
 }
}
