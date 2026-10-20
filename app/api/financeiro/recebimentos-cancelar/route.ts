import { NextRequest,NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { usuarioPodeAcaoServer } from '@/lib/acessoUsuarioServer'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const uuid=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i
const bad=(error:string,status=400)=>NextResponse.json({ok:false,error},{status,headers:{'Cache-Control':'no-store'}})

export async function GET(req:NextRequest){
 const u=await autenticarTenant(req)
 if(!u)return bad('Sessão expirada.',401)
 const vendaId=req.nextUrl.searchParams.get('vendaId')||''
 if(!uuid.test(vendaId))return bad('Venda inválida.')
 const permitido=u.role==='master'||u.role==='admin'||await usuarioPodeAcaoServer({
  usuarioId:u.id,role:u.role,empresaId:u.empresa_id,setorId:'financeiro',
  acaoId:'financeiro.contas_receber.consultar',
 })
 if(!permitido)return bad('Sem permissão para consultar histórico financeiro.',403)
 const {data:venda,error:erroVenda}=await supabaseAdmin.from('vendas_obras')
  .select('id,valor_venda').eq('id',vendaId).eq('empresa_id',u.empresa_id).maybeSingle()
 if(erroVenda)return bad('Falha na consulta da venda.',503)
 if(!venda)return bad('Venda não encontrada.',404)
 const {data,error}=await supabaseAdmin.from('financeiro_recebimentos_cancelamentos')
  .select('id,recebimento_id,valor_original,justificativa,autorizado_por_nome,cancelado_em')
  .eq('empresa_id',u.empresa_id).eq('venda_obra_id',vendaId)
  .order('cancelado_em',{ascending:false}).limit(100)
 // Compatível com prévia ainda sem a migração: consulta preservada.
 if(error && !['42P01','PGRST205'].includes(error.code||''))
  return bad('Não foi possível carregar o histórico de cancelamentos.',503)
 const contas=await supabaseAdmin.from('financeiro_contas_receber').select('id,valor,valor_pago,valor_desconto,status')
  .eq('empresa_id',u.empresa_id).eq('venda_obra_id',vendaId).limit(1000)
 if(contas.error)return bad('Falha ao consultar parcelas desta venda.',503)
 const ativas=(contas.data||[]).filter(c=>c.status!=='cancelado')
 const ids=(contas.data||[]).map(c=>c.id)
 const valorVenda=Number(venda.valor_venda||0)
 const totalTitulos=ativas.reduce((n,c)=>n+Number(c.valor||0),0)
 const recebido=ativas.reduce((n,c)=>n+Number(c.valor_pago||0),0)
 const descontos=ativas.reduce((n,c)=>n+Number(c.valor_desconto||0),0)
 const diferenca=Math.round((valorVenda-totalTitulos)*100)/100
 let recibos:Array<{id:string;valor:number;data_recebimento:string;status:string;forma:string|null}>=[]
 if(ids.length){
   const aloc=await supabaseAdmin.from('financeiro_recebimento_alocacoes')
     .select('recebimento_id').eq('empresa_id',u.empresa_id).in('conta_receber_id',ids).limit(2000)
   if(aloc.error)return bad('Falha ao consultar alocações dos recebimentos.',503)
   const recebimentoIds=[...new Set((aloc.data||[]).map(a=>a.recebimento_id).filter(Boolean))]
   if(recebimentoIds.length){
     const rec=await supabaseAdmin.from('financeiro_recebimentos')
       .select('id,valor,data_recebimento,status,forma')
       .eq('empresa_id',u.empresa_id).in('id',recebimentoIds).neq('status','cancelado')
       .order('data_recebimento',{ascending:false}).limit(300)
     if(rec.error)return bad('Falha ao consultar recebimentos.',503)
     recibos=rec.data||[]
   }
 }
 return NextResponse.json({ok:true,podeCancelar:u.role==='master',
   disponivel:!error||process.env.VERCEL_ENV==='preview',
   cancelamentos:data||[],recebimentos:recibos,
   financeiro:{valorVenda,totalTitulos,recebido,descontos,diferenca,qtdTitulos:ativas.length,
     podeConciliar:Math.abs(diferenca)>=0.01&&valorVenda>0&&ativas.length>0&&recebido===0&&descontos===0}},{headers:{'Cache-Control':'private, no-store'}})
}

export async function POST(req:NextRequest){
 const u=await autenticarTenant(req)
 if(!u)return bad('Sessão expirada.',401)
 if(u.role!=='master')return bad('Somente o usuário Master pode cancelar recebimentos.',403)
 const body=await req.json().catch(()=>({}))
 const vendaId=typeof body.vendaId==='string'?body.vendaId:''
 const recebimentoId=typeof body.recebimentoId==='string'?body.recebimentoId:''
 const motivo=typeof body.justificativa==='string'?body.justificativa.trim():''
 if(!uuid.test(vendaId)||!uuid.test(recebimentoId)||motivo.length<10||motivo.length>1000)
  return bad('Selecione o recebimento e informe justificativa de 10 a 1000 caracteres.')
 const {data:venda,error:erroVenda}=await supabaseAdmin.from('vendas_obras')
  .select('id').eq('id',vendaId).eq('empresa_id',u.empresa_id).maybeSingle()
 if(erroVenda)return bad('Falha na consulta da venda.',503)
 if(!venda)return bad('Venda não localizada nesta empresa.',404)
 if(process.env.VERCEL_ENV==='preview')
  return NextResponse.json({ok:true,simulado:true,mensagem:'Prévia: cancelamento simulado. Nenhuma baixa foi desfeita.'})
 const {data,error}=await supabaseAdmin.rpc('fn_financeiro_cancelar_recebimento_master_v1',{
  p_empresa:u.empresa_id,p_recebimento:recebimentoId,
  p_venda:vendaId,p_master:u.id,p_justificativa:motivo,
 })
 if(error){
  console.error('[Financeiro][Cancelamento Master]',error.code,error.message)
  return bad(error.message||'O recebimento não pôde ser cancelado. Verifique os lançamentos e o Caixa.',409)
 }
 return NextResponse.json({ok:true,simulado:false,valorEstornado:data?.valorEstornado||0},
  {headers:{'Cache-Control':'no-store'}})
}
