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
const resumoAuditoria=(evento:{entidade:string;acao:string;antes:unknown;depois:unknown})=>{
 const antes=(evento.antes&&typeof evento.antes==='object'?evento.antes:{}) as Record<string,unknown>
 const depois=(evento.depois&&typeof evento.depois==='object'?evento.depois:{}) as Record<string,unknown>
 if(evento.entidade==='compras_solicitacao_itens'){
  if(evento.acao==='insert')return 'Incluiu material: '+str(depois.descricao,100)
  if(depois.status==='cancelamento_solicitado'&&antes.status!=='cancelamento_solicitado')
   return 'Solicitou exclusão do item: '+str(depois.motivo_cancelamento,150)
  if(depois.status==='cancelado'&&antes.status!=='cancelado')
   return 'Excluiu/cancelou o item: '+str(depois.motivo_cancelamento,150)
  if(depois.identificacao_status==='validado'&&(antes.produto_id!==depois.produto_id||antes.identificacao_status!=='validado'))
   return antes.produto_id&&antes.produto_id!==depois.produto_id?'Corrigiu a identificação do produto do catálogo':'Confirmou a identificação do produto do catálogo'
  const campos=[['descricao','Descrição'],['categoria','Categoria'],['quantidade_necessaria','Quantidade'],['destino','Destino'],['cliente_id','Cliente'],['obra_id','Obra'],['foto_path','Foto']]
  const mudancas=campos.filter(([k])=>String(antes[k]??'')!==String(depois[k]??'')).map(([k,label])=>
   k==='foto_path'?'Foto substituída':k==='cliente_id'||k==='obra_id'?label+' alterado':label+': '+str(antes[k]??'vazio',70)+' → '+str(depois[k]??'vazio',70))
  return mudancas.length?mudancas.join(' · '):'Atualização do item'
 }
 return evento.acao==='insert'?'Solicitação criada':'Etapa do pedido atualizada'
}


export async function GET(req:NextRequest){
 const u=await autenticarCompras(req);if(!u)return falha('Sessão inválida',401)
 try{
  const a=await obterComprasAcessos(u)
  const todos=a.consultar||a.editarTodos||a.cotar||a.comprar||a.aprovar
  const meus=a.verProprios||a.editarProprios||a.solicitar
  if(!todos&&!meus){
   // Solicitar somente: mostrar apenas o cadastro mínimo para selecionar cliente/obra.
   // Não expor pedidos, valores, fornecedores nem catálogo do comprador.
   const [clientes,obras]=a.solicitar?await Promise.all([
    db.from('clientes').select('id,nome').eq('empresa_id',u.empresa_id).eq('ativo',true).order('nome').limit(3000),
    db.from('obras').select('id,nome,cliente_id').eq('empresa_id',u.empresa_id).order('nome').limit(4000)
   ]):[{data:[],error:null},{data:[],error:null}]
   if(clientes.error||obras.error)throw clientes.error||obras.error
   return NextResponse.json({acessos:a,usuarioId:u.id,solicitacoes:[],itens:[],historico:[],clientes:clientes.data||[],
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
   apenasProprios?(clientesIds.length?db.from('clientes').select('id,nome').eq('empresa_id',u.empresa_id).in('id',clientesIds):Promise.resolve({data:[],error:null})):db.from('clientes').select('id,nome').eq('empresa_id',u.empresa_id).eq('ativo',true).order('nome').limit(3000),
   apenasProprios?(obrasIds.length?db.from('obras').select('id,nome,cliente_id').eq('empresa_id',u.empresa_id).in('id',obrasIds):Promise.resolve({data:[],error:null})):db.from('obras').select('id,nome,cliente_id').eq('empresa_id',u.empresa_id).order('nome').limit(4000),
   !todos?Promise.resolve({data:[],error:null}):db.from('produtos').select('id,codigo,nome,categoria,unidade,foto_url').eq('empresa_id',u.empresa_id).eq('ativo',true).order('nome').limit(5000),
   todos?db.from('fornecedores').select('id,nome,pedido_minimo').eq('empresa_id',u.empresa_id).eq('ativo',true).order('nome').limit(2000):Promise.resolve({data:[],error:null}),
  ])
  for(const r of [itensR,clientesR,obrasR,produtosR,fornecedoresR])if(r.error)throw r.error
  // Destinos adicionais do mesmo pedido: permitir exibir apenas clientes/obras realmente associados
  // sem mostrar o cadastro inteiro a quem só consulta os próprios pedidos.
  let extrasClientesDados: Array<{id:string;nome:string}>=[]
  let extrasObrasDados: Array<{id:string;nome:string;cliente_id:string}>=[]
  if(apenasProprios){
   const extrasClientes=[...new Set((itensR.data||[]).map(i=>i.cliente_id).filter(Boolean))].filter(id=>!clientesIds.includes(id))
   const extrasObras=[...new Set((itensR.data||[]).map(i=>i.obra_id).filter(Boolean))].filter(id=>!obrasIds.includes(id))
   if(extrasClientes.length){const {data,error}=await db.from('clientes').select('id,nome').eq('empresa_id',u.empresa_id).in('id',extrasClientes);if(error)throw error;extrasClientesDados=data||[]}
   if(extrasObras.length){const {data,error}=await db.from('obras').select('id,nome,cliente_id').eq('empresa_id',u.empresa_id).in('id',extrasObras);if(error)throw error;extrasObrasDados=data||[]}
  }
  // Solicitante vê só imagens do produto associado aos próprios pedidos, não o catálogo completo.
  // A lista de perfis/acessórios mantém foto real mesmo para quem só acompanha a solicitação.
  let produtosProprios:Array<{id:string;codigo:string|null;nome:string;categoria:string|null;unidade:string|null;foto_url:string|null}>=[]
  if(!todos){
   const produtoIds=[...new Set((itensR.data||[]).map(i=>i.produto_id).filter(Boolean))]
   if(produtoIds.length){
    const {data,error}=await db.from('produtos').select('id,codigo,nome,categoria,unidade,foto_url')
     .eq('empresa_id',u.empresa_id).eq('ativo',true).in('id',produtoIds)
    if(error)throw error
    produtosProprios=data||[]
   }
  }
  const itemIds=(itensR.data||[]).map(x=>x.id)
  const [historicoR,linhasR]=await Promise.all([
   ids.length?db.from('compras_solicitacao_auditoria').select('id,solicitacao_id,item_id,acao,entidade,usuario_id,created_at,antes,depois').eq('empresa_id',u.empresa_id).in('solicitacao_id',ids).order('created_at',{ascending:false}).limit(1000):Promise.resolve({data:[],error:null}),
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
  return NextResponse.json({acessos:a,usuarioId:u.id,solicitacoes:solicitacoes||[],
   itens:(itensR.data||[]).map(i=>({...i,foto_url:fotos[i.id]||null})),
   historico:(historicoR.data||[]).map(h=>({id:h.id,item_id:h.item_id,solicitacao_id:h.solicitacao_id,acao:h.acao,entidade:h.entidade,created_at:h.created_at,autor_nome:h.usuario_id?nomesHist.get(h.usuario_id)||'Usuário':'Sistema',detalhe:resumoAuditoria(h)})),clientes:[...(clientesR.data||[]),...extrasClientesDados],obras:[...(obrasR.data||[]),...extrasObrasDados],produtos:todos?(produtosR.data||[]):produtosProprios,
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
  if(!Array.isArray(p.itens)||p.itens.length<1||p.itens.length>30)return falha('Informe de 1 a 30 itens')
  // Cada linha do mesmo pedido tem destino independente. Campos do cabeçalho
  // continuam aceitos para leitura retrocompatível com clientes antigos.
  const itens=[]
  for(let i=0;i<p.itens.length;i++){
   const it=p.itens[i],desc=str(it.descricao,500),q=quantidade(it.quantidade_necessaria)
   const destino=str(it.destino||p.destino,30)
   const clienteId=destino==='obra'?str(it.cliente_id||p.cliente_id,80):null
   const obraId=destino==='obra'?str(it.obra_id||p.obra_id,80):null
   if(!['obra','estoque'].includes(destino))return falha(`Item ${i+1}: escolha obra ou estoque`)
   if(destino==='obra'&&(!uuid.test(clienteId||'')||!uuid.test(obraId||'')))return falha(`Item ${i+1}: escolha cliente e obra`)
   if(!categorias.has(it.categoria)||desc.length<2)return falha(`Item ${i+1}: selecione a categoria e descreva o produto`)
   if(q!=null&&(!Number.isFinite(q)||q<=0))return falha(`Item ${i+1}: quantidade inválida`)
   if(destino==='obra'&&q==null)return falha(`Item ${i+1}: informe a quantidade da obra`)
   const foto=form.get('foto_'+i)
   if(foto&&(!(foto instanceof File)||foto.size>5*1024*1024||foto.size<1||!fotosValidas[foto.type]))return falha(`Item ${i+1}: foto deve ser JPG, PNG ou WEBP, até 5 MB`)
   itens.push({empresa_id:u.empresa_id,ordem:i+1,categoria:it.categoria,descricao:desc,
    destino,cliente_id:clienteId,obra_id:obraId,
    quantidade_necessaria:q,unidade:str(it.unidade,20)||'UN',atualizado_por_id:u.id})
  }
  const obraIds=[...new Set(itens.filter(i=>i.destino==='obra').map(i=>i.obra_id as string))]
  if(obraIds.length){
   const {data:obras,error}=await db.from('obras').select('id,cliente_id')
     .eq('empresa_id',u.empresa_id).in('id',obraIds)
   if(error)throw error
   const mapa=new Map((obras||[]).map(o=>[o.id,o.cliente_id]))
   for(const item of itens){
    if(item.destino==='obra'&&mapa.get(item.obra_id)!==item.cliente_id)
     return falha(`Item ${item.ordem}: obra não pertence ao cliente selecionado`)
   }
  }
  const primeiro=itens[0]
  const {data:sol,error:es}=await db.from('compras_solicitacoes').insert({empresa_id:u.empresa_id,destino:primeiro.destino,
   cliente_id:primeiro.cliente_id,obra_id:primeiro.obra_id,solicitante_id:u.id,solicitante_nome:u.nome,observacoes:str(p.observacoes,1000)||null,
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
  const a=await obterComprasAcessos(u)
  const multipart=(req.headers.get('content-type')||'').toLowerCase().includes('multipart/form-data')
  const form=multipart?await req.formData():null
  const b=form?JSON.parse(str(form.get('payload'),20000)):await req.json().catch(()=>null)

  if(b?.acao==='cancelar_pedido'){
   const sid=str(b.solicitacaoId,80)
   if(!uuid.test(sid))return falha('Pedido inválido')
   const {data:sol,error:eSol}=await db.from('compras_solicitacoes')
    .select('id,solicitante_id').eq('empresa_id',u.empresa_id).eq('id',sid).maybeSingle()
   if(eSol)throw eSol
   if(!sol)return falha('Pedido não encontrado',404)
   if(!(a.editarTodos||a.editarProprios&&sol.solicitante_id===u.id))
    return falha('Sem permissão para excluir este pedido',403)
   const motivo=str(b.motivo,250)
   if(motivo.length<3)return falha('Informe um motivo para registrar no histórico')
   const {data:resultado,error:eCancela}=await db.rpc('cancelar_solicitacao_compras_v1',{
    p_empresa:u.empresa_id,p_usuario:u.id,p_solicitacao:sid,p_motivo:motivo,p_editar_todos:a.editarTodos
   })
   if(eCancela){console.error('[compras cancelar pedido]',eCancela);return falha('Não foi possível excluir o pedido. Nenhum registro deve ser apagado.',409)}
   return NextResponse.json(resultado)
  }
  if(!b||!uuid.test(str(b.itemId,80)))return falha('Item inválido')
  const {data:item,error:ei}=await db.from('compras_solicitacao_itens').select('id,solicitacao_id,status,produto_id,descricao,categoria,quantidade_necessaria,destino,cliente_id,obra_id,foto_path')
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
   if(item.status!=='ativo')return falha('Item excluído ou com exclusão pendente.',409)
   if(!comprador)return falha('Somente o comprador pode validar a identificação',403)
   if(!uuid.test(str(b.produtoId,80)))return falha('Selecione um produto cadastrado')
   // Operação atômica: valida o produto, registra a escolha humana e aprende
   // o texto solicitado. Impede troca após inclusão em carrinho.
   const {data:resultado,error:eConfirma}=await db.rpc('confirmar_identificacao_compras_v1',{
    p_empresa:u.empresa_id,p_usuario:u.id,p_item:item.id,p_produto:b.produtoId
   })
   if(eConfirma){
    const mensagem=String(eConfirma.message||'Falha ao validar produto')
    if(['Material','Produto','Item já','Descrição','Usuário'].some(t=>mensagem.includes(t)))return falha(mensagem,409)
    throw eConfirma
   }
   return NextResponse.json({ok:true,acao:'identificado',aprendizado:resultado?.aprendizado===true,
    corrigiuSugestaoAnterior:resultado?.corrigiuSugestaoAnterior===true})
  }
  if(!edita)return falha('Sem permissão para editar este pedido',403)
  if(b.acao==='cancelar'){
   if(item.status==='cancelado')return NextResponse.json({ok:true,estado:'cancelado',historicoPreservado:true})
   if(item.status==='cancelamento_solicitado')return NextResponse.json({ok:true,estado:'cancelamento_solicitado',historicoPreservado:true})
   const motivo=str(b.motivo||'Solicitação de exclusão pelo usuário',250)
   const {data:usado,error:euso}=await db.from('compras_carrinho_itens').select('id').eq('empresa_id',u.empresa_id).eq('item_id',item.id).limit(1)
   if(euso)throw euso
   // Se o comprador já separou ou comprou, NUNCA exclua o vínculo ou estorne compra/estoque automaticamente.
   const pendente=!!usado?.length
   const status=pendente?'cancelamento_solicitado':'cancelado'
   const {error}=await db.from('compras_solicitacao_itens').update({status,motivo_cancelamento:motivo,
    cancelamento_solicitado_em:pendente?new Date().toISOString():null,
    atualizado_por_id:u.id,updated_at:new Date().toISOString()}).eq('empresa_id',u.empresa_id).eq('id',item.id).eq('status','ativo')
   if(error)throw error
   // Não apagar o card. Somente encerrar o pedido quando nenhum item ativo ou pendente permanecer.
   if(!pendente){
    const {data:restantes,error:er}=await db.from('compras_solicitacao_itens').select('id').eq('empresa_id',u.empresa_id)
     .eq('solicitacao_id',sol.id).neq('status','cancelado').limit(1)
    if(!er&&!restantes?.length)await db.from('compras_solicitacoes').update({status:'cancelado',atualizado_por_id:u.id,updated_at:new Date().toISOString()})
     .eq('empresa_id',u.empresa_id).eq('id',sol.id).in('status',['aguardando_validacao','em_cotacao','aguardando_minimo'])
   }
   return NextResponse.json({ok:true,estado:status,historicoPreservado:true,
    aviso:pendente?'Este item já está em carrinho ou compra: exclusão solicitada para revisão pelo comprador. Nenhuma compra ou estoque foi alterado.':null})
  }
  if(b.acao==='editar'){
   if(item.status!=='ativo')return falha('Item cancelado ou com exclusão pendente. Consulte o histórico.',409)
   if(!['aguardando_validacao','em_cotacao','aguardando_minimo'].includes(sol.status))
    return falha('Pedido já comprado ou em entrega. Solicite revisão ao comprador.',409)

   const descricao=str(b.descricao,500),q=quantidade(b.quantidade_necessaria)
   const categoria=b.categoria===undefined?item.categoria:str(b.categoria,40)
   if(!categorias.has(categoria))return falha('Categoria inválida')
   const foto=form?.get('foto')
   if(foto&&(!(foto instanceof File)||foto.size>5*1024*1024||foto.size<1||!fotosValidas[foto.type]))
    return falha('Foto deve ser JPG, PNG ou WEBP, com até 5 MB')

   const destino=b.destino===undefined?item.destino:str(b.destino,20)
   if(destino!=='obra'&&destino!=='estoque')return falha('Destino inválido')
   const clienteId=destino==='obra'?(b.cliente_id===undefined?item.cliente_id:str(b.cliente_id,80)):null
   const obraId=destino==='obra'?(b.obra_id===undefined?item.obra_id:str(b.obra_id,80)):null
   if(descricao.length<2||q!=null&&(!Number.isFinite(q)||q<=0)||(destino==='obra'&&q==null))return falha('Descrição ou quantidade inválida')
   if(destino==='obra'){
    if(!uuid.test(clienteId||'')||!uuid.test(obraId||''))return falha('Escolha cliente e obra')
    const {data:obra,error:eobra}=await db.from('obras').select('id').eq('empresa_id',u.empresa_id).eq('id',obraId).eq('cliente_id',clienteId).maybeSingle()
    if(eobra)throw eobra
    if(!obra)return falha('A obra não pertence ao cliente selecionado')
   }
   const {data:usado,error:euso}=await db.from('compras_carrinho_itens').select('id').eq('empresa_id',u.empresa_id).eq('item_id',item.id).limit(1)
   if(euso)throw euso
   if(usado?.length)return falha('Comprador já separou este item. Não é possível alterar.',409)
   let novoPath:string|null=null
   if(foto instanceof File){
    novoPath=u.empresa_id+'/'+sol.id+'/'+randomUUID()+fotosValidas[foto.type]
    const {error:up}=await db.storage.from('compras-solicitacoes').upload(novoPath,
     Buffer.from(await foto.arrayBuffer()),{contentType:foto.type,upsert:false})
    if(up)throw up
   }
   // Mudou a identificação do produto? Exigir nova conferência pelo comprador.
   const exigeNovaValidacao=descricao!==item.descricao||categoria!==item.categoria||Boolean(novoPath)
   const {error}=await db.from('compras_solicitacao_itens').update({descricao,categoria,quantidade_necessaria:q,
    destino,cliente_id:clienteId,obra_id:obraId,
    ...(exigeNovaValidacao?{produto_id:null,identificacao_status:'pendente',identificacao_por_id:null}:{}),
    ...(novoPath?{foto_path:novoPath}:{}),atualizado_por_id:u.id,
    updated_at:new Date().toISOString()}).eq('empresa_id',u.empresa_id).eq('id',item.id).eq('status','ativo')
   if(error){if(novoPath)await db.storage.from('compras-solicitacoes').remove([novoPath]);throw error}
   // O arquivo anterior permanece no armazenamento privado para manter o histórico auditável.
   return NextResponse.json({ok:true,acao:'editado',historicoPreservado:true})
  }
  return falha('Ação desconhecida')
 }catch(e){console.error('[compras solicitacoes PATCH]',e);return falha('Não foi possível alterar a solicitação',500)}
}
