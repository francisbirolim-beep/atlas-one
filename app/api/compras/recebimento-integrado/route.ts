import {NextRequest,NextResponse} from 'next/server'
import {autenticarCompras} from '@/lib/comprasServer'
import {obterComprasAcessos} from '@/lib/comprasPermissoesServer'
import {supabaseAdmin as db} from '@/lib/supabaseAdmin'
export const dynamic='force-dynamic'
const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i
const erro=(m:string,s=400)=>NextResponse.json({error:m},{status:s})
type Row={id:string;[key:string]:any}
const arr=(a:unknown):Row[]=>Array.isArray(a)?a:[]
export async function GET(req:NextRequest){
 const u=await autenticarCompras(req);if(!u)return erro('Sessão inválida',401)
 try{
  const a=await obterComprasAcessos(u)
  if(!a.receber&&!a.conferir&&!a.consultar&&!a.comprar)return erro('Sem permissão para acompanhar recebimentos',403)
  const empresa=u.empresa_id
  const [rRecebimentos,rCarrinhos]=await Promise.all([
   db.from('compras_recebimentos').select('id,nf_id,status,data_recebimento,recebido_por_nome').eq('empresa_id',empresa).eq('status','concluido').order('data_recebimento',{ascending:false}).limit(150),
   db.from('compras_carrinhos').select('id,fornecedor_id,status,pedido_emitido_em').eq('empresa_id',empresa).in('status',['pedido_emitido','aguardando_entrega','recebido_parcial','recebido']).order('created_at',{ascending:false}).limit(150)
  ])
  if(rRecebimentos.error||rCarrinhos.error)throw rRecebimentos.error||rCarrinhos.error
  const recs=arr(rRecebimentos.data),carts=arr(rCarrinhos.data)
  const recIds=recs.map(x=>x.id),carIds=carts.map(x=>x.id)
  const [riR,ciR]=await Promise.all([
   recIds.length?db.from('compras_recebimento_itens').select('id,recebimento_id,nf_item_id,produto_id,quantidade_recebida,quantidade_avariada').eq('empresa_id',empresa).in('recebimento_id',recIds).limit(2500):Promise.resolve({data:[],error:null}),
   carIds.length?db.from('compras_carrinho_itens').select('id,carrinho_id,item_id,quantidade_obra,quantidade_estoque,recebido_obra,recebido_estoque').eq('empresa_id',empresa).in('carrinho_id',carIds).limit(2500):Promise.resolve({data:[],error:null})
  ])
  if(riR.error||ciR.error)throw riR.error||ciR.error
  const ris=arr(riR.data),cis=arr(ciR.data)
  const riIds=ris.map(x=>x.id),nfIds=[...new Set(recs.map(x=>x.nf_id))],nfItemIds=[...new Set(ris.map(x=>x.nf_item_id))],itemIds=[...new Set(cis.map(x=>x.item_id))]
  const [movR,distR,nfR,nfItR,itR]=await Promise.all([
   riIds.length?db.from('estoque_movimentos').select('recebimento_item_id,produto_id,quantidade').eq('empresa_id',empresa).eq('origem_tipo','recebimento_nf').eq('tipo','entrada').in('recebimento_item_id',riIds).limit(3500):Promise.resolve({data:[],error:null}),
   riIds.length?db.from('compras_recebimento_destinos').select('id,recebimento_item_id,carrinho_item_id,quantidade_obra,quantidade_estoque,criado_em').eq('empresa_id',empresa).in('recebimento_item_id',riIds).order('criado_em',{ascending:false}).limit(2500):Promise.resolve({data:[],error:null}),
   nfIds.length?db.from('compras_nfs').select('id,numero,fornecedor_id,fornecedor_nome,status').eq('empresa_id',empresa).in('id',nfIds):Promise.resolve({data:[],error:null}),
   nfItemIds.length?db.from('compras_nf_itens').select('id,nf_id,produto_id,descricao,fator_conversao,unidade_estoque').eq('empresa_id',empresa).in('id',nfItemIds):Promise.resolve({data:[],error:null}),
   itemIds.length?db.from('compras_solicitacao_itens').select('id,solicitacao_id,produto_id,descricao,unidade,destino,cliente_id,obra_id,status').eq('empresa_id',empresa).in('id',itemIds):Promise.resolve({data:[],error:null}),
  ])
  for(const r of [movR,distR,nfR,nfItR,itR])if(r.error)throw r.error
  const si=arr(itR.data),nfis=arr(nfItR.data)
  const produtoIds=[...new Set([...si.map(x=>x.produto_id),...nfis.map(x=>x.produto_id)].filter(Boolean))]
  const cliIds=[...new Set(si.map(x=>x.cliente_id).filter(Boolean))],obraIds=[...new Set(si.map(x=>x.obra_id).filter(Boolean))]
  const fornecedorIds=[...new Set(carts.map(x=>x.fornecedor_id))]
  const [prR,clR,obR,forR]=await Promise.all([
   produtoIds.length?db.from('produtos').select('id,nome,codigo,foto_url,unidade').eq('empresa_id',empresa).in('id',produtoIds):Promise.resolve({data:[],error:null}),
   cliIds.length?db.from('clientes').select('id,nome').eq('empresa_id',empresa).in('id',cliIds):Promise.resolve({data:[],error:null}),
   obraIds.length?db.from('obras').select('id,nome').eq('empresa_id',empresa).in('id',obraIds):Promise.resolve({data:[],error:null}),
   fornecedorIds.length?db.from('fornecedores').select('id,nome').eq('empresa_id',empresa).in('id',fornecedorIds):Promise.resolve({data:[],error:null})
  ])
  for(const r of [prR,clR,obR,forR])if(r.error)throw r.error
  const m=(rows:Row[])=>new Map<string,Row>(rows.map(x=>[x.id,x]))
  const nf=m(arr(nfR.data)),nfi=m(nfis),prod=m(arr(prR.data)),cli=m(arr(clR.data)),ob=m(arr(obR.data)),forn=m(arr(forR.data)),cart=m(carts),item=m(si),rec=m(recs)
  const dist=arr(distR.data)
  const movs=new Map<string,number>()
  for(const a of arr(movR.data))movs.set(a.recebimento_item_id,(movs.get(a.recebimento_item_id)||0)+Number(a.quantidade))
  const alocados=new Map<string,number>()
  for(const a of dist)alocados.set(a.recebimento_item_id,(alocados.get(a.recebimento_item_id)||0)+Number(a.quantidade_obra)+Number(a.quantidade_estoque))
  const notas=ris.map(ri=>{
   const rn=rec.get(ri.recebimento_id),nfiRow=nfi.get(ri.nf_item_id),nfRow=rn?nf.get(rn.nf_id):null,p=nfiRow?.produto_id?prod.get(nfiRow.produto_id):null
   const contabilizado=movs.get(ri.id)||0,alocado=alocados.get(ri.id)||0
   return {id:ri.id,nfItemId:ri.nf_item_id,nfNumero:nfRow?.numero||'Sem número',nfId:rn?.nf_id||null,
    fornecedorId:nfRow?.fornecedor_id||null,fornecedor:nfRow?.fornecedor_nome||'Fornecedor',recebimentoEm:rn?.data_recebimento||null,
    produtoId:nfiRow?.produto_id||null,produtoNome:p?.nome||nfiRow?.descricao||'Produto',fotoUrl:p?.foto_url||null,unidade:p?.unidade||nfiRow?.unidade_estoque||'UN',
    contabilizado,alocado,disponivel:Math.max(0,contabilizado-alocado)}
  }).filter(n=>n.contabilizado>0)
  const linhas=cis.map(l=>{
   const c=cart.get(l.carrinho_id),i=item.get(l.item_id),p=i?.produto_id?prod.get(i.produto_id):null
   return{id:l.id,carrinhoId:l.carrinho_id,fornecedorId:c?.fornecedor_id||null,fornecedor:c?.fornecedor_id?forn.get(c.fornecedor_id)?.nome||'Fornecedor':'Fornecedor',
    descricao:i?.descricao||'Produto',produtoId:i?.produto_id||null,produtoNome:p?.nome||null,fotoUrl:p?.foto_url||null,unidade:p?.unidade||'UN',
    cliente:i?.cliente_id?cli.get(i.cliente_id)?.nome||'Cliente':null,obra:i?.obra_id?ob.get(i.obra_id)?.nome||'Obra':null,
    destino:i?.destino||'estoque',status:i?.status||'pendente',
    quantidadeObra:Number(l.quantidade_obra),quantidadeEstoque:Number(l.quantidade_estoque),recebidoObra:Number(l.recebido_obra),recebidoEstoque:Number(l.recebido_estoque),
    statusCarrinho:c?.status||'pendente'}
  })
  return NextResponse.json({notas,linhas,historico:dist,acessos:{receber:a.receber,conferir:a.conferir},
   aviso:'A NF é a única responsável pela entrada física. Esta tela só registra a destinação do material já conferido.'},
   {headers:{'Cache-Control':'no-store'}})
 }catch(e){console.error('[compras recebimento integrado GET]',e);return erro('Não foi possível carregar a distribuição de recebimentos',503)}
}
export async function POST(req:NextRequest){
 const u=await autenticarCompras(req);if(!u)return erro('Sessão inválida',401)
 try{
  const a=await obterComprasAcessos(u);if(!a.receber)return erro('Sem permissão para destinar recebimento',403)
  const p=await req.json().catch(()=>null),rid=String(p?.recebimentoItemId||''),cid=String(p?.carrinhoItemId||'')
  const qo=Number(p?.quantidadeObra??0),qe=Number(p?.quantidadeEstoque??0)
  if(!uuid.test(rid)||!uuid.test(cid)||![qo,qe].every(Number.isFinite)||qo<0||qe<0||qo+qe<=0)return erro('Informe uma conferência, um item de pedido e quantidades positivas')
  const {data,error}=await db.rpc('registrar_destino_recebimento_compras',{
   p_empresa_id:u.empresa_id,p_recebimento_item_id:rid,p_carrinho_item_id:cid,
   p_quantidade_obra:qo,p_quantidade_estoque:qe,p_usuario_id:u.id
  })
  if(error){const msg=String(error.message||'Falha no vínculo');
   const esperado=['excede','Produto','Fornecedor','conferência','comprado','cancelado','recebida','duplic','registrado','não encontrado','positivo','receber','usuário','Usuário','quantidade','estoque','pedido']
   if(esperado.some(x=>msg.toLowerCase().includes(x.toLowerCase())))return erro(msg,409)
   console.error('[compras destino RPC]',error);return erro('Não foi possível distribuir o recebimento',503)}
  return NextResponse.json({resultado:data})
 }catch(e){console.error('[compras recebimento integrado POST]',e);return erro('Não foi possível confirmar a destinação do material',503)}
}
