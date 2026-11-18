import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarCompras, limiteSeguro } from '@/lib/comprasServer'
import { usuarioPodeAcaoServer } from '@/lib/acessoUsuarioServer'
import { calcularBaixaPagar } from '@/lib/contasPagarAjustes'

export const runtime='nodejs'
export const dynamic='force-dynamic'
function texto(v:unknown,max=200){return String(v??'').trim().slice(0,max)}

async function pode(u:any,acaoId:string,minimo:'consulta'|'edicao'='consulta'){
 return usuarioPodeAcaoServer({usuarioId:u.id,role:u.role,empresaId:u.empresa_id,setorId:'financeiro',acaoId,minimo})
}

export async function GET(req:NextRequest){
 const u=await autenticarCompras(req);if(!u)return NextResponse.json({error:'Sessão inválida.'},{status:401})
 if(!(await pode(u,'financeiro.contas_pagar.consultar')))return NextResponse.json({error:'Sem acesso ao Contas a Pagar.'},{status:403})
 try{
  const limite=limiteSeguro(req.nextUrl.searchParams.get('limit'),300,1000)
  const status=req.nextUrl.searchParams.get('status')
  let q=supabaseAdmin.from('financeiro_contas_pagar').select('id,nf_id,fornecedor_id,fornecedor_nome,documento,parcela,descricao,data_emissao,vencimento,valor,status,data_pagamento,valor_pago,forma_pagamento,forma_pagamento_prevista,origem,rh_pessoa_id,observacoes,created_at,valor_desconto,valor_juros,valor_multa,valor_troco').eq('empresa_id',u.empresa_id).order('vencimento',{ascending:true,nullsFirst:false}).order('created_at',{ascending:false}).limit(limite)
  if(status)q=q.eq('status',status)
  let {data,error}=await q
  // Prévia somente leitura enquanto as colunas novas aguardam migração de homologação.
  if(error && process.env.VERCEL_ENV==='preview' && /valor_desconto|valor_juros|valor_multa|valor_troco|rh_pessoa_id/i.test(error.message)){
    let antiga=supabaseAdmin.from('financeiro_contas_pagar').select('id,nf_id,fornecedor_id,fornecedor_nome,documento,parcela,descricao,data_emissao,vencimento,valor,status,data_pagamento,valor_pago,forma_pagamento,forma_pagamento_prevista,origem,observacoes,created_at').eq('empresa_id',u.empresa_id).order('vencimento',{ascending:true,nullsFirst:false}).order('created_at',{ascending:false}).limit(limite)
    if(status)antiga=antiga.eq('status',status)
    const resultado=await antiga
    data=(resultado.data||[]).map(c=>({...c,valor_desconto:0,valor_juros:0,valor_multa:0,valor_troco:0,rh_pessoa_id:null})) as unknown as typeof data
    error=resultado.error
  }
  if(error)throw error
  const cadastroFornecedores=await supabaseAdmin.from('fornecedores').select('id,nome,cnpj_cpf,cidade,telefone').eq('empresa_id',u.empresa_id).eq('ativo',true).order('nome').limit(1500)
  if(cadastroFornecedores.error)throw cadastroFornecedores.error
  const ids=(data||[]).map(c=>c.id)
  const fornecedorIds=[...new Set((data||[]).map(c=>c.fornecedor_id).filter((id):id is string=>!!id))]
  const dadosFornecedor=new Map<string,{cnpj_cpf:string|null;cidade:string|null;telefone:string|null}>()
  for(let i=0;i<fornecedorIds.length;i+=80){
   const cadastro=await supabaseAdmin.from('fornecedores').select('id,cnpj_cpf,cidade,telefone').eq('empresa_id',u.empresa_id).in('id',fornecedorIds.slice(i,i+80))
   if(cadastro.error)throw cadastro.error
   for(const f of cadastro.data||[])dadosFornecedor.set(f.id,f)
  }
  const contas=(data||[]).map(c=>({...c,fornecedor_cnpj_cpf:dadosFornecedor.get(c.fornecedor_id||'')?.cnpj_cpf||null,fornecedor_cidade:dadosFornecedor.get(c.fornecedor_id||'')?.cidade||null}))
  const [categorias,alocacoes]=await Promise.all([
   supabaseAdmin.from('financeiro_plano_contas').select('id,codigo,nome,grupo').eq('empresa_id',u.empresa_id).eq('ativo',true).order('codigo'),
   ids.length?supabaseAdmin.from('financeiro_conta_classificacoes').select('conta_pagar_id,plano_conta_id').eq('empresa_id',u.empresa_id).in('conta_pagar_id',ids):Promise.resolve({data:[],error:null})
  ])
  if(categorias.error||alocacoes.error)throw categorias.error||alocacoes.error
  const rh=await supabaseAdmin.from('rh_pessoas').select('id,nome,tipo').eq('empresa_id',u.empresa_id).order('nome').limit(2000)
  if(rh.error && !(process.env.VERCEL_ENV==='preview' && ['42P01','PGRST205'].includes(rh.error.code||'')))throw rh.error
  return NextResponse.json({ok:true,fornecedoresCadastro:cadastroFornecedores.data||[],pessoasRH:rh.error?[]:rh.data||[],contas,categorias:categorias.data||[],classificacoes:alocacoes.data||[]})
 }catch(e){console.error(e);return NextResponse.json({error:'Não foi possível carregar Contas a Pagar.'},{status:500})}
}

export async function PATCH(req:NextRequest){
 const u=await autenticarCompras(req);if(!u)return NextResponse.json({error:'Sessão inválida.'},{status:401})
 try{
  const b=await req.json();const id=texto(b.id,80);const acao=texto(b.acao,30)
  const permissaoPorAcao:Record<string,string>={pagar:'financeiro.contas_pagar.pagar',cancelar:'financeiro.contas_pagar.cancelar',reabrir:'financeiro.contas_pagar.reabrir',vencimento:'financeiro.contas_pagar.editar'}
  const permissao=permissaoPorAcao[acao]
  if(!permissao)return NextResponse.json({error:'Ação inválida.'},{status:400})
  if(!(await pode(u,permissao,'edicao')))return NextResponse.json({error:'Sem permissão para esta ação em Contas a Pagar.'},{status:403})
  if(!id)return NextResponse.json({error:'Conta não informada.'},{status:400})
  const {data:conta,error:erroConta}=await supabaseAdmin.from('financeiro_contas_pagar').select('id,valor,status,data_pagamento').eq('id',id).eq('empresa_id',u.empresa_id).maybeSingle()
  if(erroConta)throw erroConta
  if(!conta)return NextResponse.json({error:'Conta não encontrada.'},{status:404})
  const agora=new Date().toISOString().slice(0,10)
  let patch:Record<string,unknown>={updated_at:new Date().toISOString()}
  if(acao==='pagar'){
    if(!['aberto','pendente_vencimento'].includes(conta.status))return NextResponse.json({error:'O título não está aberto para pagamento. Atualize a tela.'},{status:409})
    const formaPagamento=texto(b.formaPagamento,60)||null
    const dataPagamento=texto(b.dataPagamento,10)||agora
    if(!/^\d{4}-\d{2}-\d{2}$/.test(dataPagamento)||Number.isNaN(new Date(dataPagamento+'T12:00:00Z').getTime())){
      return NextResponse.json({error:'Data de pagamento inválida.'},{status:422})
    }
    const calculo=calcularBaixaPagar({
      valorTitulo:conta.valor,
      valorEntregue:b.valorEntregue??b.valorPago??conta.valor,
      valorDesconto:b.valorDesconto??0,
      valorJuros:b.valorJuros??0,
      valorMulta:b.valorMulta??0,
      valorTroco:b.valorTroco??0,
      formaPagamento,
    })
    if(!calculo.ok)return NextResponse.json({error:calculo.erro,calculo},{status:422})
    patch={...patch,status:'pago',data_pagamento:dataPagamento,valor_pago:calculo.valorLiquido,
      valor_desconto:calculo.valorDesconto,valor_juros:calculo.valorJuros,
      valor_multa:calculo.valorMulta,valor_troco:calculo.valorTroco,
      forma_pagamento:formaPagamento}
  }else if(acao==='cancelar')patch={...patch,status:'cancelado'}
  else if(acao==='reabrir')patch={...patch,status:'aberto',data_pagamento:null,valor_pago:null,
    valor_desconto:0,valor_juros:0,valor_multa:0,valor_troco:0}
  else if(acao==='vencimento'){
    const v=texto(b.vencimento,10)
    if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return NextResponse.json({error:'Vencimento inválido.'},{status:400})
    patch={...patch,vencimento:v,status:conta.status==='pendente_vencimento'?'aberto':conta.status}
  }
  // A prévia jamais grava baixas, reaberturas ou cancelamentos no banco em uso.
  if(process.env.VERCEL_ENV==='preview'){
    return NextResponse.json({ok:true,simulacao:true,conta:{...conta,...patch}})
  }
  const {data,error}=await supabaseAdmin.from('financeiro_contas_pagar')
    .update(patch).eq('id',id).eq('empresa_id',u.empresa_id).eq('status',conta.status)
    .select('*').maybeSingle()
  if(error)throw error
  if(!data)return NextResponse.json({error:'Título alterado por outro usuário. Atualize antes de continuar.'},{status:409})
  return NextResponse.json({ok:true,conta:data})
 }catch(e){console.error(e);return NextResponse.json({error:e instanceof Error?e.message:'Erro ao atualizar conta.'},{status:500})}
}
