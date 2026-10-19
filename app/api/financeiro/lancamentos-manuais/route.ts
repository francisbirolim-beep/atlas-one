import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomUUID } from 'node:crypto'
import { autenticarCompras } from '@/lib/comprasServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { usuarioPodeAcaoServer } from '@/lib/acessoUsuarioServer'
import { PLANO_CONTAS_PADRAO, TITULOS_GRUPOS } from '@/lib/financeiroPlanoContas'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const dataValida=(s:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s}
const str=(v:unknown,max=200)=>String(v??'').trim().slice(0,max)
const erro=(m:string,code=400)=>NextResponse.json({error:m},{status:code})
const inteiro=(v:unknown)=>Number.isInteger(Number(v))?Number(v):NaN
const monetario=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?Math.round(n*100):NaN}
async function autorizado(u:{id:string;role:string;empresa_id:string},acaoId:string,nivel:'consulta'|'edicao'='consulta') {
 return usuarioPodeAcaoServer({usuarioId:u.id,role:u.role,empresaId:u.empresa_id,setorId:'financeiro',acaoId,minimo:nivel})
}
function uuidParcela(empresa:string,chave:string,i:number){
 const hex=createHash('sha256').update(`${empresa}:${chave}:${i}`).digest('hex')
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`
}
function partesParcelas(valorCentavos:number,n:number){
 const basica=Math.floor(valorCentavos/n),resto=valorCentavos%n
 return Array.from({length:n},(_,i)=>(basica+(i<resto?1:0))/100)
}
function validarParcelas(b:any) {
 const vencimentos=Array.isArray(b.vencimentos)?b.vencimentos.map((v:unknown)=>str(v,10)):[]
 const quantidade=inteiro(b.quantidade)
 const valor=monetario(b.valorTotal)
 if(!Number.isInteger(quantidade)||quantidade<1||quantidade>36)return {error:'Escolha de 1 a 36 parcelas.'}
 if(!Number.isInteger(valor)||valor<=0||valor>100_000_000_00)return {error:'Valor total inválido.'}
 if(vencimentos.length!==quantidade||!vencimentos.every(dataValida))return {error:'Informe a data de vencimento de todas as parcelas.'}
 if(!dataValida(str(b.dataEmissao,10)))return {error:'Data de emissão inválida.'}
 if(!uuid.test(str(b.chaveLote,60)))return {error:'Identificação do lote inválida.'}
 return {vencimentos,quantidade,valor,parcelas:partesParcelas(valor,quantidade)}
}

// A prévia permite conferência sem gravar transações reais na empresa.
function previaSemEscrita(){return process.env.VERCEL_ENV==='preview'}

export async function GET(req:NextRequest){
 const u=await autenticarCompras(req);if(!u)return erro('Sessão inválida.',401)
 const [pagar,receber]=await Promise.all([
  autorizado(u,'financeiro.contas_pagar.consultar'),
  autorizado(u,'financeiro.contas_receber.consultar')
 ])
 if(!pagar&&!receber)return erro('Sem permissão para consultar Financeiro.',403)
 try{
  const [forn,cli,plano,obras,compras]=await Promise.all([
   pagar?supabaseAdmin.from('fornecedores').select('id,nome,cnpj_cpf').eq('empresa_id',u.empresa_id).eq('ativo',true).order('nome').limit(600):Promise.resolve({data:[],error:null}),
   receber?supabaseAdmin.from('clientes').select('id,nome,cpf_cnpj').eq('empresa_id',u.empresa_id).order('nome').limit(1000):Promise.resolve({data:[],error:null}),
   pagar?supabaseAdmin.from('financeiro_plano_contas').select('id,codigo,nome,grupo').eq('empresa_id',u.empresa_id).eq('ativo',true).order('codigo').limit(250):Promise.resolve({data:[],error:null}),
   receber?supabaseAdmin.from('obras').select('id,cliente_id,nome,numero').eq('empresa_id',u.empresa_id).order('created_at',{ascending:false}).limit(1000):Promise.resolve({data:[],error:null}),
   pagar?supabaseAdmin.from('compras_nfs').select('id,numero,fornecedor_id,fornecedor_nome,data_emissao').eq('empresa_id',u.empresa_id).order('created_at',{ascending:false}).limit(250):Promise.resolve({data:[],error:null})
  ])
  const all=[forn,cli,plano,obras,compras];if(all.some(v=>v.error))return erro('Falha ao consultar cadastros do Financeiro.',500)
  return NextResponse.json({ok:true,fornecedores:forn.data||[],clientes:cli.data||[],planoContas:plano.data||[],obras:obras.data||[],compras:compras.data||[],grupos:TITULOS_GRUPOS,modelosPlano:PLANO_CONTAS_PADRAO})
 }catch(e){console.error('cadastros financeiro',e);return erro('Não foi possível carregar os cadastros.',500)}
}

export async function POST(req:NextRequest){
 const u=await autenticarCompras(req);if(!u)return erro('Sessão inválida.',401)
 if(previaSemEscrita())return erro('Prévia de demonstração: lançamentos e cadastros não são gravados no financeiro real.',423)
 try{
  const b=await req.json()
  const tipo=str(b.tipo,30)
  const operacao=str(b.operacao,20)||'titulo'
  const permissao=operacao==='classificar'?'financeiro.contas_pagar.editar':tipo==='pagar'?'financeiro.contas_pagar.cadastrar':'financeiro.contas_receber.cadastrar'
  if(!['pagar','receber'].includes(tipo))return erro('Tipo de lançamento inválido.')
  if(!(await autorizado(u,permissao,'edicao')))return erro('Sem permissão para cadastrar ou classificar títulos.',403)
  if(operacao==='classificar'){
   if(tipo!=='pagar')return erro('Somente títulos a pagar recebem classificação DRE nesta tela.')
   const tituloId=str(b.tituloId,60),planoContaId=str(b.categoriaId,60)
   if(!uuid.test(tituloId)||!uuid.test(planoContaId))return erro('Título ou categoria inválida.')
   const [titulo,categoria]=await Promise.all([
    supabaseAdmin.from('financeiro_contas_pagar').select('id').eq('empresa_id',u.empresa_id).eq('id',tituloId).maybeSingle(),
    supabaseAdmin.from('financeiro_plano_contas').select('id').eq('empresa_id',u.empresa_id).eq('id',planoContaId).eq('ativo',true).maybeSingle()
   ])
   if(titulo.error||categoria.error)throw titulo.error||categoria.error
   if(!titulo.data||!categoria.data)return erro('Título ou categoria fora do escopo da empresa.',404)
   const {error}=await supabaseAdmin.from('financeiro_conta_classificacoes').upsert({empresa_id:u.empresa_id,conta_pagar_id:tituloId,plano_conta_id:planoContaId,classificado_por_id:u.id,classificado_por_nome:u.nome,classificado_em:new Date().toISOString()},{onConflict:'empresa_id,conta_pagar_id'})
   if(error)throw error
   return NextResponse.json({ok:true})
  }
  if(operacao==='novo-cadastro'){
   const nome=str(b.nome,170)
   if(nome.length<3)return erro('Informe o nome completo do cadastro.')
   if(tipo==='pagar'){
    const existente=await supabaseAdmin.from('fornecedores').select('id,nome').eq('empresa_id',u.empresa_id).ilike('nome',nome).limit(1).maybeSingle()
    if(existente.error)throw existente.error
    if(existente.data)return NextResponse.json({ok:true,cadastro:existente.data,existente:true})
    const {data,error}=await supabaseAdmin.from('fornecedores').insert({empresa_id:u.empresa_id,nome,cnpj_cpf:str(b.documento,35)||null,ativo:true,criado_por_id:u.id,criado_por_nome:u.nome}).select('id,nome,cnpj_cpf').single()
    if(error)throw error
    return NextResponse.json({ok:true,cadastro:data})
   }
   if(nome.split(/\s+/).length<2)return erro('Para um novo cliente, informe nome e sobrenome.')
   const existente=await supabaseAdmin.from('clientes').select('id,nome').eq('empresa_id',u.empresa_id).ilike('nome',nome).limit(1).maybeSingle()
   if(existente.error)throw existente.error
   if(existente.data)return NextResponse.json({ok:true,cadastro:existente.data,existente:true})
   const {data,error}=await supabaseAdmin.from('clientes').insert({empresa_id:u.empresa_id,nome,cpf_cnpj:str(b.documento,35)||null,whatsapp:str(b.telefone,30)||null}).select('id,nome,cpf_cnpj').single()
   if(error)throw error
   return NextResponse.json({ok:true,cadastro:data})
  }
  if(operacao==='nova-categoria'){
   if(tipo!=='pagar')return erro('Categoria de despesa disponível somente no Contas a Pagar.')
   const nome=str(b.nome,170),grupo=str(b.grupo,40)
   if(nome.length<3||!Object.prototype.hasOwnProperty.call(TITULOS_GRUPOS,grupo))return erro('Nome ou grupo de DRE inválido.')
   const codigo=`8.${randomUUID().replace(/-/g,'').slice(0,10)}`
   const {data,error}=await supabaseAdmin.from('financeiro_plano_contas').insert({empresa_id:u.empresa_id,codigo,nome,grupo,ativo:true}).select('id,codigo,nome,grupo').single()
   if(error)throw error
   return NextResponse.json({ok:true,categoria:data})
  }
  if(operacao!=='titulo')return erro('Operação inválida.')
  const parcelas=validarParcelas(b)
  if('error' in parcelas)return erro(parcelas.error||'Parcelas inválidas.')
  const identificador=str(b.identificador,60)
  if(!uuid.test(identificador))return erro('Selecione um fornecedor ou cliente cadastrado.')
  const obs=str(b.observacoes,600),documento=str(b.documento,100),forma=str(b.forma,45)
  const descricao=str(b.descricao,230)
  const ids=Array.from({length:parcelas.quantidade},(_,i)=>uuidParcela(u.empresa_id,str(b.chaveLote,60),i+1))
  if(tipo==='pagar'){
   const categoriaId=str(b.categoriaId,60)
   if(!uuid.test(categoriaId))return erro('Escolha uma categoria do plano de contas/DRE.')
   const [forn,cat]=await Promise.all([
    supabaseAdmin.from('fornecedores').select('id,nome').eq('empresa_id',u.empresa_id).eq('id',identificador).eq('ativo',true).maybeSingle(),
    supabaseAdmin.from('financeiro_plano_contas').select('id,grupo').eq('empresa_id',u.empresa_id).eq('id',categoriaId).eq('ativo',true).maybeSingle()
   ])
   if(forn.error||cat.error)throw forn.error||cat.error
   if(!forn.data||!cat.data)return erro('Fornecedor ou categoria não pertence à empresa.',404)
   const notaId=str(b.compraId,60)
   let compraDescricao=''
   if(notaId){
    if(!uuid.test(notaId))return erro('Compra inválida.')
    const {data:nf,error}=await supabaseAdmin.from('compras_nfs').select('id,numero,fornecedor_id').eq('empresa_id',u.empresa_id).eq('id',notaId).maybeSingle()
    if(error)throw error
    if(!nf||nf.fornecedor_id!==identificador)return erro('A compra selecionada não corresponde ao fornecedor.',422)
    compraDescricao=`Compra NF ${nf.numero||nf.id}`
    const existentesCompra=await supabaseAdmin.from('financeiro_contas_pagar').select('id').eq('empresa_id',u.empresa_id).eq('nf_id',notaId).neq('status','cancelado').limit(1)
    if(existentesCompra.error)throw existentesCompra.error
    if((existentesCompra.data||[]).length)return erro('Essa compra já gerou títulos automáticos. Confira no Contas a Pagar para evitar duplicidade.',409)
    // Não utiliza nf_id: a compra pode ter títulos automáticos e essa FK tem índice único
    // por parcela. A referência fica documentada sem duplicar vínculo fiscal automático.
   }
   if(documento){
     const possiveis=await supabaseAdmin.from('financeiro_contas_pagar').select('id,vencimento,valor').eq('empresa_id',u.empresa_id).eq('fornecedor_id',identificador).eq('documento',documento).neq('status','cancelado').limit(100)
     if(possiveis.error)throw possiveis.error
     if((possiveis.data||[]).some(c=>parcelas.vencimentos!.includes(c.vencimento)))return erro('Já existe título deste fornecedor com o mesmo documento e vencimento. Confira antes de lançar novamente.',409)
   }
   const registros=parcelas.parcelas!.map((valor,i)=>({id:ids[i],empresa_id:u.empresa_id,fornecedor_id:forn.data!.id,fornecedor_nome:forn.data!.nome,documento:documento||null,parcela:`${i+1}/${parcelas.quantidade}`,descricao:descricao||null,data_emissao:str(b.dataEmissao,10),vencimento:parcelas.vencimentos![i],valor,status:'aberto',forma_pagamento_prevista:forma||null,origem:'lancamento_manual',observacoes:[obs,compraDescricao].filter(Boolean).join(' | ')||null,criado_por_id:u.id,criado_por_nome:u.nome}))
   const {data:novos,error}=await supabaseAdmin.from('financeiro_contas_pagar').upsert(registros,{onConflict:'id',ignoreDuplicates:true}).select('id')
   if(error)throw error
   const classificados=ids.map(id=>({empresa_id:u.empresa_id,conta_pagar_id:id,plano_conta_id:categoriaId,classificado_por_id:u.id,classificado_por_nome:u.nome}))
   const {error:erroClasse}=await supabaseAdmin.from('financeiro_conta_classificacoes').upsert(classificados,{onConflict:'empresa_id,conta_pagar_id',ignoreDuplicates:true})
   if(erroClasse){
    if(novos?.length)await supabaseAdmin.from('financeiro_contas_pagar').delete().eq('empresa_id',u.empresa_id).in('id',novos.map(x=>x.id))
    throw erroClasse
   }
   return NextResponse.json({ok:true,quantidade:registros.length,duplicado:!novos?.length})
  }
  const {data:cliente,error:ec}=await supabaseAdmin.from('clientes').select('id,nome').eq('empresa_id',u.empresa_id).eq('id',identificador).maybeSingle()
  if(ec)throw ec
  if(!cliente)return erro('Cliente não encontrado nesta empresa.',404)
  const obraId=str(b.obraId,60)
  if(obraId){
   if(!uuid.test(obraId))return erro('Obra inválida.')
   const {data:obra,error}=await supabaseAdmin.from('obras').select('id').eq('empresa_id',u.empresa_id).eq('id',obraId).eq('cliente_id',identificador).maybeSingle()
   if(error)throw error
   if(!obra)return erro('A obra não pertence a este cliente.',422)
  }
  if(documento){
    const possiveis=await supabaseAdmin.from('financeiro_contas_receber').select('id,vencimento').eq('empresa_id',u.empresa_id).eq('cliente_id',identificador).eq('documento',documento).neq('status','cancelado').limit(100)
    if(possiveis.error)throw possiveis.error
    if((possiveis.data||[]).some(c=>parcelas.vencimentos!.includes(c.vencimento)))return erro('Já existe título do cliente com este documento e vencimento. Confira antes de lançar novamente.',409)
  }
  const registros=parcelas.parcelas!.map((valor,i)=>({id:ids[i],empresa_id:u.empresa_id,cliente_id:cliente.id,cliente_nome:cliente.nome,obra_id:obraId||null,documento:documento||null,parcela:i+1,total_parcelas:parcelas.quantidade,data_emissao:str(b.dataEmissao,10),vencimento:parcelas.vencimentos![i],valor,status:'aberto',forma:forma||null,observacoes:['Lançamento manual Atlas',descricao,obs].filter(Boolean).join(' | '),criado_por_id:u.id,criado_por_nome:u.nome}))
  const {data:novos,error}=await supabaseAdmin.from('financeiro_contas_receber').upsert(registros,{onConflict:'id',ignoreDuplicates:true}).select('id')
  if(error)throw error
  return NextResponse.json({ok:true,quantidade:registros.length,duplicado:!novos?.length})
 }catch(e){console.error('Falha lançamento manual:',e);return erro('Falha ao salvar lançamento. Nenhum pagamento foi realizado. Confira os títulos antes de tentar novamente.',500)}
}
