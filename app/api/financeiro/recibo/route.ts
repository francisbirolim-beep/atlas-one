import { NextRequest,NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import {autenticarCompras} from '@/lib/comprasServer'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import {usuarioPodeAcaoServer} from '@/lib/acessoUsuarioServer'
import { somarRecebimentos, type ReciboInfo, type ItemReciboRecebimento } from '@/lib/financeiroRecibos'
import { assinaturaReciboAutorizada } from '@/lib/financeiroAssinatura'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const bad=(msg:string,status=400)=>NextResponse.json({error:msg},{status})
type FormaPersistida = {recebimento_id:string;forma:string;valor:number;ordem:number;parcelas:number|null}
async function buscarFormas(recebimentoIds:string[],empresaId:string):Promise<{data:FormaPersistida[];erro:string|null}> {
 const detalhadas=await supabaseAdmin.from('financeiro_recebimento_formas')
   .select('recebimento_id,forma,valor,ordem,parcelas').eq('empresa_id',empresaId).in('recebimento_id',recebimentoIds).order('ordem')
 if(!detalhadas.error)return {data:(detalhadas.data||[]).map(f=>({...f,parcelas:f.parcelas??null})),erro:null}
 // Mantém leitura dos recibos caso a migração do campo parcelas ainda não tenha sido aplicada.
 if(detalhadas.error.code!=='42703'&&!/parcelas/i.test(detalhadas.error.message))return {data:[],erro:detalhadas.error.message}
 const legadas=await supabaseAdmin.from('financeiro_recebimento_formas')
   .select('recebimento_id,forma,valor,ordem').eq('empresa_id',empresaId).in('recebimento_id',recebimentoIds).order('ordem')
 return {data:(legadas.data||[]).map(f=>({...f,parcelas:null})),erro:legadas.error?.message||null}
}
export async function GET(req:NextRequest){
 const u=await autenticarCompras(req);if(!u)return bad('Sessão inválida.',401)
 const tipo=req.nextUrl.searchParams.get('tipo'),id=req.nextUrl.searchParams.get('id')||''
 const idsParametro=req.nextUrl.searchParams.get('ids')
 const ids=idsParametro ? idsParametro.split(',').map(v=>v.trim()) : []
 if(!['pagar','receber'].includes(tipo||''))return bad('Tipo de recibo inválido.')
 if(idsParametro && (tipo!=='receber'||ids.length<2||ids.length>25||new Set(ids).size!==ids.length||ids.some(v=>!uuid.test(v)))) return bad('Selecione de 2 a 25 recebimentos válidos, sem repetir lançamentos.')
 if(!idsParametro && !uuid.test(id))return bad('Recibo inválido.')
 const acao=tipo==='pagar'?'financeiro.contas_pagar.consultar':'financeiro.contas_receber.recibo'
 const [permissaoCaixa,permissaoFinanceiro,permissaoVendas]=await Promise.all([
  usuarioPodeAcaoServer({usuarioId:u.id,role:u.role,empresaId:u.empresa_id,setorId:'caixa-balcao',acaoId:acao}),
  usuarioPodeAcaoServer({usuarioId:u.id,role:u.role,empresaId:u.empresa_id,setorId:'financeiro',acaoId:acao}),
  tipo==='receber'?usuarioPodeAcaoServer({usuarioId:u.id,role:u.role,empresaId:u.empresa_id,setorId:'recebimento-vendas',acaoId:'financeiro.recebimento_vendas.registrar'}):Promise.resolve(false)
 ])
 if(!permissaoCaixa&&!permissaoFinanceiro&&!permissaoVendas)return bad('Sem permissão para consultar recibos.',403)
 try{
  if(idsParametro){
   const clienteFiltro=req.nextUrl.searchParams.get('clienteId')
   if(clienteFiltro && !uuid.test(clienteFiltro))return bad('Cliente inválido.')
   const vendaFiltro=req.nextUrl.searchParams.get('vendaId')
   if(vendaFiltro && !uuid.test(vendaFiltro))return bad('Venda inválida.')
   const resultado=await supabaseAdmin.from('financeiro_recebimentos')
     .select('id,cliente_id,obra_id,venda_obra_id,data_recebimento,valor,valor_desconto,cartao_parcelas,forma,referencia,status')
     .eq('empresa_id',u.empresa_id).in('id',ids)
   if(resultado.error)throw resultado.error
   const recebimentos=resultado.data||[]
   if(recebimentos.length!==ids.length||recebimentos.some(r=>['cancelado','estornado'].includes(r.status||'')))return bad('Um dos recebimentos não existe ou está cancelado.',404)
   const clienteId=recebimentos[0].cliente_id
   if(!clienteId||recebimentos.some(r=>r.cliente_id!==clienteId)||(clienteFiltro && clienteFiltro!==clienteId))return bad('Selecione recebimentos pertencentes ao mesmo cliente.',422)
   if(vendaFiltro){
     // Uma seleção originada da venda não pode agrupar um pagamento de outra venda
     // nem utilizar recebimentos livres/créditos que não foram alocados nela.
     if(recebimentos.some(r=>r.venda_obra_id && r.venda_obra_id!==vendaFiltro))return bad('Há recebimento vinculado a outra venda.',422)
     const alocResp=await supabaseAdmin.from('financeiro_recebimento_alocacoes')
       .select('recebimento_id,conta_receber_id,tipo').eq('empresa_id',u.empresa_id).in('recebimento_id',ids).eq('tipo','conta')
     if(alocResp.error)throw alocResp.error
     const alocacoes=alocResp.data||[]
     const contaIds=[...new Set(alocacoes.map(a=>a.conta_receber_id).filter((v):v is string=>!!v))]
     if(contaIds.length===0)return bad('Os recebimentos não estão associados a parcelas desta venda.',422)
     const contasResp=await supabaseAdmin.from('financeiro_contas_receber')
       .select('id,venda_obra_id').eq('empresa_id',u.empresa_id).in('id',contaIds)
     if(contasResp.error)throw contasResp.error
     const contasVenda=new Map((contasResp.data||[]).map(c=>[c.id,c.venda_obra_id]))
     if(recebimentos.some(r=>!alocacoes.some(a=>a.recebimento_id===r.id))||
        alocacoes.some(a=>contasVenda.get(a.conta_receber_id)!==vendaFiltro))return bad('Selecione somente pagamentos vinculados a esta venda.',422)
   }
   const obraIds=[...new Set(recebimentos.map(r=>r.obra_id).filter((v):v is string=>!!v))]
   const [clienteResp,obrasResp]=await Promise.all([
     supabaseAdmin.from('clientes').select('id,nome,cpf_cnpj').eq('empresa_id',u.empresa_id).eq('id',clienteId).maybeSingle(),
     obraIds.length ? supabaseAdmin.from('obras').select('id,nome').eq('empresa_id',u.empresa_id).eq('cliente_id',clienteId).in('id',obraIds) : Promise.resolve({data:[],error:null})
   ])
   if(clienteResp.error||obrasResp.error)throw clienteResp.error||obrasResp.error
   if(!clienteResp.data)return bad('Cliente não encontrado.',404)
   const obras=new Map((obrasResp.data||[]).map(o=>[o.id,o.nome]))
   const ordem=new Map(ids.map((valor,indice)=>[valor,indice]))
   recebimentos.sort((a,b)=>(ordem.get(a.id)??0)-(ordem.get(b.id)??0))
   const multiplos=recebimentos.filter(r=>r.forma==='multiplo').map(r=>r.id)
   let formas:Array<{recebimento_id:string;forma:string;valor:number;ordem:number;parcelas?:number|null}>=[]
   if(multiplos.length){
     const detalhes=await buscarFormas(multiplos,u.empresa_id)
     if(detalhes.erro)return bad('Não foi possível consultar as formas detalhadas de um recebimento.',422)
     formas=detalhes.data
     if(multiplos.some(id=>!formas.some(f=>f.recebimento_id===id)))return bad('Recebimento sem detalhamento das formas de pagamento.',422)
   }
   const descontosResp=await supabaseAdmin.from('financeiro_recebimento_alocacoes')
     .select('recebimento_id,valor').eq('empresa_id',u.empresa_id).in('recebimento_id',ids).eq('tipo','desconto')
   if(descontosResp.error)throw descontosResp.error
   const descontosPorId=new Map<string,number>()
   for(const a of descontosResp.data||[]) descontosPorId.set(a.recebimento_id,(descontosPorId.get(a.recebimento_id)||0)+Number(a.valor||0))
   const itens:ItemReciboRecebimento[]=recebimentos.map(r=>({
     id:r.id,data:r.data_recebimento,valor:Number(r.valor||0),desconto:Math.max(Number(r.valor_desconto||0),descontosPorId.get(r.id)||0),
     forma:r.forma,referencia:r.referencia,obra:r.obra_id?obras.get(r.obra_id)||null:null,
     cartaoParcelas:r.cartao_parcelas,
     formas:formas.filter(f=>f.recebimento_id===r.id).map(f=>({forma:f.forma,valor:Number(f.valor),parcelas:f.parcelas}))
   }))
   for(const item of itens){
     if(item.forma==='multiplo' && Math.abs((item.formas||[]).reduce((t,f)=>t+f.valor,0)-item.valor)>0.009)return bad('Um recebimento possui total de formas divergente.',422)
   }
   const total=somarRecebimentos(itens)
   const datas=itens.map(item=>item.data).sort()
   const nomesObras=[...new Set(itens.map(item=>item.obra).filter((v):v is string=>!!v))]
   const identificador=createHash('sha256').update([...ids].sort().join('|')).digest('hex').slice(0,12)
   const recibo:ReciboInfo={tipo:'receber',id:'CONSOLIDADO-'+identificador,consolidado:true,itens,
      nome:clienteResp.data.nome,documento:clienteResp.data.cpf_cnpj,obra:nomesObras.length===1?nomesObras[0]:nomesObras.length>1?'Múltiplas obras':null,
      data:datas[datas.length-1],forma:'multiplo',valorMovimento:total,valorOriginal:total,saldo:0,
      assinaturaDataUri:assinaturaReciboAutorizada()}
   return NextResponse.json({ok:true,recibo},{headers:{'Cache-Control':'no-store'}})
  }
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
  const {data:rec,error}=await supabaseAdmin.from('financeiro_recebimentos').select('id,cliente_id,cliente_nome,obra_id,data_recebimento,valor,valor_desconto,cartao_parcelas,forma,referencia,observacoes,status').eq('empresa_id',u.empresa_id).eq('id',id).maybeSingle()
  if(error)throw error
  if(!rec||['cancelado','estornado'].includes(rec.status||''))return bad('Recebimento inexistente ou cancelado.',404)
  const [cli,alocs]=await Promise.all([
   supabaseAdmin.from('clientes').select('id,nome,cpf_cnpj').eq('empresa_id',u.empresa_id).eq('id',rec.cliente_id).maybeSingle(),
   supabaseAdmin.from('financeiro_recebimento_alocacoes').select('conta_receber_id,obra_id,tipo,valor').eq('empresa_id',u.empresa_id).eq('recebimento_id',id)
  ])
  if(cli.error||alocs.error)throw cli.error||alocs.error
  if(!cli.data)return bad('Cliente do recebimento indisponível.',404)
  const idsObras=[...new Set([rec.obra_id,...(alocs.data||[]).map(a=>a.obra_id)].filter((v):v is string=>!!v))]
  const filtroObra=req.nextUrl.searchParams.get('obraId')
  if(filtroObra&&filtroObra!=='sem-obra'&&!uuid.test(filtroObra))return bad('Obra inválida.',400)
  if(filtroObra && !(alocs.data||[]).some(a=>a.tipo==='conta' && (a.obra_id||'sem-obra')===filtroObra))return bad('Não existe alocação desse recebimento na obra selecionada.',422)
  let obraId:string|null=filtroObra==='sem-obra'?null:(filtroObra||(idsObras.length===1?idsObras[0]:null))
  if(!obraId&&!filtroObra){
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
  if(filtroObra==='sem-obra')contas=contas.is('obra_id',null)
  else if(filtroObra&&obraId)contas=contas.eq('obra_id',obraId)
  else if(idsObras.length>1)contas=contas.in('obra_id',idsObras)
  else if(obraId)contas=contas.eq('obra_id',obraId)
  else contas=contas.is('obra_id',null) // Sem obra: não somar dívidas de obras distintas.
  const {data:titulos,error:erroTitulos}=await contas.limit(1000)
  if(erroTitulos)throw erroTitulos
  const valorOriginal=(titulos||[]).filter(c=>c.status!=='cancelado').reduce((a,c)=>a+Number(c.valor||0),0)
  const saldo=(titulos||[]).filter(c=>c.status!=='cancelado').reduce((a,c)=>a+Math.max(0,Number(c.valor||0)-Number(c.valor_pago||0)-Number(c.valor_desconto||0)),0)
  let formasDetalhadas:Array<{forma:string;valor:number;parcelas?:number|null}>=[]
  if(rec.forma==='multiplo'){
    const detalhes=await buscarFormas([id],u.empresa_id)
    if(detalhes.erro||!detalhes.data.length)return bad('Formas de pagamento do recebimento indisponíveis.',422)
    formasDetalhadas=detalhes.data.map(f=>({forma:f.forma,valor:Number(f.valor),parcelas:f.parcelas}))
    if(Math.abs(formasDetalhadas.reduce((a,f)=>a+f.valor,0)-Number(rec.valor||0))>0.009)return bad('Formas de pagamento não conferem com total recebido.',422)
  }
  const recebidoNaObra=filtroObra?(alocs.data||[]).filter(a=>a.tipo==='conta'&&(a.obra_id||'sem-obra')===filtroObra).reduce((v,a)=>v+Number(a.valor||0),0):Number(rec.valor)
  const descontoAlocado=(alocs.data||[]).filter(a=>a.tipo==='desconto').reduce((v,a)=>v+Number(a.valor||0),0)
  const recibo:ReciboInfo={tipo:'receber',id,itens:[{id,data:rec.data_recebimento,valor:Number(rec.valor),forma:rec.forma,desconto:Math.max(Number(rec.valor_desconto||0),descontoAlocado),cartaoParcelas:rec.cartao_parcelas,formas:formasDetalhadas,referencia:rec.referencia}],nome:cli.data.nome,documento:cli.data.cpf_cnpj,obra:obra?.data?.nome|| (idsObras.length>1&&!filtroObra?'Recebimento de múltiplas obras — consulte os extratos individualizados':'Sem obra vinculada'),descricao:rec.observacoes||null,referencia:rec.referencia,data:rec.data_recebimento,forma:rec.forma,valorOriginal:valorOriginal||Number(rec.valor),valorMovimento:recebidoNaObra,saldo,assinaturaDataUri:assinaturaReciboAutorizada()}
  return NextResponse.json({ok:true,recibo})
 }catch(e){console.error('recibo financeiro',e);return bad('Não foi possível carregar os dados do recibo.',500)}
}
