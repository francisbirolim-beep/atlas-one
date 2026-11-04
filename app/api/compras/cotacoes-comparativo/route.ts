import {NextRequest,NextResponse} from 'next/server'
import {randomUUID} from 'node:crypto'
import {autenticarCompras} from '@/lib/comprasServer'
import {obterComprasAcessos} from '@/lib/comprasPermissoesServer'
import {supabaseAdmin as db} from '@/lib/supabaseAdmin'
import {calcularComparativo,type ItemCotado,type ItemSolicitado,type CondicoesCotacao} from '@/lib/comprasComparativoCotacoes'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i
const respond=(message:string,status=400)=>NextResponse.json({error:message},{status})
const money=(v:unknown)=>v==null||String(v).trim()===''?null:Number(v)
const str=(v:unknown,max=300)=>String(v??'').trim().slice(0,max)
const date=(v:unknown)=>/^\d{4}-\d\d-\d\d$/.test(String(v))?String(v):null

async function contexto(req:NextRequest){
 const usuario=await autenticarCompras(req)
 if(!usuario)return {error:respond('Sessão inválida.',401)} as const
 const acessos=await obterComprasAcessos(usuario)
 const podeLer=acessos.cotar||acessos.comprar||acessos.aprovar||acessos.financeiro
 const podeEditar=acessos.cotar||acessos.comprar
 if(!podeLer)return {error:respond('Sem acesso ao comparativo de cotações.',403)} as const
 return {usuario,acessos,podeEditar} as const
}
async function carregarPedido(empresaId:string,solicitacaoId:string){
 if(!uuid.test(solicitacaoId))return null
 const {data:solicitacao,error}=await db.from('compras_solicitacoes')
  .select('id,status,created_at').eq('empresa_id',empresaId).eq('id',solicitacaoId).maybeSingle()
 if(error)throw error
 if(!solicitacao)return null
 const {data:itens,error:ei}=await db.from('compras_solicitacao_itens')
  .select('id,descricao,quantidade_necessaria,unidade,produto_id,categoria,destino')
  .eq('empresa_id',empresaId).eq('solicitacao_id',solicitacaoId).eq('status','ativo').order('ordem').limit(100)
 if(ei)throw ei
 return {solicitacao,itens:itens||[]}
}
export async function GET(req:NextRequest){
 const ctx=await contexto(req)
 if('error' in ctx)return ctx.error
 try{
  const solicitacaoId=req.nextUrl.searchParams.get('solicitacaoId')||''
  const pedido=await carregarPedido(ctx.usuario.empresa_id,solicitacaoId)
  if(!pedido)return respond('Solicitação não encontrada.',404)
  const {data,error}=await db.from('compras_cotacoes_solicitacoes').select('*')
    .eq('empresa_id',ctx.usuario.empresa_id).eq('solicitacao_id',solicitacaoId)
    .order('created_at',{ascending:false}).limit(100)
  if(error)throw error
  const lista=data||[]
  const fornecedoresIds=[...new Set(lista.map(x=>x.fornecedor_id))]
  const {data:fornecedores}=fornecedoresIds.length?await db.from('fornecedores')
    .select('id,nome,pedido_minimo,prazo_entrega_dias')
    .eq('empresa_id',ctx.usuario.empresa_id).in('id',fornecedoresIds):{data:[]}
  const nomes=new Map((fornecedores||[]).map(f=>[f.id,f]))
  const solicitados:ItemSolicitado[]=pedido.itens.map(x=>({
   id:x.id,descricao:x.descricao,quantidade_necessaria:x.quantidade_necessaria,unidade:x.unidade
  }))
  const cotacoes=await Promise.all(lista.map(async c=>{
   let arquivoUrl:string|null=null
   if(c.arquivo_path?.startsWith(ctx.usuario.empresa_id+'/')){
    const {data:signed}=await db.storage.from('compras-cotacoes').createSignedUrl(c.arquivo_path,300)
    arquivoUrl=signed?.signedUrl||null
   }
   const condicoes:CondicoesCotacao={frete:c.frete==null?null:Number(c.frete),
    desconto:Number(c.desconto||0),prazo_dias:c.prazo_dias,forma_pagamento:c.forma_pagamento,validade:c.validade}
   const resumo=calcularComparativo(c.itens as ItemCotado[],solicitados,condicoes)
   const fornecedor=nomes.get(c.fornecedor_id)
   return {id:c.id,fornecedor_id:c.fornecedor_id,fornecedor_nome:fornecedor?.nome||'Fornecedor',
    pedido_minimo:Number(fornecedor?.pedido_minimo||0),numero_proposta:c.numero_proposta,
    data_proposta:c.data_proposta,created_at:c.created_at,status:c.status,selecionada:c.selecionada,
    itens:c.itens,condicoes,observacoes:c.observacoes,arquivoUrl,resumo}
  }))
  const hoje=new Date().toISOString().slice(0,10)
  const comparaveis=cotacoes.filter(c=>c.resumo.completa&&c.status!=='descartada'&&
   (!c.condicoes.validade||c.condicoes.validade>=hoje)&&
   c.resumo.subtotal>=c.pedido_minimo)
  const melhor=comparaveis.reduce<(typeof cotacoes)[number]|null>((at,c)=>
   !at||(c.resumo.custoComparavel??Infinity)<(at.resumo.custoComparavel??Infinity)?c:at,null)
  return NextResponse.json({solicitacaoId,itens:pedido.itens,cotacoes,
   menorCustoComparavelId:melhor?.id||null,podeEditar:ctx.podeEditar,
   aviso:'Comparar somente propostas com todos os itens e quantidades equivalentes e frete informado. Validar condições e fornecedor antes de escolher.'},
   {headers:{'Cache-Control':'no-store'}})
 }catch(e){
  console.error('[cotacoes GET]',e);return respond('Não foi possível consultar as cotações.',500)
 }
}
export async function POST(req:NextRequest){
 const ctx=await contexto(req)
 if('error' in ctx)return ctx.error
 if(!ctx.podeEditar)return respond('Sem permissão para cadastrar cotações.',403)
 let path:string|null=null
 try{
  const form=await req.formData()
  const json=str(form.get('dados'),20000)
  let dados:Record<string,any>
  try{dados=JSON.parse(json)}catch{return respond('Dados da cotação inválidos.')}
  const pedido=await carregarPedido(ctx.usuario.empresa_id,str(dados.solicitacao_id,80))
  if(!pedido)return respond('Solicitação não encontrada.',404)
  if(['cancelado','recebido'].includes(pedido.solicitacao.status))
   return respond('Solicitação encerrada: não é possível cadastrar nova cotação.',409)
  const fornecedorId=str(dados.fornecedor_id,80)
  const chave=str(dados.chave_envio,80)
  if(!uuid.test(fornecedorId)||!uuid.test(chave))return respond('Fornecedor ou chave de envio inválidos.')
  const {data:existente}=await db.from('compras_cotacoes_solicitacoes')
    .select('id').eq('empresa_id',ctx.usuario.empresa_id).eq('chave_envio',chave).maybeSingle()
  if(existente)return NextResponse.json({id:existente.id,jaExistia:true})
  const {data:fornecedor,error:ef}=await db.from('fornecedores').select('id')
    .eq('empresa_id',ctx.usuario.empresa_id).eq('id',fornecedorId).eq('ativo',true).maybeSingle()
  if(ef)throw ef
  if(!fornecedor)return respond('Fornecedor não encontrado nesta empresa.',404)
  const solicitados=new Map(pedido.itens.map(x=>[x.id,x]))
  const itensRaw=dados.itens
  if(!Array.isArray(itensRaw)||itensRaw.length<1||itensRaw.length>100)return respond('Informe de 1 a 100 itens cotados.')
  const ja=new Set<string>()
  const itens:ItemCotado[]=[]
  for(const x of itensRaw){
   const itemId=str(x.item_id,80),q=money(x.quantidade),preco=money(x.preco_unitario)
   const item=solicitados.get(itemId)
   if(!item||ja.has(itemId)||!q||q<=0||q>1e9||preco==null||preco<0||preco>1e9)
    return respond('Confira os itens, quantidades e valores da proposta. Somente itens desta solicitação são permitidos.')
   ja.add(itemId)
   itens.push({item_id:itemId,quantidade:q,preco_unitario:preco,unidade:item.unidade})
  }
  const frete=money(dados.frete)
  const desconto=money(dados.desconto)??0
  const prazo=money(dados.prazo_dias)
  if(frete!=null&&(!Number.isFinite(frete)||frete<0||frete>1e9))return respond('Frete inválido.')
  if(!Number.isFinite(desconto)||desconto<0||desconto>1e9)return respond('Desconto inválido.')
  if(prazo!=null&&(!Number.isInteger(prazo)||prazo<0||prazo>3650))return respond('Prazo inválido.')
  const calculo=calcularComparativo(itens,[...solicitados.values()].map(s=>({
   id:s.id,descricao:s.descricao,quantidade_necessaria:s.quantidade_necessaria,unidade:s.unidade
  })),{frete,desconto,prazo_dias:prazo,forma_pagamento:null,validade:null})
  if(desconto>calculo.subtotal+(frete??0))return respond('Desconto superior ao valor cotado.')
  const pdf=form.get('arquivo')
  if(pdf&&!(pdf instanceof File))return respond('Anexo inválido.')
  if(pdf instanceof File){
   if(pdf.size<5||pdf.size>12*1024*1024)return respond('PDF deve ter até 12 MB.',413)
   const bin=Buffer.from(await pdf.arrayBuffer())
   if(bin.subarray(0,5).toString()!=='%PDF-')return respond('O anexo precisa ser um arquivo PDF válido.')
   path=ctx.usuario.empresa_id+'/'+dados.solicitacao_id+'/'+randomUUID()+'.pdf'
   const {error:upload}=await db.storage.from('compras-cotacoes').upload(path,bin,
    {contentType:'application/pdf',upsert:false})
   if(upload)throw upload
  }
  const row={
   empresa_id:ctx.usuario.empresa_id,solicitacao_id:pedido.solicitacao.id,
   fornecedor_id:fornecedorId,chave_envio:chave,
   numero_proposta:str(dados.numero_proposta,100)||null,data_proposta:date(dados.data_proposta),
   prazo_dias:prazo,validade:date(dados.validade),forma_pagamento:str(dados.forma_pagamento,300)||null,
   frete,desconto,observacoes:str(dados.observacoes,1200)||null,itens,arquivo_path:path,
   criado_por_id:ctx.usuario.id
  }
  const {data,error}=await db.from('compras_cotacoes_solicitacoes').insert(row).select('id').single()
  if(error)throw error
  return NextResponse.json({id:data.id,resumo:calculo,registrada:true},{status:201})
 }catch(e){
  if(path)await db.storage.from('compras-cotacoes').remove([path])
  console.error('[cotacoes POST]',e)
  return respond('Não foi possível gravar a cotação. Nenhum pedido ao fornecedor foi emitido.',500)
 }
}
export async function PATCH(req:NextRequest){
 const ctx=await contexto(req)
 if('error' in ctx)return ctx.error
 if(!ctx.podeEditar)return respond('Sem permissão para selecionar fornecedor.',403)
 try{
  const p=await req.json().catch(()=>null)
  if(!p||!uuid.test(str(p.id,80))||!uuid.test(str(p.solicitacaoId,80))||
   !['selecionar','descartar','reabrir'].includes(p.acao))return respond('Ação inválida.')
  const {data:cot,error}=await db.from('compras_cotacoes_solicitacoes').select('id,solicitacao_id,status')
   .eq('empresa_id',ctx.usuario.empresa_id).eq('solicitacao_id',p.solicitacaoId)
   .eq('id',p.id).maybeSingle()
  if(error)throw error
  if(!cot)return respond('Cotação não localizada.',404)
  if(p.acao==='selecionar'){
   if(cot.status==='descartada')return respond('Reabra esta cotação antes de escolhê-la.',409)
   const {data:quote,error:eq}=await db.from('compras_cotacoes_solicitacoes')
    .select('fornecedor_id,itens,frete,desconto,validade').eq('empresa_id',ctx.usuario.empresa_id)
    .eq('id',p.id).single()
   if(eq)throw eq
   const pedido=await carregarPedido(ctx.usuario.empresa_id,p.solicitacaoId)
   if(!pedido||['cancelado','recebido'].includes(pedido.solicitacao.status))
    return respond('Solicitação encerrada.',409)
   const resumo=calcularComparativo(quote.itens as ItemCotado[],
    pedido.itens.map(i=>({id:i.id,descricao:i.descricao,quantidade_necessaria:i.quantidade_necessaria,unidade:i.unidade})),
    {frete:quote.frete==null?null:Number(quote.frete),desconto:Number(quote.desconto),
     prazo_dias:null,forma_pagamento:null,validade:quote.validade})
   if(!resumo.completa)return respond('Só é possível escolher uma proposta com todos os itens, quantidades equivalentes e frete informado.',409)
   if(quote.validade&&quote.validade<new Date().toISOString().slice(0,10))
    return respond('Esta proposta venceu. Solicite uma cotação atualizada.',409)
   const {data:fornecedor,error:ef}=await db.from('fornecedores').select('pedido_minimo')
    .eq('empresa_id',ctx.usuario.empresa_id).eq('id',quote.fornecedor_id).maybeSingle()
   if(ef)throw ef
   if(resumo.subtotal<Number(fornecedor?.pedido_minimo||0))
    return respond('O valor da proposta ainda não atingiu o pedido mínimo do fornecedor.',409)
   const {error:rpcErr}=await db.rpc('selecionar_cotacao_compras',{
    p_empresa_id:ctx.usuario.empresa_id,p_solicitacao_id:p.solicitacaoId,p_cotacao_id:p.id
   })
   if(rpcErr)throw rpcErr
  }else{
   const update=p.acao==='descartar'?{status:'descartada',selecionada:false}:
    {status:'em_analise',selecionada:false}
   const {error:eu}=await db.from('compras_cotacoes_solicitacoes')
    .update({...update,updated_at:new Date().toISOString()})
    .eq('empresa_id',ctx.usuario.empresa_id).eq('id',p.id).eq('solicitacao_id',p.solicitacaoId)
   if(eu)throw eu
  }
  return NextResponse.json({ok:true,aviso:'Escolha registrada. O pedido ao fornecedor exige confirmação separada no fluxo de Compras.'})
 }catch(e){
  console.error('[cotacoes PATCH]',e);return respond('Não foi possível atualizar a cotação.',500)
 }
}
