import {NextRequest,NextResponse} from 'next/server'
import {autenticarTenant} from '@/lib/tenantServer'
import {contextoCliente360Server} from '@/lib/cliente360AcessoServer'
import {podeCliente360} from '@/lib/cliente360Permissoes'
import {supabaseAdmin as db} from '@/lib/supabaseAdmin'
import {projetarCardGeral,COLUNAS_GERAIS_PADRAO,type EvidenciasProjeto} from '@/lib/visaoGeralProjetos'
import {agruparKanbanObras,type ObraBaseCliente,type VendaCardCliente} from '@/lib/cliente360KanbanObras'
export const dynamic='force-dynamic'
export const runtime='nodejs'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const txt=(x:unknown)=>String(x??'').trim().toLowerCase()
const final=(x:unknown)=>['concluido','concluida','concluído','concluída','finalizado','finalizada','produzido'].includes(txt(x))
const pedido=(x:unknown)=>['pedido_emitido','aguardando_entrega','comprado','recebido','recebido_parcial'].includes(txt(x))
const producao=(x:unknown)=>['em_producao','em_andamento','em_execucao','produzindo','corte','montagem'].includes(txt(x))
const ids=(arr:(string|null|undefined)[])=>[...new Set(arr.filter((x):x is string=>Boolean(x)))]
const percent=(feito:number,total:number)=>total?Math.min(100,Math.round(feito/total*100)):null
const erro=(mensagem:string,status:number)=>NextResponse.json({erro:mensagem},{status,headers:{'Cache-Control':'no-store'}})
/** Kanban resumido por obra, somente leitura e restrito ao Cliente 360 autenticado. */
export async function GET(req:NextRequest,{params}:{params:{id:string}}){
 try{
  const u=await autenticarTenant(req)
  if(!u)return erro('Sessão expirada.',401)
  const clienteId=params.id
  if(!uuid.test(clienteId))return erro('Cliente inválido.',400)
  const acesso=await contextoCliente360Server(u)
  if(!podeCliente360(acesso,'visao')||!podeCliente360(acesso,'obras'))
   return erro('Acesso ao andamento das obras não autorizado.',403)
  const empresa=u.empresa_id
  const cliente=await db.from('clientes').select('id').eq('empresa_id',empresa).eq('id',clienteId).maybeSingle()
  if(cliente.error)throw cliente.error
  if(!cliente.data)return erro('Cliente não encontrado nesta empresa.',404)
  const verOrcamentos=podeCliente360(acesso,'orcamentos')
  const [o,v,b]=await Promise.all([
   db.from('obras').select('id,numero,nome,status,cidade,previsao_entrega').eq('empresa_id',empresa).eq('cliente_id',clienteId).order('created_at',{ascending:false}).limit(2000),
   db.from('vendas_obras').select('id,numero,obra_id,orcamento_id,status').eq('empresa_id',empresa).eq('cliente_id',clienteId).order('created_at',{ascending:false}).limit(2000),
   verOrcamentos?db.from('orcamentos').select('id,obra_id,fotos_urls,revisao_atual').eq('empresa_id',empresa).eq('cliente_id',clienteId).limit(3000):Promise.resolve({data:[],error:null}),
  ])
  if(o.error||v.error||b.error)throw o.error||v.error||b.error
  const obras=o.data||[], vendas=(v.data||[]).filter(x=>!['cancelada','cancelado'].includes(txt(x.status)))
  const obrasIds=ids(obras.map(x=>x.id)), vendaIds=ids(vendas.map(x=>x.id)),orcIds=ids(vendas.map(x=>x.orcamento_id))
  const buscar=async(tabela:string,campos:string,coluna:string,lista:string[])=>{
   const dados:any[]=[]
   for(let i=0;i<lista.length;i+=100){
    const res=await db.from(tabela).select(campos).eq('empresa_id',empresa).in(coluna,lista.slice(i,i+100)).limit(5000)
    if(res.error)throw res.error
    dados.push(...(res.data||[]))
   }
   return dados
  }
  const [nec,ops,inst,med,itensCompra]=await Promise.all([
   buscar('compras_necessidades','id,obra_id,status,recebido_em','obra_id',obrasIds),
   buscar('ordens_producao','id,venda_obra_id,status,bloqueada','venda_obra_id',vendaIds),
   buscar('venda_instalacao_itens','id,venda_obra_id,status,quantidade,quantidade_instalada,pendencia,checklist','venda_obra_id',vendaIds),
   buscar('medicoes_finais','id,obra_id,orcamento_id,status_operacional','orcamento_id',orcIds),
   buscar('compras_solicitacao_itens','id,obra_id,destino,status,quantidade_necessaria','obra_id',obrasIds),
  ])
  const linhas=await buscar('compras_carrinho_itens','item_id,carrinho_id,quantidade_obra,recebido_obra','item_id',ids(itensCompra.map(x=>x.id)))
  const carrinhos=await buscar('compras_carrinhos','id,status','id',ids(linhas.map(x=>x.carrinho_id)))
  const porCarrinho=new Map(carrinhos.map(x=>[x.id,x]))
  const porObra=new Map(obras.map(x=>[x.id,x]))
  const orcamentos=b.data||[]
  const vendasObra=new Map<string,number>()
  for(const venda of vendas)if(venda.obra_id)vendasObra.set(venda.obra_id,(vendasObra.get(venda.obra_id)||0)+1)
  const agrupadas:Record<string,VendaCardCliente[]>={}
  for(const venda of vendas){
   const obra=venda.obra_id?porObra.get(venda.obra_id):null
   if(!obra)continue // Não inventar vínculo de obra ausente.
   const exclusivas=vendasObra.get(obra.id)===1
   const antigas=exclusivas?nec.filter(x=>x.obra_id===obra.id&&txt(x.status)!=='cancelado'):[]
   const novas=exclusivas?itensCompra.filter(x=>x.obra_id===obra.id&&x.destino==='obra'&&!['cancelado','cancelamento_solicitado'].includes(txt(x.status))):[]
   const resumo=novas.map(x=>{
    const lancamentos=linhas.filter(l=>l.item_id===x.id&&pedido(porCarrinho.get(l.carrinho_id)?.status))
    const total=Number(x.quantidade_necessaria)||0
    const comprado=lancamentos.reduce((n,l)=>n+Math.max(0,Number(l.quantidade_obra)||0),0)
    const recebido=lancamentos.reduce((n,l)=>n+Math.max(0,Number(l.recebido_obra)||0),0)
    return {comprado:total>0&&comprado>=total,recebido:total>0&&recebido>=total,iniciado:comprado>0,parcial:recebido>0}
   })
   const totalCompras=novas.length||antigas.length
   const compradas=novas.length?resumo.filter(x=>x.comprado).length:antigas.filter(x=>pedido(x.status)).length
   const recebidas=novas.length?resumo.filter(x=>x.recebido).length:antigas.filter(x=>txt(x.status)==='recebido'||Boolean(x.recebido_em)).length
   const comCompra=novas.length?resumo.some(x=>x.iniciado):compradas>0
   const parcial=novas.length?resumo.some(x=>x.parcial):recebidas>0
   const ordens=ops.filter(x=>x.venda_obra_id===venda.id)
   const feitas=ordens.filter(x=>final(x.status)&&!x.bloqueada).length
   const itens=inst.filter(x=>x.venda_obra_id===venda.id)
   const instaladas=itens.filter(x=>{
    const ck=(x.checklist&&typeof x.checklist==='object'?x.checklist:{}) as Record<string,boolean>
    return txt(x.status)==='instalado'&&Number(x.quantidade)>0&&Number(x.quantidade_instalada)>=Number(x.quantidade)
      &&!txt(x.pendencia)&&['nivelamento','vedacao','acabamento','limpeza'].every(k=>ck[k]===true)
   }).length
   const medidas=med.filter(x=>x.orcamento_id===venda.orcamento_id&&(!x.obra_id||x.obra_id===obra.id))
   const sinais:EvidenciasProjeto={
    vendaConfirmada:true,projetoConferido:false,
    medicaoFinal:medidas.length&&medidas.every(x=>txt(x.status_operacional)==='aprovado')?'aprovada':medidas.length?'em_andamento':'pendente',
    materiais:totalCompras&&recebidas===totalCompras?'liberados':parcial?'recebimento_parcial':comCompra?'aguardando_recebimento':totalCompras?'em_cotacao':'aguardando_liberacao',
    producao:ordens.length&&feitas===ordens.length?'concluida':ordens.some(x=>producao(x.status)&&!x.bloqueada)?'em_andamento':ordens.some(x=>x.bloqueada)?'bloqueada':'nao_iniciada',
    instalacao:itens.length&&instaladas===itens.length?'concluida':itens.some(x=>txt(x.status)==='instalado')?'em_andamento':itens.length?'aguardando_agendamento':'nao_iniciada',
    encerramentoConfirmado:txt(venda.status)==='concluida',
   }
   const p=projetarCardGeral({vendaId:venda.id,cliente:'',projeto:obra.nome,sinais,previsaoEntrega:obra.previsao_entrega},COLUNAS_GERAIS_PADRAO,new Date().toISOString().slice(0,10))
   if(!p)continue
   const coluna=p.colunaId
   const progresso=['compras','aguardando'].includes(coluna)?percent(compradas,totalCompras):
    coluna==='producao'?percent(feitas,ordens.length):coluna==='instalacao'?percent(instaladas,itens.length):coluna==='finalizado'?100:null
   const descricao=['compras','aguardando'].includes(coluna)?'Materiais comprados: '+compradas+'/'+totalCompras:
    coluna==='producao'?'Ordens concluídas: '+feitas+'/'+ordens.length:
    coluna==='instalacao'?'Itens instalados: '+instaladas+'/'+itens.length:
    coluna==='finalizado'?'Obra encerrada no fluxo operacional':'Acompanhamento da etapa'
   const card:VendaCardCliente={vendaId:venda.id,numero:Number(venda.numero)||0,colunaId:coluna,
    etapaOperacional:p.etapaOperacional,progresso,progressoDescricao:descricao}
   agrupadas[obra.id]=[...(agrupadas[obra.id]||[]),card]
  }
  const cardsBase:ObraBaseCliente[]=obras.map(obra=>{
   const lista=verOrcamentos?orcamentos.filter(x=>x.obra_id===obra.id&&x.revisao_atual!==false):[]
   const foto=lista.flatMap(x=>Array.isArray(x.fotos_urls)?x.fotos_urls:[])
    .find((x:unknown)=>typeof x==='string'&&/^https:\/\//i.test(x)&&!/\.(pdf|zip|doc)(\?|$)/i.test(x))
   return {id:obra.id,numero:Number(obra.numero)||0,nome:obra.nome||'Obra sem nome',status:obra.status||'planejamento',
    cidade:obra.cidade||null,previsaoEntrega:obra.previsao_entrega||null,
    fotoProjetoUrl:typeof foto==='string'?foto:null,orcamentos:verOrcamentos?lista.length:null}
  })
  const podeAbrirVendas=podeCliente360(acesso,'vendas')
  const cards=agruparKanbanObras(cardsBase,agrupadas).map(card=>podeAbrirVendas?card:{
   ...card,vendas:card.vendas.map(v=>({...v,vendaId:'',numero:0})),
  })
  return NextResponse.json({cards,
   vendasSemObra:vendas.filter(x=>!x.obra_id||!porObra.has(x.obra_id)).length,atualizadoEm:new Date().toISOString()},
   {headers:{'Cache-Control':'no-store'}})
 }catch(e){console.error('[cliente360 kanban por obra]',e);return erro('Falha ao consultar obras. Nenhum dado foi alterado.',503)}
}
