import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant, type UsuarioTenant } from '@/lib/tenantServer'
import { usuarioPodeAcaoServer } from '@/lib/acessoUsuarioServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const bad=(error:string,status=400)=>NextResponse.json({ok:false,error},{status})
const str=(v:unknown,max=300)=>typeof v==='string'?v.trim().slice(0,max):''
const uuid=(v:unknown)=>typeof v==='string'&&UUID.test(v)?v:''
const ACOES={
  criar_etapa:'producao.geral.etapas',
  editar_etapa:'producao.geral.etapas',
  editar_card:'producao.geral.editar',
  mover_card:'producao.geral.mover',
  criar_ordem:'producao.geral.criar',
  avancar_ordem:'producao.geral.mover',
  marcar_liberado:'producao.geral.liberar',
} as const
type Acao=keyof typeof ACOES

async function colunaDaEmpresa(empresa:string,id:string) {
 const {data,error}=await supabaseAdmin.from('setor_kanban_colunas')
  .select('id,setor_id,nome,ordem').eq('empresa_id',empresa).eq('setor_id','producao').eq('id',id).maybeSingle()
 if(error)throw error
 return data
}
async function cardDaProducao(empresa:string,id:string) {
 const {data,error}=await supabaseAdmin.from('setor_kanban_itens')
  .select('id,coluna_id,descricao,orcamento_id,liberado_producao_em').eq('empresa_id',empresa).eq('id',id).maybeSingle()
 if(error)throw error
 if(!data||!await colunaDaEmpresa(empresa,data.coluna_id))return null
 return data
}
async function executar(usuario:UsuarioTenant,acao:Acao,b:Record<string,unknown>) {
 const empresa=usuario.empresa_id
 const agora=new Date().toISOString()

 if(acao==='criar_etapa'){
  const nome=str(b.nome,90),descricao=str(b.descricao,500)
  if(!nome)return bad('Informe o nome da etapa.')
  const {data:atuais,error:erroColunas}=await supabaseAdmin.from('setor_kanban_colunas')
   .select('ordem').eq('empresa_id',empresa).eq('setor_id','producao').order('ordem',{ascending:false}).limit(1)
  if(erroColunas)throw erroColunas
  const ordem=Number(atuais?.[0]?.ordem??-1)+1
  const {data,error}=await supabaseAdmin.from('setor_kanban_colunas').insert({
   empresa_id:empresa,setor_id:'producao',nome,descricao:descricao||null,ordem,
  }).select('id,setor_id,nome,descricao,ordem').single()
  if(error)throw error
  return NextResponse.json({ok:true,coluna:data})
 }

 if(acao==='editar_etapa'){
  const colunaId=uuid(b.colunaId),nome=str(b.nome,90),descricao=str(b.descricao,500)
  if(!colunaId||!nome)return bad('Etapa ou nome inválido.')
  if(!await colunaDaEmpresa(empresa,colunaId))return bad('Etapa não pertence à Produção.',404)
  const {data,error}=await supabaseAdmin.from('setor_kanban_colunas')
   .update({nome,descricao:descricao||null}).eq('empresa_id',empresa)
   .eq('setor_id','producao').eq('id',colunaId)
   .select('id,setor_id,nome,descricao,ordem').maybeSingle()
  if(error)throw error
  return data?NextResponse.json({ok:true,coluna:data}):bad('Etapa alterada por outra pessoa. Atualize.',409)
 }

 if(acao==='editar_card'){
  const cardId=uuid(b.cardId),titulo=str(b.titulo,240)
  if(!cardId||!titulo)return bad('Card ou título inválido.')
  const card=await cardDaProducao(empresa,cardId)
  if(!card)return bad('Card não localizado na Produção.',404)
  // Um usuário não pode forjar ou retirar a ligação técnica com a Medição Final.
  const marcador=String(card.descricao||'').match(/\[medicao:[0-9a-f-]{36}\]/i)?.[0]||''
  const descricao=str(b.descricao,4000).replace(/\[medicao:[^\]]+\]/gi,'').trim()
  const final=[descricao,marcador].filter(Boolean).join(' ')
  const {data,error}=await supabaseAdmin.from('setor_kanban_itens')
   .update({titulo,descricao:final||null,atualizado_em:agora,atualizado_por_id:usuario.id,
    atualizado_por_nome:usuario.nome}).eq('empresa_id',empresa).eq('id',cardId)
   .eq('coluna_id',card.coluna_id).select('id').maybeSingle()
  if(error)throw error
  return data?NextResponse.json({ok:true,descricao:final||null}):bad('Card foi movimentado por outra pessoa. Atualize.',409)
 }

 if(acao==='mover_card'){
  const cardId=uuid(b.cardId),destinoId=uuid(b.colunaId)
  if(!cardId||!destinoId)return bad('Card ou etapa inválida.')
  const [card,destino]=await Promise.all([
   cardDaProducao(empresa,cardId),colunaDaEmpresa(empresa,destinoId),
  ])
  if(!card||!destino)return bad('Card ou destino fora do setor Produção.',404)
  if(card.coluna_id===destinoId)return NextResponse.json({ok:true})
  if(/\[medicao:[0-9a-f-]{36}\]/i.test(String(card.descricao||''))&&!card.liberado_producao_em)
   return bad('Card ainda não liberado tecnicamente. Faça a aprovação da Medição Final.',409)
  // Triggers técnicos originais continuam conferindo a etapa e as ordens vinculadas.
  const {data,error}=await supabaseAdmin.from('setor_kanban_itens')
   .update({coluna_id:destinoId,atualizado_em:agora,atualizado_por_id:usuario.id,
    atualizado_por_nome:usuario.nome}).eq('empresa_id',empresa).eq('id',cardId)
   .eq('coluna_id',card.coluna_id).select('id').maybeSingle()
  if(error)throw error
  return data?NextResponse.json({ok:true}):bad('Card movimentado por outra pessoa. Atualize.',409)
 }

 if(acao==='marcar_liberado'){
  const cardId=uuid(b.cardId),destinoId=b.colunaId==null?'':uuid(b.colunaId)
  if(!cardId||(b.colunaId!=null&&!destinoId))return bad('Card ou etapa inválida.')
  const card=await cardDaProducao(empresa,cardId)
  if(!card)return bad('Card não localizado na Produção.',404)
  if(card.liberado_producao_em)return bad('A Produção já foi liberada. Atualize a página.',409)
  const medicaoId=String(card.descricao||'').match(/\[medicao:([0-9a-f-]{36})\]/i)?.[1]
  if(!medicaoId||!uuid(medicaoId))return bad('Card sem vínculo válido com uma Medição Final.',409)
  const {data:medicao,error:erroMedicao}=await supabaseAdmin.from('medicoes_finais')
   .select('id,orcamento_id,status_operacional').eq('id',medicaoId)
   .eq('empresa_id',empresa).eq('tipo_medicao','tipologia').maybeSingle()
  if(erroMedicao)throw erroMedicao
  if(!medicao||medicao.status_operacional!=='aprovado'
     ||medicao.orcamento_id!==card.orcamento_id)
   return bad('A Medição Final vinculada ainda não foi aprovada.',409)
  if(!card.orcamento_id)return bad('Este card não possui orçamento vinculado.',409)
  const {data:pacote,error:erroPacote}=await supabaseAdmin.from('pacotes_tecnicos')
   .select('id').eq('empresa_id',empresa).eq('orcamento_id',card.orcamento_id)
   .eq('origem','medicao_final').neq('status','substituido').limit(1).maybeSingle()
  if(erroPacote)throw erroPacote
  if(!pacote)return bad('Gere primeiro o pacote técnico da Medição Final.',409)
  if(destinoId&&!await colunaDaEmpresa(empresa,destinoId))
   return bad('O destino não pertence ao Kanban da Produção.',404)
  const patch:Record<string,unknown>={
   liberado_producao_em:agora,liberado_producao_por_id:usuario.id,
   liberado_producao_por_nome:usuario.nome,atualizado_em:agora,
   atualizado_por_id:usuario.id,atualizado_por_nome:usuario.nome,
  }
  if(destinoId)patch.coluna_id=destinoId
  const {data,error}=await supabaseAdmin.from('setor_kanban_itens').update(patch)
   .eq('empresa_id',empresa).eq('id',cardId).eq('coluna_id',card.coluna_id)
   .is('liberado_producao_em',null).select('id').maybeSingle()
  if(error)throw error
  return data?NextResponse.json({ok:true}):bad('O estado do card mudou. Atualize e confira.',409)
 }

 if(acao==='avancar_ordem'){
  const ordemId=uuid(b.ordemId),novo=str(b.status,40)
  if(!ordemId||!['em_producao','conferencia','concluida'].includes(novo))
   return bad('Ordem ou etapa inválida.')
  const {data:ordem,error:erroOrdem}=await supabaseAdmin.from('ordens_producao')
   .select('id,status,bloqueada,origem').eq('empresa_id',empresa).eq('id',ordemId).maybeSingle()
  if(erroOrdem)throw erroOrdem
  if(!ordem)return bad('Ordem não localizada nesta empresa.',404)
  if(ordem.bloqueada)return bad('Ordem bloqueada. Conclua as liberações técnicas.',409)
  const mapa:Record<string,string>={
   aguardando:'em_producao',liberada:'em_producao',em_producao:'conferencia',conferencia:'concluida',
  }
  if(mapa[ordem.status]!==novo)return bad('Etapa inválida ou ordem concluída. Atualize a produção.',409)
  const {data,error}=await supabaseAdmin.from('ordens_producao').update({status:novo})
   .eq('empresa_id',empresa).eq('id',ordemId).eq('status',ordem.status).eq('bloqueada',false)
   .select('id').maybeSingle()
  if(error)throw error
  return data?NextResponse.json({ok:true}):bad('A ordem mudou em outra sessão. Atualize.',409)
 }

 if(acao==='criar_ordem'){
  const titulo=str(b.titulo,240)
  const tipo=str(b.tipoProducao,35)
  const quantidade=Number(b.quantidade)
  const largura=b.larguraMm==null?null:Number(b.larguraMm)
  const altura=b.alturaMm==null?null:Number(b.alturaMm)
  const clienteId=b.clienteId==null?null:uuid(b.clienteId)
  const obraId=b.obraId==null?null:uuid(b.obraId)
  const vendaId=b.vendaId==null?null:uuid(b.vendaId)
  const orcamentoId=b.orcamentoId==null?null:uuid(b.orcamentoId)
  if(!titulo||!['contramarco','esquadria','personalizada'].includes(tipo)
   ||!Number.isInteger(quantidade)||quantidade<1||quantidade>100000
   ||(largura!==null&&(!Number.isFinite(largura)||largura<=0||largura>100000))
   ||(altura!==null&&(!Number.isFinite(altura)||altura<=0||altura>100000))
   ||(b.clienteId!=null&&!clienteId)||(b.obraId!=null&&!obraId)
   ||(b.vendaId!=null&&!vendaId)||(b.orcamentoId!=null&&!orcamentoId))
   return bad('Dados da ordem de produção inválidos.')
  if((obraId||vendaId||orcamentoId)&&!clienteId)return bad('Informe o cliente da obra.')
  if(clienteId){
   const {data:cliente,error}=await supabaseAdmin.from('clientes')
    .select('id').eq('empresa_id',empresa).eq('id',clienteId).maybeSingle()
   if(error)throw error
   if(!cliente)return bad('Cliente não pertence à empresa.',404)
  }
  if(obraId){
   const {data:obra,error}=await supabaseAdmin.from('obras')
    .select('id').eq('empresa_id',empresa).eq('cliente_id',clienteId).eq('id',obraId).maybeSingle()
   if(error)throw error
   if(!obra)return bad('Obra não vinculada ao cliente.',404)
  }
  if(vendaId){
   const {data:venda,error}=await supabaseAdmin.from('vendas_obras')
    .select('id,orcamento_id,obra_id').eq('empresa_id',empresa).eq('cliente_id',clienteId)
    .eq('id',vendaId).maybeSingle()
   if(error)throw error
   if(!venda||venda.orcamento_id!==orcamentoId
      ||(obraId&&venda.obra_id!==obraId))
    return bad('Venda ou orçamento não corresponde ao cliente e à obra.',409)
  }else if(orcamentoId)return bad('Orçamento exige uma venda vinculada.')
  const {data:colunas,error:erroColunas}=await supabaseAdmin.from('setor_kanban_colunas')
   .select('id').eq('empresa_id',empresa).eq('setor_id','producao')
   .order('ordem').limit(1)
  if(erroColunas)throw erroColunas
  const colunaId=colunas?.[0]?.id
  if(!colunaId)return bad('Não há etapa de entrada cadastrada para a Produção.',409)
  const {data:card,error:erroCard}=await supabaseAdmin.from('setor_kanban_itens')
   .insert({empresa_id:empresa,titulo,descricao:clienteId?'Produção vinculada criada manualmente.':'Produção avulsa criada manualmente.',
    coluna_id:colunaId,cliente_id:clienteId,obra_id:obraId,orcamento_id:orcamentoId,
    criado_por_id:usuario.id,criado_por_nome:usuario.nome,atualizado_por_id:usuario.id,
    atualizado_por_nome:usuario.nome}).select('id').single()
  if(erroCard)throw erroCard
  // Mantém o comportamento legado de desfazer o card se a OP não for criada.
  const {data:ordem,error:erroOrdem}=await supabaseAdmin.from('ordens_producao')
   .insert({empresa_id:empresa,setor_card_id:card.id,cliente_id:clienteId,obra_id:obraId,
    venda_obra_id:vendaId,orcamento_id:orcamentoId,item_ref:null,tipo_producao:tipo,
    titulo,quantidade,largura_mm:largura,altura_mm:altura,status:'liberada',bloqueada:false,
    bloqueio_motivo:null,origem:'manual',criado_por_id:usuario.id,criado_por_nome:usuario.nome})
   .select('*,clientes(nome),obras(nome),vendas_obras(numero)').single()
  if(erroOrdem){
   const {error:erroLimpeza}=await supabaseAdmin.from('setor_kanban_itens').delete()
    .eq('empresa_id',empresa).eq('id',card.id)
   if(erroLimpeza)console.error('[Produção] Card órfão após falha da OP:',card.id,erroLimpeza.code)
   throw erroOrdem
  }
  return NextResponse.json({ok:true,ordem:{
   ...ordem,cliente_nome:ordem.clientes?.nome||null,
   obra_nome:ordem.obras?.nome||null,venda_numero:ordem.vendas_obras?.numero||null,
  }})
 }
 return bad('Ação inválida.')
}

export async function POST(req:NextRequest) {
 const usuario=await autenticarTenant(req)
 if(!usuario)return bad('Sessão expirada ou inválida.',401)
 const b=await req.json().catch(()=>null)
 if(!b||typeof b!=='object'||Array.isArray(b))return bad('Dados inválidos.')
 const acao=String(b.acao||'') as Acao
 if(!Object.prototype.hasOwnProperty.call(ACOES,acao))return bad('Operação não reconhecida.',400)
 try{
  const autorizado=await usuarioPodeAcaoServer({
   usuarioId:usuario.id,role:usuario.role,empresaId:usuario.empresa_id,
   setorId:'producao',acaoId:ACOES[acao],minimo:'edicao',
  })
  if(!autorizado)return bad('Sem permissão para executar esta operação da Produção.',403)
 }catch{return bad('Não foi possível conferir sua autorização. Nada foi alterado.',503)}
 try{return await executar(usuario,acao,b)}
 catch(error){
  console.error('[Produção][Operações] Operação rejeitada:',acao,error)
  return bad('Não foi possível completar a operação. Atualize o quadro e tente novamente.',409)
 }
}
