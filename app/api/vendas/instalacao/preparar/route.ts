import {NextRequest,NextResponse} from 'next/server'
import {autenticarTenant} from '@/lib/tenantServer'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import {refItemProducaoInstalacao} from '@/lib/vendaInstalacaoProducao'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const erro=(message:string,status=400)=>NextResponse.json({error:message},{status,headers:{'Cache-Control':'private,no-store'}})
const texto=(x:unknown,limite=250)=>String(x??'').trim().slice(0,limite)

function nomeAmbiente(item:Record<string,unknown>,index:number){
 return texto(item.ambiente||item.local||item.descricao_curta||`Tipologia ${index+1}`)
}
function descricao(item:Record<string,unknown>){
 return texto(item.tipo_outro_texto||item.descricao||item.tipologia_nome||item.configuracao_nome||item.tipo_esquadria||'Peça')
}

// Preparar o checklist NÃO pressupõe que a obra já esteja vinculada.
// Usa a fotografia da venda fechada, nunca tipologias de um orçamento
// posteriormente modificado, e jamais sobrescreve progresso existente.
export async function POST(req:NextRequest){
 const user=await autenticarTenant(req)
 if(!user)return erro('Sessão inválida.',401)
 const body=await req.json().catch(()=>({}))
 const vendaId=texto(body.vendaId,80)
 if(!uuid.test(vendaId))return erro('Venda inválida.')
 const {data:venda,error:ve}=await supabaseAdmin.from('vendas_obras')
  .select('id,cliente_id,orcamento_id,obra_id,itens_snapshot,status')
  .eq('empresa_id',user.empresa_id).eq('id',vendaId).maybeSingle()
 if(ve){console.error('[Instalação][Preparar]',ve);return erro('Não foi possível consultar a venda.',500)}
 if(!venda)return erro('Venda não encontrada nesta empresa.',404)
 if(['cancelado','cancelada'].includes(String(venda.status||'').toLowerCase()))return erro('Venda cancelada não pode receber instalação.',409)
 const itens=Array.isArray(venda.itens_snapshot)?venda.itens_snapshot:[]
 if(!itens.length)return erro('Venda sem tipologias no orçamento fechado. Confira os itens vendidos.',409)
 if(itens.length>400)return erro('Quantidade de tipologias excede o limite de conferência; contate o responsável técnico.',409)
 const refs=new Set<string>()
 const novos=itens.map((original:unknown,index:number)=>{
  const item=(original&&typeof original==='object'&&!Array.isArray(original)?original:{}) as Record<string,unknown>
  const ref=refItemProducaoInstalacao(item,index)
  if(!ref||ref.length>200||refs.has(ref))throw new Error('Referência de tipologia duplicada ou inválida: '+ref)
  refs.add(ref)
  const quantidade=Number(item.quantidade??1)
  if(!Number.isInteger(quantidade)||quantidade<1||quantidade>300)throw new Error('Quantidade inválida na tipologia '+ref)
  return {
   empresa_id:user.empresa_id,venda_obra_id:venda.id,obra_id:venda.obra_id,
   cliente_id:venda.cliente_id,orcamento_id:venda.orcamento_id,
   item_ref:ref,ambiente:nomeAmbiente(item,index),descricao:descricao(item),
   quantidade,quantidade_instalada:0,status:'pendente',
   checklist:{nivelamento:false,vedacao:false,acabamento:false,limpeza:false}
  }
 })
 try{
  // Upsert com ignoreDuplicates, protegido por índice único
  // (empresa_id, venda_obra_id, item_ref). Não altera linhas já conferidas.
  const {error:ie}=await supabaseAdmin.from('venda_instalacao_itens').upsert(novos,{
   onConflict:'empresa_id,venda_obra_id,item_ref',ignoreDuplicates:true
  })
  if(ie)throw ie
  // Se a obra for vinculada depois, manter checklist e fotos anteriores.
  // Atualiza só obra_id nas tipologias sem vínculo e da mesma venda.
  if(venda.obra_id){
   const {error:ue}=await supabaseAdmin.from('venda_instalacao_itens')
    .update({obra_id:venda.obra_id}).eq('empresa_id',user.empresa_id)
    .eq('venda_obra_id',venda.id).is('obra_id',null)
   if(ue)console.error('[Instalação][Vínculo obra]',ue)
  }
  const {data:lista,error:le}=await supabaseAdmin.from('venda_instalacao_itens')
   .select('*').eq('empresa_id',user.empresa_id).eq('venda_obra_id',venda.id).order('created_at')
  if(le)throw le
  return NextResponse.json({ok:true,itens:lista||[],previstos:novos.length,
   obraVinculada:Boolean(venda.obra_id)},{headers:{'Cache-Control':'private,no-store'}})
 }catch(e){
  console.error('[Instalação][Preparar]',e)
  return erro(e instanceof Error?e.message:'Não foi possível preparar as tipologias.',422)
 }
}
