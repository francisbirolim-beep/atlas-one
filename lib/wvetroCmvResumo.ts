// Conserva os totais do quadro Conferir Valores do W.Vetro.
type Campo = 'perfil'|'acessorio'|'vidro'|'sobra'|'perda'
export type ResumoCmv = {
 categorias: Record<Campo,number|null>; total:number|null; fonte:string; aviso:string|null
 // Os campos CustoSemSobra / CustoComSobra do payload podem vir invertidos.
 // Só publicamos os dois resultados quando os dois totais originais existem.
 total_uso:number|null;total_com_sobra:number|null
 perfil_previsao:number|null;perfil_previsao_fonte:'despesas_extras_wvetro'|'uso_mais_sobra_wvetro'|null
 perfil_centro_custo:number|null;perda_fonte:'wvetro'|'conciliacao_wvetro'|null
}
const vazio=()=>({perfil:null,acessorio:null,vidro:null,sobra:null,perda:null}) as Record<Campo,number|null>
const normal=(v:unknown)=>String(v??'').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g,'')
const numero=(v:unknown):number|null=>{
  if(v===null||v===undefined||v==='')return null
  if(typeof v==='number')return Number.isFinite(v)?v:null
  let s=String(v).trim().replace(/[^0-9,.-]/g,'')
  if(s.includes(','))s=s.replace(/\./g,'').replace(',','.')
  const n=Number(s);return Number.isFinite(n)&&n>=0?n:null
}
const objeto=(v:unknown):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:{}
const valor=(v:unknown):number|null=>{
  if(!v||typeof v!=='object')return numero(v)
  const x=objeto(v)
  for(const k of Object.keys(x))if(['custos','custo','custototal','valorcusto'].includes(normal(k)))return numero(x[k])
  return null
}
const categoria=(v:unknown):Campo|null=>{
  const s=normal(v)
  if(['perfil','perfis','perfilutilizado','perfisutilizados','usoperfil'].includes(s))return 'perfil'
  if(['acessorio','acessorios'].includes(s))return 'acessorio'
  if(['vidro','vidros'].includes(s))return 'vidro'
  if(['sobra','sobras','sobraperfil','sobradeperfil'].includes(s))return 'sobra'
  if(['perda','perdacorte','perdadecorte'].includes(s))return 'perda'
  return null
}
// O centro de custo das previsões NÃO é o valor de uso técnico do ResumoObra.
// Aceita as listas de previsões quando a integração W.Vetro as disponibilizar.
function perfilDasPrevisoes(f:Record<string,any>,p:Record<string,any>):number|null{
 const listas=[p.DespesasExtrasPrevisao,p.DespesasExtrasPrevisoes,p.PrevisoesDespesas,p.DespesasExtras,f.despesas_extras_previsao,f.previsoes_despesas]
 for(const linhas of listas){
  if(!Array.isArray(linhas))continue
  const valores=linhas.map(linha=>{
   const d=objeto(linha)
   const centro=normal(d.CentroCusto??d.CentroCustoDescricao??d.centro_custo??d.centro_custo_descricao??d.DescricaoCentroCusto)
   const descricao=normal(d.Descricao??d.descricao)
   if(!['materiaprimaperfil','materiaprimaperfis'].includes(centro)|| (descricao!==''&&!['perfil','perfis'].includes(descricao)))return null
   return numero(d.Valor??d.valor??d.ValorTotal??d.valor_total??d.PrevisaoValor)
  }).filter((v):v is number=>v!==null)
  if(valores.length)return Math.round(valores.reduce((s,v)=>s+v,0)*100)/100
 }
 return null
}
export function extrairPrevisaoWVetro(bruto:unknown):ResumoCmv{
 const f=objeto(bruto), p=objeto(f.payload_bruto), categorias=vazio()
 const candidatas=[p,f,objeto(p.ConferirValores),objeto(p.ResumoCustos),objeto(f.conferir_valores),objeto(p.MateriaisUtilizadosComCusto)]
 const campos:Record<Campo,string[]>={perfil:['custoperfil','custoperfis'],acessorio:['custoacessorio','custoacessorios'],vidro:['custovidro','custovidros'],sobra:['custosobra','custosobras'],perda:['custoperda','custoperdacorte']}
 for(const origem of candidatas)for(const [chave,dado] of Object.entries(origem)){
   const nome=normal(chave), cat=categoria(chave)
   if(cat&&categorias[cat]===null)categorias[cat]=valor(dado)
   for(const c of Object.keys(campos) as Campo[])if(campos[c].includes(nome)&&categorias[c]===null)categorias[c]=numero(dado)
 }
 for(const registros of [p.ConferirValores,p.MateriaisUtilizadosComCusto,f.conferir_valores])if(Array.isArray(registros)){
  for(const linha of registros){
   const d=objeto(linha), c=categoria(d.Grupo??d.Categoria??d.Nome??d.Descricao??d.Tipo)
   if(c&&categorias[c]===null)categorias[c]=valor(d)
  }
 }
 // Orçamentos recentes trazem estes totais no payload_bruto, sem linha no histórico.
 const totalValores=[numero(f.custo_sem_sobra??p.CustoSemSobra),numero(f.custo_com_sobra??p.CustoComSobra)].filter((v):v is number=>v!==null)
 const historico=totalValores.length?Math.max(...totalValores):null
 const total_uso=totalValores.length===2?Math.min(...totalValores):null
 const total_com_sobra=totalValores.length===2?Math.max(...totalValores):null
 let perda_fonte:ResumoCmv['perda_fonte']=categorias.perda!==null?'wvetro':null
 // O payload operacional do W.Vetro guarda custos utilizados no ResumoObra.
 // No orçamento Samuel #872, SobraCusto/PerdaCorte vieram zerados no ResumoObra,
 // embora os dois totais históricos e o quadro Conferir Valores os incluam.
 const resumo=objeto(p.ResumoObra)
 if(categorias.perfil===null)categorias.perfil=numero(resumo.OrcamentoValorVlrCustoPerfil)
 if(categorias.acessorio===null)categorias.acessorio=numero(resumo.OrcamentoValorVlrCustoAcessorio)
 if(categorias.vidro===null)categorias.vidro=numero(resumo.OrcamentoValorVlrCustoVidro)
 const menor=totalValores.length>=2?Math.min(...totalValores):null
 if(categorias.sobra===null && menor!==null && historico!==null && historico>=menor){
   // A diferença entre os totais históricos representa a sobra no quadro Conferir Valores.
   // Quando os dois totais são iguais, a sobra conhecida é R$ 0,00.
   categorias.sobra=Math.round((historico-menor)*100)/100
 }
 if(categorias.sobra===null){
   const sobraResumo=numero(resumo.OrcamentoValorSobraCusto)
   if(sobraResumo!==null&&sobraResumo>0)categorias.sobra=sobraResumo
 }
 if(categorias.perda===null){
   const perdaResumo=numero(resumo.OrcamentoValorCustoPerdaCorte)
   if(perdaResumo!==null&&perdaResumo>0){categorias.perda=perdaResumo;perda_fonte='wvetro'}
 }
 const outras=[p.CustoMaoObraVlr,resumo.OrcamentoValorCustoServicos,resumo.OrcamentoValorVlrCustoKit,resumo.OrcamentoValorTratamentoCusto,resumo.OrcamentoValorVlrAcesEmbCusto].some(v=>(numero(v)||0)>0)
 if(categorias.perda===null&&menor!==null&&!outras&&categorias.perfil!==null&&categorias.acessorio!==null&&categorias.vidro!==null){
   const residual=Math.round((menor-categorias.perfil-categorias.acessorio-categorias.vidro)*100)/100
   if(residual>=0&&residual<=Math.max(10,menor*0.015)){
    categorias.perda=residual
    perda_fonte='conciliacao_wvetro'
   }
 }
 // O centro de custo Despesas Extras/Previsão pode reunir perda de corte e outros
 // componentes. Nunca atribuímos a diferença do total à categoria PERFIS:
 // #1176: 1790,84 - 289,09 - 401,80 = 1099,95 (mistura perfis+sobra+perda).
 // Materiais utilizados: perfis 525,90 + sobra 570,28 = 1096,18.
 const perfil_centro_custo=perfilDasPrevisoes(f,p)
 const perfilComSobra=categorias.perfil!==null&&categorias.sobra!==null
  ?Math.round((categorias.perfil+categorias.sobra)*100)/100:null
 const perfil_previsao=perfilComSobra??perfil_centro_custo
 const perfil_previsao_fonte:ResumoCmv['perfil_previsao_fonte']=perfilComSobra!==null
  ?'uso_mais_sobra_wvetro':perfil_centro_custo!==null?'despesas_extras_wvetro':null
 const completo=Object.values(categorias).every(v=>v!==null)
 const soma=completo?Math.round(Object.values(categorias).reduce<number>((s,v)=>s+(v??0),0)*100)/100:null
 const quantidade=Object.values(categorias).filter(v=>v!==null).length
 const aviso=quantidade===0?'O W.Vetro informou o total histórico, mas ainda não forneceu o detalhamento por categoria.':!completo?'O detalhamento W.Vetro ainda está incompleto.':historico!==null&&soma!==null&&Math.abs(historico-soma)>0.03?'Total histórico W.Vetro diferente da soma das categorias.':null
 const fonte=quantidade===0?(historico!==null?'resumo_wvetro':'indisponivel'):(Object.keys(resumo).length?'resumo_obra_wvetro':'conferir_valores')
 return {categorias,total:historico??soma,fonte,aviso:historico===null&&quantidade===0?'Resumo W.Vetro indisponível.':aviso,perfil_previsao,perfil_previsao_fonte,perfil_centro_custo,perda_fonte,total_uso,total_com_sobra}
}
