import {randomUUID} from 'node:crypto'
import {NextRequest,NextResponse} from 'next/server'
import {autenticarCompras} from '@/lib/comprasServer'
import {obterComprasAcessos} from '@/lib/comprasPermissoesServer'
import {supabaseAdmin as db} from '@/lib/supabaseAdmin'
import {fontePreparacaoCompra,type CategoriaPreCompra} from '@/lib/preparacaoCompraMateriaisServer'
import {auditarCotacaoMateriais} from '@/lib/tipologiaMateriaisConferenciaServer'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const txt=(v:unknown,max=500)=>String(v??'').trim().slice(0,max)
const erro=(m:string,s=400)=>NextResponse.json({error:m},{status:s,headers:{'Cache-Control':'private,no-store'}})
const validaCat=(v:unknown):v is CategoriaPreCompra=>v==='perfil'||v==='acessorio'||v==='vidro'
const numero=(n:unknown)=>Number(n)
const positivo=(n:number)=>Number.isFinite(n)&&n>=0&&n<=100000&&Number(n.toFixed(3))===n
const tab='venda_preparacao_compras'
async function contexto(req:NextRequest,vendaId:string,escrita:boolean){
 const u=await autenticarCompras(req)
 if(!u||!uuid.test(vendaId))return null
 const a=await obterComprasAcessos(u)
 if(escrita&&!a.solicitar)return null
 if(!escrita&&!(a.solicitar||a.consultar||a.verProprios||a.editarTodos))return null
 return {u,fonte:await fontePreparacaoCompra(u.empresa_id,vendaId)}
}
export async function GET(req:NextRequest){
 const vendaId=txt(req.nextUrl.searchParams.get('vendaId'),80)
 try{
  const ctx=await contexto(req,vendaId,false)
  if(!ctx)return erro('Sem permissão para consultar a preparação de compras.',403)
  const r=await db.from(tab).select('*').eq('empresa_id',ctx.u.empresa_id).eq('venda_obra_id',vendaId).order('created_at')
  if(r.error)throw r.error
  const manuais=(r.data||[]).filter(s=>s.origem==='manual'&&s.categoria!=='vidro')
  const codigos=[...new Set(manuais.map(m=>m.codigo))]
  const produtos=codigos.length?await db.from('produtos').select('id,codigo,foto_url')
    .eq('empresa_id',ctx.u.empresa_id).eq('ativo',true).in('codigo',codigos):{data:[],error:null}
  if(produtos.error)throw produtos.error
  const manuaisImagens:Record<string,{imagemUrl:string|null;produtoId:string|null}>={}
  for(const m of manuais){
   const produto=(produtos.data||[]).find(p=>p.codigo===m.codigo)
   manuaisImagens[m.chave_item]={imagemUrl:produto?.foto_url||null,produtoId:produto?.id||null}
  }
  return NextResponse.json({ok:true,itens:ctx.fonte.itens,rascunhos:r.data||[],manuaisImagens,
   aviso:[!ctx.fonte.temBarrasWvetro?'Sem relatório comercial de barras W.Vetro. Nunca estimar compra usando quantidade de peças cortadas.':null,
    ctx.fonte.perfisSemBarra.length?ctx.fonte.perfisSemBarra.length+' perfil(is) adicionados na tipologia sem equivalência em Barras Utilizadas. Calcule a quantidade de barras na conferência antes de comprar.':null
   ].filter(Boolean).join(' ')||null},
   {headers:{'Cache-Control':'private,no-store'}})
 }catch(e){console.error('[preparacao GET]',e);return erro('Preparação indisponível. A composição técnica foi preservada.',503)}
}
export async function PATCH(req:NextRequest){
 const b=await req.json().catch(()=>({}))
 const vendaId=txt(b.vendaId,80),chave=txt(b.chave,450),cat=b.categoria
 if(!uuid.test(vendaId)||!validaCat(cat)||!chave)return erro('Material ou venda inválidos.')
 try{
  const ctx=await contexto(req,vendaId,true)
  if(!ctx)return erro('Sem permissão para preparar compras.',403)
  const fonte=ctx.fonte.itens.find(i=>i.chave===chave&&i.categoria===cat)
  const r=await db.from(tab).select('*').eq('empresa_id',ctx.u.empresa_id)
   .eq('venda_obra_id',vendaId).eq('categoria',cat).eq('chave_item',chave).maybeSingle()
  if(r.error)throw r.error
  const antigo=r.data
  if(!fonte&&antigo?.origem!=='manual')return erro('Material removido da tipologia. Reabra a conferência.',409)
  if(antigo?.solicitacao_id)return erro('Já enviado para Compras. Confira o pedido antes de alterar.',409)
  const hash=fonte?.fonteHash||'manual'
  if(b.fonteHash!==hash)return erro('A composição da tipologia mudou. Atualize e confira os materiais novamente.',409)
  const estoque=numero(b.estoque),comprar=numero(b.comprar),necessidade=fonte?.necessidade??Number(antigo?.quantidade_necessaria||0)
  if(!positivo(estoque)||!positivo(comprar))return erro('Quantidade inválida; informe valores não negativos.')
  if(cat!=='acessorio'&&(!Number.isInteger(estoque)||!Number.isInteger(comprar)))return erro('Barras e vidros precisam de quantidade inteira.')
  const justificativa=txt(b.justificativa,750)
  if(Math.abs(comprar-Math.max(0,necessidade-estoque))>.0001&&justificativa.length<5)
   return erro('Informe o motivo quando a quantidade a comprar não corresponde à necessidade menos o estoque.')
  if(b.conferido!==true)return erro('Marque a conferência do estoque antes de salvar.')
  const patch={empresa_id:ctx.u.empresa_id,venda_obra_id:vendaId,categoria:cat,chave_item:chave,
   origem:fonte?.origem||'manual',codigo:fonte?.codigo||antigo?.codigo||'',
   descricao:fonte?.descricao||antigo?.descricao||'',cor:fonte?.cor||antigo?.cor||'',
   medida:fonte?.medida||antigo?.medida||'',unidade:fonte?.unidade||antigo?.unidade||'UN',
   quantidade_necessaria:necessidade,quantidade_estoque:estoque,quantidade_comprar:comprar,
   fonte_hash:hash,estoque_conferido:true,justificativa:justificativa||null,
   atualizado_por_id:ctx.u.id,updated_at:new Date().toISOString(),revisao:(antigo?.revisao||0)+1}
  const salvo=antigo
   ?await db.from(tab).update(patch).eq('empresa_id',ctx.u.empresa_id).eq('id',antigo.id).eq('revisao',antigo.revisao).is('solicitacao_id',null).select('*').maybeSingle()
   :await db.from(tab).insert(patch).select('*').single()
  if(salvo.error){if(salvo.error.code==='23505')return erro('Outra pessoa salvou este material. Atualize a lista.',409);throw salvo.error}
  if(!salvo.data)return erro('A preparação mudou em outra sessão. Recarregue.',409)
  return NextResponse.json({ok:true,rascunho:salvo.data})
 }catch(e){console.error('[preparacao PATCH]',e);return erro('Não foi possível salvar; nenhum material técnico foi alterado.',500)}
}
export async function POST(req:NextRequest){
 const b=await req.json().catch(()=>({}))
 const vendaId=txt(b.vendaId,80),cat=b.categoria
 if(!uuid.test(vendaId)||!validaCat(cat))return erro('Venda ou categoria inválida.')
 try{
  const ctx=await contexto(req,vendaId,true)
  if(!ctx)return erro('Sem permissão para enviar compras.',403)
  if(b.acao==='adicionar'){
   const codigo=txt(b.codigo,80),comprar=numero(b.comprar)
   if(!codigo||!positivo(comprar)||comprar<=0)return erro('Informe código e quantidade válidos.')
   if(cat!=='acessorio'&&!Number.isInteger(comprar))return erro('Quantidade deve ser inteira.')
   const r=await db.from('produtos').select('id,codigo,nome,categoria,unidade,foto_url')
    .eq('empresa_id',ctx.u.empresa_id).eq('ativo',true).ilike('codigo',codigo).limit(10)
   if(r.error)throw r.error
   const pr=(r.data||[]).find(p=>p.codigo.toUpperCase()===codigo.toUpperCase())
   if(!pr)return erro('Cadastre este código no catálogo antes de incluí-lo.',409)
   if(cat!=='vidro'&&!pr.foto_url)return erro('Cadastre a imagem do perfil ou acessório.',409)
   const catProduto=String(pr.categoria||'').toLowerCase()
   if((cat==='perfil'&&!['perfil','contramarco'].includes(catProduto))||
      (cat==='acessorio'&&!['acessorio','acessorios'].includes(catProduto)))
    return erro('O código não pertence à categoria escolhida.',409)
   const novo=await db.from(tab).insert({empresa_id:ctx.u.empresa_id,venda_obra_id:vendaId,
    categoria:cat,chave_item:'manual:'+randomUUID(),origem:'manual',codigo:pr.codigo,descricao:pr.nome,
    cor:txt(b.cor,150),medida:txt(b.medida,150),unidade:pr.unidade||'UN',
    quantidade_necessaria:0,quantidade_estoque:0,quantidade_comprar:comprar,
    fonte_hash:'manual',estoque_conferido:true,
    justificativa:txt(b.justificativa,750)||'Compra extra manual, sem alteração da composição técnica.',
    atualizado_por_id:ctx.u.id}).select().single()
   if(novo.error)throw novo.error
   return NextResponse.json({ok:true,rascunho:novo.data},{status:201})
  }
  if(b.acao!=='enviar')return erro('Ação inválida.')
  if(!ctx.fonte.venda.obra_id||!ctx.fonte.venda.cliente_id)return erro('Vincule cliente e obra antes de enviar a compra.',409)
  // O fluxo histórico de Barras Utilizadas permanece disponível para acompanhar
  // compras antigas. Proteger a nova Central contra pedido duplicado na mesma obra.
  if(cat==='perfil'){
   const legada=await db.from('venda_wvetro_barras').select('id')
    .eq('empresa_id',ctx.u.empresa_id).eq('venda_obra_id',vendaId)
    .not('validado_em','is',null).limit(1)
   if(legada.error)throw legada.error
   if(legada.data?.length)return erro('Esta obra possui barras já encaminhadas pelo fluxo anterior. Confira as compras existentes antes de criar outra solicitação de perfis.',409)
  }
  const r=await db.from(tab).select('*').eq('empresa_id',ctx.u.empresa_id).eq('venda_obra_id',vendaId).eq('categoria',cat)
  if(r.error)throw r.error
  const salvos=r.data||[],origem=ctx.fonte.itens.filter(i=>i.categoria===cat)
  if(!origem.length&&!salvos.length)return erro('Nenhum material nesta categoria.')
  const mapas=new Map(salvos.map(i=>[i.chave_item,i]))
  const pendentes=origem.filter(i=>!mapas.has(i.chave)||!mapas.get(i.chave)?.estoque_conferido||mapas.get(i.chave)?.fonte_hash!==i.fonteHash)
  if(pendentes.length)return erro('Revise '+pendentes.length+' material(is) que ainda não foram conferidos ou mudaram na tipologia.',409)
  if(salvos.some(s=>s.solicitacao_id))return erro('Esta categoria já foi enviada a Compras. Não duplicar pedidos.',409)
  if(salvos.some(s=>s.origem!=='manual'&&!origem.some(i=>i.chave===s.chave_item)))
   return erro('Há um material antigo fora da tipologia atual. Refaça a conferência.',409)
  const compra=salvos.filter(s=>s.estoque_conferido&&Number(s.quantidade_comprar)>0)
  if(!compra.length)return erro('A lista está preparada, mas não há material a comprar.',409)
  if(compra.length>100)return erro('Limite de 100 materiais por pedido de categoria.')
  const itens=[]
  for(const [idx,s] of compra.entries()){
   const src=origem.find(i=>i.chave===s.chave_item)
   const prod=await db.from('produtos').select('id,foto_url').eq('empresa_id',ctx.u.empresa_id)
    .eq('ativo',true).eq('codigo',s.codigo).limit(1).maybeSingle()
   if(prod.error)throw prod.error
   if(cat!=='vidro'&&!prod.data?.foto_url)return erro('Imagem não cadastrada: '+s.codigo,409)
   itens.push({empresa_id:ctx.u.empresa_id,ordem:idx+1,categoria:cat,
    descricao:s.codigo+' · '+s.descricao+(s.cor?' · '+s.cor:'')+(s.medida?' · '+s.medida:''),
    quantidade_necessaria:Number(s.quantidade_comprar),unidade:s.unidade,
    produto_id:src?.produtoId||prod.data?.id||null,
    identificacao_status:(src?.produtoId||prod.data?.id)?'validado':'pendente',
    destino:'obra',cliente_id:ctx.fonte.venda.cliente_id,obra_id:ctx.fonte.venda.obra_id,
    atualizado_por_id:ctx.u.id})
  }
  const pacote=ctx.fonte.pacote
  if(!pacote)return erro('Pacote técnico ainda não validado.',409)
  const materiaisCategoria=ctx.fonte.materiais.filter(m=>compra.some(c=>c.codigo===m.codigo)&&
   (cat==='perfil'?['perfil','contramarco'].includes(m.categoria):cat==='acessorio'?['acessorio','acessorios'].includes(m.categoria):m.categoria==='vidro'))
  const selecionados=materiaisCategoria.length?materiaisCategoria:compra.every(c=>c.origem==='manual')?ctx.fonte.materiais:[]
  const pendencias=await auditarCotacaoMateriais({empresaId:ctx.u.empresa_id,vendaId,
   orcamentoId:ctx.fonte.venda.orcamento_id,pacoteId:pacote.id,origemPacote:pacote.origem,
   criadoEm:pacote.created_at,itensPacote:Array.isArray(pacote.snapshot_itens)?pacote.snapshot_itens:[],
   materiais:ctx.fonte.materiais,selecionados})
  if(pendencias.length)return erro('Compra bloqueada: '+pendencias.slice(0,4).join(' | '),409)
  // Reserva exclusiva por categoria impede dois pedidos decorrentes de cliques simultâneos.
  const reserva=await db.from('venda_preparacao_envios').insert({empresa_id:ctx.u.empresa_id,
   venda_obra_id:vendaId,categoria:cat,status:'reservado',criado_por_id:ctx.u.id}).select('id').single()
  if(reserva.error){if(reserva.error.code==='23505')return erro('Esta categoria já está em envio ou já foi enviada. Não duplicar pedidos.',409);throw reserva.error}
  const pedido=await db.from('compras_solicitacoes').insert({empresa_id:ctx.u.empresa_id,
   destino:'obra',cliente_id:ctx.fonte.venda.cliente_id,obra_id:ctx.fonte.venda.obra_id,
   solicitante_id:ctx.u.id,solicitante_nome:ctx.u.nome,
   observacoes:'Lista '+cat+' da obra, após conferência de estoque. A necessidade técnica e os cortes foram preservados.',
   atualizado_por_id:ctx.u.id}).select('id').single()
  if(pedido.error){await db.from('venda_preparacao_envios').delete().eq('id',reserva.data.id);throw pedido.error}
  try{
   const ins=await db.from('compras_solicitacao_itens').insert(itens.map(i=>({...i,solicitacao_id:pedido.data.id})))
   if(ins.error)throw ins.error
   const upd=await db.from(tab).update({solicitacao_id:pedido.data.id,enviado_em:new Date().toISOString()})
    .eq('empresa_id',ctx.u.empresa_id).eq('venda_obra_id',vendaId).eq('categoria',cat)
    .is('solicitacao_id',null).in('id',salvos.map(s=>s.id)).select('id')
   if(upd.error||upd.data?.length!==salvos.length)throw Error('Preparação alterada simultaneamente; pedido revertido.')
   const concluido=await db.from('venda_preparacao_envios').update({status:'enviado',solicitacao_id:pedido.data.id,updated_at:new Date().toISOString()})
    .eq('id',reserva.data.id).eq('status','reservado')
   if(concluido.error)throw concluido.error
  }catch(e){
   await db.from('compras_solicitacao_itens').delete().eq('empresa_id',ctx.u.empresa_id).eq('solicitacao_id',pedido.data.id)
   await db.from('compras_solicitacoes').delete().eq('empresa_id',ctx.u.empresa_id).eq('id',pedido.data.id)
   await db.from(tab).update({solicitacao_id:null,enviado_em:null}).eq('empresa_id',ctx.u.empresa_id)
    .eq('venda_obra_id',vendaId).eq('categoria',cat).eq('solicitacao_id',pedido.data.id)
   await db.from('venda_preparacao_envios').delete().eq('id',reserva.data.id).eq('status','reservado')
   throw e
  }
  return NextResponse.json({ok:true,solicitacaoId:pedido.data.id,itens:itens.length,
   mensagem:'Pedido encaminhado à Central de Compras, sem modificar tipologia ou corte.'})
 }catch(e){console.error('[preparacao POST]',e);return erro('Não foi possível enviar. Nenhum material técnico foi alterado.',500)}
}
