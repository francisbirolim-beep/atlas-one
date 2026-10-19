import {NextRequest,NextResponse} from 'next/server'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import {autenticarCompras} from '@/lib/comprasServer'
import {usuarioPodeAcaoServer} from '@/lib/acessoUsuarioServer'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const uid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const dataOK=(v:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T12:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===v}
const erro=(m:string,s=400)=>NextResponse.json({error:m},{status:s})
const str=(v:unknown,n=200)=>String(v??'').trim().slice(0,n)
export async function POST(req:NextRequest){
 const u=await autenticarCompras(req)
 if(!u)return erro('Sessão inválida.',401)
 try{
  const b=await req.json(),tipo=b.tipo==='pagar'?'pagar':b.tipo==='receber'?'receber':null
  if(!tipo)return erro('Tipo de título inválido.')
  const acao=tipo==='pagar'?'financeiro.contas_pagar.cadastrar':'financeiro.contas_receber.cadastrar'
  if(!(await usuarioPodeAcaoServer({usuarioId:u.id,role:u.role,empresaId:u.empresa_id,setorId:tipo==='pagar'?'financeiro':'caixa-balcao',acaoId:acao,minimo:'edicao'})))return erro('Sem permissão para cadastrar este título.',403)
  const pessoaId=str(b.pessoaId,40),documento=str(b.documento,100),descricao=str(b.descricao,500),forma=str(b.forma,60),obraId=str(b.obraId,40)
  if(!uid.test(pessoaId))return erro('Selecione um fornecedor ou cliente cadastrado.')
  if(!documento&&!descricao)return erro('Informe documento ou descrição do lançamento.')
  if(!Array.isArray(b.parcelas)||b.parcelas.length<1||b.parcelas.length>48)return erro('Informe entre 1 e 48 parcelas.')
  const parcelas=b.parcelas.map((p:any)=>({valor:Number(p.valor),vencimento:str(p.vencimento,10)}))
  if(parcelas.some((p:any)=>!dataOK(p.vencimento)||!Number.isFinite(p.valor)||p.valor<=0||p.valor>100000000||Math.abs(p.valor*100-Math.round(p.valor*100))>0.001))return erro('Confira os valores e vencimentos de cada parcela.')
  const total=parcelas.reduce((s:number,p:any)=>s+Math.round(p.valor*100),0)/100
  if(total>100000000)return erro('Valor acima do limite aceito.')
  const tabela=tipo==='pagar'?'fornecedores':'clientes'
  const {data:pessoa,error:ePessoa}=await supabaseAdmin.from(tabela).select('id,nome').eq('id',pessoaId).eq('empresa_id',u.empresa_id).maybeSingle()
  if(ePessoa)throw ePessoa
  if(!pessoa)return erro('Cadastro não encontrado nesta empresa.',404)
  if(obraId){
   if(tipo!=='receber'||!uid.test(obraId))return erro('Obra inválida.')
   const {data:obra}=await supabaseAdmin.from('obras').select('id').eq('id',obraId).eq('cliente_id',pessoaId).eq('empresa_id',u.empresa_id).maybeSingle()
   if(!obra)return erro('Obra não pertence ao cliente selecionado.',400)
  }
  let planoId=''
  if(tipo==='pagar'){
   planoId=str(b.planoContaId,40)
   if(!uid.test(planoId))return erro('Selecione a categoria do plano de contas para o DRE.')
   const {data:plano}=await supabaseAdmin.from('financeiro_plano_contas').select('id').eq('id',planoId).eq('empresa_id',u.empresa_id).eq('ativo',true).maybeSingle()
   if(!plano)return erro('Categoria financeira inválida.',400)
  }
  // Evita cadastrar o mesmo documento manual duas vezes para a mesma pessoa.
  if(documento){
   let duplicados=supabaseAdmin.from(tipo==='pagar'?'financeiro_contas_pagar':'financeiro_contas_receber').select('id').eq('empresa_id',u.empresa_id).eq('documento',documento).eq(tipo==='pagar'?'fornecedor_id':'cliente_id',pessoaId).limit(1)
   if(tipo==='pagar')duplicados=duplicados.eq('origem','manual_financeiro')
   const {data:ja}=await duplicados
   if(ja?.length)return erro('Já existe lançamento manual com este documento para este cadastro. Confira antes de duplicar.',409)
  }
  const emissao=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
  const linhas=parcelas.map((p:any,i:number)=>tipo==='pagar'?{
   empresa_id:u.empresa_id,fornecedor_id:pessoa.id,fornecedor_nome:pessoa.nome,documento:documento||null,descricao:descricao||null,
   parcela:(i+1)+'/'+parcelas.length,data_emissao:emissao,vencimento:p.vencimento,valor:p.valor,status:'aberto',
   forma_pagamento_prevista:forma||null,origem:'manual_financeiro',criado_por_id:u.id,criado_por_nome:u.nome
  }:{
   empresa_id:u.empresa_id,cliente_id:pessoa.id,cliente_nome:pessoa.nome,obra_id:obraId||null,
   documento:documento||null,parcela:i+1,total_parcelas:parcelas.length,data_emissao:emissao,
   vencimento:p.vencimento,valor:p.valor,status:'aberto',forma:forma||null,observacoes:descricao||null,
   criado_por_id:u.id,criado_por_nome:u.nome
  })
  const tabelaTitulo=tipo==='pagar'?'financeiro_contas_pagar':'financeiro_contas_receber'
  const {data:criados,error:eCriar}=await supabaseAdmin.from(tabelaTitulo).insert(linhas).select('id')
  if(eCriar)throw eCriar
  const ids=(criados||[]).map(x=>x.id)
  if(tipo==='pagar'){
   const classificacoes=ids.map((id:string)=>({empresa_id:u.empresa_id,conta_pagar_id:id,plano_conta_id:planoId,classificado_por_id:u.id,classificado_por_nome:u.nome}))
   const {error:eClass}=await supabaseAdmin.from('financeiro_conta_classificacoes').insert(classificacoes)
   if(eClass){await supabaseAdmin.from('financeiro_contas_pagar').delete().eq('empresa_id',u.empresa_id).in('id',ids);throw new Error('Falha na classificação gerencial; os títulos foram revertidos: '+eClass.message)}
  }
  return NextResponse.json({ok:true,ids,parcelas:ids.length,total})
 }catch(e){console.error('Lançamento manual financeiro:',e);return erro(e instanceof Error?e.message:'Falha ao registrar lançamento.',500)}
}
