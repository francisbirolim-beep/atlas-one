// Conferência W.Vetro SOMENTE LEITURA. Não recalcular venda, margem ou custos
// a partir do Atlas e não publicar diferenças como lançamentos financeiros.
type Registro = Record<string, unknown>
const objeto=(x:unknown):Registro=>x&&typeof x==='object'&&!Array.isArray(x)?x as Registro:{}
const array=(x:unknown)=>Array.isArray(x)?x:[]
const string=(x:unknown)=>String(x??'').trim()
function moeda(x:unknown):number|null{
 if(x==null||x==='')return null
 if(typeof x==='number')return Number.isFinite(x)?Math.round(x*100)/100:null
 let s=string(x).replace(/[^0-9,.-]/g,'')
 if(!s)return null
 if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'')
 else if(s.includes(','))s=s.replace(/\./g,'').replace(',','.')
 const n=Number(s)
 return Number.isFinite(n)?Math.round(n*100)/100:null
}
const soma=(numeros:(number|null)[]):number|null=>numeros.every(n=>n!==null)?Math.round(numeros.reduce<number>((a,b)=>a+Number(b),0)*100)/100:null
const diff=(a:number|null,b:number|null)=>a===null||b===null?null:Math.round((a-b)*100)/100
export type ItemWVetroConferido={
 chaveWVetro:string|null; ordem:number; codigo:string; descricao:string; quantidade:number;
 custoWVetro:number|null; vendaWVetro:number|null;
 vendaAtlas:number|null; custoAtlas:number|null;
 imagemUrl:string|null
}
export type WVetroConferencia={
 numero:string; fonte:'importacao_atlas'|'consulta_ao_vivo'; dataCaptura:string|null;
 itens:ItemWVetroConferido[];
 totais:{
  custoTipologias:number|null; vendaTipologias:number|null;
  custoGeralWVetro:number|null; custoAlternativoWVetro:number|null;
  vendaBrutaWVetro:number|null; descontoWVetro:number|null; vendaLiquidaWVetro:number|null;
  vendaAtlas:number|null; custoAtlas:number|null;
  diferencaCustoGeralTipologias:number|null; diferencaVendaBrutaTipologias:number|null;
  diferencaVendaAtlas:number|null; diferencaCustoAtlas:number|null;
 };
 alertas:string[];
}
export function construirConferenciaWVetro(
 entrada:{fluxo:unknown;itensAtlas:unknown;vendaAtlas:unknown;custoAtlas:unknown;historico?:unknown;fonte?:WVetroConferencia['fonte']},
):WVetroConferencia|null{
 const fluxo=objeto(entrada.fluxo)
 const bruto=objeto(fluxo.payload_bruto||entrada.fluxo)
 const originais=array(bruto.Itens)
 if(!originais.length)return null
 const itensAtlas=array(entrada.itensAtlas)
 const tipologias:ItemWVetroConferido[]=originais.map((registro,i)=>{
  const w=objeto(registro)
  // Seleção pela ordem técnica importada. Não misturar tipologias de nomes similares.
  const itemAtlas=itensAtlas.map(objeto).find(a=>string(objeto(a.variaveis).wvetro_ordem)===String(i+1))
   ||objeto(itensAtlas[i])
  const desc=string(w.Nome||w.Modelo||w.Descricao||w.Codigo)||'Tipologia '+(i+1)
  return {
   chaveWVetro:string(w.Id||w.ItemId)||null,
   ordem:i+1,codigo:string(w.Codigo||w.Id),descricao:desc,
   quantidade:Math.max(1,Number(w.Qtde||w.Quantidade||1)||1),
   // Estes são os campos verificados contra o relatório original do orçamento 1073.
   custoWVetro:moeda(w.ValorTotal),vendaWVetro:moeda(w.ValorTotalAlterado),
   vendaAtlas:moeda(itemAtlas.preco_total),
   // Não atribuir custo Atlas por posição se não houver referência de cálculo 1:1.
   custoAtlas:null,
   imagemUrl:typeof w.URL==='string'&&/^https:\/\/api\.wvetro\.com\.br\//.test(w.URL)?w.URL:null,
  }
 })
 const hist=objeto(entrada.historico)
 const custoGeralWVetro=moeda(bruto.CustoComSobra??hist.custo_com_sobra)
 const custoAlternativoWVetro=moeda(bruto.CustoSemSobra??hist.custo_sem_sobra)
 const vendaBrutaWVetro=moeda(bruto.ValorBruto??hist.valor_bruto)
 const descontoWVetro=moeda(bruto.DescontoVlr)
 const vendaLiquidaWVetro=moeda(bruto.Total??hist.valor_total)
 const custoTipologias=soma(tipologias.map(x=>x.custoWVetro))
 const vendaTipologias=soma(tipologias.map(x=>x.vendaWVetro))
 const vendaAtlas=moeda(entrada.vendaAtlas),custoAtlas=moeda(entrada.custoAtlas)
 const dCusto=diff(custoGeralWVetro,custoTipologias)
 const dVenda=diff(vendaBrutaWVetro,vendaTipologias)
 const alertas:string[]=[]
 if(dCusto!==null&&Math.abs(dCusto)>0.01)alertas.push('O custo geral do W.Vetro difere da soma dos custos das tipologias. Não redistribuir a diferença automaticamente.')
 if(dVenda!==null&&Math.abs(dVenda)>0.01)alertas.push('O valor bruto do W.Vetro difere da soma das vendas das tipologias.')
 if(vendaBrutaWVetro!==null&&descontoWVetro!==null&&vendaLiquidaWVetro!==null
  &&Math.abs(vendaBrutaWVetro-descontoWVetro-vendaLiquidaWVetro)>0.01)
   alertas.push('Venda bruta, desconto e venda líquida do W.Vetro não conciliam.')
 if(vendaLiquidaWVetro!==null&&vendaAtlas!==null&&Math.abs(vendaLiquidaWVetro-vendaAtlas)>0.01)
  alertas.push('O valor da venda confirmada no Atlas difere do total líquido original do W.Vetro.')
 if(custoGeralWVetro!==null&&custoAtlas!==null&&Math.abs(custoGeralWVetro-custoAtlas)>0.01)
  alertas.push('O custo previsto atual no Atlas foi recalculado e difere do custo geral original do W.Vetro.')
 return {numero:string(bruto.Nro||fluxo.numero),fonte:entrada.fonte||'importacao_atlas',
  dataCaptura:string(fluxo.validado_em||fluxo.importado_em)||null,
  itens:tipologias,
  totais:{custoTipologias,vendaTipologias,custoGeralWVetro,custoAlternativoWVetro,
   vendaBrutaWVetro,descontoWVetro,vendaLiquidaWVetro,vendaAtlas,custoAtlas,
   diferencaCustoGeralTipologias:dCusto,diferencaVendaBrutaTipologias:dVenda,
   diferencaVendaAtlas:diff(vendaAtlas,vendaLiquidaWVetro),
   diferencaCustoAtlas:diff(custoAtlas,custoGeralWVetro)},
  alertas}
}
// A API operacional pode devolver o pedido em diferentes envelopes; confirmar
// sempre o mesmo Nro antes de considerar uma resposta atual do W.Vetro.
export function extrairPedidoAtual(payload:unknown,numero:string):Registro|null{
 const fila=[payload];let iter=0
 while(fila.length&&iter++<45){
  const atual=fila.shift()
  if(Array.isArray(atual)){fila.push(...atual.slice(0,20));continue}
  const obj=objeto(atual)
  if(!Object.keys(obj).length)continue
  if(string(obj.Nro||obj.Orcamentoid||obj.OrcamentoId)===numero&&Array.isArray(obj.Itens))return obj
  for(const chave of ['data','Dados','pedido','Pedido','result','Result','conteudo','Conteudo','retorno','Retorno','items','Items'])
   if(obj[chave]&&typeof obj[chave]==='object')fila.push(obj[chave])
 }
 return null
}


// Diff financeiro entre o orçamento W.Vetro importado e uma consulta em tempo real.
// Não usa totais do Atlas para inferir custos das tipologias, não aplica nada,
// e NÃO emparelha por posição quando um item pode ter sido acrescentado/removido.
export type DiferencaItemWVetro={
 chave:string; status:'incluida'|'removida'|'alterada'|'sem_alteracao'|'identidade_incerta';
 anterior:ItemWVetroConferido|null; novo:ItemWVetroConferido|null;
 alteracoes:string[];
}
export type DiferencaTotalWVetro={
 chave:'custoGeralWVetro'|'custoTipologias'|'vendaTipologias'|'vendaBrutaWVetro'|'descontoWVetro'|'vendaLiquidaWVetro';
 rotulo:string; anterior:number|null; novo:number|null; diferenca:number|null;
 mudou:boolean;
}
export type DiferencaConferenciaWVetro={
 numero:string; fonte:'comparacao_ao_vivo'; somenteLeitura:true;
 itens:DiferencaItemWVetro[]; totais:DiferencaTotalWVetro[];
 qtdAlteradas:number;qtdIncluidas:number;qtdRemovidas:number;qtdSemMudanca:number;qtdIncertas:number;
 aplicacaoAutomaticaPermitida:false; avisos:string[];
}
export function compararConferenciasWVetro(
 anterior:WVetroConferencia,novo:WVetroConferencia,
):DiferencaConferenciaWVetro{
 if(!anterior.numero||anterior.numero!==novo.numero)
  throw new Error('Não é possível comparar orçamentos de números diferentes.')
 // IDs que se repetem em uma mesma versão não podem ser emparelhados automaticamente.
 const contagem=(itens:ItemWVetroConferido[])=>{
  const mapa=new Map<string,number>()
  for(const it of itens)if(it.chaveWVetro)mapa.set(it.chaveWVetro,(mapa.get(it.chaveWVetro)||0)+1)
  return mapa
 }
 const ca=contagem(anterior.itens),cn=contagem(novo.itens)
 const idsConfiaveis=new Set<string>()
 for(const [id,q] of ca)if(q===1&&cn.get(id)===1)idsConfiaveis.add(id)
 const originais=new Map(anterior.itens.filter(i=>i.chaveWVetro&&idsConfiaveis.has(i.chaveWVetro)).map(i=>[i.chaveWVetro!,i]))
 const atuais=new Map(novo.itens.filter(i=>i.chaveWVetro&&idsConfiaveis.has(i.chaveWVetro)).map(i=>[i.chaveWVetro!,i]))
 const itens:DiferencaItemWVetro[]=[]
 const pares=new Set<string>()
 for(const it of anterior.itens){
  const id=it.chaveWVetro
  if(!id||ca.get(id)!==1){
   itens.push({chave:'antiga:'+it.ordem,status:'identidade_incerta',anterior:it,novo:null,
    alteracoes:['Identificador não permite associar com segurança. Conferir manualmente.']})
   continue
  }
  const novoItem=idsConfiaveis.has(id)?atuais.get(id)||null:null
  if(!novoItem){
   // Só é segura a classificação de exclusão quando a lista original e a nova
   // possuem IDs únicos. Caso contrário há risco de falso positivo.
   const seguro=!cn.has(id)&&cn.size===novo.itens.length&&ca.size===anterior.itens.length
   itens.push({chave:'id:'+id,status:seguro?'removida':'identidade_incerta',anterior:it,novo:null,
    alteracoes:[seguro?'Tipologia ausente no W.Vetro atual':'Conferir se esta tipologia foi removida ou alterou ID']})
   continue
  }
  pares.add(id)
  const alteracoes:string[]=[]
  if(it.descricao!==novoItem.descricao)alteracoes.push('Descrição')
  if(it.codigo!==novoItem.codigo)alteracoes.push('Código')
  if(it.quantidade!==novoItem.quantidade)alteracoes.push('Quantidade')
  if(it.custoWVetro!==novoItem.custoWVetro)alteracoes.push('Custo')
  if(it.vendaWVetro!==novoItem.vendaWVetro)alteracoes.push('Venda')
  if(it.ordem!==novoItem.ordem)alteracoes.push('Posição no orçamento')
  itens.push({chave:'id:'+id,status:alteracoes.length?'alterada':'sem_alteracao',
   anterior:it,novo:novoItem,alteracoes})
 }
 for(const it of novo.itens){
  if(it.chaveWVetro&&pares.has(it.chaveWVetro))continue
  const id=it.chaveWVetro
  const seguro=Boolean(id&&ca.size===anterior.itens.length&&cn.size===novo.itens.length
   &&!ca.has(id)&&cn.get(id)===1)
  itens.push({chave:'nova:'+it.ordem,status:seguro?'incluida':'identidade_incerta',
   anterior:null,novo:it,alteracoes:[seguro?'Nova tipologia detectada':'Novo item sem identificação segura']})
 }
 const campos:[DiferencaTotalWVetro['chave'],string][]=[
  ['custoGeralWVetro','Custo geral W.Vetro'],
  ['custoTipologias','Soma dos custos por tipologia'],
  ['vendaTipologias','Soma das vendas das tipologias'],
  ['vendaBrutaWVetro','Venda bruta'],
  ['descontoWVetro','Desconto'],
  ['vendaLiquidaWVetro','Venda líquida'],
 ]
 const totais=campos.map(([chave,rotulo])=>{
  const a=anterior.totais[chave],n=novo.totais[chave]
  return {chave,rotulo,anterior:a,novo:n,diferenca:diff(n,a),mudou:a!==n}
 })
 const qtd=(status:DiferencaItemWVetro['status'])=>itens.filter(i=>i.status===status).length
 const avisos:string[]=[]
 if(qtd('identidade_incerta'))avisos.push('Há tipologias sem identificação segura. Não tentar relacionar itens por posição ou nome.')
 if(novo.totais.vendaLiquidaWVetro===null||novo.totais.custoGeralWVetro===null)
  avisos.push('O W.Vetro não forneceu todos os totais atuais. É proibido completar valores atuais com o histórico antigo.')
 if(novo.alertas.length)avisos.push(...novo.alertas)
 avisos.push('Comparação somente leitura. Uma venda confirmada não pode ser reescrita sem confirmação individual, auditoria e reconciliação financeira.')
 return {numero:novo.numero,fonte:'comparacao_ao_vivo',somenteLeitura:true,
  itens,totais,qtdAlteradas:qtd('alterada'),qtdIncluidas:qtd('incluida'),
  qtdRemovidas:qtd('removida'),qtdSemMudanca:qtd('sem_alteracao'),qtdIncertas:qtd('identidade_incerta'),
  aplicacaoAutomaticaPermitida:false,avisos}
}
