import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { autenticarCompras } from '@/lib/comprasServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { usuarioPodeAcaoServer } from '@/lib/acessoUsuarioServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const responder = (error:string, status=400) => NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}})
const centavos = (valor:unknown) => Math.round(Number(valor)*100)
const saldo = (c:{valor:number;valor_pago?:number|null;valor_desconto?:number|null}) => Math.max(0,centavos(c.valor)-centavos(c.valor_pago||0)-centavos(c.valor_desconto||0))
const preview = () => process.env.VERCEL_ENV !== 'production'
const autorizado = (u:{id:string;role:string;empresa_id:string}, acao:string, minimo:'consulta'|'edicao'='consulta') =>
  usuarioPodeAcaoServer({usuarioId:u.id,role:u.role,empresaId:u.empresa_id,setorId:'financeiro',acaoId:acao,minimo})

export async function GET(req:NextRequest) {
  const usuario = await autenticarCompras(req)
  if(!usuario) return responder('Sessão inválida. Faça login novamente.',401)
  if(!(await autorizado(usuario,'financeiro.contas_receber.consultar'))) return responder('Sem permissão para consultar contas a receber.',403)
  const clienteId=req.nextUrl.searchParams.get('clienteId')||''
  if(!UUID.test(clienteId)) return responder('Cliente inválido.')
  try {
    const c = await supabaseAdmin.from('clientes').select('id,nome').eq('empresa_id',usuario.empresa_id).eq('id',clienteId).maybeSingle()
    if(c.error)throw c.error
    if(!c.data)return responder('Cliente inexistente nesta empresa.',404)
    const [titulos,obras] = await Promise.all([
      supabaseAdmin.from('financeiro_contas_receber').select('id,cliente_id,cliente_nome,obra_id,orcamento_id,documento,parcela,total_parcelas,data_emissao,vencimento,valor,valor_pago,valor_desconto,status,forma,data_pagamento,observacoes,created_at').eq('empresa_id',usuario.empresa_id).eq('cliente_id',clienteId).order('vencimento',{ascending:true,nullsFirst:false}).limit(1500),
      supabaseAdmin.from('obras').select('id,nome,numero').eq('empresa_id',usuario.empresa_id).eq('cliente_id',clienteId).limit(500)
    ])
    if(titulos.error||obras.error)throw titulos.error||obras.error
    return NextResponse.json({ok:true,cliente:c.data,contas:titulos.data||[],obras:obras.data||[],simulacao:preview()},{headers:{'Cache-Control':'no-store'}})
  }catch(e){console.error('Consulta recebimento cliente',e);return responder('Não foi possível consultar os recebimentos do cliente.',500)}
}

export async function POST(req:NextRequest) {
  const usuario=await autenticarCompras(req)
  if(!usuario)return responder('Sessão inválida. Faça login novamente.',401)
  if(!(await autorizado(usuario,'financeiro.contas_receber.receber','edicao')))return responder('Sem permissão para registrar recebimentos.',403)
  try {
    const body=await req.json()
    const clienteId=String(body.clienteId||'')
    const data=String(body.dataRecebimento||'')
    const forma=String(body.forma||'')
    const referencia=String(body.referencia||'').trim().slice(0,160)
    const observacoes=String(body.observacoes||'').trim().slice(0,500)
    const alocacoes=body.alocacoes
    if(!UUID.test(clienteId)||!Array.isArray(alocacoes)||!alocacoes.length||alocacoes.length>150) return responder('Cliente ou parcelas inválidos.')
    if(!/^\d{4}-\d{2}-\d{2}$/.test(data)||Number.isNaN(Date.parse(data+'T12:00:00Z'))||new Date(data+'T12:00:00Z').toISOString().slice(0,10)!==data)return responder('Data de recebimento inválida.')
    if(!['pix','dinheiro','boleto','cartao','transferencia','cheque','outro'].includes(forma))return responder('Forma de recebimento inválida.')
    const ids:string[]=alocacoes.map((a:{conta_receber_id?:string})=>String(a.conta_receber_id||''))
    if(ids.some(id=>!UUID.test(id))||new Set(ids).size!==ids.length)return responder('Parcelas duplicadas ou inválidas.')
    const c=await supabaseAdmin.from('clientes').select('id,nome').eq('empresa_id',usuario.empresa_id).eq('id',clienteId).maybeSingle()
    if(c.error)throw c.error
    if(!c.data)return responder('Cliente inexistente nesta empresa.',404)
    const [existentes,todas,obras]=await Promise.all([
      supabaseAdmin.from('financeiro_contas_receber').select('id,obra_id,valor,valor_pago,valor_desconto,status').eq('empresa_id',usuario.empresa_id).eq('cliente_id',clienteId).in('id',ids),
      supabaseAdmin.from('financeiro_contas_receber').select('id,obra_id,valor,valor_pago,valor_desconto,status').eq('empresa_id',usuario.empresa_id).eq('cliente_id',clienteId).neq('status','cancelado').limit(1500),
      supabaseAdmin.from('obras').select('id,nome').eq('empresa_id',usuario.empresa_id).eq('cliente_id',clienteId).limit(500),
    ])
    if(existentes.error||todas.error||obras.error)throw existentes.error||todas.error||obras.error
    if(existentes.data?.length!==ids.length)return responder('Parcela inexistente ou não vinculada ao cliente.',404)
    const porId=new Map((existentes.data||[]).map(x=>[x.id,x]))
    const cobrancas:{conta_receber_id:string;valor:number}[]=[]
    const pagosPorObra=new Map<string,number>()
    for(const alocacao of alocacoes){
      const c=porId.get(String(alocacao.conta_receber_id))
      const v=centavos(alocacao.valor)
      if(!c||c.status==='cancelado'||!Number.isSafeInteger(v)||v<=0||v>saldo(c))return responder('O valor recebido deve ser maior que zero e não pode ultrapassar o saldo da parcela.')
      cobrancas.push({conta_receber_id:c.id,valor:v/100})
      const obra=c.obra_id||''
      pagosPorObra.set(obra,(pagosPorObra.get(obra)||0)+v)
    }
    if(preview()){
      const nomes=new Map((obras.data||[]).map(o=>[o.id,o.nome]))
      const linhas=[...pagosPorObra].map(([obraId,valor])=>{
        const grupo=(todas.data||[]).filter(t=>(t.obra_id||'')===obraId)
        const original=grupo.reduce((a,t)=>a+centavos(t.valor),0)
        const aberto=grupo.reduce((a,t)=>a+saldo(t),0)
        return {obra:obraId?(nomes.get(obraId)||'Obra vinculada'):'Sem obra vinculada',valorOriginal:original/100,valorRecebido:valor/100,saldoDevedor:Math.max(0,aberto-valor)/100}
      })
      return NextResponse.json({ok:true,simulado:true,valor:cobrancas.reduce((a,v)=>a+v.valor,0),parcelas:cobrancas.length,clienteNome:c.data.nome,data,forma,referencia,linhas,mensagem:'Simulação: nenhum recebimento foi gravado.'},{headers:{'Cache-Control':'no-store'}})
    }
    // Em produção, a baixa continua pela RPC transacional existente e pelo token do usuário.
    const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim()
    const sessao=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}})
    const {data:resultado,error}=await sessao.rpc('registrar_recebimento_cliente_parcelas',{
      p_cliente_id:clienteId,p_cliente_nome:c.data.nome,p_data_recebimento:data,p_forma:forma,
      p_referencia:referencia||null,p_observacoes:observacoes||null,
      p_alocacoes:cobrancas,p_usuario_id:usuario.id,p_usuario_nome:usuario.nome,
    })
    if(error){console.error('Registrar recebimento',error);return responder('Não foi possível registrar o recebimento. Confira as permissões e tente novamente.',422)}
    return NextResponse.json({ok:true,simulado:false,recebimentoId:resultado?.recebimento_id,valor:resultado?.valor,parcelas:resultado?.parcelas},{headers:{'Cache-Control':'no-store'}})
  }catch(e){console.error('Falha recebimento cliente',e);return responder('Não foi possível processar o recebimento.',500)}
}
