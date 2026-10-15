import {NextRequest,NextResponse} from 'next/server'
import {autenticarCompras} from '@/lib/comprasServer'
import {obterComprasAcessos} from '@/lib/comprasPermissoesServer'
import {supabaseAdmin as db} from '@/lib/supabaseAdmin'
export const dynamic='force-dynamic'
const erro=(m:string,s=400)=>NextResponse.json({error:m},{status:s})
export async function GET(req:NextRequest,{params}:{params:{clienteId:string}}){
 const u=await autenticarCompras(req);if(!u)return erro('Sessão inválida',401)
 try{
  const a=await obterComprasAcessos(u),todos=a.consultar||a.cotar||a.comprar||a.editarTodos
  if(!todos&&!a.verProprios&&!a.editarProprios)return erro('Sem permissão para acompanhar compras',403)
  const {data:cliente,error:ec}=await db.from('clientes').select('id').eq('empresa_id',u.empresa_id).eq('id',params.clienteId).maybeSingle()
  if(ec)throw ec;if(!cliente)return erro('Cliente não encontrado',404)
  let q=db.from('compras_solicitacoes').select('id,cliente_id,obra_id,solicitante_id,solicitante_nome,status,created_at')
   .eq('empresa_id',u.empresa_id).eq('cliente_id',cliente.id).order('created_at',{ascending:false}).limit(150)
  if(!todos)q=q.eq('solicitante_id',u.id)
  const {data:sols,error:es}=await q;if(es)throw es
  const ids=(sols||[]).map(x=>x.id)
  if(!ids.length)return NextResponse.json({solicitacoes:[]})
  const {data:itens,error:ei}=await db.from('compras_solicitacao_itens').select('id,solicitacao_id,descricao,quantidade_necessaria,unidade,status')
   .eq('empresa_id',u.empresa_id).in('solicitacao_id',ids).order('ordem').limit(2500)
  if(ei)throw ei
  const itemIds=(itens||[]).map(i=>i.id)
  const [linhasR,obrasR]=await Promise.all([
   itemIds.length?db.from('compras_carrinho_itens').select('id,item_id,carrinho_id,quantidade_obra,quantidade_estoque')
    .eq('empresa_id',u.empresa_id).in('item_id',itemIds).limit(2500):Promise.resolve({data:[],error:null}),
   db.from('obras').select('id,nome').eq('empresa_id',u.empresa_id).in('id',[...new Set((sols||[]).map(s=>s.obra_id).filter(Boolean))]),
  ])
  if(linhasR.error||obrasR.error)throw linhasR.error||obrasR.error
  const cartIds=[...new Set((linhasR.data||[]).map(l=>l.carrinho_id))]
  const {data:cart, error:er}=cartIds.length?await db.from('compras_carrinhos').select('id,fornecedor_id,status,pedido_emitido_em,recebido_em')
   .eq('empresa_id',u.empresa_id).in('id',cartIds):{data:[],error:null}
  if(er)throw er
  const fornIds=[...new Set((cart||[]).map(c=>c.fornecedor_id))]
  const {data:fornecedores}=fornIds.length?await db.from('fornecedores').select('id,nome').eq('empresa_id',u.empresa_id).in('id',fornIds):{data:[]}
  const nomeFornecedor=new Map((fornecedores||[]).map(f=>[f.id,f.nome]))
  const cartMap=new Map((cart||[]).map(c=>[c.id,c]))
  const obras=new Map((obrasR.data||[]).map(o=>[o.id,o.nome]))
  const r=(sols||[]).map(s=>({...s,obra_nome:s.obra_id?obras.get(s.obra_id)||'Obra':'Pedido avulso',
   itens:(itens||[]).filter(i=>i.solicitacao_id===s.id).map(i=>{
    const compras=(linhasR.data||[]).filter(l=>l.item_id===i.id).map(l=>({linha:l,cart:cartMap.get(l.carrinho_id)}))
     .filter(v=>v.cart&& !['cancelado','rascunho'].includes(v.cart.status))
    const total=compras.reduce((n,v)=>n+Number(v.linha.quantidade_obra||0),0)
    const situacao=i.status==='cancelado'?'cancelado':!compras.length?'aguardando_compra':
     i.quantidade_necessaria!=null&&total<Number(i.quantidade_necessaria)?'comprado_parcial':'comprado'
    return {id:i.id,descricao:i.descricao,quantidade_necessaria:i.quantidade_necessaria,unidade:i.unidade,
     status:situacao,compras:todos?compras.map(v=>({fornecedor:nomeFornecedor.get(v.cart!.fornecedor_id)||'Fornecedor',
      comprado_em:v.cart!.pedido_emitido_em,quantidade_obra:v.linha.quantidade_obra,quantidade_estoque:v.linha.quantidade_estoque,
      status:v.cart!.status})):[]}
   })}))
  return NextResponse.json({solicitacoes:r},{headers:{'Cache-Control':'no-store'}})
 }catch(e){console.error('[compras cliente]',e);return erro('Não foi possível consultar as compras deste cliente',503)}
}
