import {NextRequest,NextResponse} from 'next/server'
import {autenticarTenant} from '@/lib/tenantServer'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const bad=(error:string,status=400)=>NextResponse.json({ok:false,error},{status,headers:{'Cache-Control':'no-store'}})
export async function GET(req:NextRequest){
 const u=await autenticarTenant(req)
 if(!u)return bad('Sessão expirada.',401)
 if(u.role!=='master')return bad('Apenas Master pode consultar ajustes manuais.',403)
 const vendaId=req.nextUrl.searchParams.get('vendaId')||''
 if(!uuid.test(vendaId))return bad('Venda inválida.')
 const {data:venda}=await supabaseAdmin.from('vendas_obras').select('id,valor_venda')
  .eq('empresa_id',u.empresa_id).eq('id',vendaId).maybeSingle()
 if(!venda)return bad('Venda não localizada.',404)
 const {data:contas,error}=await supabaseAdmin.from('financeiro_contas_receber')
  .select('id,documento,parcela,valor,valor_pago,valor_desconto,status,vencimento')
  .eq('empresa_id',u.empresa_id).eq('venda_obra_id',vendaId).order('parcela')
 if(error)return bad('Não foi possível consultar os títulos.',503)
 const hist=await supabaseAdmin.from('financeiro_ajustes_titulos_manuais')
  .select('id,conta_receber_id,acao,valor_anterior,valor_novo,status_anterior,status_novo,justificativa,autorizado_por_nome,criado_em')
  .eq('empresa_id',u.empresa_id).eq('venda_obra_id',vendaId).order('criado_em',{ascending:false}).limit(200)
 return NextResponse.json({ok:true,valorVenda:venda.valor_venda,titulos:contas||[],
  historico:hist.error?[]:hist.data||[],historicoDisponivel:!hist.error,
  previa:process.env.VERCEL_ENV==='preview'})
}
export async function POST(req:NextRequest){
 const u=await autenticarTenant(req)
 if(!u)return bad('Sessão expirada.',401)
 if(u.role!=='master')return bad('Somente Master pode fazer ajuste financeiro.',403)
 const b=await req.json().catch(()=>({}))
 const vendaId=String(b.vendaId||''),contaId=String(b.contaId||'')
 const acao=String(b.acao||'')
 const justificativa=String(b.justificativa||'').trim()
 const valor=Number(b.valor),esperado=Number(b.valorEsperado)
 if(!uuid.test(vendaId)||!uuid.test(contaId)||!['alterar','zerar','cancelar'].includes(acao)||
   justificativa.length<10||justificativa.length>1000||!Number.isFinite(esperado)||
   (acao==='alterar'&&(!Number.isFinite(valor)||valor<=0)))
  return bad('Informe título, ação, valor válido e justificativa de pelo menos 10 caracteres.')
 if(process.env.VERCEL_ENV==='preview')
   return bad('A prévia não pode gravar ajustes reais. A atualização deverá ser publicada em produção.',409)
 const {data,error}=await supabaseAdmin.rpc('fn_financeiro_ajustar_titulo_master_v1',{
  p_empresa:u.empresa_id,p_venda:vendaId,p_conta:contaId,p_master:u.id,
  p_acao:acao,p_valor:acao==='alterar'?valor:null,p_justificativa:justificativa,
  p_valor_esperado:esperado
 })
 if(error){console.error('[Financeiro][AjustarTitulo]',error.code,error.message);return bad(error.message||'Ajuste não concluído.',409)}
 return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}})
}
