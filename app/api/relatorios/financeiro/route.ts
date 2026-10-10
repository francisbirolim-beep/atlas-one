import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { extrairPrevisaoWVetro } from '@/lib/wvetroCmvResumo'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const n=(v:unknown)=>Number(v||0)||0
const round=(v:number)=>Math.round(v*100)/100
const valid=/^\d{4}-\d{2}-\d{2}$/
function inPeriod(v:string|null|undefined, inicio:string,fim:string){
 const d=String(v||'').slice(0,10)
 return !!d && d>=inicio && d<=fim
}
async function fetchLimit(table:string,columns:string,empresa:string,filters:(q:any)=>any){
 let q=supabaseAdmin.from(table).select(columns).eq('empresa_id',empresa).limit(1001)
 q=filters(q)
 const {data,error}=await q
 if(error) throw error
 if((data||[]).length>=1001) throw new Error('Período com mais de 1.000 registros numa das fontes; reduza o intervalo para emitir relatório completo.')
 return data||[]
}
async function fetchIn(table:string,columns:string,key:string,ids:string[],empresa:string){
 const all:any[]=[]
 for(let i=0;i<ids.length;i+=100){
  const group=ids.slice(i,i+100)
  const data=await fetchLimit(table,columns,empresa,q=>q.in(key,group))
  all.push(...data)
 }
 return all
}
function summarizeByMonth(rows:any[],timeKey:string,value:(row:any)=>number,inicio:string,fim:string){
 const keys:string[]=[]
 for(let date=new Date(inicio+'T12:00:00Z');date.toISOString().slice(0,7)<=fim.slice(0,7);date.setUTCMonth(date.getUTCMonth()+1)){
  keys.push(date.toISOString().slice(0,7))
 }
 return keys.map(m=>({mes:m,valor:round(rows.filter(row=>inPeriod(row[timeKey],inicio,fim)&&String(row[timeKey]||'').startsWith(m)).reduce((s,row)=>s+value(row),0))}))
}
export async function GET(req:NextRequest){
 const usuario=await autenticarTenant(req)
 if(!usuario)return NextResponse.json({error:'Sessão inválida.'},{status:401})
 // Custos agregados e margens: apenas Master até existir permissão específica de relatórios.
 if(usuario.role!=='master')return NextResponse.json({error:'Relatório financeiro gerencial disponível para Master.'},{status:403})
 const inicio=req.nextUrl.searchParams.get('inicio')||''
 const fim=req.nextUrl.searchParams.get('fim')||''
 if(!valid.test(inicio)||!valid.test(fim)||inicio>fim||Date.parse(fim+'T00:00:00Z')-Date.parse(inicio+'T00:00:00Z')>366*86400000){
  return NextResponse.json({error:'Selecione um período válido de até 12 meses.'},{status:400})
 }
 const empresa=usuario.empresa_id
 try{
  // Consultas independentes: não somar saldo a receber com entradas efetivamente recebidas.
  const [vendas,balcao,recebimentos,pagar,receber]=await Promise.all([
   fetchLimit('vendas_obras','id,orcamento_id,status,valor_venda,custo_previsto,confirmado_em',empresa,q=>q.gte('confirmado_em',inicio+'T00:00:00-03:00').lte('confirmado_em',fim+'T23:59:59-03:00')),
   fetchLimit('balcao_vendas','id,status,total,finalizada_em',empresa,q=>q.gte('finalizada_em',inicio+'T00:00:00-03:00').lte('finalizada_em',fim+'T23:59:59-03:00')),
   fetchLimit('financeiro_recebimentos','id,data_recebimento,valor,status,forma,valor_desconto',empresa,q=>q.gte('data_recebimento',inicio).lte('data_recebimento',fim)),
   fetchLimit('financeiro_contas_pagar','id,status,valor,valor_pago,vencimento,data_pagamento,descricao,fornecedor_nome',empresa,q=>q.or('and(data_pagamento.gte.'+inicio+',data_pagamento.lte.'+fim+'),and(vencimento.gte.'+inicio+',vencimento.lte.'+fim+')')),
   fetchLimit('financeiro_contas_receber','id,status,valor,valor_pago,valor_desconto,vencimento',empresa,q=>q.gte('vencimento',inicio).lte('vencimento',fim))
  ])
  const vendasValidas=vendas.filter((v:any)=>v.status!=='cancelada')
  const balcaoValidos=balcao.filter((v:any)=>v.status==='finalizada')
  const orcamentos=await fetchIn('orcamentos','id,wvetro_fluxo,custo_estimado', 'id', [...new Set(vendasValidas.map((v:any)=>v.orcamento_id).filter(Boolean))],empresa)
  const orcMap=new Map(orcamentos.map((o:any)=>[o.id,o]))
  const numeros=[...new Set(orcamentos.map((o:any)=>String(o.wvetro_fluxo?.numero||o.wvetro_fluxo?.numero_wvetro||'')).filter(Boolean))]
  const historicos=await fetchIn('wvetro_orcamentos_historico','wvetro_numero,custo_com_sobra,custo_sem_sobra','wvetro_numero',numeros,empresa)
  const histMap=new Map(historicos.map((h:any)=>[String(h.wvetro_numero),h]))
  const itensBalcao=await fetchIn('balcao_venda_itens','venda_id,quantidade,custo_unitario_snapshot','venda_id',balcaoValidos.map((v:any)=>v.id),empresa)
  const balcaoItensMap=new Map<string,any[]>()
  for(const item of itensBalcao as any[]){
   balcaoItensMap.set(item.venda_id,[...(balcaoItensMap.get(item.venda_id)||[]),item])
  }
  let cmvPrevistoObras=0
  let semPrevisto=0
  for(const v of vendasValidas as any[]){
   const orc:any=orcMap.get(v.orcamento_id)
   const fluxo=orc?.wvetro_fluxo||{}
   const numeroWvetro=String(fluxo.numero||fluxo.numero_wvetro||'')
   const previsao=extrairPrevisaoWVetro({...histMap.get(numeroWvetro),...fluxo})
   // Fallback transparente ao snapshot da venda; nunca subtrair duas vezes a sobra.
   const custo=previsao.total??(v.custo_previsto==null?(orc?.custo_estimado==null?null:n(orc.custo_estimado)):n(v.custo_previsto))
   if(custo===null)semPrevisto++
   else cmvPrevistoObras+=custo
  }
  let cmvBalcao=0
  let balcaoSemCusto=0
  for(const v of balcaoValidos as any[]){
   const itens=balcaoItensMap.get(v.id)||[]
   if(!itens.length || itens.some((i:any)=>i.custo_unitario_snapshot==null))balcaoSemCusto++
   else cmvBalcao+=itens.reduce((s:number,i:any)=>s+n(i.quantidade)*n(i.custo_unitario_snapshot),0)
  }
  const receitaObras=round(vendasValidas.reduce((s:number,v:any)=>s+n(v.valor_venda),0))
  const receitaBalcao=round(balcaoValidos.reduce((s:number,v:any)=>s+n(v.total),0))
  const receitaTotal=round(receitaObras+receitaBalcao)
  const cmvProjetado=round(cmvPrevistoObras+cmvBalcao)
  const despesasIdentificadas=pagar.filter((x:any)=>x.status!=='cancelado' && inPeriod(x.data_pagamento,inicio,fim))
  const totalPagamentos=round(despesasIdentificadas.reduce((s:number,x:any)=>s+n(x.valor_pago),0))
  const totalRecebimentos=round(recebimentos.filter((x:any)=>!['cancelado','estornado'].includes(String(x.status))).reduce((s:number,x:any)=>s+n(x.valor),0))
  const aReceber=round(receber.filter((x:any)=>x.status!=='cancelado').reduce((s:number,x:any)=>s+Math.max(0,n(x.valor)-n(x.valor_pago)-n(x.valor_desconto)),0))
  const aPagar=round(pagar.filter((x:any)=>x.status!=='cancelado' && inPeriod(x.vencimento,inicio,fim)).reduce((s:number,x:any)=>s+Math.max(0,n(x.valor)-n(x.valor_pago)),0))
  const mesesRecebidos=summarizeByMonth(recebimentos.filter((x:any)=>!['cancelado','estornado'].includes(String(x.status))),'data_recebimento',(x:any)=>n(x.valor),inicio,fim)
  const mesesPagos=summarizeByMonth(despesasIdentificadas,'data_pagamento',(x:any)=>n(x.valor_pago),inicio,fim)
  const meses=mesesRecebidos.map((m,i)=>({mes:m.mes,recebido:m.valor,pago:mesesPagos[i]?.valor||0}))
  const aviso=[
   'DRE gerencial preliminar: receitas de contratos confirmados e vendas de balcão, não receita fiscal por competência.',
   'CMV de obras é previsto pelo WVetro/snapshot; não é CMV contábil realizado nem baixa definitiva de estoque.',
   'Contas a pagar incluem compras de estoque e outras obrigações. Não foram deduzidas da margem bruta para evitar contagem duplicada.',
   'Movimentações de caixa de balcão e movimentos bancários não conciliados podem não constar no fluxo.',
   'Recebimentos e pagamentos usam os registros disponíveis por data do movimento. Saldo em aberto usa vencimento no período.',
  ]
  if(semPrevisto||balcaoSemCusto)aviso.push('Há '+(semPrevisto+balcaoSemCusto)+' venda(s) sem CMV previsto completo; margem projetada não será exibida como resultado fechado.')
  const margemDisponivel=semPrevisto===0 && balcaoSemCusto===0
  return NextResponse.json({
   ok:true, periodo:{inicio,fim},
   dre:{
    receitaObras,receitaBalcao,receitaTotal,cmvPrevisto:cmvProjetado,
    cmvObras:round(cmvPrevistoObras),cmvBalcao:round(cmvBalcao),
    margemBrutaProjetada:margemDisponivel?round(receitaTotal-cmvProjetado):null,
    margemPct:margemDisponivel && receitaTotal>0?round(100*(receitaTotal-cmvProjetado)/receitaTotal):null,
    despesasOperacionais:null,tributos:null,lucroLiquido:null,
    semPrevisao:semPrevisto+balcaoSemCusto,obras:vendasValidas.length,balcao:balcaoValidos.length
   },
   caixa:{recebido:totalRecebimentos,pago:totalPagamentos,saldoParcial:round(totalRecebimentos-totalPagamentos),meses},
   contas:{aReceber,aPagar,receber:receber.length,pagar:pagar.filter((x:any)=>inPeriod(x.vencimento,inicio,fim)).length},
   avisos:aviso
  })
 }catch(e){
  console.error('Falha no relatório financeiro gerencial:',e)
  return NextResponse.json({error:'Falha ao gerar o relatório financeiro. Confira as tabelas e reduza o período se necessário.'},{status:500})
 }
}
