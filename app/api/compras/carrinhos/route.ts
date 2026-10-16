import {NextRequest,NextResponse} from 'next/server'
import {autenticarCompras} from '@/lib/comprasServer'
import {obterComprasAcessos} from '@/lib/comprasPermissoesServer'
import {supabaseAdmin as db} from '@/lib/supabaseAdmin'

export const dynamic='force-dynamic'
const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i
const erro=(m:string,s=400)=>NextResponse.json({error:m},{status:s})
const n=(v:unknown)=>v===null||v===undefined||v===''?null:Number(v)

export async function POST(req:NextRequest){
 const u=await autenticarCompras(req);if(!u)return erro('Sessão inválida',401)
 let criadoId:string|null=null
 try{
  const a=await obterComprasAcessos(u);if(!a.cotar)return erro('Sem permissão para montar carrinhos',403)
  const b=await req.json().catch(()=>null)
  if(!b||!uuid.test(String(b.itemId||''))||!uuid.test(String(b.fornecedorId||'')))return erro('Selecione um item e fornecedor')
  const qo=n(b.quantidadeObra)??0,qe=n(b.quantidadeEstoque)??0,pu=n(b.precoUnitario)
  if(![qo,qe].every(Number.isFinite)||qo<0||qe<0||qo+qe<=0||pu==null||!Number.isFinite(pu)||pu<0)return erro('Quantidades e preço precisam ser válidos')
  const [itR,forR]=await Promise.all([
   db.from('compras_solicitacao_itens').select('id,solicitacao_id,status,produto_id,identificacao_status').eq('empresa_id',u.empresa_id).eq('id',b.itemId).maybeSingle(),
   db.from('fornecedores').select('id,nome,pedido_minimo').eq('empresa_id',u.empresa_id).eq('id',b.fornecedorId).eq('ativo',true).maybeSingle()
  ])
  if(itR.error||forR.error)throw itR.error||forR.error
  const item=itR.data,forn=forR.data
  if(!item||item.status!=='ativo'||!forn)return erro('Item cancelado ou com exclusão pendente. Revise a solicitação antes de incluir no carrinho.',409)
  if(!item.produto_id||item.identificacao_status!=='validado')return erro('O comprador deve identificar e validar o produto antes da cotação')
  let carrinhoId=String(b.carrinhoId||'')
  if(carrinhoId){
   if(!uuid.test(carrinhoId))return erro('Carrinho inválido')
   const {data:c}=await db.from('compras_carrinhos').select('id,status').eq('empresa_id',u.empresa_id).eq('id',carrinhoId).eq('fornecedor_id',forn.id).maybeSingle()
   if(!c||c.status!=='rascunho')return erro('O carrinho escolhido não aceita novos itens')
  }else{
   const {data:c,error:ec}=await db.from('compras_carrinhos').insert({empresa_id:u.empresa_id,fornecedor_id:forn.id,criado_por_id:u.id,atualizado_por_id:u.id}).select('id').single()
   if(ec)throw ec
   carrinhoId=c.id;criadoId=c.id
  }
  const {data:existente,error:ee}=await db.from('compras_carrinho_itens').select('id').eq('empresa_id',u.empresa_id).eq('carrinho_id',carrinhoId).eq('item_id',item.id).maybeSingle()
  if(ee)throw ee
  const linha={empresa_id:u.empresa_id,carrinho_id:carrinhoId,item_id:item.id,
   quantidade_obra:qo,quantidade_estoque:qe,preco_unitario:pu,atualizado_por_id:u.id}
  const gravar=existente?db.from('compras_carrinho_itens').update(linha).eq('empresa_id',u.empresa_id).eq('id',existente.id):db.from('compras_carrinho_itens').insert(linha)
  const {error:el}=await gravar
  if(el)throw el
  // O estado do pedido acompanha o carrinho do fornecedor. Sempre considerar
  // todos os itens daquele carrinho para calcular o pedido mínimo do fornecedor.
  const {data:linhasAtualizadas,error:elc}=await db.from('compras_carrinho_itens')
    .select('quantidade_obra,quantidade_estoque,preco_unitario')
    .eq('empresa_id',u.empresa_id).eq('carrinho_id',carrinhoId)
  if(elc)throw elc
  const subtotal=(linhasAtualizadas||[]).reduce((total,l)=>total+
    (Number(l.quantidade_obra)+Number(l.quantidade_estoque))*Number(l.preco_unitario||0),0)
  const atingiuMinimo=!(linhasAtualizadas||[]).some(l=>l.preco_unitario===null)
    && subtotal>=Number(forn.pedido_minimo||0)
  const proximoStatus=atingiuMinimo?'em_cotacao':'aguardando_minimo'
  const {error:es}=await db.from('compras_solicitacoes')
    .update({status:proximoStatus,atualizado_por_id:u.id,updated_at:new Date().toISOString()})
    .eq('empresa_id',u.empresa_id).eq('id',item.solicitacao_id)
    .in('status',['aguardando_validacao','em_cotacao','aguardando_minimo'])
  if(es){console.error('[compras carrinhos] solicitacao status sync',es)}
  return NextResponse.json({ok:true,carrinhoId,pedidoMinimoAtingido:atingiuMinimo,
    faltaMinimo:Math.max(0,Number(forn.pedido_minimo||0)-subtotal),
    aviso:es?'O item foi vinculado, mas o status da solicitação exige revisão.':null})
 }catch(e){
  if(criadoId)await db.from('compras_carrinhos').delete().eq('empresa_id',u.empresa_id).eq('id',criadoId)
  console.error('[compras carrinhos POST]',e)
  return erro(e instanceof Error?e.message:'Não foi possível adicionar item ao carrinho',500)
 }
}

export async function PATCH(req:NextRequest){
 const u=await autenticarCompras(req);if(!u)return erro('Sessão inválida',401)
 try{
  const a=await obterComprasAcessos(u);if(!a.comprar)return erro('Sem permissão para confirmar a compra',403)
  const b=await req.json().catch(()=>null)
  const id=String(b?.carrinhoId||'')
  if(!uuid.test(id))return erro('Carrinho inválido')
  const {data:c,error:e}=await db.from('compras_carrinhos').select('id,status,fornecedor_id').eq('empresa_id',u.empresa_id).eq('id',id).maybeSingle()
  if(e)throw e
  if(!c)return erro('Carrinho não encontrado',404)
  if(c.status!=='rascunho')return erro('Carrinho já confirmado',409)
  const [linhasR,fornR]=await Promise.all([
   db.from('compras_carrinho_itens').select('item_id,quantidade_obra,quantidade_estoque,preco_unitario').eq('empresa_id',u.empresa_id).eq('carrinho_id',id),
   db.from('fornecedores').select('pedido_minimo,nome').eq('empresa_id',u.empresa_id).eq('id',c.fornecedor_id).maybeSingle()
  ])
  if(linhasR.error||fornR.error)throw linhasR.error||fornR.error
  if(!fornR.data||!(linhasR.data||[]).length)return erro('Carrinho sem fornecedor ou itens')
  const linhas=linhasR.data||[]
  // Item com cancelamento solicitado jamais pode ser comprado automaticamente.
  const {data:itensAtivos,error:eia}=await db.from('compras_solicitacao_itens')
   .select('id,status').eq('empresa_id',u.empresa_id).in('id',linhas.map(x=>x.item_id))
  if(eia)throw eia
  if((itensAtivos||[]).length!==linhas.length||(itensAtivos||[]).some(x=>x.status!=='ativo'))
   return erro('Carrinho contém material excluído ou com exclusão solicitada. Revise antes de confirmar a compra.',409)
  if(linhas.some(x=>x.preco_unitario===null))return erro('Confirme todos os preços do pedido')
  const total=linhas.reduce((s,x)=>s+(Number(x.quantidade_obra)+Number(x.quantidade_estoque))*Number(x.preco_unitario),0)
  const minimo=Number(fornR.data.pedido_minimo||0)
  if(total+0.00001<minimo)return erro(`Pedido mínimo não atingido. Faltam R$ ${(minimo-total).toFixed(2)}`,409)
  const {error:em}=await db.from('compras_carrinhos').update({status:'pedido_emitido',pedido_emitido_em:new Date().toISOString(),atualizado_por_id:u.id,updated_at:new Date().toISOString()})
   .eq('empresa_id',u.empresa_id).eq('id',id).eq('status','rascunho')
  if(em)throw em
  // Atualiza a solicitacao como "comprado" somente quando TODOS os itens ativos
  // tiverem quantidades suficientes em carrinhos efetivamente comprados.
  // Uma lista com dez perfis e apenas cinco comprados continua parcial/em cotacao.
  const {data:origens,error:eo}=await db.from('compras_solicitacao_itens').select('id,solicitacao_id')
   .eq('empresa_id',u.empresa_id).in('id',linhas.map(x=>x.item_id))
  if(eo)throw eo
  const solicitacoes=[...new Set((origens||[]).map(x=>x.solicitacao_id))]
  for(const sid of solicitacoes){
   const [solR,itR]=await Promise.all([
    db.from('compras_solicitacoes').select('id,destino,status').eq('empresa_id',u.empresa_id).eq('id',sid).maybeSingle(),
    db.from('compras_solicitacao_itens').select('id,quantidade_necessaria,destino').eq('empresa_id',u.empresa_id).eq('solicitacao_id',sid).eq('status','ativo')
   ])
   if(solR.error||itR.error)throw solR.error||itR.error
   if(!solR.data||!itR.data?.length)continue
   const {data:links,error:el}=await db.from('compras_carrinho_itens').select('item_id,carrinho_id,quantidade_obra,quantidade_estoque')
    .eq('empresa_id',u.empresa_id).in('item_id',itR.data.map(x=>x.id))
   if(el)throw el
   const cid=[...new Set((links||[]).map(x=>x.carrinho_id))]
   const carts=cid.length?await db.from('compras_carrinhos').select('id,status').eq('empresa_id',u.empresa_id).in('id',cid):{data:[],error:null}
   if(carts.error)throw carts.error
   const emitidos=new Set((carts.data||[]).filter(c=>!['rascunho','cancelado'].includes(c.status)).map(c=>c.id))
   const completos=itR.data.every(it=>{
    const comprado=(links||[]).filter(l=>l.item_id===it.id&&emitidos.has(l.carrinho_id))
    if(it.destino==='estoque')return comprado.some(l=>Number(l.quantidade_estoque)>0)
    return comprado.reduce((acc,l)=>acc+Number(l.quantidade_obra),0)>=Number(it.quantidade_necessaria)
   })
   const {error:estatus}=await db.from('compras_solicitacoes').update({status:completos?'comprado':'em_cotacao',
    atualizado_por_id:u.id,updated_at:new Date().toISOString()}).eq('empresa_id',u.empresa_id).eq('id',sid)
    .in('status',['aguardando_validacao','em_cotacao','aguardando_minimo','comprado'])
   if(estatus)throw estatus
  }
  return NextResponse.json({ok:true,total,pedidoEmitido:true,semMovimentacaoEstoque:true})
 }catch(e){console.error('[compras carrinhos PATCH]',e);return erro('Não foi possível confirmar o carrinho. Verifique se está completo.',500)}
}
