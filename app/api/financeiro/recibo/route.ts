import { NextRequest,NextResponse } from 'next/server'
import {autenticarCompras} from '@/lib/comprasServer'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import {usuarioPodeAcaoServer} from '@/lib/acessoUsuarioServer'
import type {ReciboInfo} from '@/lib/financeiroRecibos'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const bad=(msg:string,status=400)=>NextResponse.json({error:msg},{status})
export async function GET(req:NextRequest){
 const u=await autenticarCompras(req);if(!u)return bad('Sessão inválida.',401)
 const tipo=req.nextUrl.searchParams.get('tipo'),id=req.nextUrl.searchParams.get('id')||''
 if(!['pagar','receber'].includes(tipo||'')||!uuid.test(id))return bad('Recibo inválido.')
 const acao=tipo==='pagar'?'financeiro.contas_pagar.consultar':'financeiro.contas_receber.recibo'
 if(!(await usuarioPodeAcaoServer({usuarioId:u.id,role:u.role,empresaId:u.empresa_id,setorId:'financeiro',acaoId:acao})))return bad('Sem permissão para consultar recibos.',403)
 try{
  if(tipo==='pagar'){
   const {data:t,error}=await supabaseAdmin.from('financeiro_contas_pagar').select('id,fornecedor_id,fornecedor_nome,valor,valor_pago,vencimento,data_pagamento,descricao,documento,forma_pagamento,status').eq('empresa_id',u.empresa_id).eq('id',id).maybeSingle()
   if(error)throw error
   if(!t)return bad('Título inexistente.',404)
   if(t.status!=='pago'||!t.data_pagamento)return bad('Recibo disponível somente após pagamento confirmado.',422)
   const fornecedor=t.fornecedor_id?await supabaseAdmin.from('fornecedores').select('nome,cnpj_cpf').eq('empresa_id',u.empresa_id).eq('id',t.fornecedor_id).maybeSingle():null
   const pago=Number(t.valor_pago??t.valor)
   const recibo:ReciboInfo={tipo:'pagar',id,nome:fornecedor?.data?.nome||t.fornecedor_nome||'Beneficiário',documento:fornecedor?.data?.cnpj_cpf||null,descricao:t.descricao,referencia:t.documento,data:t.data_pagamento,forma:t.forma_pagamento,valorOriginal:Number(t.valor||0),valorMovimento:pago,saldo:Math.max(0,Number(t.valor||0)-pago)}
   return NextResponse.json({ok:true,recibo})
  }
  const {data:rec,error}=await supabaseAdmin.from('financeiro_recebimentos').select('id,cliente_id,cliente_nome,obra_id,data_recebimento,valor,valor_desconto,forma,referencia,observacoes,status').eq('empresa_id',u.empresa_id).eq('id',id).maybeSingle()
  if(error)throw error
  if(!rec||rec.status==='cancelado')return bad('Recebimento inexistente ou cancelado.',404)
  const [cli,alocs]=await Promise.all([
   supabaseAdmin.from('clientes').select('id,nome,cpf_cnpj').eq('empresa_id',u.empresa_id).eq('id',rec.cliente_id).maybeSingle(),
   supabaseAdmin.from('financeiro_recebimento_alocacoes').select('conta_receber_id,obra_id,tipo,valor').eq('empresa_id',u.empresa_id).eq('recebimento_id',id)
  ])
  if(cli.error||alocs.error)throw cli.error||alocs.error
  if(!cli.data)return bad('Cliente do recebimento indisponível.',404)
  const idsObras=[...new Set([rec.obra_id,...(alocs.data||[]).map(a=>a.obra_id)].filter((v):v is string=>!!v))]
  let obraId=idsObras.length===1?idsObras[0]:null
  if(!obraId){
   const contasAlocadas=[...new Set((alocs.data||[]).map(a=>a.conta_receber_id).filter((v):v is string=>!!v))]
   if(contasAlocadas.length){
    const resp=await supabaseAdmin.from('financeiro_contas_receber').select('obra_id').eq('empresa_id',u.empresa_id).in('id',contasAlocadas)
    if(resp.error)throw resp.error
    const obras=[...new Set((resp.data||[]).map(c=>c.obra_id).filter((v):v is string=>!!v))]
    if(obras.length===1)obraId=obras[0]
   }
  }
  const obra=obraId?await supabaseAdmin.from('obras').select('id,nome').eq('empresa_id',u.empresa_id).eq('id',obraId).eq('cliente_id',rec.cliente_id).maybeSingle():null
  let contas=supabaseAdmin.from('financeiro_contas_receber').select('id,valor,valor_pago,valor_desconto,status').eq('empresa_id',u.empresa_id).eq('cliente_id',rec.cliente_id)
  if(idsObras.length>1)contas=contas.in('obra_id',idsObras)
  else if(obraId)contas=contas.eq('obra_id',obraId)
  else contas=contas.is('obra_id',null) // Sem obra: não somar dívidas de obras distintas.
  const {data:titulos,error:erroTitulos}=await contas.limit(1000)
  if(erroTitulos)throw erroTitulos
  const valorOriginal=(titulos||[]).filter(c=>c.status!=='cancelado').reduce((a,c)=>a+Number(c.valor||0),0)
  const saldo=(titulos||[]).filter(c=>c.status!=='cancelado').reduce((a,c)=>a+Math.max(0,Number(c.valor||0)-Number(c.valor_pago||0)-Number(c.valor_desconto||0)),0)
  const recibo:ReciboInfo={tipo:'receber',id,nome:cli.data.nome,documento:cli.data.cpf_cnpj,obra:obra?.data?.nome|| (idsObras.length>1?'Recebimento de múltiplas obras — consulte os extratos individualizados':'Sem obra vinculada'),descricao:rec.observacoes||null,referencia:rec.referencia,data:rec.data_recebimento,forma:rec.forma,valorOriginal:valorOriginal||Number(rec.valor),valorMovimento:Number(rec.valor),saldo}
  return NextResponse.json({ok:true,recibo})
 }catch(e){console.error('recibo financeiro',e);return bad('Não foi possível carregar os dados do recibo.',500)}
}
