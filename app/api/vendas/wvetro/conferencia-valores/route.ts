import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { consultarPedidoConferenciaWVetro } from '@/lib/wvetroConferenciaConsultaServer'
import { construirConferenciaWVetro, compararConferenciasWVetro } from '@/lib/wvetroConferenciaValores'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const erro=(msg:string,status=400)=>NextResponse.json({error:msg},{status,headers:{'Cache-Control':'no-store'}})
export async function GET(req:NextRequest){
 const usuario=await autenticarTenant(req)
 if(!usuario)return erro('Sessão inválida.',401)
 const vendaId=String(req.nextUrl.searchParams.get('vendaId')||'')
 const aoVivo=req.nextUrl.searchParams.get('aoVivo')==='1'
 if(!/^[0-9a-f-]{36}$/i.test(vendaId))return erro('Venda inválida.')
 try{
  const {data:venda,error:ve}=await supabaseAdmin.from('vendas_obras')
   .select('id,orcamento_id,valor_venda,custo_previsto')
   .eq('id',vendaId).eq('empresa_id',usuario.empresa_id).maybeSingle()
  if(ve)throw ve
  if(!venda)return erro('Venda não localizada nesta empresa.',404)
  const {data:orcamento,error:oe}=await supabaseAdmin.from('orcamentos')
   .select('id,itens,wvetro_fluxo').eq('id',venda.orcamento_id)
   .eq('empresa_id',usuario.empresa_id).maybeSingle()
  if(oe)throw oe
  if(!orcamento)return erro('Orçamento não encontrado.',404)
  const fluxo=(orcamento.wvetro_fluxo||{}) as Record<string,unknown>
  const numero=String(fluxo.numero||'').trim()
  if(!/^\d{1,12}$/.test(numero))return erro('Esta venda não possui número de orçamento W.Vetro válido.',404)
  const {data:historico}=await supabaseAdmin.from('wvetro_orcamentos_historico')
   .select('valor_bruto,valor_total,custo_com_sobra,custo_sem_sobra')
   .eq('wvetro_numero',numero).eq('empresa_id',usuario.empresa_id)
   .order('capturado_em',{ascending:false}).limit(1).maybeSingle()
  const antes=construirConferenciaWVetro({
   fluxo,itensAtlas:orcamento.itens,vendaAtlas:venda.valor_venda,
   custoAtlas:venda.custo_previsto,historico,fonte:'importacao_atlas',
  })
  if(!antes)return erro('O orçamento importado não contém a composição original para comparar.',422)
  let fonte:'importacao_atlas'|'consulta_ao_vivo'='importacao_atlas'
  let dadosFluxo:unknown=fluxo
  if(aoVivo){
   // Consultar somente leitura: pedidoByKey e, se preciso, lista de pedidos
   // da data original e lista de orçamentos da emissão. Confirmar Nro e
   // custo/venda individuais antes de mostrar diferenças ou substituir fontes.
   const importado=(fluxo.payload_bruto||{}) as Record<string,unknown>
   const consulta=await consultarPedidoConferenciaWVetro(numero,importado)
   if(!consulta.pedido){
    console.warn('Consulta W.Vetro sem composição financeira', {numero,etapas:consulta.motivos})
    return erro('O W.Vetro não forneceu uma composição financeira completa nas consultas disponíveis. Os dados anteriores permanecem intactos. Confira a data e o número do orçamento no W.Vetro.',422)
   }
   dadosFluxo={numero,payload_bruto:consulta.pedido}
   fonte='consulta_ao_vivo'
  }
  const resultado=construirConferenciaWVetro({
   fluxo:dadosFluxo,itensAtlas:orcamento.itens,vendaAtlas:venda.valor_venda,
   custoAtlas:venda.custo_previsto,historico:aoVivo?undefined:historico,fonte,
  })
  if(!resultado)return erro('Ainda não há itens financeiros originais do W.Vetro para comparar.',404)
  const diferencas=aoVivo?compararConferenciasWVetro(antes,resultado):null
  return NextResponse.json({ok:true,conferencia:resultado,diferencas},
   {headers:{'Cache-Control':'no-store'}})
 }catch(e){
  console.error('Falha na conferência W.Vetro sem gravação:',e)
  return erro('Não foi possível conferir os valores. Nenhuma alteração foi feita na venda.',500)
 }
}
