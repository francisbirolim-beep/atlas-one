import {NextRequest,NextResponse} from 'next/server'
import {autenticarTenant} from '@/lib/tenantServer'
import {supabaseAdmin} from '@/lib/supabaseAdmin'

// Exclusivamente leitura; nunca altera clientes, estoque, CRM, compras ou financeiro.
export const runtime='nodejs'
export const dynamic='force-dynamic'
const valido=/^\d{4}-\d{2}-\d{2}$/
const arredonda=(x:number)=>Math.round((x+Number.EPSILON)*100)/100
const valor=(x:unknown)=>{const n=Number(x);return Number.isFinite(n)&&n>0?n:0}
const dia=(x:unknown)=>String(x||'').slice(0,10)
const chave=(x:unknown)=>String(x||'Não informado').trim().replace(/\s+/g,' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleUpperCase('pt-BR')
const lotes=<T,>(xs:T[],tamanho=100)=>Array.from({length:Math.ceil(xs.length/tamanho)},(_,i)=>xs.slice(i*tamanho,(i+1)*tamanho))
async function ler(tabela:string,colunas:string,empresa:string,filtro:(q:any)=>any){
 const {data,error}=await filtro(supabaseAdmin.from(tabela).select(colunas).eq('empresa_id',empresa).limit(1001))
 if(error)throw error
 if((data||[]).length>1000)throw Error('Limite de registros atingido. Reduza o intervalo para um relatório completo.')
 return data||[]
}
async function emLotes(tabela:string,colunas:string,empresa:string,chaveId:string,ids:string[]){
 const ret:any[]=[]
 for(const chunk of lotes(ids)){
  const encontrados=await ler(tabela,colunas,empresa,q=>q.in(chaveId,chunk))
  ret.push(...encontrados)
 }
 return ret
}
function somarPor<T>(dados:T[],getChave:(row:T)=>string,getValor:(row:T)=>number){
 const map=new Map<string,{nome:string;quantidade:number;valor:number}>()
 for(const r of dados){
  const nome=getChave(r)||'Não informado',id=chave(nome),item=map.get(id)||{nome,quantidade:0,valor:0}
  item.quantidade++;item.valor=arredonda(item.valor+getValor(r));map.set(id,item)
 }
 return [...map.values()].sort((a,b)=>b.valor-a.valor||a.nome.localeCompare(b.nome,'pt-BR'))
}
export async function GET(req:NextRequest){
 const u=await autenticarTenant(req)
 if(!u)return NextResponse.json({error:'Sessão inválida.'},{status:401})
 if(u.role!=='master')return NextResponse.json({error:'Relatórios gerenciais reservados ao Master.'},{status:403})
 const inicio=req.nextUrl.searchParams.get('inicio')||''
 const fim=req.nextUrl.searchParams.get('fim')||''
 const dias=(Date.parse(fim+'T12:00:00Z')-Date.parse(inicio+'T12:00:00Z'))/86400000
 if(!valido.test(inicio)||!valido.test(fim)||inicio>fim||!Number.isFinite(dias)||dias>366)
  return NextResponse.json({error:'Selecione um período válido de até 12 meses.'},{status:400})
 const empresa=u.empresa_id
 try{
  const [obrasOrigem,balcaoOrigem,metas,notasOrigem]=await Promise.all([
   ler('vendas_obras','id,cliente_id,valor_venda,custo_previsto,confirmado_em,status',empresa,q=>q.gte('confirmado_em',inicio+'T00:00:00-03:00').lte('confirmado_em',fim+'T23:59:59-03:00')),
   ler('balcao_vendas','id,cliente_id,cliente_nome,vendedor_nome,total,status,finalizada_em',empresa,q=>q.gte('finalizada_em',inicio+'T00:00:00-03:00').lte('finalizada_em',fim+'T23:59:59-03:00')),
   ler('crm_metas','mes,meta_valor,usuario_id,usuario_nome',empresa,q=>q.gte('mes',inicio.slice(0,7)).lte('mes',fim.slice(0,7))),
   ler('compras_nfs','id,fornecedor_nome,valor_total,data_entrada,status',empresa,q=>q.gte('data_entrada',inicio).lte('data_entrada',fim))
  ])
  const obras=(obrasOrigem as any[]).filter(v=>v.status!=='cancelada'&&v.status!=='cancelado'&&dia(v.confirmado_em)>=inicio&&dia(v.confirmado_em)<=fim)
  const balcao=(balcaoOrigem as any[]).filter(v=>v.status==='finalizada'&&dia(v.finalizada_em)>=inicio&&dia(v.finalizada_em)<=fim)
  const notas=(notasOrigem as any[]).filter(v=>!['cancelado','cancelada','rascunho','rejeitada'].includes(String(v.status).toLowerCase()))
  const idsCliente=[...new Set([...obras,...balcao].map((x:any)=>String(x.cliente_id||'')).filter(Boolean))]
  const clientesBase=await emLotes('clientes','id,nome,cidade',empresa,'id',idsCliente)
  const clienteMap=new Map(clientesBase.map((x:any)=>[x.id,x]))
  const itens=await emLotes('balcao_venda_itens','venda_id,produto_id,produto_nome,quantidade,total_item,custo_unitario_snapshot',empresa,'venda_id',balcao.map((x:any)=>x.id))
  const idsProdutos=[...new Set(itens.map(x=>String(x.produto_id||'')).filter(Boolean))]
  const produtosOrigem=await emLotes('produtos','id,foto_url,categoria',empresa,'id',idsProdutos)
  const fotosOrigem=await emLotes('produto_imagens','produto_id,url,principal,ativo',empresa,'produto_id',idsProdutos)
  const fotos=new Map<string,string>()
  for(const p of produtosOrigem){if(typeof p.foto_url==='string'&&/^https:\/\//.test(p.foto_url))fotos.set(p.id,p.foto_url)}
  for(const img of fotosOrigem){if(img.ativo&&!fotos.has(img.produto_id)&&typeof img.url==='string'&&/^https:\/\//.test(img.url))fotos.set(img.produto_id,img.url)}
  const mes=new Map<string,{mes:string;contratos:number;balcao:number;meta:number;obras:number}>()
  const buscarMes=(m:string)=>{const x=mes.get(m)||{mes:m,contratos:0,balcao:0,meta:0,obras:0};mes.set(m,x);return x}
  for(const v of obras){const x=buscarMes(dia(v.confirmado_em).slice(0,7));x.contratos+=valor(v.valor_venda);x.obras++}
  for(const v of balcao)buscarMes(dia(v.finalizada_em).slice(0,7)).balcao+=valor(v.total)
  for(const m of metas as any[])buscarMes(String(m.mes)).meta+=valor(m.meta_valor)
  const mensal=[...mes.values()].sort((a,b)=>a.mes.localeCompare(b.mes)).map(x=>({...x,contratos:arredonda(x.contratos),balcao:arredonda(x.balcao),meta:arredonda(x.meta)}))
  const representantes=somarPor(balcao,(x:any)=>String(x.vendedor_nome||'Sem vendedor'),(x:any)=>valor(x.total))
  // Cliente é identificado pelo ID: nomes iguais não devem fundir carteiras.
  const clientesPorId=new Map<string,{nome:string;quantidade:number;valor:number}>()
  for(const x of obras){
   const id=String(x.cliente_id||x.id)
   const nome=String(clienteMap.get(x.cliente_id)?.nome||'Cliente não identificado')
   const atual=clientesPorId.get(id)||{nome,quantidade:0,valor:0}
   atual.quantidade++;atual.valor=arredonda(atual.valor+valor(x.valor_venda))
   clientesPorId.set(id,atual)
  }
  const clientes=[...clientesPorId.values()].sort((a,b)=>b.valor-a.valor||a.nome.localeCompare(b.nome,'pt-BR'))
  const resultadoClientes=new Map<string,{nome:string;contratos:number;valorContratos:number;custoConhecido:number;faltandoCusto:number}>()
  for(const x of obras){
   const nome=String(clienteMap.get(x.cliente_id)?.nome||'Cliente não identificado'),id=String(x.cliente_id||x.id)
   const l=resultadoClientes.get(id)||{nome,contratos:0,valorContratos:0,custoConhecido:0,faltandoCusto:0}
   l.contratos++;l.valorContratos+=valor(x.valor_venda)
   if(x.custo_previsto==null)l.faltandoCusto++
   else l.custoConhecido+=valor(x.custo_previsto)
   resultadoClientes.set(id,l)
  }
  const clientesMargem=[...resultadoClientes.values()].map(x=>({nome:x.nome,contratos:x.contratos,valorContratos:arredonda(x.valorContratos),custoPrevisto:x.faltandoCusto?null:arredonda(x.custoConhecido),margemPrevista:x.faltandoCusto?null:arredonda(x.valorContratos-x.custoConhecido)})).sort((a,b)=>b.valorContratos-a.valorContratos)
  const cidades=somarPor(obras,(x:any)=>String(clienteMap.get(x.cliente_id)?.cidade||'Cidade não informada'),(x:any)=>valor(x.valor_venda))
  const produtosMap=new Map<string,{nome:string;itens:number;quantidade:number;total:number;custoConhecido:number;semCusto:number;imagem:string}>()
  for(const item of itens){
   const nome=String(item.produto_nome||'Produto sem descrição'),id=String(item.produto_id||chave(nome))
   const x=produtosMap.get(id)||{nome,itens:0,quantidade:0,total:0,custoConhecido:0,semCusto:0,imagem:''}
   if(!x.imagem&&item.produto_id)x.imagem=fotos.get(item.produto_id)||''
   x.itens++;x.quantidade+=valor(item.quantidade);x.total+=valor(item.total_item)
   if(item.custo_unitario_snapshot==null||Number(item.custo_unitario_snapshot)<=0)x.semCusto++
   else x.custoConhecido+=valor(item.custo_unitario_snapshot)*valor(item.quantidade)
   produtosMap.set(id,x)
  }
  const produtos=[...produtosMap.values()].map(x=>({
   nome:x.nome,imagem:x.imagem||null,itens:x.itens,quantidade:arredonda(x.quantidade),total:arredonda(x.total),
   custoConhecido:x.semCusto?null:arredonda(x.custoConhecido),
   margemPrevista:x.semCusto?null:arredonda(x.total-x.custoConhecido)
  })).sort((a,b)=>b.total-a.total)
  const fornecedores=somarPor(notas,(x:any)=>String(x.fornecedor_nome||'Fornecedor não informado'),(x:any)=>valor(x.valor_total))
  const totalContratos=arredonda(obras.reduce((s,x)=>s+valor(x.valor_venda),0))
  const totalBalcao=arredonda(balcao.reduce((s,x)=>s+valor(x.total),0))
  const totalComprasNf=arredonda(notas.reduce((s,x)=>s+valor(x.valor_total),0))
  return NextResponse.json({
   ok:true,periodo:{inicio,fim},resumo:{qtdObras:obras.length,qtdBalcao:balcao.length,totalContratos,totalBalcao,totalComercial:arredonda(totalContratos+totalBalcao),meta:arredonda((metas as any[]).reduce((s,m)=>s+valor(m.meta_valor),0)),comprasNf:totalComprasNf,quantidadeNf:notas.length},
   mensal,representantes,clientes,clientesMargem,cidades,produtos,fornecedores,
   notas:['Vendas de obras são contratos confirmados, não notas fiscais de saída.','Vendas de balcão são vendas finalizadas.','Margens são estimativas onde há CMV previsto completo.','Compras por fornecedor utilizam somente notas fiscais de entrada cadastradas, sem duplicar CMV manual.']
  },{headers:{'Cache-Control':'private, no-store'}})
 }catch(e){
  console.error('Falha ao consultar relatórios individuais Esquadrifácio:',e)
  return NextResponse.json({error:'Não foi possível consultar todas as fontes. Confira os cadastros ou reduza o período.'},{status:500})
 }
}
