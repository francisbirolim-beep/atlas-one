import { NextRequest, NextResponse } from 'next/server'
import { autenticarCompras } from '@/lib/comprasServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime='nodejs'
export const dynamic='force-dynamic'

type Movimento={id:string;tipo:'entrada'|'saida';situacao:'realizado'|'previsto';data:string;descricao:string;origem:string;valor:number;categoria:string;grupo:string}
const data=/^\d{4}-\d{2}-\d{2}$/
const moeda=(v:unknown)=>Math.round((Number(v)||0)*100)/100
const erro=(mensagem:string,status=400)=>NextResponse.json({error:mensagem},{status,headers:{'Cache-Control':'private, no-store'}})

// Cada busca é paginada. Não apresentar totais parciais como se fossem completos.
async function buscarTodos(fazer:(inicio:number,fim:number)=>PromiseLike<{data:any[]|null;error:any}>,max=10000):Promise<any[]>{
 const todos:any[]=[]
 while(true){
  const {data:pagina,error}=await fazer(todos.length,todos.length+499)
  if(error)throw error
  const itens=pagina||[]
  todos.push(...itens)
  if(itens.length<500)return todos
  if(todos.length>=max)throw Error('Volume financeiro acima do limite de conferência. Reduza o período.')
 }
}
export async function GET(req:NextRequest){
 const u=await autenticarCompras(req)
 if(!u)return erro('Sessão inválida.',401)
 // Primeira versão de homologação: só o Master pode visualizar.
 if(u.role!=='master')return erro('Visualização ainda restrita ao Master.',403)
 const inicio=req.nextUrl.searchParams.get('inicio')||''
 const fim=req.nextUrl.searchParams.get('fim')||''
 if(!data.test(inicio)||!data.test(fim)||inicio>fim)return erro('Informe um período válido.')
 try{
  const empresa=u.empresa_id
  const [pagar,receber,recebimentos,plano]=await Promise.all([
   buscarTodos((a,b)=>supabaseAdmin.from('financeiro_contas_pagar')
    .select('id,descricao,fornecedor_nome,status,valor,valor_pago,valor_desconto,valor_juros,valor_multa,valor_troco,vencimento,data_pagamento')
    .eq('empresa_id',empresa)
    .or('and(vencimento.gte.'+inicio+',vencimento.lte.'+fim+'),and(data_pagamento.gte.'+inicio+',data_pagamento.lte.'+fim+')')
    .order('id').range(a,b)),
   buscarTodos((a,b)=>supabaseAdmin.from('financeiro_contas_receber')
    .select('id,cliente_nome,documento,valor,valor_pago,valor_desconto,status,vencimento,data_pagamento')
    .eq('empresa_id',empresa)
    .or('and(vencimento.gte.'+inicio+',vencimento.lte.'+fim+'),and(data_pagamento.gte.'+inicio+',data_pagamento.lte.'+fim+')')
    .order('id').range(a,b)),
   buscarTodos((a,b)=>supabaseAdmin.from('financeiro_recebimentos')
    .select('id,cliente_nome,referencia,valor,valor_desconto,status,data_recebimento')
    .eq('empresa_id',empresa).neq('status','cancelado')
    .gte('data_recebimento',inicio).lte('data_recebimento',fim).order('id').range(a,b)),
   buscarTodos((a,b)=>supabaseAdmin.from('financeiro_plano_contas')
    .select('id,nome,grupo,codigo').eq('empresa_id',empresa).order('id').range(a,b),3000)
  ])
  const classificacoes:any[]=[]
  for(let i=0;i<pagar.length;i+=80){
   const ids=pagar.slice(i,i+80).map(x=>x.id)
   if(!ids.length)break
   const {data:itens,error}=await supabaseAdmin.from('financeiro_conta_classificacoes')
    .select('conta_pagar_id,plano_conta_id').eq('empresa_id',empresa).in('conta_pagar_id',ids)
   if(error)throw error
   classificacoes.push(...(itens||[]))
  }
  const categorias=new Map(plano.map((x:any)=>[x.id,x]))
  const classificadas=new Map(classificacoes.map((x:any)=>[x.conta_pagar_id,x.plano_conta_id]))
  const movimentos:Movimento[]=[]
  for(const x of pagar){
   if(x.status==='cancelado')continue
   const c:any=categorias.get(classificadas.get(x.id))
   const categoria=c?.nome||'A classificar'
   const grupo=c?.grupo||'nao_classificado'
   if(x.status==='pago'&&x.data_pagamento&&x.data_pagamento>=inicio&&x.data_pagamento<=fim){
    movimentos.push({id:'pagar-'+x.id,tipo:'saida',situacao:'realizado',data:x.data_pagamento,
     descricao:x.descricao||x.fornecedor_nome||'Pagamento',origem:'Contas a Pagar',valor:moeda(x.valor_pago??x.valor),categoria,grupo})
   }else if(['aberto','pendente_vencimento'].includes(x.status)&&x.vencimento&&x.vencimento>=inicio&&x.vencimento<=fim){
    movimentos.push({id:'prevp-'+x.id,tipo:'saida',situacao:'previsto',data:x.vencimento,
     descricao:x.descricao||x.fornecedor_nome||'Pagamento previsto',origem:'Contas a Pagar',
     valor:Math.max(0,moeda(x.valor)),categoria,grupo})
   }
  }
  // Recebimentos reais são lidos UMA VEZ da tabela de recebimentos. Não somar
  // novamente valor_pago das parcelas, para não duplicar entradas no fluxo.
  for(const x of recebimentos){
   movimentos.push({id:'rec-'+x.id,tipo:'entrada',situacao:'realizado',data:x.data_recebimento,
    descricao:x.referencia||x.cliente_nome||'Recebimento',origem:'Recebimentos',valor:moeda(x.valor),
    categoria:'Receita a classificar',grupo:'nao_classificado'})
  }
  for(const x of receber){
   if(x.status==='cancelado')continue
   const saldo=Math.max(0,moeda(x.valor)-moeda(x.valor_pago)-moeda(x.valor_desconto))
   if(saldo>0.005&&x.vencimento&&x.vencimento>=inicio&&x.vencimento<=fim){
    movimentos.push({id:'prevr-'+x.id,tipo:'entrada',situacao:'previsto',data:x.vencimento,
     descricao:x.documento||x.cliente_nome||'Recebimento previsto',origem:'Contas a Receber',
     valor:moeda(saldo),categoria:'Receita a classificar',grupo:'nao_classificado'})
   }
  }
  movimentos.sort((a,b)=>b.data.localeCompare(a.data)||a.id.localeCompare(b.id))
  const total=(tipo:'entrada'|'saida',situacao:'realizado'|'previsto')=>moeda(movimentos.filter(x=>x.tipo===tipo&&x.situacao===situacao).reduce((s,x)=>s+x.valor,0))
  return NextResponse.json({ok:true,inicio,fim,movimentos,resumo:{
   entradasRealizadas:total('entrada','realizado'),saidasRealizadas:total('saida','realizado'),
   entradasPrevistas:total('entrada','previsto'),saidasPrevistas:total('saida','previsto')
  },avisos:[
   'Visão do caixa por lançamentos registrados. Os saldos das contas bancárias ainda não estão conciliados.',
   'Grupos gerenciais são classificações de lançamentos; esta consulta NÃO é uma DRE por competência.',
   'Pagamentos realizados são deduzidos uma vez; recebimentos parciais vêm dos recibos efetivos e não das parcelas.',
   'Movimentos sem banco identificado não são atribuídos automaticamente a nenhuma conta.'
  ]},{headers:{'Cache-Control':'private, no-store'}})
 }catch(e){
  console.error('fluxo de caixa: falha de leitura',e)
  return erro(e instanceof Error&&e.message.includes('limite')?e.message:'Falha ao consultar as movimentações.',500)
 }
}
