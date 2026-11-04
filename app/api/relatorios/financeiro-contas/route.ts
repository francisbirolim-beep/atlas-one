import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autorizarRelatorio } from '@/lib/relatoriosPermissoesServer'
import { usuarioPodeAcaoServer } from '@/lib/acessoUsuarioServer'
import { rotuloFormaRecebimento } from '@/lib/recebimentoFormas'
import { hojeSaoPaulo, normalizarTitulo, previsaoMensal, rankingDevedores, resumirTitulos, type MovimentoFinanceiro, type TipoConta } from '@/lib/relatoriosContasFinanceiras'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const cabecalhos={'Cache-Control':'private, no-store'}
const iso=/^\d{4}-\d{2}-\d{2}$/
const valido=(s:string)=>iso.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s
const dinheiro=(v:unknown)=>Math.round((Number(v)||0)*100)/100
// Nunca truncar silenciosamente um relatório financeiro.
async function buscarCompleto(tabela:string,colunas:string,empresaId:string){
 const registros:Record<string,unknown>[]=[]
 for(let offset=0;offset<=8000;offset+=1000){
  const {data,error}=await supabaseAdmin.from(tabela).select(colunas).eq('empresa_id',empresaId).order('id',{ascending:true}).range(offset,offset+999)
  if(error)throw error
  const lote=(data||[]) as unknown as Record<string,unknown>[]
  if(offset===8000&&lote.length)throw new Error('LIMITE_RELATORIO')
  registros.push(...lote)
  if(lote.length<1000)break
 }
 return registros
}
export async function GET(req:NextRequest){
 const usuario=await autenticarTenant(req)
 if(!usuario)return NextResponse.json({error:'Sessão inválida.'},{status:401,headers:cabecalhos})
 const bloqueio=await autorizarRelatorio(req,usuario,'financeiro')
 if(bloqueio)return bloqueio
 const inicio=req.nextUrl.searchParams.get('inicio')||''
 const fim=req.nextUrl.searchParams.get('fim')||''
 if(!valido(inicio)||!valido(fim)||inicio>fim||Date.parse(fim+'T12:00:00Z')-Date.parse(inicio+'T12:00:00Z')>366*86400000){
  return NextResponse.json({error:'Informe um período válido de até 12 meses.'},{status:400,headers:cabecalhos})
 }
 try{
  const [podePagar,podeReceber]=await Promise.all([
   usuarioPodeAcaoServer({usuarioId:usuario.id,role:usuario.role,empresaId:usuario.empresa_id,setorId:'financeiro',acaoId:'financeiro.contas_pagar.consultar'}),
   usuarioPodeAcaoServer({usuarioId:usuario.id,role:usuario.role,empresaId:usuario.empresa_id,setorId:'financeiro',acaoId:'financeiro.contas_receber.consultar'})
  ])
  if(!podePagar&&!podeReceber)return NextResponse.json({error:'Sem permissão para consultar as contas.'},{status:403,headers:cabecalhos})
  const [pagar,receber,recebimentos]=await Promise.all([
   podePagar?buscarCompleto('financeiro_contas_pagar','id,fornecedor_id,fornecedor_nome,documento,parcela,descricao,data_emissao,vencimento,valor,valor_pago,status,data_pagamento,forma_pagamento,origem,observacoes',usuario.empresa_id):Promise.resolve([]),
   podeReceber?buscarCompleto('financeiro_contas_receber','id,cliente_id,cliente_nome,obra_id,documento,parcela,total_parcelas,data_emissao,vencimento,valor,valor_pago,valor_desconto,status,forma,data_pagamento,observacoes',usuario.empresa_id):Promise.resolve([]),
   podeReceber?buscarCompleto('financeiro_recebimentos','id,cliente_nome,data_recebimento,valor,forma,referencia,status',usuario.empresa_id):Promise.resolve([])
  ])
  const titulosPagar=pagar.map(t=>normalizarTitulo(t,'pagar'))
  const titulosReceber=receber.map(t=>normalizarTitulo(t,'receber'))
  const movimentosPagar:MovimentoFinanceiro[]=titulosPagar.filter(t=>t.status!=='cancelado'&&t.status!=='estornado'&&!!t.dataPagamento&&t.pago>0).map(t=>({
   id:t.id,tipo:'pagar' as TipoConta,pessoa:t.pessoa,data:t.dataPagamento!,valor:dinheiro(t.pago),
   forma:t.forma,referencia:t.documento,tituloId:t.id
  }))
  const multiformaIds=recebimentos.filter(r=>r.forma==='multiplo' && !['cancelado','estornado'].includes(String(r.status||''))).map(r=>String(r.id))
  const composicoes=new Map<string,Array<{forma:string;valor:number}>>()
  for(let i=0;i<multiformaIds.length;i+=80){
   const {data,error}=await supabaseAdmin.from('financeiro_recebimento_formas').select('recebimento_id,forma,valor,ordem')
    .eq('empresa_id',usuario.empresa_id).in('recebimento_id',multiformaIds.slice(i,i+80)).order('ordem')
   if(error)throw error
   for(const f of data||[]){
    const lista=composicoes.get(f.recebimento_id)||[]
    lista.push({forma:f.forma,valor:dinheiro(f.valor)})
    composicoes.set(f.recebimento_id,lista)
   }
  }
  const movimentosReceber:MovimentoFinanceiro[]=recebimentos.filter(r=>!['cancelado','estornado'].includes(String(r.status||'')) && r.data_recebimento).map(r=>{
   const formas=composicoes.get(String(r.id))||[]
   const inconsistente=r.forma==='multiplo'&&Math.abs(formas.reduce((a,f)=>a+f.valor,0)-dinheiro(r.valor))>0.009
   return {
    id:String(r.id),tipo:'receber' as TipoConta,pessoa:String(r.cliente_nome||'Cliente não informado'),
    data:String(r.data_recebimento),valor:dinheiro(r.valor),
    forma:inconsistente?'Múltiplas formas (composição a conferir)':formas.length?formas.map(f=>rotuloFormaRecebimento(f.forma)+': '+f.valor.toFixed(2)).join(' + '):rotuloFormaRecebimento(String(r.forma||'')),
    formas:inconsistente?[]:formas,
    referencia:String(r.referencia||'')||null,tituloId:null
   }
  })
  const hoje=hojeSaoPaulo()
  const dados={
   ok:true,periodo:{inicio,fim,hoje},permissoes:{pagar:podePagar,receber:podeReceber},
   pagar:podePagar?{
    titulos:titulosPagar,movimentos:movimentosPagar,
    resumo:resumirTitulos(titulosPagar,hoje,inicio,fim,movimentosPagar),
    ranking:rankingDevedores(titulosPagar),previsao:previsaoMensal(titulosPagar,inicio,fim)
   }:null,
   receber:podeReceber?{
    titulos:titulosReceber,movimentos:movimentosReceber,
    resumo:resumirTitulos(titulosReceber,hoje,inicio,fim,movimentosReceber),
    ranking:rankingDevedores(titulosReceber),previsao:previsaoMensal(titulosReceber,inicio,fim)
   }:null,
   avisos:[
    'Posição de títulos em aberto calculada na data da consulta. Não é reconstrução histórica de saldos.',
    'Previsão utiliza apenas saldo aberto de títulos com vencimento preenchido no período.',
    'Recebimentos realizados vêm do livro de recebimentos e podem incluir créditos gerais ainda não alocados. Não somar novamente às baixas das parcelas.',
    'Pagamentos realizados representam os valores pagos com data de pagamento informada na conta a pagar. Não equivalem à conciliação bancária.',
    'Títulos sem vencimento permanecem destacados; não são tratados como vencidos nem como a vencer.',
    'Pagamentos e recebimentos cancelados ou estornados não entram nos indicadores.'
   ]
  }
  return NextResponse.json(dados,{headers:cabecalhos})
 }catch(e){
  if(e instanceof Error&&e.message==='LIMITE_RELATORIO')return NextResponse.json({error:'A base ultrapassou o limite seguro de 8.000 registros em uma das fontes. Nenhum total parcial foi exibido; solicite ampliação da consulta.'},{status:422,headers:cabecalhos})
  console.error('Consulta de relatórios de contas falhou:',e)
  return NextResponse.json({error:'Não foi possível gerar o relatório de contas. Os lançamentos não foram alterados.'},{status:500,headers:cabecalhos})
 }
}
