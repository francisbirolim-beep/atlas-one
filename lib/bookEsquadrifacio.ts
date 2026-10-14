import type {RelatorioIndividual} from '@/lib/relatoriosEsquadrifacio'
import type {FinanceiroRelatorioDados} from '@/components/relatorios/FinanceiroRelatorio'

export type ItemSimples={nome:string;quantidade:number;valor:number}
export type ProdutoBook={nome:string;imagem:string|null;quantidade:number;total:number;custoConhecido:number|null;margemPrevista:number|null}
export type ClienteBook={nome:string;contratos:number;valorContratos:number;custoPrevisto:number|null;margemPrevista:number|null}
export type DadosBook={
 ok:true;periodo:{inicio:string;fim:string};
 resumo:{qtdObras:number;qtdBalcao:number;totalContratos:number;totalBalcao:number;totalComercial:number;meta:number;comprasNf:number;quantidadeNf:number;comprasCmv:number;quantidadeCmv:number}
 mensal:{mes:string;contratos:number;balcao:number;meta:number;obras:number}[];
 representantes:ItemSimples[];clientes:ItemSimples[];clientesMargem:ClienteBook[];cidades:ItemSimples[];
 produtos:ProdutoBook[];fornecedores:ItemSimples[];fornecedoresCmv:ItemSimples[];notas:string[]
}
export type LivroLinha=(string|number|null)[]
export type LivroTabela={colunas:string[];linhas:LivroLinha[];imagens?:boolean}
export type ResultadoLivro={tabela:LivroTabela|null;estado:'disponivel'|'pendente'|'indisponivel';aviso:string}
const moeda=(n:number)=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const numero=(n:number)=>Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:2})
const pct=(n:number)=>Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:2})+'%'
const mes=(s:string)=>s.slice(5,7)+'/'+s.slice(0,4)
function abc<T>(itens:T[],getValor:(item:T)=>number){
 const total=itens.reduce((s,x)=>s+getValor(x),0)
 let soma=0
 return itens.map(item=>{const v=getValor(item);soma+=v;const participacao=total?100*v/total:0,acumulado=total?100*soma/total:0;return {item,participacao,acumulado,classe:acumulado<=80?'A':acumulado<=95?'B':'C'}})
}
export function montarVisaoLivro(relatorio:RelatorioIndividual,dados:DadosBook,fin:FinanceiroRelatorioDados|null):ResultadoLivro{
 const f=relatorio.fonte
 if(f==='pendente')return {tabela:null,estado:'pendente',aviso:relatorio.observacao}
 if(['dre','caixa','margem'].includes(f)&&!fin)return {tabela:null,estado:'indisponivel',aviso:'Consulta financeira não disponível. Não foi criado valor para este demonstrativo.'}
 const pronto=(tabela:LivroTabela):ResultadoLivro=>({tabela,estado:'disponivel',aviso:relatorio.observacao})
 if(f==='vendas')return pronto({colunas:['Mês','Obras contratadas','Balcão finalizado','Total comercial','Obras'],linhas:dados.mensal.map(x=>[mes(x.mes),moeda(x.contratos),moeda(x.balcao),moeda(x.contratos+x.balcao),x.obras])})
 if(f==='metas')return pronto({colunas:['Mês','Meta do CRM','Contratos confirmados','Atingimento'],linhas:dados.mensal.map(x=>[mes(x.mes),x.meta>0?moeda(x.meta):'Sem meta cadastrada',moeda(x.contratos),x.meta>0?pct(100*x.contratos/x.meta):'Não apurado'])})
 if(f==='representantes')return pronto({colunas:['Vendedor · balcão','Vendas','Valor total'],linhas:dados.representantes.map(x=>[x.nome,x.quantidade,moeda(x.valor)])})
 if(f==='clientes')return pronto({colunas:['Cliente','Contratos','Valor contratado'],linhas:dados.clientes.map(x=>[x.nome,x.quantidade,moeda(x.valor)])})
 if(f==='abc-clientes')return pronto({colunas:['Cliente','Contratos','Valor','Participação','Acumulado','ABC'],linhas:abc(dados.clientes,x=>x.valor).map(x=>[x.item.nome,x.item.quantidade,moeda(x.item.valor),pct(x.participacao),pct(x.acumulado),x.classe])})
 if(f==='lucro-cliente')return pronto({colunas:['Cliente','Contratos','Receita contratada','CMV previsto','Margem prevista'],linhas:dados.clientesMargem.map(x=>[x.nome,x.contratos,moeda(x.valorContratos),x.custoPrevisto===null?'A conferir':moeda(x.custoPrevisto),x.margemPrevista===null?'Não apurada':moeda(x.margemPrevista)])})
 if(f==='abc-produtos')return pronto({colunas:['Produto','Imagem','Total vendido','Participação','Acumulado','ABC'],imagens:true,linhas:abc(dados.produtos,x=>x.total).map(x=>[x.item.nome,x.item.imagem,moeda(x.item.total),pct(x.participacao),pct(x.acumulado),x.classe])})
 if(f==='lucro-produto')return pronto({colunas:['Produto','Imagem','Venda','Custo conhecido','Margem estimada'],imagens:true,linhas:dados.produtos.map(x=>[x.nome,x.imagem,moeda(x.total),x.custoConhecido===null?'Não apurado':moeda(x.custoConhecido),x.margemPrevista===null?'Não apurada':moeda(x.margemPrevista)])})
 if(f==='produtos')return pronto({colunas:['Produto','Imagem','Quantidade','Valor vendido'],imagens:true,linhas:dados.produtos.map(x=>[x.nome,x.imagem,numero(x.quantidade),moeda(x.total)])})
 if(f==='cidades')return pronto({colunas:['Cidade','Contratos','Valor contratado'],linhas:dados.cidades.map(x=>[x.nome,x.quantidade,moeda(x.valor)])})
 if(f==='fornecedores')return pronto({colunas:['Fornecedor','Fonte','Registros','Valor'],linhas:[...dados.fornecedores.map(x=>[x.nome,'Nota fiscal de entrada',x.quantidade,moeda(x.valor)]),...dados.fornecedoresCmv.map(x=>[x.nome,'Compra manual CMV · não somar à NF',x.quantidade,moeda(x.valor)])]})
 if(f==='comparativo')return pronto({colunas:['Indicador','Regime / fonte','Valor'],linhas:[['Vendas de obras','Contratos confirmados',moeda(dados.resumo.totalContratos)],['Balcão','Vendas finalizadas',moeda(dados.resumo.totalBalcao)],['Compras NF entrada','Notas cadastradas',moeda(dados.resumo.comprasNf)],['Compras manuais','CMV, possível duplicidade com NF',moeda(dados.resumo.comprasCmv)]]})
 if(!fin)return {tabela:null,estado:'indisponivel',aviso:'Informações financeiras indisponíveis.'}
 if(f==='margem')return pronto({colunas:['Indicador','Valor'],linhas:[['Receita comercial',moeda(fin.dre.receitaTotal)],['CMV previsto',moeda(fin.dre.cmvPrevisto)],['Margem bruta projetada',fin.dre.margemBrutaProjetada===null?'Não apurada':moeda(fin.dre.margemBrutaProjetada)],['Margem projetada %',fin.dre.margemPct===null?'Não apurada':pct(fin.dre.margemPct)]]})
 if(f==='caixa')return pronto({colunas:['Mês','Entradas registradas','Pagamentos registrados','Diferença parcial'],linhas:fin.caixa.meses.map(x=>[mes(x.mes),moeda(x.recebido),moeda(x.pago),moeda(x.recebido-x.pago)])})
 if(f==='dre'){
  const d=fin.dre
  if(relatorio.id==='dre-analitica-2')return pronto({colunas:['Classificação no plano de contas','Pagamentos em regime de caixa','Observação'],linhas:[...Object.entries(fin.classificacao?.gastosPorGrupo||{}).map(([grupo,v])=>[grupo,moeda(v),'Ainda requer competência']),['Títulos sem classificação',fin.classificacao?.pagamentosSemClassificacao??0,'Não deduzidos da DRE']]})
  if(relatorio.id==='dre-analitica-3')return pronto({colunas:['Indicador','Valor','Situação'],linhas:[['Obras',d.obras,'Contratos confirmados'],['Vendas balcão',d.balcao,'Finalizadas'],['Vendas com CMV incompleto',d.semPrevisao,'Impedem fechamento'],['Margem prevista %',d.margemPct===null?'Não apurada':pct(d.margemPct),'Não é lucro líquido'],['Lucro líquido',null,'Despesas/tributos por competência pendentes']]})
  if(relatorio.id==='dre-sintetica')return pronto({colunas:['Linha','Valor','Critério'],linhas:[['Receita comercial',moeda(d.receitaTotal),'Contratos + balcão'],['CMV previsto',moeda(d.cmvPrevisto),'Previsto, não realizado'],['Margem bruta estimada',d.margemBrutaProjetada===null?'Não apurada':moeda(d.margemBrutaProjetada),'Prévia'],['Lucro líquido',null,'Ainda não apurado']]})
  return pronto({colunas:['DRE gerencial preliminar','Valor','Fonte'],linhas:[['Receita contratada de obras',moeda(d.receitaObras),'Não fiscal'],['Balcão',moeda(d.receitaBalcao),'Finalizadas'],['Receita comercial',moeda(d.receitaTotal),'Não é receita fiscal'],['(–) CMV previsto',moeda(d.cmvPrevisto),'Custo projetado'],['Margem bruta projetada',d.margemBrutaProjetada===null?'Não apurada':moeda(d.margemBrutaProjetada),'Parcial'],['Tributos',null,'Sem conciliação'],['Despesas por competência',null,'Sem conciliação'],['Lucro líquido',null,'Não apurado']]})
 }
 return {tabela:null,estado:'indisponivel',aviso:'Visão ainda não associada a uma consulta homologada.'}
}
export function validarPeriodoBook(inicio:string,fim:string):boolean{
 const regex=/^\d{4}-\d{2}-\d{2}$/
 if(!regex.test(inicio)||!regex.test(fim)||inicio>fim)return false
 const a=Date.parse(inicio+'T12:00:00Z'),b=Date.parse(fim+'T12:00:00Z')
 return Number.isFinite(a)&&Number.isFinite(b)&&(b-a)/86400000<=366
}
