import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarCompras } from '@/lib/comprasServer'
import { usuarioPodeAcaoServer } from '@/lib/acessoUsuarioServer'

export const dynamic='force-dynamic'
export const runtime='nodejs'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const txt=(s:unknown,max=240)=>String(s??'').trim().slice(0,max)
const bad=(message:string,status=400)=>NextResponse.json({error:message},{status})
const valido=(s:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===s}
const centavos=(n:unknown)=>Math.round(Number(n)*100)

export async function GET(req:NextRequest){
 const u=await autenticarCompras(req)
 if(!u)return bad('Sessão expirada ou inválida.',401)
 const [pCaixa,pFinanceiro,pVendas]=await Promise.all([
   usuarioPodeAcaoServer({usuarioId:u.id,role:u.role,empresaId:u.empresa_id,setorId:'caixa-balcao',acaoId:'financeiro.contas_receber.consultar'}),
   usuarioPodeAcaoServer({usuarioId:u.id,role:u.role,empresaId:u.empresa_id,setorId:'financeiro',acaoId:'financeiro.contas_receber.consultar'}),
   usuarioPodeAcaoServer({usuarioId:u.id,role:u.role,empresaId:u.empresa_id,setorId:'recebimento-vendas',acaoId:'financeiro.recebimento_vendas.registrar'})
 ])
 if(!pCaixa&&!pFinanceiro&&!pVendas)return bad('Sem permissão para consultar contas a receber.',403)
 const clienteId=txt(req.nextUrl.searchParams.get('clienteId'),40)
 const origemCaixa=req.nextUrl.searchParams.get('origem')==='caixa'
 if(!uuid.test(clienteId))return bad('Cliente inválido.')
 try{
  const {data:cliente,error:cErro}=await supabaseAdmin.from('clientes').select('id,nome,cpf_cnpj').eq('empresa_id',u.empresa_id).eq('id',clienteId).maybeSingle()
  if(cErro)throw cErro
  if(!cliente)return bad('Cliente não encontrado nesta empresa.',404)
  const [c,o]=await Promise.all([
   supabaseAdmin.from('financeiro_contas_receber').select('id,cliente_id,cliente_nome,obra_id,documento,parcela,total_parcelas,vencimento,valor,valor_pago,valor_desconto,status,forma,data_pagamento').eq('empresa_id',u.empresa_id).eq('cliente_id',clienteId).order('vencimento',{ascending:true,nullsFirst:false}).limit(2000),
   supabaseAdmin.from('obras').select('id,cliente_id,nome,numero').eq('empresa_id',u.empresa_id).eq('cliente_id',clienteId).order('created_at',{ascending:false}).limit(1000)
  ])
  if(c.error||o.error)throw c.error||o.error
  let caixaAberto=true
  if(origemCaixa){
   const {data:caixa,error:caixaErro}=await supabaseAdmin.from('balcao_caixas').select('id').eq('empresa_id',u.empresa_id).eq('operador_id',u.id).eq('status','aberto').order('aberto_em',{ascending:false}).limit(1).maybeSingle()
   if(caixaErro)throw caixaErro
   caixaAberto=!!caixa
  }
  return NextResponse.json({ok:true,cliente,contas:c.data||[],obras:o.data||[],caixaAberto,modoPrevia:process.env.VERCEL_ENV==='preview'},{headers:{'Cache-Control':'private, no-store'}})
 }catch(e){console.error('recebimento dados cliente',e);return bad('Não foi possível consultar o financeiro deste cliente.',500)}
}
export async function POST(req:NextRequest){
 const u=await autenticarCompras(req)
 if(!u)return bad('Sessão expirada ou inválida.',401)
 const [pCaixa,pFinanceiro,pVendas]=await Promise.all([
   usuarioPodeAcaoServer({usuarioId:u.id,role:u.role,empresaId:u.empresa_id,setorId:'caixa-balcao',acaoId:'financeiro.contas_receber.receber',minimo:'edicao'}),
   usuarioPodeAcaoServer({usuarioId:u.id,role:u.role,empresaId:u.empresa_id,setorId:'financeiro',acaoId:'financeiro.contas_receber.receber',minimo:'edicao'}),
   usuarioPodeAcaoServer({usuarioId:u.id,role:u.role,empresaId:u.empresa_id,setorId:'recebimento-vendas',acaoId:'financeiro.recebimento_vendas.registrar',minimo:'edicao'})
 ])
 if(!pCaixa&&!pFinanceiro&&!pVendas)return bad('Sem permissão para registrar recebimentos.',403)
 try{
  const b=await req.json()
  const clienteId=txt(b.clienteId,40),data=txt(b.dataRecebimento,10),forma=txt(b.forma,40)
  const origemCaixa=b.origem==='caixa'
  if(!uuid.test(clienteId)||!valido(data))return bad('Cliente ou data inválidos.')
  if(!['pix','dinheiro','boleto','cartao','cartao_debito','cartao_credito','transferencia','cheque','outro','outros'].includes(forma))return bad('Forma de pagamento inválida.')
  const aloc=Array.isArray(b.alocacoes)?b.alocacoes:[]
  if(aloc.length<1||aloc.length>100)return bad('Selecione de 1 a 100 parcelas.')
  const mapa=new Map<string,number>()
  for(const a of aloc){
   const id=txt(a?.conta_receber_id,40),valor=centavos(a?.valor)
   if(!uuid.test(id)||!Number.isInteger(valor)||valor<1||mapa.has(id))return bad('Parcela duplicada ou valor de recebimento inválido.')
   mapa.set(id,valor)
  }
  const total=[...mapa.values()].reduce((s,v)=>s+v,0)
  if(total<=0||total>100_000_000_00)return bad('Valor recebido fora do limite permitido.')
  const {data:cliente,error:erroCliente}=await supabaseAdmin.from('clientes').select('id,nome').eq('empresa_id',u.empresa_id).eq('id',clienteId).maybeSingle()
  if(erroCliente)throw erroCliente
  if(!cliente)return bad('Cliente não encontrado nesta empresa.',404)
  const {data:contas,error:erroContas}=await supabaseAdmin.from('financeiro_contas_receber').select('id,valor,valor_pago,valor_desconto,status,obra_id').eq('empresa_id',u.empresa_id).eq('cliente_id',clienteId).in('id',[...mapa.keys()])
  if(erroContas)throw erroContas
  if(contas?.length!==mapa.size)return bad('Uma ou mais parcelas não pertencem a este cliente.',422)
  for(const conta of contas){
   const saldo=Math.round((Number(conta.valor||0)-Number(conta.valor_pago||0)-Number(conta.valor_desconto||0))*100)
   if(conta.status==='cancelado'||conta.status==='pago'||saldo<1||(mapa.get(conta.id)||0)>saldo)return bad('O saldo mudou ou o valor informado excede o disponível. Atualize antes de confirmar.',409)
  }
  let caixaId:string|null=null
  if(origemCaixa && process.env.VERCEL_ENV!=='preview'){
   const caixa=await supabaseAdmin.from('balcao_caixas').select('id')
    .eq('empresa_id',u.empresa_id).eq('operador_id',u.id)
    .eq('status','aberto').order('aberto_em',{ascending:false})
    .limit(1).maybeSingle()
   if(caixa.error)throw caixa.error
   if(!caixa.data)return bad('Abra o Caixa para registrar este recebimento.',409)
   caixaId=caixa.data.id
  }
  // Em qualquer deploy de prévia não gravamos na base operacional.
  if(process.env.VERCEL_ENV==='preview')return NextResponse.json({ok:true,simulado:true,valor:total/100,parcelas:contas.length,recebimentoId:null})
  const argumentos={
   p_cliente_id:clienteId,p_cliente_nome:cliente.nome,p_data_recebimento:data,
   p_forma:forma,p_referencia:txt(b.referencia,140)||null,p_observacoes:txt(b.observacoes,800)||null,
   p_alocacoes:[...mapa.entries()].map(([conta_receber_id,valor])=>({conta_receber_id,valor:valor/100})),
   p_usuario_id:u.id,p_usuario_nome:u.nome
  }
  // No Caixa, a RPC registra o recebimento e o movimento em UMA transação.
  // Pelo Cliente, mantém a mesma RPC de parcelas que já foi homologada.
  const {data:resultado,error}=origemCaixa
   ?await supabaseAdmin.rpc('registrar_recebimento_cliente_caixa_v1',{...argumentos,p_caixa_id:caixaId})
   :await supabaseAdmin.rpc('registrar_recebimento_cliente_parcelas',argumentos)
  if(error){console.error('registrar recebimento servidor',error);return bad('Falha na baixa financeira. Confira o histórico antes de tentar novamente.',500)}
  return NextResponse.json({ok:true,simulado:false,recebimentoId:resultado?.recebimento_id||null,valor:Number(resultado?.valor||total/100),parcelas:Number(resultado?.parcelas||contas.length)})
 }catch(e){console.error('recebimento cliente post',e);return bad('Não foi possível processar o recebimento.',500)}
}
