import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { autenticarCompras } from '@/lib/comprasServer'
import { obterComprasAcessos } from '@/lib/comprasPermissoesServer'
import { supabaseAdmin as db } from '@/lib/supabaseAdmin'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i
const categorias=new Set(['perfil','acessorio','vidro','produto_pronto','outros'])
const fotosValidas:Record<string,string>={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'}
const falha=(msg:string,status=400)=>NextResponse.json({error:msg},{status})
const str=(v:unknown,max=500)=>String(v??'').trim().slice(0,max)
const quantidade=(v:unknown):number|null=>v==null||String(v).trim()===''?null:Number(v)

export async function GET(req:NextRequest){
 const u=await autenticarCompras(req);if(!u)return falha('Sessão inválida',401)
 try{
  const a=await obterComprasAcessos(u)
  const todos=a.consultar||a.editarTodos||a.cotar
  const meus=a.verProprios||a.editarProprios
  if(!todos&&!meus){
   // Solicitar somente: mostrar apenas o cadastro mínimo para selecionar cliente/obra.
   // Não expor pedidos, valores, fornecedores nem catálogo do comprador.
   const [clientes,obras]=a.solicitar?await Promise.all([
    db.from('clientes').select('id,nome').eq('empresa_id',u.empresa_id).order('nome').limit(3000),
    db.from('obras').select('id,nome,cliente_id').eq('empresa_id',u.empresa_id).order('nome').limit(4000)
   ]):[{data:[],error:null},{data:[],error:null}]
   if(clientes.error||obras.error)throw clientes.error||obras.error
   return NextResponse.json({acessos:a,solicitacoes:[],itens:[],historico:[],clientes:clientes.data||[],
    obras:obras.data||[],produtos:[],fornecedores:[],carrinhos:[],linhas:[]})
  }
  let q=db.from('compras_solicitacoes').select('*').eq('empresa_id',u.empresa_id).order('created_at',{ascending:false}).limit(300)
  if(!todos)q=q.eq('solicitante_id',u.id)
  const {data:solicitacoes,error:e}=await q;if(e)throw e
  const ids=(solicitacoes||[]).map(x=>x.id)
  const apenasProprios=!todos&&!a.solicitar
  const clientesIds=[...new Set((solicitacoes||[]).map(s=>s.cliente_id).filter(Boolean))]
  const obrasIds=[...new Set((solicitacoes||[]).map(s=>s.obra_id).filter(Boolean))]
  const [itensR,clientesR,obrasR,produtosR,fornecedoresR]=await Promise.all([
   ids.length?db.from('compras_solicitacao_itens').select('*').eq('empresa_id',u.empresa_id).in('solicitacao_id',ids).order('ordem').limit(4000):Promise.resolve({data:[],error:null}),
   apenasProprios?(clientesIds.length?db.from('clientes').select('id,nome').eq('empresa_id',u.empresa_id).in('id',clientesIds):Promise.resolve({data:[],error:null})):db.from('clientes').select('id,nome').eq('empresa_id',u.empresa_id).order('nome').limit(3000),
   apenasProprios?(obrasIds.length?db.from('obras').select('id,nome,cliente_id').eq('empresa_id',u.empresa_id).in('id',obrasIds):Promise.resolve({data:[],error:null})):db.from('obras').select('id,nome,cliente_id').eq('empresa_id',u.empresa_id).order('nome').limit(4000),
   apenasProprios?Promise.resolve({data:[],error:null}):db.from('produtos').select('id,codigo,nome,categoria,unidade,foto_url').eq('empresa_id',u.empresa_id).eq('ativo',true).order('nome').limit(5000),
   todos?db.from('fornecedores').select('id,nome,pedido_minimo').eq('empresa_id',u.empresa_id).eq('ativo',true).order('nome').limit(2000):Promise.resolve({data:[],error:null}),
  ])
  for(const r of [itensR,clientesR,obrasR,produtosR,fornecedoresR])if(r.error)throw r.error
  const itemIds=(itensR.data||[]).map(x=>x.id)
  const [historicoR,linhasR]=await Promise.all([
   ids.length?db.from('compras_solicitacao_auditoria').select('id,solicitacao_id,item_id,acao,entidade,usuario_id,created_at').eq('empresa_id',u.empresa_id).in('solicitacao_id',ids).order('created_at',{ascending:false}).limit(1000):Promise.resolve({data:[],error:null}),
   todos&&itemIds.length?db.from('compras_carrinho_itens').select('*').eq('empresa_id',u.empresa_id).in('item_id',itemIds).limit(5000):Promise.resolve({data:[],error:null}),
  ])
  if(historicoR.error||linhasR.error)throw historicoR.error||linhasR.error
  const autores=[...new Set((historicoR.data||[]).map(x=>x.usuario_id).filter(Boolean))]
  const {data:usuariosHist}=autores.length?await db.from('usuarios').select('id,nome').eq('empresa_id',u.empresa_id).in('id',autores):{data:[]}
  const nomesHist=new Map((usuariosHist||[]).map(x=>[x.id,x.nome]))
  const carrinhoIds=[...new Set((linhasR.data||[]).map(x=>x.carrinho_id))]
  const carrinhosR=carrinhoIds.length?await db.from('compras_carrinhos').select('*').eq('empresa_id',u.empresa_id).in('id',carrinhoIds).limit(1000):{data:[],error:null}
  if(carrinhosR.error)throw carrinhosR.error
  const fotos:Record<string,string>={}
  await Promise.all((itensR.data||[]).filter(i=>i.foto_path).map(async i=>{
   const {data}=await db.storage.from('compras-solicitacoes').createSignedUrl(i.foto_path,600)
   if(data?.signedUrl)fotos[i.id]=data.signedUrl
  }))
  const podeFinanceiro=a.financeiro||a.cotar||a.comprar
  return NextResponse.json({acessos:a,solicitacoes:solicitacoes||[],
   itens:(itensR.data||[]).map(i=>({...i,foto_url:fotos[i.id]||null})),
   historico:(historicoR.data||[]).map(h=>({...h,autor_nome:h.usuario_id?nomesHist.get(h.usuario_id)||'Usuário':'Sistema'})),clientes:clientesR.data||[],obras:obrasR.data||[],produtos:produtosR.data||[],
   fornecedores:(fornecedoresR.data||[]).map(f=>({...f,pedido_minimo:podeFinanceiro?f.pedido_minimo:null})),
   carrinhos:(carrinhosR.data||[]).map(c=>podeFinanceiro?c:{...c,numero_pedido:null}),
   linhas:(linhasR.data||[]).map(l=>podeFinanceiro?l:{...l,preco_unitario:null})
  },{headers:{'Cache-Control':'no-store'}})
 }catch(e){console.error('[compras solicitacoes GET]',e);return falha('Não foi possível carregar solicitações. Confira se a migração foi aplicada.',503)}
}

export async function POST(req:NextRequest){
 const u=await autenticarCompras(req);if(!u)return falha('Sessão inválida',401)
 let solId:string|null=null
 const caminhos:string[]=[]
 try{
  const a=await obterComprasAcessos(u);if(!a.solicitar)return falha('Sem permissão para solicitar compras',403)
  const form=await req.formData();let p:any
  try{p=JSON.parse(str(form.get('payload'),25000))}catch{return falha('Pedido inválido')}
  if(!['obra','estoque'].includes(p.destino))return falha('Escolha estoque ou cliente e obra')
  if(!Array.isArray(p.itens)||p.itens.length<1||p.itens.length>30)return falha('Informe de 1 a 30 itens')
  const clienteId=p.destino==='obra'?str(p.cliente_id,80):null
  const obraId=p.destino==='obra'?str(p.obra_id,80):null
  if(p.destino==='obra'){
   if(!clienteId||!obraId||!uuid.test(clienteId)||!uuid.test(obraId))return falha('Escolha cliente e obra')
   const {data:obra,error}=await db.from('obras').select('id').eq('empresa_id',u.empresa_id).eq('id',obraId).eq('cliente_id',clienteId).maybeSingle()
   if(error)throw error
   if(!obra)return falha('A obra não pertence ao cliente selecionado')
  }
  const itens=[]
  for(let i=0;i<p.itens.length;i++){
   const it=p.itens[i],desc=str(it.descricao,500),q=quantidade(it.quantidade_necessaria)
   if(!categorias.has(it.categoria)||desc.length<2)return falha(`Item ${i+1}: selecione a categoria e descreva o produto`)
   if(q!=null&&(!Number.isFinite(q)||q<=0))return falha(`Item ${i+1}: quantidade inválida`)
   if(p.destino==='obra'&&q==null)return falha(`Item ${i+1}: informe a quantidade da obra`)
   const foto=form.get('foto_'+i)
   if(foto&&(!(foto instanceof File)||foto.size>5*1024*1024||foto.size<1||!fotosValidas[foto.type]))return falha(`Item ${i+1}: foto deve ser JPG, PNG ou WEBP, até 5 MB`)
   itens.push({empresa_id:u.empresa_id,ordem:i+1,categoria:it.categoria,descricao:desc,quantidade_necessaria:q,unidade:str(it.unidade,20)||'UN',atualizado_por_id:u.id})
  }
  const {data:sol,error:es}=await db.from('compras_solicitacoes').insert({empresa_id:u.empresa_id,destino:p.destino,
   cliente_id:clienteId,obra_id:obraId,solicitante_id:u.id,solicitante_nome:u.nome,observacoes:str(p.observacoes,1000)||null,
   atualizado_por_id:u.id}).select('id').single()
  if(es)throw es
  solId=sol.id
  const {data:inseridos,error:ei}=await db.from('compras_solicitacao_itens').insert(itens.map(x=>({...x,solicitacao_id:sol.id}))).select('id,ordem')
  if(ei)throw ei
  for(const i of inseridos||[]){
   const foto=form.get('foto_'+(i.ordem-1));if(!(foto instanceof File))continue
   const path=u.empresa_id+'/'+sol.id+'/'+randomUUID()+fotosValidas[foto.type]
   const {error:up}=await db.storage.from('compras-solicitacoes').upload(path,Buffer.from(await foto.arrayBuffer()),{contentType:foto.type,upsert:false})
   if(up)throw up
   caminhos.push(path)
   const {error:eup}=await db.from('compras_solicitacao_itens').update({foto_path:path}).eq('empresa_id',u.empresa_id).eq('id',i.id)
   if(eup)throw eup
  }
  return NextResponse.json({ok:true,id:sol.id,itens:itens.length},{status:201})
 }catch(e){
  if(solId){await db.from('compras_solicitacao_itens').delete().eq('empresa_id',u.empresa_id).eq('solicitacao_id',solId)
   await db.from('compras_solicitacoes').delete().eq('empresa_id',u.empresa_id).eq('id',solId)}
  if(caminhos.length)await db.storage.from('compras-solicitacoes').remove(caminhos)
  console.error('[compras solicitacoes POST]',e)
  return falha('Não foi possível enviar a solicitação. Nenhum pedido foi confirmado.',500)
 }
}

export async function PATCH(req:NextRequest){
 const u=await autenticarCompras(req);if(!u)return falha('Sessão inválida',401)
 try{
  const a=await obterComprasAcessos(u),b=await req.json().catch(()=>null)
  if(!b||!uuid.test(str(b.itemId,80)))return falha('Item inválido')
  const {data:item,error:ei}=await db.from('compras_solicitacao_itens').select('id,solicitacao_id,status,produto_id,descricao,quantidade_necessaria')
   .eq('empresa_id',u.empresa_id).eq('id',b.itemId).maybeSingle()
  if(ei)throw ei
  if(!item)return falha('Item não encontrado',404)
  const {data:sol,error:es}=await db.from('compras_solicitacoes').select('id,solicitante_id,status,destino')
   .eq('empresa_id',u.empresa_id).eq('id',item.solicitacao_id).maybeSingle()
  if(es)throw es
  if(!sol)return falha('Solicitação inexistente',404)
  const comprador=a.cotar||a.comprar||a.aprovar
  const edita=a.editarTodos||(a.editarProprios&&sol.solicitante_id===u.id)
  if(b.acao==='identificar'){
   if(!comprador)return falha('Somente o comprador pode validar a identificação',403)
   if(!uuid.test(str(b.produtoId,80)))return falha('Selecione um produto cadastrado')
   const {data:produto}=await db.from('produtos').select('id').eq('empresa_id',u.empresa_id).eq('id',b.produtoId).maybeSingle()
   if(!produto)return falha('Produto não encontrado')
   const {error}=await db.from('compras_solicitacao_itens').update({produto_id:produto.id,identificacao_status:'validado',
    identificacao_por_id:u.id,atualizado_por_id:u.id,updated_at:new Date().toISOString()}).eq('empresa_id',u.empresa_id).eq('id',item.id)
   if(error)throw error
   await db.from('compras_solicitacoes').update({status:'em_cotacao',atualizado_por_id:u.id,updated_at:new Date().toISOString()})
     .eq('empresa_id',u.empresa_id).eq('id',sol.id).eq('status','aguardando_validacao')
   return NextResponse.json({ok:true,acao:'identificado'})
  }
  if(!edita)return falha('Sem permissão para editar este pedido',403)
  if(sol.status!=='aguardando_validacao'&&sol.status!=='em_cotacao')return falha('Pedido em compra ou entrega não pode ser alterado',409)
  if(b.acao==='cancelar'){
   if(item.status==='cancelado')return NextResponse.json({ok:true})
   const {data:usado}=await db.from('compras_carrinho_itens').select('id').eq('empresa_id',u.empresa_id).eq('item_id',item.id).limit(1)
   if(usado?.length)return falha('Este item já foi separado pelo comprador. Solicite correção a Compras.',409)
   const {error}=await db.from('compras_solicitacao_itens').update({status:'cancelado',atualizado_por_id:u.id,updated_at:new Date().toISOString()}).eq('empresa_id',u.empresa_id).eq('id',item.id)
   if(error)throw error
   return NextResponse.json({ok:true,acao:'cancelado',historicoPreservado:true})
  }
  if(b.acao==='editar'){
   if(item.status==='cancelado')return falha('Pedido cancelado, histórico preservado',409)
   const descricao=str(b.descricao,500),q=quantidade(b.quantidade_necessaria)
   if(descricao.length<2||q!=null&&(!Number.isFinite(q)||q<=0)||(sol.destino==='obra'&&q==null))return falha('Descrição ou quantidade inválida')
   const {data:usado}=await db.from('compras_carrinho_itens').select('id').eq('empresa_id',u.empresa_id).eq('item_id',item.id).limit(1)
   if(usado?.length)return falha('Comprador já separou este item. Não é possível alterar.',409)
   const {error}=await db.from('compras_solicitacao_itens').update({descricao,quantidade_necessaria:q,atualizado_por_id:u.id,
    updated_at:new Date().toISOString()}).eq('empresa_id',u.empresa_id).eq('id',item.id)
   if(error)throw error
   return NextResponse.json({ok:true,acao:'editado',historicoPreservado:true})
  }
  return falha('Ação desconhecida')
 }catch(e){console.error('[compras solicitacoes PATCH]',e);return falha('Não foi possível alterar a solicitação',500)}
}
