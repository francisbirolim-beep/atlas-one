import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const UUID=/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i
const falha=(error:string,status=400)=>NextResponse.json({error},{status})
const numerico=(v:unknown):number|null=>{
 if(typeof v==='number')return Number.isFinite(v)&&Math.round(v*100)===v*100? v:null
 const s=String(v??'').trim()
 if(!/^\d+(?:[.,]\d{1,2})?$/.test(s))return null
 const n=Number(s.replace(',','.'))
 return Number.isFinite(n)?n:null
}

async function autorizar(req:NextRequest){
 const u=await autenticarTenant(req)
 if(!u)return {error:falha('Sessão expirada.',401)} as const
 if(String(u.role).toLowerCase()!=='master')return {error:falha('Conferência financeira disponível apenas para Master.',403)} as const
 const vendaId=req.method==='GET'?(req.nextUrl.searchParams.get('vendaId')||''):''
 return {u,vendaId}
}
async function localizarVenda(empresaId:string,vendaId:string){
 const {data,error}=await supabaseAdmin.from('vendas_obras')
  .select('id,cliente_id,orcamento_id,valor_venda,status')
  .eq('id',vendaId).eq('empresa_id',empresaId).maybeSingle()
 if(error)throw error
 return data
}

export async function GET(req:NextRequest){
 const a=await autorizar(req)
 if('error'in a)return a.error
 if(!UUID.test(a.vendaId))return falha('Venda inválida.')
 try{
  const venda=await localizarVenda(a.u.empresa_id,a.vendaId)
  if(!venda)return falha('Venda não encontrada nesta empresa.',404)
  const {data:orcamento,error:erroOrcamento}=await supabaseAdmin.from('orcamentos')
   .select('wvetro_fluxo').eq('id',venda.orcamento_id)
   .eq('empresa_id',a.u.empresa_id).maybeSingle()
  if(erroOrcamento)throw erroOrcamento
  const fluxo=(orcamento?.wvetro_fluxo||{}) as Record<string,unknown>
  const numero=String(fluxo.numero||fluxo.numero_wvetro||'').trim()
  const [historico,registros,financeiro]=await Promise.all([
   numero?supabaseAdmin.from('wvetro_orcamentos_historico')
    .select('valor_total,updated_at').eq('empresa_id',a.u.empresa_id)
    .eq('wvetro_numero',numero).order('updated_at',{ascending:false}).limit(1):Promise.resolve({data:[],error:null}),
   supabaseAdmin.from('venda_conferencias_importacao')
    .select('id,tipo,wvetro_financeiro_id,acao,valor_origem,valor_anterior,valor_conferido,justificativa,criado_por_nome,created_at')
    .eq('empresa_id',a.u.empresa_id).eq('venda_obra_id',venda.id)
    .order('created_at',{ascending:false}).limit(300),
   numero?supabaseAdmin.from('wvetro_historico_financeiro')
    .select('id,titulo_id_wvetro,documento,orcamento_wvetro,valor_titulo,valor_recebido,valor_saldo,data_vencimento,data_baixa,importado_em')
    .eq('empresa_id',a.u.empresa_id).eq('cliente_id',venda.cliente_id)
    .eq('orcamento_wvetro',numero).eq('tipo_titulo','R').eq('status_vinculo','seguro')
    .order('data_vencimento',{ascending:true}).limit(200):Promise.resolve({data:[],error:null})
  ])
  if(historico.error||registros.error||financeiro.error)throw historico.error||registros.error||financeiro.error
  const ultimos=new Map<string,any>()
  for(const r of registros.data||[]){
   const chave=r.tipo+':'+(r.wvetro_financeiro_id||'')
   if(!ultimos.has(chave))ultimos.set(chave,r)
  }
  const original=historico.data?.[0]?.valor_total==null?null:Number(historico.data[0].valor_total)
  const revW=ultimos.get('wvetro_venda:')
  const revA=ultimos.get('atlas_venda:')
  const valorAtlas=Number(venda.valor_venda||0)
  const pagamentos=(financeiro.data||[]).map(f=>{
   const bruto=Number(f.valor_recebido||0)
   const revisao=ultimos.get('wvetro_pagamento:'+f.id)
   return {
    id:f.id, titulo:f.titulo_id_wvetro||f.documento||'Título W.Vetro',
    documento:f.documento, vencimento:f.data_vencimento, baixa:f.data_baixa,
    valorTitulo:Number(f.valor_titulo||0),valorOriginal:bruto,
    valorConferido:revisao?Number(revisao.valor_conferido):bruto,
    saldoOriginal:Number(f.valor_saldo||0),
    estado:revisao?revisao.acao:'pendente',
    fonteAlterada:!!revisao&&Math.abs(Number(revisao.valor_origem)-bruto)>0.009,
   }
  })
  return NextResponse.json({
   ok:true,numeroWvetro:numero,valorWvetroOriginal:original,
   valorWvetroConferido:revW?Number(revW.valor_conferido):original,
   estadoWvetro:revW?.acao||'pendente',
   fonteWvetroAlterada:!!revW&&original!==null&&Math.abs(Number(revW.valor_origem)-original)>0.009,
   valorAtlas,estadoAtlas:revA?.acao==='validado'&&Math.abs(Number(revA.valor_conferido)-valorAtlas)<0.01?'validado':'pendente',
   pagamentos,pagamentosTotal:pagamentos.reduce((s,f)=>s+f.valorConferido,0),
   historico:(registros.data||[]).slice(0,60),
  },{headers:{'Cache-Control':'private, no-store'}})
 }catch(e){console.error('Consulta de conferência de importação',e);return falha('Não foi possível carregar conferências de venda e pagamentos.',500)}
}
export async function POST(req:NextRequest){
 const a=await autorizar(req)
 if('error'in a)return a.error
 if(process.env.VERCEL_ENV==='preview')return falha('Prévia somente leitura; nenhum valor financeiro é modificado.',409)
 try{
  const b=await req.json()
  const vendaId=String(b.vendaId||'')
  const tipo=String(b.tipo||'')
  const acao=String(b.acao||'')
  const financeiroId=b.financeiroId==null?null:String(b.financeiroId)
  const anterior=numerico(b.valorAnterior)
  const novo=acao==='corrigido'?numerico(b.valorNovo):null
  const justificativa=String(b.justificativa||'').trim()
  if(!UUID.test(vendaId))return falha('Venda inválida.')
  if(!['wvetro_venda','atlas_venda','wvetro_pagamento'].includes(tipo)||!['validado','corrigido'].includes(acao))return falha('Operação inválida.')
  if(tipo==='atlas_venda'&&acao!=='validado')return falha('Use a correção específica da venda Atlas.')
  if((tipo==='wvetro_pagamento')!==!!financeiroId||(financeiroId&&!UUID.test(financeiroId)))return falha('Pagamento W.Vetro inválido.')
  if(anterior==null||anterior<0||novo!==null&&(novo<0||novo>999999999))return falha('Valor informado inválido.')
  if(acao==='corrigido'&&(novo===null||justificativa.length<8||justificativa.length>500))return falha('Valor e justificativa obrigatórios para correção.')
  const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim()
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{
   auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+token}}
  })
  const {data,error}=await db.rpc('fn_conferir_importacao_venda_financeiro_v1',{
   p_venda_id:vendaId,p_tipo:tipo,p_financeiro_id:financeiroId,p_acao:acao,
   p_valor_anterior:anterior,p_valor_novo:novo,p_justificativa:justificativa
  })
  if(error)return falha(error.message||'Não foi possível concluir a conferência.',409)
  return NextResponse.json(data)
 }catch(e){console.error('Conferência W.Vetro',e);return falha('Não foi possível processar a conferência.',500)}
}
