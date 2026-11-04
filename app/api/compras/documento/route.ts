import {NextRequest,NextResponse} from 'next/server'
import {autenticarCompras} from '@/lib/comprasServer'
import {obterComprasAcessos} from '@/lib/comprasPermissoesServer'
import {supabaseAdmin as db} from '@/lib/supabaseAdmin'
import {gerarPdfCompra,numeroCompra,type DocumentoCompra,type ItemDocumentoCompra} from '@/lib/comprasDocumento'
export const dynamic='force-dynamic'
export const runtime='nodejs'
const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i
const err=(m:string,s=400)=>NextResponse.json({error:m},{status:s})
function destinoText(x:{destino:string;cliente?:string;obra?:string}){
 if(x.destino==='estoque')return 'Estoque'
 return x.cliente?(x.cliente+(x.obra?' / '+x.obra:' / Compra avulsa')):'Cliente / obra'
}
export async function GET(req:NextRequest){
 const u=await autenticarCompras(req)
 if(!u)return err('Sessão inválida.',401)
 try{
  const p=req.nextUrl.searchParams
  const tipo=p.get('tipo')||''
  const id=p.get('id')||''
  if(!uuid.test(id)||(tipo!=='solicitacao'&&tipo!=='necessidade'&&tipo!=='carrinho'))return err('Identificador do pedido inválido.')
  const acesso=await obterComprasAcessos(u)
  const consulta=acesso.consultar||acesso.cotar||acesso.comprar||acesso.aprovar||acesso.editarTodos
  const proprio=acesso.solicitar||acesso.verProprios||acesso.editarProprios
  if(!consulta&&!proprio)return err('Sem permissão para consultar pedidos.',403)
  let doc:DocumentoCompra
  if(tipo==='solicitacao'){
   const {data:sol,error}=await db.from('compras_solicitacoes').select('*')
    .eq('empresa_id',u.empresa_id).eq('id',id).maybeSingle()
   if(error)throw error
   if(!sol)return err('Solicitação não encontrada.',404)
   if(!consulta&&sol.solicitante_id!==u.id)return err('Sem permissão para consultar este pedido.',403)
   const {data:itens,error:ei}=await db.from('compras_solicitacao_itens')
    .select('id,descricao,categoria,quantidade_necessaria,unidade,destino,cliente_id,obra_id,produto_id,foto_path,status')
    .eq('empresa_id',u.empresa_id).eq('solicitacao_id',id).order('ordem').limit(100)
   if(ei)throw ei
   const clientesIds=[...new Set((itens||[]).map(x=>x.cliente_id).filter(Boolean))]
   const obrasIds=[...new Set((itens||[]).map(x=>x.obra_id).filter(Boolean))]
   const produtosIds=[...new Set((itens||[]).map(x=>x.produto_id).filter(Boolean))]
   const [cl,ob,pr]=await Promise.all([
    clientesIds.length?db.from('clientes').select('id,nome').eq('empresa_id',u.empresa_id).in('id',clientesIds):Promise.resolve({data:[],error:null}),
    obrasIds.length?db.from('obras').select('id,nome').eq('empresa_id',u.empresa_id).in('id',obrasIds):Promise.resolve({data:[],error:null}),
    produtosIds.length?db.from('produtos').select('id,codigo,nome,categoria,foto_url').eq('empresa_id',u.empresa_id).in('id',produtosIds):Promise.resolve({data:[],error:null}),
   ])
   if(cl.error||ob.error||pr.error)throw cl.error||ob.error||pr.error
   const clientes=new Map((cl.data||[]).map(x=>[x.id,x.nome]))
   const obras=new Map((ob.data||[]).map(x=>[x.id,x.nome]))
   const produtos=new Map((pr.data||[]).map(x=>[x.id,x]))
   const semFoto=(pr.data||[]).filter(x=>!x.foto_url).map(x=>x.id)
   const imagens=new Map<string,string>()
   if(semFoto.length){
    const {data:imgs}=await db.from('produto_imagens').select('produto_id,url,principal')
      .in('produto_id',semFoto).eq('ativo',true).eq('status_validacao','validada')
      .order('principal',{ascending:false}).limit(200)
    for(const imagem of imgs||[])if(!imagens.has(imagem.produto_id))imagens.set(imagem.produto_id,imagem.url)
   }
   const fotos=new Map<string,string>()
   await Promise.all((itens||[]).filter(x=>x.foto_path).map(async x=>{
    if(!x.foto_path?.startsWith(u.empresa_id+'/'))return
    const {data}=await db.storage.from('compras-solicitacoes').createSignedUrl(x.foto_path,600)
    if(data?.signedUrl)fotos.set(x.id,data.signedUrl)
   }))
   const itensDoc:ItemDocumentoCompra[]=(itens||[]).map(x=>{
    const produto=x.produto_id?produtos.get(x.produto_id):null
    const cliente=x.cliente_id?clientes.get(x.cliente_id)||'Cliente não localizado':''
    const obra=x.obra_id?obras.get(x.obra_id)||'Obra não localizada':''
    return {id:x.id,codigo:produto?.codigo||'',descricao:x.descricao,categoria:x.categoria,
     quantidade:x.quantidade_necessaria==null?null:Number(x.quantidade_necessaria),unidade:x.unidade,
     destino:x.destino,cliente,obra,imagem:fotos.get(x.id)||produto?.foto_url||(x.produto_id?imagens.get(x.produto_id):null)||null,
     status:x.status,fornecedor:'',quantidade_recebida:0}
   })
   const destinos=new Set(itensDoc.map(x=>destinoText(x)))
   const principal=itensDoc.find(x=>x.destino!=='estoque')||itensDoc[0]
   doc={tipo:'solicitacao',id,numero:numeroCompra('solicitacao',id,sol.created_at),data:sol.created_at,
    status:sol.status,solicitante:sol.solicitante_nome||'—',
    cliente:destinos.size===1?principal?.cliente||'':'Destinos por item',
    obra:destinos.size===1?principal?.obra||'':'Diversas obras / estoque',
    destino:destinos.size===1?[...destinos][0]:'Pedido com vários destinos',
    observacoes:sol.observacoes||'',itens:itensDoc}
  }else if(tipo==='necessidade'){
   const {data:n,error:en}=await db.from('compras_necessidades').select('*')
    .eq('empresa_id',u.empresa_id).eq('id',id).maybeSingle()
   if(en)throw en
   if(!n)return err('Necessidade não encontrada.',404)
   if(!consulta&&n.criado_por_id!==u.id)return err('Sem permissão para consultar este pedido.',403)
   const {data:produto}=n.produto_id?await db.from('produtos').select('id,codigo,foto_url')
    .eq('empresa_id',u.empresa_id).eq('id',n.produto_id).maybeSingle():{data:null}
   const {data:imagens}=n.produto_id&&!produto?.foto_url?await db.from('produto_imagens')
    .select('url').eq('produto_id',n.produto_id).eq('ativo',true).eq('status_validacao','validada').limit(1):{data:[]}
   const cliente=n.cliente_nome||'',obra=n.obra_nome||''
   doc={tipo:'necessidade',id,numero:numeroCompra('necessidade',id,n.created_at),data:n.created_at,
    status:n.status,solicitante:n.criado_por_nome||'—',cliente,obra,
    destino:destinoText({destino:n.destino||'estoque',cliente,obra}),observacoes:n.observacoes||'',
    itens:[{id:n.id,codigo:produto?.codigo||'',descricao:n.descricao,categoria:n.categoria||'',
     quantidade:Number(n.quantidade),unidade:n.unidade,destino:n.destino||'estoque',
     cliente,obra,imagem:produto?.foto_url||imagens?.[0]?.url||null,status:n.status,fornecedor:'',quantidade_recebida:0}]}
  }else{
   if(!consulta)return err('Sem permissão para imprimir pedidos do fornecedor.',403)
   const {data:carrinho,error:ec}=await db.from('compras_carrinhos')
    .select('id,fornecedor_id,status,numero_pedido,pedido_emitido_em,created_at')
    .eq('empresa_id',u.empresa_id).eq('id',id).maybeSingle()
   if(ec)throw ec
   if(!carrinho)return err('Pedido de fornecedor não encontrado.',404)
   const {data:linhas,error:el}=await db.from('compras_carrinho_itens')
    .select('id,item_id,quantidade_obra,quantidade_estoque,recebido_obra,recebido_estoque')
    .eq('empresa_id',u.empresa_id).eq('carrinho_id',id).limit(200)
   if(el)throw el
   if(!linhas?.length)return err('Carrinho ainda não possui materiais.',409)
   const ids=[...new Set(linhas.map(l=>l.item_id))]
   const {data:itens,error:ei}=await db.from('compras_solicitacao_itens')
    .select('id,descricao,categoria,unidade,produto_id,cliente_id,obra_id,foto_path,status')
    .eq('empresa_id',u.empresa_id).in('id',ids)
   if(ei)throw ei
   const itensMapa=new Map((itens||[]).map(x=>[x.id,x]))
   const clienteIds=[...new Set((itens||[]).map(x=>x.cliente_id).filter(Boolean))]
   const obraIds=[...new Set((itens||[]).map(x=>x.obra_id).filter(Boolean))]
   const produtoIds=[...new Set((itens||[]).map(x=>x.produto_id).filter(Boolean))]
   const [forn,cl,ob,pr]=await Promise.all([
    db.from('fornecedores').select('id,nome').eq('empresa_id',u.empresa_id).eq('id',carrinho.fornecedor_id).maybeSingle(),
    clienteIds.length?db.from('clientes').select('id,nome').eq('empresa_id',u.empresa_id).in('id',clienteIds):Promise.resolve({data:[],error:null}),
    obraIds.length?db.from('obras').select('id,nome').eq('empresa_id',u.empresa_id).in('id',obraIds):Promise.resolve({data:[],error:null}),
    produtoIds.length?db.from('produtos').select('id,codigo,foto_url').eq('empresa_id',u.empresa_id).in('id',produtoIds):Promise.resolve({data:[],error:null}),
   ])
   if(forn.error||cl.error||ob.error||pr.error)throw forn.error||cl.error||ob.error||pr.error
   const clientes=new Map((cl.data||[]).map(x=>[x.id,x.nome]))
   const obras=new Map((ob.data||[]).map(x=>[x.id,x.nome]))
   const produtos=new Map((pr.data||[]).map(x=>[x.id,x]))
   const semImagem=(pr.data||[]).filter(x=>!x.foto_url).map(x=>x.id)
   const imagens=new Map<string,string>()
   if(semImagem.length){
    const {data:imgs}=await db.from('produto_imagens').select('produto_id,url,principal')
     .in('produto_id',semImagem).eq('ativo',true).eq('status_validacao','validada')
     .order('principal',{ascending:false}).limit(250)
    for(const img of imgs||[])if(!imagens.has(img.produto_id))imagens.set(img.produto_id,img.url)
   }
   const fotos=new Map<string,string>()
   await Promise.all((itens||[]).filter(x=>x.foto_path).map(async x=>{
    if(!x.foto_path?.startsWith(u.empresa_id+'/'))return
    const {data}=await db.storage.from('compras-solicitacoes').createSignedUrl(x.foto_path,600)
    if(data?.signedUrl)fotos.set(x.id,data.signedUrl)
   }))
   const nomeFornecedor=forn.data?.nome||'Fornecedor'
   const linhasDocumento:ItemDocumentoCompra[]=[]
   for(const l of linhas){
    const item=itensMapa.get(l.item_id)
    if(!item)continue
    const produto=item.produto_id?produtos.get(item.produto_id):null
    const imagem=fotos.get(item.id)||produto?.foto_url||(item.produto_id?imagens.get(item.produto_id):null)||null
    const cliente=item.cliente_id?clientes.get(item.cliente_id)||'Cliente':''
    const obra=item.obra_id?obras.get(item.obra_id)||'Obra':''
    if(Number(l.quantidade_obra)>0)linhasDocumento.push({
     id:l.id+'-obra',codigo:produto?.codigo||'',descricao:item.descricao,categoria:item.categoria,
     quantidade:Number(l.quantidade_obra),unidade:item.unidade,destino:'obra',
     cliente,obra,imagem,status:item.status,fornecedor:nomeFornecedor,quantidade_recebida:Number(l.recebido_obra||0)})
    if(Number(l.quantidade_estoque)>0)linhasDocumento.push({
     id:l.id+'-estoque',codigo:produto?.codigo||'',descricao:item.descricao,categoria:item.categoria,
     quantidade:Number(l.quantidade_estoque),unidade:item.unidade,destino:'estoque',
     cliente:'',obra:'',imagem,status:item.status,fornecedor:nomeFornecedor,quantidade_recebida:Number(l.recebido_estoque||0)})
   }
   const destinos=new Set(linhasDocumento.map(x=>destinoText(x)))
   const itemPrincipal=linhasDocumento.find(x=>x.destino!=='estoque')
   const dataPedido=carrinho.pedido_emitido_em||carrinho.created_at
   doc={tipo:'carrinho',id,
    numero:carrinho.numero_pedido?.trim()||numeroCompra('carrinho',id,dataPedido),
    data:dataPedido,status:carrinho.status,solicitante:'Setor de Compras',
    cliente:destinos.size===1?itemPrincipal?.cliente||'':'Destinos por item',
    obra:destinos.size===1?itemPrincipal?.obra||'':'',
    destino:destinos.size===1?[...destinos][0]:'Pedido com vários destinos',
    fornecedor:nomeFornecedor,observacoes:'Conferir materiais e divergências antes de registrar a entrada no estoque.',
    itens:linhasDocumento}
  }
  if(p.get('formato')==='pdf'){
   const conteudo=await gerarPdfCompra(doc)
   return new Response(Buffer.from(conteudo),{
    headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="'+doc.numero+'.pdf"','Cache-Control':'no-store'}})
  }
  return NextResponse.json({documento:doc},{headers:{'Cache-Control':'no-store'}})
 }catch(e){
  console.error('[compras documento]',e)
  return err('Não foi possível gerar o documento de compra.',500)
 }
}
