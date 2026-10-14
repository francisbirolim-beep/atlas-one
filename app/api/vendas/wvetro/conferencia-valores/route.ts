import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { buscarPedidoWVetro } from '@/lib/wvetroApi'
import { construirConferenciaWVetro, extrairPedidoAtual } from '@/lib/wvetroConferenciaValores'

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
  let fonte:'importacao_atlas'|'consulta_ao_vivo'='importacao_atlas'
  let dadosFluxo:unknown=fluxo
  if(aoVivo){
   // Consulta o pedido agora, sem importar/atualizar tabelas, vendas ou financeiro.
   let resposta:unknown
   try{resposta=await buscarPedidoWVetro(numero)}
   catch(e){console.error('Falha ao consultar W.Vetro ao vivo:',e);return erro('Não foi possível consultar o W.Vetro neste momento. Os dados importados continuam preservados.',503)}
   const pedido=extrairPedidoAtual(resposta,numero)
   if(!pedido)return erro('O W.Vetro não retornou os itens do orçamento solicitado. Não houve alteração no Atlas.',422)
   dadosFluxo={numero,payload_bruto:pedido}
   fonte='consulta_ao_vivo'
  }
  const resultado=construirConferenciaWVetro({
   fluxo:dadosFluxo,itensAtlas:orcamento.itens,vendaAtlas:venda.valor_venda,
   custoAtlas:venda.custo_previsto,historico,fonte,
  })
  if(!resultado)return erro('Ainda não há itens financeiros originais do W.Vetro para comparar.',404)
  return NextResponse.json({ok:true,conferencia:resultado},{headers:{'Cache-Control':'no-store'}})
 }catch(e){
  console.error('Falha na conferência W.Vetro sem gravação:',e)
  return erro('Não foi possível conferir os valores. Nenhuma alteração foi feita na venda.',500)
 }
}
