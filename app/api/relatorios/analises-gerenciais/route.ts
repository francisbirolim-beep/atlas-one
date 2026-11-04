import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { autorizarRelatorio } from '@/lib/relatoriosPermissoesServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime='nodejs'
export const dynamic='force-dynamic'
type Tipo='compras-fornecedor'|'compras-produto'|'vendas-cliente'|'vendas-produto'
type R={
 id:string;data:string;pessoa:string;pessoaId:string;documento:string;
 referencia:string;produto:string;produtoId:string;codigo:string;unidade:string;
 quantidade:number;valor:number;canal:string;imagem:string|null;categoria:string
}
const headers={'Cache-Control':'private, no-store'}
const iso=/^\d{4}-\d{2}-\d{2}$/
const valido=(s:string)=>iso.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s
const numero=(v:unknown)=>Number.isFinite(Number(v))?Number(v):0
const str=(v:unknown)=>String(v??'').trim()
const data=(v:unknown)=>str(v).slice(0,10)
const partes=<T,>(xs:T[],size:number)=>Array.from({length:Math.ceil(xs.length/size)},(_,i)=>xs.slice(i*size,i*size+size))
async function paginar(tabela:string,colunas:string,empresa:string){
 const linhas:any[]=[]
 for(let i=0;i<10;i++){
  const {data,error}=await supabaseAdmin.from(tabela).select(colunas)
   .eq('empresa_id',empresa).order('id',{ascending:true}).range(i*1000,i*1000+999)
  if(error)throw error
  if(i===9&&(data||[]).length)throw new Error('REGISTROS_EM_EXCESSO')
  linhas.push(...(data||[]))
  if((data||[]).length<1000)break
 }
 return linhas
}
async function porIds(tabela:string,colunas:string,chave:string,ids:string[],empresa:string){
 const todos:any[]=[]
 for(const grupo of partes([...new Set(ids.filter(Boolean))],100)){
  const {data,error}=await supabaseAdmin.from(tabela).select(colunas).eq('empresa_id',empresa).in(chave,grupo)
  if(error)throw error
  todos.push(...(data||[]))
 }
 return todos
}
function planoImagem(v:unknown):string|null{
 const url=str(v)
 return /^https:\/\//.test(url)?url:null
}
export async function GET(req:NextRequest){
 const u=await autenticarTenant(req)
 if(!u)return NextResponse.json({error:'Sessão inválida.'},{status:401,headers})
 const tipo=req.nextUrl.searchParams.get('tipo') as Tipo
 if(!['compras-fornecedor','compras-produto','vendas-cliente','vendas-produto'].includes(tipo))
  return NextResponse.json({error:'Relatório não reconhecido.'},{status:400,headers})
 const acesso=tipo.startsWith('compras-')?'compras':'comercial'
 const bloqueio=await autorizarRelatorio(req,u,acesso)
 if(bloqueio)return bloqueio
 const inicio=req.nextUrl.searchParams.get('inicio')||''
 const fim=req.nextUrl.searchParams.get('fim')||''
 if(!iso.test(inicio)||!iso.test(fim)||!valido(inicio)||!valido(fim)||inicio>fim||
  Date.parse(fim+'T12:00:00Z')-Date.parse(inicio+'T12:00:00Z')>366*86400000)
  return NextResponse.json({error:'Selecione um período de até 12 meses.'},{status:400,headers})
 try{
  const linhas:R[]=[]
  let observacao=''
  if(tipo.startsWith('compras-')){
   // NFs confirmadas; documentos ainda pendentes não representam compras concluídas.
   const [nfs,itens]=await Promise.all([
    paginar('compras_nfs','id,status,numero,data_emissao,data_entrada,fornecedor_id,fornecedor_nome,fornecedor_cnpj,valor_total',u.empresa_id),
    tipo==='compras-produto'?paginar('compras_nf_itens','id,nf_id,produto_id,codigo_fornecedor,descricao,unidade,quantidade,valor_total',u.empresa_id):Promise.resolve([])
   ])
   const validas=nfs.filter(n=>n.status==='confirmada')
    .filter(n=>{const d=data(n.data_emissao||n.data_entrada);return !!d&&d>=inicio&&d<=fim})
   const nfMap=new Map(validas.map(n=>[n.id,n]))
   if(tipo==='compras-fornecedor'){
    for(const n of validas){
     linhas.push({id:n.id,data:data(n.data_emissao||n.data_entrada),pessoa:str(n.fornecedor_nome)||'Fornecedor não informado',
      pessoaId:str(n.fornecedor_id)||'fornecedor:'+str(n.fornecedor_nome),documento:str(n.fornecedor_cnpj),
      referencia:'NF '+str(n.numero||'sem número'),produto:'',produtoId:'',codigo:'',unidade:'',
      quantidade:1,valor:numero(n.valor_total),canal:'Nota fiscal confirmada',imagem:null,categoria:''})
    }
    observacao='Compras confirmadas por nota fiscal, agrupáveis por fornecedor. Valor total da NF (pode incluir tributos e frete). Período pela emissão da nota, ou entrada se emissão ausente.'
   }else{
    const usados=itens.filter(i=>nfMap.has(i.nf_id))
    const products=await porIds('produtos','id,nome,codigo,categoria,grupo,foto_url','id',usados.map(i=>str(i.produto_id)),u.empresa_id)
    const productsMap=new Map(products.map(x=>[x.id,x]))
    for(const i of usados){
     const nf=nfMap.get(i.nf_id),produto=productsMap.get(i.produto_id)
     if(!nf)continue
     linhas.push({
      id:i.id,data:data(nf.data_emissao||nf.data_entrada),
      pessoa:str(nf.fornecedor_nome)||'Fornecedor não informado',
      pessoaId:str(nf.fornecedor_id)||'fornecedor:'+str(nf.fornecedor_nome),documento:str(nf.fornecedor_cnpj),
      referencia:'NF '+str(nf.numero||'sem número'),
      produto:str(produto?.nome||i.descricao)||'Produto sem descrição',
      produtoId:str(i.produto_id)||'fornecedor:'+str(nf.fornecedor_id)+'|'+str(i.codigo_fornecedor)+'|'+str(i.descricao)+'|'+str(i.unidade),
      codigo:str(produto?.codigo||i.codigo_fornecedor),unidade:str(i.unidade)||'un.',
      quantidade:numero(i.quantidade),valor:numero(i.valor_total),canal:'Item de nota fiscal',
      imagem:planoImagem(produto?.foto_url),categoria:str(produto?.categoria||produto?.grupo)
     })
    }
    observacao='Produtos das NFs confirmadas. Os totais dos itens podem diferir do total das notas por frete, tributos e descontos. Itens sem vínculo no catálogo aparecem sem imagem cadastrada.'
   }
  }else{
   const [balcao,obras]=await Promise.all([
    paginar('balcao_vendas','id,numero,status,cliente_id,cliente_nome,finalizada_em,total',u.empresa_id),
    tipo==='vendas-cliente'?paginar('vendas_obras','id,numero,status,cliente_id,valor_venda,confirmado_em,excluida_em',u.empresa_id):Promise.resolve([])
   ])
   const validas=balcao.filter(v=>v.status==='finalizada')
    .filter(v=>data(v.finalizada_em)>=inicio&&data(v.finalizada_em)<=fim)
   if(tipo==='vendas-cliente'){
    const obrasValidas=obras.filter(v=>v.status!=='cancelada'&&v.status!=='cancelado'&&!v.excluida_em&&v.confirmado_em)
     .filter(v=>data(v.confirmado_em)>=inicio&&data(v.confirmado_em)<=fim)
    const ids=[...validas.map(v=>str(v.cliente_id)),...obrasValidas.map(v=>str(v.cliente_id))]
    const clientes=await porIds('clientes','id,nome,cpf_cnpj','id',ids,u.empresa_id)
    const m=new Map(clientes.map(c=>[c.id,c]))
    for(const v of validas){
     const c=m.get(v.cliente_id)
     linhas.push({id:'balcao-'+v.id,data:data(v.finalizada_em),
      pessoa:str(c?.nome||v.cliente_nome)||'Consumidor não identificado',pessoaId:str(v.cliente_id)||'balcao:'+str(v.cliente_nome),
      documento:str(c?.cpf_cnpj),referencia:'Balcão #'+str(v.numero||'—'),produto:'',produtoId:'',
      codigo:'',unidade:'',quantidade:1,valor:numero(v.total),canal:'Balcão',imagem:null,categoria:''})
    }
    for(const v of obrasValidas){
     const c=m.get(v.cliente_id)
     linhas.push({id:'obra-'+v.id,data:data(v.confirmado_em),pessoa:str(c?.nome)||'Cliente não identificado',
      pessoaId:str(v.cliente_id)||'obra:'+str(v.id),documento:str(c?.cpf_cnpj),
      referencia:'Venda/obra #'+str(v.numero||'—'),produto:'',produtoId:'',
      codigo:'',unidade:'',quantidade:1,valor:numero(v.valor_venda),canal:'Obra',
      imagem:null,categoria:''})
    }
    observacao='Vendas comerciais confirmadas de obras e vendas finalizadas de balcão. Não representam, necessariamente, receitas recebidas ou faturamento fiscal.'
   }else{
    const itens=await porIds('balcao_venda_itens','id,venda_id,produto_id,produto_codigo,produto_nome,unidade,quantidade,total_item','venda_id',validas.map(v=>v.id),u.empresa_id)
    const m=new Map(validas.map(v=>[v.id,v]))
    const produtos=await porIds('produtos','id,nome,codigo,categoria,grupo,foto_url','id',itens.map(i=>str(i.produto_id)),u.empresa_id)
    const produtosMap=new Map(produtos.map(v=>[v.id,v]))
    for(const i of itens){
     const venda=m.get(i.venda_id),produto=produtosMap.get(i.produto_id)
     if(!venda)continue
     linhas.push({id:i.id,data:data(venda.finalizada_em),
      pessoa:str(venda.cliente_nome)||'Consumidor não identificado',
      pessoaId:str(venda.cliente_id)||'balcao:'+str(venda.cliente_nome),
      documento:'',referencia:'Balcão #'+str(venda.numero||'—'),
      produto:str(produto?.nome||i.produto_nome)||'Produto sem descrição',
      produtoId:str(i.produto_id)||'balcao:'+str(i.produto_codigo)+'|'+str(i.produto_nome)+'|'+str(i.unidade),
      codigo:str(produto?.codigo||i.produto_codigo),unidade:str(i.unidade)||'un.',
      quantidade:numero(i.quantidade),valor:numero(i.total_item),canal:'Balcão',
      imagem:planoImagem(produto?.foto_url),categoria:str(produto?.categoria||produto?.grupo)})
    }
    observacao='Produtos vendidos no balcão (vendas finalizadas). Itens das esquadrias fabricadas sob medida não entram neste ranking de produtos. Descontos aplicados no total da venda podem fazer o somatório dos itens diferir do total da venda.'
   }
  }
  linhas.sort((a,b)=>a.data.localeCompare(b.data)||a.pessoa.localeCompare(b.pessoa,'pt-BR'))
  return NextResponse.json({ok:true,tipo,inicio,fim,linhas,observacao},{headers})
 }catch(e){
  console.error('Relatório gerencial por documento/produto:',e)
  const excess=e instanceof Error&&e.message==='REGISTROS_EM_EXCESSO'
  return NextResponse.json({error:excess?'Quantidade de registros acima do limite seguro. Não mostramos valores incompletos.':'Não foi possível consultar este relatório.'},
   {status:excess?422:500,headers})
 }
}
