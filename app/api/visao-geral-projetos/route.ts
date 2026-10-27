import {NextRequest,NextResponse} from 'next/server'
import {autenticarCompras} from '@/lib/comprasServer'
import {podeConsultarPainelGeral} from '@/lib/painelGeralAcessoServer'
import {supabaseAdmin as db} from '@/lib/supabaseAdmin'
import {projetarCardGeral,COLUNAS_GERAIS_PADRAO,type EvidenciasProjeto} from '@/lib/visaoGeralProjetos'
import {permissoesKanbanObra} from '@/lib/kanbanObraPermissoesServer'
import type {MaterialResumo,PedidoGeralCard,DetalheMaterialCompra} from '@/lib/visaoGeralDemo'
export const dynamic='force-dynamic'
export const runtime='nodejs'
const txt=(x:unknown)=>String(x??'').trim().toLowerCase()
const final=(x:unknown)=>['concluido','concluida','concluído','concluída','finalizado','finalizada','produzido'].includes(txt(x))
const pedidoFeito=(x:unknown)=>['pedido_emitido','aguardando_entrega','comprado','recebido'].includes(txt(x))
const recebido=(x:{status?:string;recebido_em?:string})=>txt(x.status)==='recebido'||Boolean(x.recebido_em)
const producaoAndamento=(x:unknown)=>['em_producao','em_andamento','em_execucao','produzindo','corte','montagem'].includes(txt(x))
const tipoItem=(x:unknown):MaterialResumo['tipo']|null=>{
 const n=txt(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 return n.includes('perfil')?'perfil':n.includes('vidro')?'vidro':n.includes('acessorio')?'acessorio':null
}
const respErro=(erro:string,codigo:number)=>NextResponse.json({erro},{status:codigo,headers:{'Cache-Control':'no-store'}})
type Necessidade={id:string;obra_id:string;status:string;recebido_em?:string;categoria?:string;quantidade:number;unidade:string}
function categorias(compras:Necessidade[]):MaterialResumo[]{
 return (['perfil','vidro','acessorio'] as const).map(tipo=>{
  const lista=compras.filter(c=>tipoItem(c.categoria)===tipo)
  // Quantidades só podem ser somadas quando as unidades são compatíveis.
  if(!lista.length||new Set(lista.map(c=>txt(c.unidade))).size!==1||lista.some(c=>!(Number(c.quantidade)>0)))
   return {tipo,total:null,comprados:null,recebidos:null}
  const qtd=(predicate:(c:Necessidade)=>boolean)=>lista.filter(predicate).reduce((s,c)=>s+Number(c.quantidade),0)
  return {tipo,total:qtd(()=>true),comprados:qtd(c=>pedidoFeito(c.status)),recebidos:qtd(c=>recebido(c))}
 })
}
export async function GET(req:NextRequest){
 try{
  const u=await autenticarCompras(req)
  if(!u)return respErro('Sessão inválida',401)
  const vendaSelecionada=req.nextUrl.searchParams.get('vendaId')
  if(vendaSelecionada && !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(vendaSelecionada))
    return respErro('ID de venda inválido.',400)
  const permissaoObra=vendaSelecionada?await permissoesKanbanObra(u):null
  if(!(await podeConsultarPainelGeral(u,'visao-geral-projetos'))&&!permissaoObra?.consultar)
    return respErro('Acesso não autorizado à Visão Geral ou à obra.',403)
  const empresa=u.empresa_id
  let consultaVendas=db.from('vendas_obras').select('id,numero,cliente_id,obra_id,orcamento_id,created_at,status')
   .eq('empresa_id',empresa)
  if(vendaSelecionada)consultaVendas=consultaVendas.eq('id',vendaSelecionada)
  const vendasR=await consultaVendas.order('created_at',{ascending:false}).limit(500)
  if(vendasR.error)throw vendasR.error
  const vendas=(vendasR.data||[]).filter(v=>!['cancelada','cancelado'].includes(txt(v.status)))
  const ids=(values:(string|null|undefined)[])=>[...new Set(values.filter((v):v is string=>Boolean(v)))]
  const vendaIds=ids(vendas.map(v=>v.id)),obraIds=ids(vendas.map(v=>v.obra_id))
  const clienteIds=ids(vendas.map(v=>v.cliente_id)),orcIds=ids(vendas.map(v=>v.orcamento_id))
  // Na visão filtrada de uma venda, outra venda pode usar a mesma obra.
  // Não atribuir pedidos compartilhados ao orçamento selecionado por engano.
  const todasVendasDaObra=obraIds.length?await db.from('vendas_obras')
    .select('id,cliente_id,obra_id').eq('empresa_id',empresa).in('obra_id',obraIds).limit(5000):{data:[],error:null}
  if(todasVendasDaObra.error)throw todasVendasDaObra.error
  const qtdVendasObra=(obraId:string)=>((todasVendasDaObra.data||[]) as {id:string;obra_id:string}[])
    .filter(v=>v.obra_id===obraId).length
  const buscar=async(tabela:string,campos:string,campo:string,valores:string[])=>{
   if(!valores.length)return [] as any[]
   const resultado:any[]=[]
   for(let i=0;i<valores.length;i+=100){
    const res=await db.from(tabela).select(campos).eq('empresa_id',empresa).in(campo,valores.slice(i,i+100)).limit(5000)
    if(res.error)throw res.error
    resultado.push(...(res.data||[]))
   }
   return resultado
  }
  // Pedido de compra é independente do estado principal do projeto e pode ter vários destinos.
  const pedidosR=await db.from('compras_solicitacoes').select('id,status,cliente_id,obra_id,created_at')
   .eq('empresa_id',empresa).order('created_at',{ascending:false}).limit(500)
  if(pedidosR.error)throw pedidosR.error
  const pedidosAbertos=(pedidosR.data||[]).filter(s=>txt(s.status)!=='cancelado')
  const pedidoIds=pedidosAbertos.map(s=>s.id)
  const [clientes,obras,orcs,compras,ops,instalacoes,medicoes,itensPedido]=await Promise.all([
   buscar('clientes','id,nome','id',clienteIds),
   buscar('obras','id,nome,previsao_entrega,status,observacoes','id',obraIds),
   buscar('orcamentos','id,numero,fotos_urls,observacoes','id',orcIds),
   buscar('compras_necessidades','id,obra_id,status,recebido_em,categoria,quantidade,unidade','obra_id',obraIds),
   buscar('ordens_producao','id,venda_obra_id,status,bloqueada','venda_obra_id',vendaIds),
   buscar('venda_instalacao_itens','id,venda_obra_id,status,quantidade,quantidade_instalada,pendencia,checklist','venda_obra_id',vendaIds),
   buscar('medicoes_finais','id,obra_id,orcamento_id,status_operacional','orcamento_id',orcIds),
   buscar('compras_solicitacao_itens','id,solicitacao_id,destino,cliente_id,obra_id,status,descricao,categoria,quantidade_necessaria,unidade,produto_id','solicitacao_id',pedidoIds),
  ])
  const linhasCompra=await buscar('compras_carrinho_itens',
   'item_id,carrinho_id,quantidade_obra,recebido_obra','item_id',ids(itensPedido.map(i=>i.id)))
  const carrinhos=await buscar('compras_carrinhos',
   'id,fornecedor_id,status,atualizado_por_id','id',ids(linhasCompra.map(x=>x.carrinho_id)))
  const [produtos,fornecedores,responsaveis]=await Promise.all([
   buscar('produtos','id,nome,codigo,foto_url','id',ids(itensPedido.map(x=>x.produto_id))),
   buscar('fornecedores','id,nome','id',ids(carrinhos.map(x=>x.fornecedor_id))),
   buscar('usuarios','id,nome','id',ids(carrinhos.map(x=>x.atualizado_por_id))),
  ])
  const porCarrinho=new Map(carrinhos.map(x=>[x.id,x]))
  const porProduto=new Map(produtos.map(x=>[x.id,x]))
  const fornecedorNome=new Map(fornecedores.map(x=>[x.id,x.nome]))
  const responsavelNome=new Map(responsaveis.map(x=>[x.id,x.nome]))
  const detalhe=(item:any):DetalheMaterialCompra=>{
   const linhas=linhasCompra.filter(x=>x.item_id===item.id)
   const emitidas=linhas.filter(l=>['pedido_emitido','aguardando_entrega','recebido_parcial','recebido'].includes(txt(porCarrinho.get(l.carrinho_id)?.status)))
   const necessario=Number(item.quantidade_necessaria)
   const valido=Number.isFinite(necessario)&&necessario>0
   const comprado=emitidas.reduce((a,l)=>a+Math.max(0,Number(l.quantidade_obra)||0),0)
   const recebidoTotal=emitidas.reduce((a,l)=>a+Math.max(0,Number(l.recebido_obra)||0),0)
   const ultimo=emitidas.length?porCarrinho.get(emitidas[0].carrinho_id):null
   const produto=porProduto.get(item.produto_id)
   return {id:item.id,descricao:String(item.descricao||produto?.nome||'Material'),
    categoria:String(item.categoria||'outros'),quantidade:valido?necessario:null,unidade:String(item.unidade||'UN'),
    comprado:valido?Math.min(necessario,comprado):null,recebido:valido?Math.min(necessario,recebidoTotal):null,
    fornecedor:ultimo?.fornecedor_id?fornecedorNome.get(ultimo.fornecedor_id)||null:null,
    responsavelRegistro:ultimo?.atualizado_por_id?responsavelNome.get(ultimo.atualizado_por_id)||null:null,
    fotoUrl:produto?.foto_url||null}
  }
  // Cartões de pedidos podem ter um cliente/obra que ainda não possui venda.
  const clientesExtras=ids(itensPedido.map(x=>x.cliente_id)).filter(id=>!clienteIds.includes(id))
  const obrasExtras=ids(itensPedido.map(x=>x.obra_id)).filter(id=>!obraIds.includes(id))
  if(clientesExtras.length)clientes.push(...await buscar('clientes','id,nome','id',clientesExtras))
  if(obrasExtras.length)obras.push(...await buscar('obras','id,nome,previsao_entrega,status,observacoes','id',obrasExtras))
  // Agenda financeira é separada de previsão comercial e de instalação física.
  const agendaR=vendaIds.length?await db.from('instalacao_planejamento_reservas')
    .select('venda_obra_id,data_prevista,valor_programado,estado').eq('empresa_id',empresa)
    .in('venda_obra_id',vendaIds).limit(1000):{data:[],error:null}
  if(agendaR.error&&!['PGRST205','42P01'].includes(String(agendaR.error.code||'')))throw agendaR.error
  const agenda=new Map((agendaR.data||[]).filter(a=>a.estado!=='cancelado').map(a=>[a.venda_obra_id,a]))
  const nomeCliente=new Map(clientes.map(c=>[c.id,c.nome]))
  const porObra=new Map(obras.map(o=>[o.id,o]))
  const porOrc=new Map(orcs.map(o=>[o.id,'#'+o.numero]))
  const dadosOrc=new Map(orcs.map(o=>[o.id,o]))
  const fotoReal=(url:unknown):string|null=>
    typeof url==='string' && /^https?:\/\//i.test(url) && !/\.(pdf|zip|docx?)(\?|$)/i.test(url) ? url : null
  const hoje=new Date().toISOString().slice(0,10)
  // O fluxo de Compras por solicitações/carrinhos é a fonte preferencial quando
  // há itens novos vinculados sem ambiguidade a uma única venda da obra.
  const resumoItensAtuais=(itens:any[]):MaterialResumo[]=>{
   return (['perfil','vidro','acessorio'] as const).map(tipo=>{
    const lista=itens.filter(i=>tipoItem(i.categoria)===tipo).map(detalhe)
    if(!lista.length||lista.some(i=>i.quantidade===null||i.comprado===null||i.recebido===null)
       ||new Set(lista.map(i=>txt(i.unidade))).size!==1)
     return {tipo,total:null,comprados:null,recebidos:null}
    const soma=(campo:'quantidade'|'comprado'|'recebido')=>lista.reduce((a,i)=>a+Number(i[campo]||0),0)
    return {tipo,total:soma('quantidade'),comprados:soma('comprado'),recebidos:soma('recebido')}
   })
  }
  const cards=vendas.map(v=>{
   const obra=porObra.get(v.obra_id)
   const orcamento=dadosOrc.get(v.orcamento_id)
   const fotoProjetoUrl=(Array.isArray(orcamento?.fotos_urls)?orcamento.fotos_urls:[]).map(fotoReal).find(Boolean)||null
   const necessidades=(compras as Necessidade[]).filter(c=>Boolean(v.obra_id)&&c.obra_id===v.obra_id&&txt(c.status)!=='cancelado')
   const ordens=ops.filter(o=>o.venda_obra_id===v.id)
   const itens=instalacoes.filter(o=>o.venda_obra_id===v.id)
   const med=medicoes.filter(o=>o.orcamento_id===v.orcamento_id&&(!o.obra_id||o.obra_id===v.obra_id))
   const itensAtuais=itensPedido.filter(i=>i.destino==='obra'&&i.obra_id===v.obra_id
     &&Boolean(v.obra_id)&&qtdVendasObra(v.obra_id)===1
     &&txt(i.status)!=='cancelado')
   const detalhesAtuais=itensAtuais.map(detalhe)
   const semReceberAtuais=detalhesAtuais.filter(i=>i.quantidade!==null&&i.recebido!==null
     &&i.recebido<i.quantidade && i.comprado!==null&&i.comprado>0)
   const recebidosAtuais=detalhesAtuais.filter(i=>i.quantidade!==null&&i.recebido!==null&&i.recebido>=i.quantidade)
   const compradosAtuais=detalhesAtuais.filter(i=>i.comprado!==null&&i.comprado>0)
   const comPedido=necessidades.filter(c=>pedidoFeito(c.status)).length
   const recebidas=necessidades.filter(recebido).length
   const concluidas=ordens.filter(o=>final(o.status)&&!o.bloqueada).length
   const instaladas=itens.filter(item=>{
    const ck=(item.checklist&&typeof item.checklist==='object'?item.checklist:{}) as Record<string,boolean>
    return txt(item.status)==='instalado'&&Number(item.quantidade)>0
     &&Number(item.quantidade_instalada)>=Number(item.quantidade)&&!txt(item.pendencia)
     &&['nivelamento','vedacao','acabamento','limpeza'].every(k=>ck[k]===true)
   }).length
   const falta=necessidades.filter(c=>pedidoFeito(c.status)&&!recebido(c))
   const possuiCompraEmAndamento=necessidades.some(c=>['necessidade','cotacao','aprovado'].includes(txt(c.status)))
   const medIniciada=med.length>0
   const medAprovada=med.length>0&&med.every(m=>txt(m.status_operacional)==='aprovado')
   const materiaisAtuais=itensAtuais.length?
     semReceberAtuais.length?(recebidosAtuais.length?'recebimento_parcial':'aguardando_recebimento'):
     recebidosAtuais.length===itensAtuais.length?'liberados':
     compradosAtuais.length?'pedido_emitido':'em_cotacao':null
   const sinais:EvidenciasProjeto={
    vendaConfirmada:true,projetoConferido:false,conferenciaIniciada:false,
    // Nunca classificar medição como integralmente aprovada apenas pela existência de cabeçalho.
    medicaoFinal:medAprovada?'aprovada':medIniciada?'em_andamento':'pendente',
    materiais:materiaisAtuais??(falta.length?(recebidas?'recebimento_parcial':'aguardando_recebimento')
     :necessidades.length&&recebidas===necessidades.length?'liberados'
     :comPedido?'pedido_emitido':possuiCompraEmAndamento?'em_cotacao':'aguardando_liberacao'),
    producao:ordens.length&&concluidas===ordens.length?'concluida'
     :ordens.some(o=>producaoAndamento(o.status)&&!o.bloqueada)?'em_andamento'
     :ordens.some(o=>o.bloqueada)?'bloqueada':'nao_iniciada',
    instalacao:itens.length&&instaladas===itens.length?'concluida'
     :itens.some(i=>txt(i.status)==='instalado')?'em_andamento'
     :itens.length?'aguardando_agendamento':'nao_iniciada',
    encerramentoConfirmado:txt(v.status)==='concluida',
   }
   const pendencias:string[]=[]
   if(!v.obra_id)pendencias.push('Obra não vinculada à venda')
   if(semReceberAtuais.length)pendencias.push(semReceberAtuais.length+' item(ns) de compras recentes aguardando recebimento')
   if(falta.length)pendencias.push(falta.length+' necessidade(s) com compra efetuada ainda não recebida(s)')
   if(ordens.some(o=>o.bloqueada))pendencias.push('Ordens de produção bloqueadas')
   if(itens.some(i=>txt(i.pendencia)))pendencias.push('Existem pendências na instalação')
   const card=projetarCardGeral({vendaId:v.id,cliente:nomeCliente.get(v.cliente_id)||'Cliente sem cadastro',
    projeto:obra?.nome||'Obra não vinculada',sinais,previsaoEntrega:obra?.previsao_entrega,pendencias},
    COLUNAS_GERAIS_PADRAO,hoje)
   return {...card,clienteId:v.cliente_id,obraId:v.obra_id,numeroOrcamento:porOrc.get(v.orcamento_id)||'não identificado',
    materiais:itensAtuais.length?resumoItensAtuais(itensAtuais):categorias(necessidades),
    compras:itensAtuais.length?{total:itensAtuais.length,comprados:compradosAtuais.length,recebidos:recebidosAtuais.length}:{total:necessidades.length,comprados:comPedido,recebidos:recebidas},
    producao:{total:ordens.length,concluidas},instalacao:{total:itens.length,concluidas:instaladas},
    medicao:{registros:med.length},
    fotoProjetoUrl,dataVenda:v.created_at||null,observacoes:obra?.observacoes||orcamento?.observacoes||null,
    dataInstalacao:agenda.get(v.id)?.data_prevista||null,
    instalacaoMes:agenda.get(v.id)?.data_prevista?.slice(0,7)||null,
    valorInstalacao:agenda.get(v.id)?Number(agenda.get(v.id)?.valor_programado):null,
    detalhesCompra:detalhesAtuais}
  }).filter(c=>c.vendaId)
  // Ajustes visuais do Master, sem alterar Cliente 360 ou status operacionais.
  const controlesR=await db.from('visao_geral_cards_controle')
    .select('venda_id,estado,motivo,updated_at').eq('empresa_id',empresa).limit(1000)
  if(controlesR.error)throw controlesR.error
  const controles=new Map((controlesR.data||[]).map(c=>[c.venda_id,c]))
  const normalizados=cards.map(c=>{
    const controle=controles.get(c.vendaId)
    return controle?.estado==='finalizado'
      ?{...c,etapaOrigem:c.etapaOperacional,etapaOperacional:'finalizado',colunaId:'finalizado',cor:'azul' as const,controleMaster:'finalizado',motivoControle:controle.motivo}
      :{...c,controleMaster:controle?.estado||null,motivoControle:controle?.motivo||null}
  })
  const ativos=normalizados.filter(c=>c.controleMaster!=='oculto')
  const ocultos=(u.role==='master'||permissaoObra?.restaurar)
    ?normalizados.filter(c=>c.controleMaster==='oculto')
      .map(c=>({vendaId:c.vendaId,cliente:c.cliente,numeroOrcamento:c.numeroOrcamento,motivoControle:c.motivoControle}))
    :[]
  const pedidos:PedidoGeralCard[]=[]
  for(const s of pedidosAbertos){
   const lista=itensPedido.filter(i=>i.solicitacao_id===s.id&&i.destino==='obra'&&!['cancelado','cancelamento_solicitado'].includes(txt(i.status)))
   const porDestino=new Map<string,typeof lista>()
   for(const item of lista){if(!item.obra_id)continue;const arr=porDestino.get(item.obra_id)||[];arr.push(item);porDestino.set(item.obra_id,arr)}
   for(const [obraId,linhas] of porDestino){
    const clienteId=linhas[0]?.cliente_id||s.cliente_id||null
    const vendasDaObra=vendas.filter(v=>v.obra_id===obraId&&(!clienteId||v.cliente_id===clienteId))
    const venda=vendasDaObra.length===1&&qtdVendasObra(obraId)===1?vendasDaObra[0]:null
    // Pedido de estoque ou sem venda confirmada fica somente no Compras 360.
    if(!venda)continue
    const situacao=['comprado','pedido_emitido','aguardando_entrega','recebido_parcial'].includes(txt(s.status))?'aguardando':'compras'
    if(venda && controles.get(venda.id)?.estado==='oculto')continue
    pedidos.push({id:s.id+':'+obraId,cliente:clienteId?nomeCliente.get(clienteId)||'Cliente sem cadastro':'Cliente não vinculado',
     clienteId,vendaId:venda?.id||null,numeroOrcamento:venda?porOrc.get(venda.orcamento_id)||null:null,
     status:situacao,descricao:linhas.length===1?String(linhas[0].descricao||'Material solicitado'):'Solicitação com '+linhas.length+' itens',
     itens:linhas.length,recebidos:linhas.filter(l=>{const d=detalhe(l);return d.quantidade!==null&&d.recebido!==null&&d.recebido>=d.quantidade}).length,
     detalhesCompra:linhas.map(detalhe)})
   }
  }
  // Cards manuais são visuais e auditados. Nunca representam pedidos emitidos.
  let kanbanObraConfigurado=true
  let manuais:any[]=[]
  let manuaisQuery=db.from('kanban_obra_cards_manuais')
   .select('id,venda_id,titulo,descricao,etapa,retirado_em,created_at,updated_at')
   .eq('empresa_id',empresa).order('created_at',{ascending:false}).limit(2000)
  if(vendaSelecionada)manuaisQuery=manuaisQuery.eq('venda_id',vendaSelecionada)
  const manuaisR=await manuaisQuery
  if(manuaisR.error){
   if(['42P01','PGRST205'].includes(String(manuaisR.error.code||'')))kanbanObraConfigurado=false
   else throw manuaisR.error
  }else manuais=manuaisR.data||[]
  const vendasPorId=new Map(vendas.map(v=>[v.id,v]))
  const acompanhamentos=manuais.filter(m=>!m.retirado_em&&vendasPorId.has(m.venda_id)).map(m=>{
   const venda=vendasPorId.get(m.venda_id)!
   return {id:m.id,vendaId:m.venda_id,clienteId:venda.cliente_id,
    cliente:nomeCliente.get(venda.cliente_id)||'Cliente',numeroOrcamento:porOrc.get(venda.orcamento_id)||null,
    titulo:m.titulo,descricao:m.descricao,etapa:m.etapa,createdAt:m.created_at}
  })
  const retiradosManuais=(u.role==='master'||permissaoObra?.restaurar)
   ?manuais.filter(m=>m.retirado_em&&vendasPorId.has(m.venda_id)).map(m=>({
     id:m.id,vendaId:m.venda_id,titulo:m.titulo,etapa:m.etapa,retiradoEm:m.retirado_em
    })):[]
  return NextResponse.json({cards:ativos,ocultos,pedidos,acompanhamentos,retiradosManuais,
   permissoesObra:permissaoObra,kanbanObraConfigurado,
   usuarioMaster:u.role==='master',atualizadoEm:new Date().toISOString(),
   observacao:'Os percentuais sem quantidades ou unidades conciliadas são exibidos como Não apurado. Agendamentos não foram inferidos a partir da entrega da obra.'},
   {headers:{'Cache-Control':'no-store'}})
 }catch(e){console.error('visao geral de projetos GET',e);return respErro('Não foi possível consultar a Visão Geral de Projetos.',500)}
}
