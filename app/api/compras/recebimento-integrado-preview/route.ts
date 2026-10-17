import {NextRequest,NextResponse} from 'next/server'
import {autenticarCompras} from '@/lib/comprasServer'
import {obterComprasAcessos} from '@/lib/comprasPermissoesServer'
import {supabaseAdmin as db} from '@/lib/supabaseAdmin'
export const dynamic='force-dynamic'

/** Etapa 2: somente leitura, sem escrita nem movimentacao de estoque. */
export async function GET(req:NextRequest){
 const u=await autenticarCompras(req)
 if(!u)return NextResponse.json({error:'Sessão inválida'},{status:401})
 try{
  const acesso=await obterComprasAcessos(u)
  if(!(acesso.consultar||acesso.comprar||acesso.cotar||acesso.receber||acesso.conferir))
   return NextResponse.json({error:'Sem permissão para acompanhar recebimento de compras'},{status:403})
  const empresa=u.empresa_id
  const [cartR,prodR]=await Promise.all([
   db.from('compras_carrinhos').select('id,fornecedor_id,status,pedido_emitido_em')
     .eq('empresa_id',empresa).not('status','in','(rascunho,cancelado)').order('created_at',{ascending:false}).limit(70),
   db.from('produtos').select('id,codigo,nome,categoria,foto_url,unidade')
     .eq('empresa_id',empresa).eq('ativo',true).eq('categoria','acessorio')
     .ilike('nome','%fechadur%').not('foto_url','is',null).order('nome').limit(10)
  ])
  if(cartR.error||prodR.error)throw cartR.error||prodR.error
  const carrinhos=cartR.data||[],cartIds=carrinhos.map(x=>x.id)
  const {data:linhas,error:el}=cartIds.length?await db.from('compras_carrinho_itens')
   .select('id,carrinho_id,item_id,quantidade_obra,quantidade_estoque,recebido_obra,recebido_estoque')
   .eq('empresa_id',empresa).in('carrinho_id',cartIds).limit(2500):{data:[],error:null}
  if(el)throw el
  const itemIds=[...new Set((linhas||[]).map(l=>l.item_id))]
  const {data:itens,error:ei}=itemIds.length?await db.from('compras_solicitacao_itens')
   .select('id,solicitacao_id,produto_id,descricao,categoria').eq('empresa_id',empresa).in('id',itemIds):{data:[],error:null}
  if(ei)throw ei
  const solIds=[...new Set((itens||[]).map(x=>x.solicitacao_id))]
  const fornecedorIds=[...new Set(carrinhos.map(x=>x.fornecedor_id))]
  const produtoIds=[...new Set((itens||[]).map(x=>x.produto_id).filter(Boolean))]
  const [solR,forR,prodPedidoR]=await Promise.all([
   solIds.length?db.from('compras_solicitacoes').select('id,cliente_id,obra_id,destino').eq('empresa_id',empresa).in('id',solIds):Promise.resolve({data:[],error:null}),
   fornecedorIds.length?db.from('fornecedores').select('id,nome').eq('empresa_id',empresa).in('id',fornecedorIds):Promise.resolve({data:[],error:null}),
   produtoIds.length?db.from('produtos').select('id,nome,codigo,categoria,unidade,foto_url').eq('empresa_id',empresa).in('id',produtoIds):Promise.resolve({data:[],error:null})
  ])
  if(solR.error||forR.error||prodPedidoR.error)throw solR.error||forR.error||prodPedidoR.error
  const clienteIds=[...new Set((solR.data||[]).map(s=>s.cliente_id).filter(Boolean))]
  const obraIds=[...new Set((solR.data||[]).map(s=>s.obra_id).filter(Boolean))]
  const [clienteR,obraR]=await Promise.all([
   clienteIds.length?db.from('clientes').select('id,nome').eq('empresa_id',empresa).in('id',clienteIds):Promise.resolve({data:[],error:null}),
   obraIds.length?db.from('obras').select('id,nome,cliente_id').eq('empresa_id',empresa).in('id',obraIds):Promise.resolve({data:[],error:null})
  ])
  if(clienteR.error||obraR.error)throw clienteR.error||obraR.error
  const mapa=<T extends {id:string}>(lista:T[])=>new Map(lista.map(x=>[x.id,x]))
  const mIt=mapa(itens||[]),mSol=mapa(solR.data||[]),mCli=mapa(clienteR.data||[]),mOb=mapa(obraR.data||[])
  const mFor=mapa(forR.data||[]),mProd=mapa(prodPedidoR.data||[])
  const cards=(linhas||[]).map(l=>{
   const c=carrinhos.find(x=>x.id===l.carrinho_id)
   if(!c)return null
   const i=mIt.get(l.item_id),s=i?mSol.get(i.solicitacao_id):null
   const p=i?.produto_id?mProd.get(i.produto_id):null
   return{id:l.id,carrinhoId:c.id,fornecedor:mFor.get(c.fornecedor_id)?.nome||'Fornecedor',
    status:c.status,pedidoEm:c.pedido_emitido_em,descricao:i?.descricao||'Material',
    produtoNome:p?.nome||null,produtoCodigo:p?.codigo||null,produtoImagem:p?.foto_url||null,
    categoria:i?.categoria||'outros',unidade:p?.unidade||'UN',
    cliente:s?.cliente_id?mCli.get(s.cliente_id)?.nome||'Cliente':null,
    obra:s?.obra_id?mOb.get(s.obra_id)?.nome||'Obra':null,
    destino:s?.destino||'estoque',necessidadeObra:Number(l.quantidade_obra),necessidadeEstoque:Number(l.quantidade_estoque),
    recebidoObra:Number(l.recebido_obra),recebidoEstoque:Number(l.recebido_estoque)}
  }).filter(Boolean)
  return NextResponse.json({acessos:{consultar:acesso.consultar,receber:acesso.receber,conferir:acesso.conferir},
    cards,produtoDemonstracao:(prodR.data||[]).find(p=>p.foto_url)||null,
    aviso:'PRÉVIA SEM GRAVAÇÃO. A conferência física de NF continua na rotina original; este painel apenas projeta o vínculo ao pedido e à obra.'},
    {headers:{'Cache-Control':'no-store'}})
 }catch(e){console.error('[compras recebimento preview]',e);return NextResponse.json({error:'Não foi possível carregar a prévia de recebimento'},{status:503})}
}
