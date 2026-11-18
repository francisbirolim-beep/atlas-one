import { NextRequest, NextResponse } from 'next/server'
import { autenticarCompras } from '@/lib/comprasServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { acessoRHServer } from '@/lib/rhAcessoServer'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const competenciaValida=/^[0-9]{4}-(0[1-9]|1[0-2])$/
const texto=(valor:unknown,limite=170)=>String(valor??'').trim().slice(0,limite)
const erro=(mensagem:string,status=400)=>NextResponse.json({error:mensagem},{status})
const preview=()=>process.env.VERCEL_ENV==='preview'

async function autenticar(req:NextRequest,modo:'consulta'|'edicao'='consulta'){
 const usuario=await autenticarCompras(req)
 if(!usuario)return {error:erro('Sessão inválida.',401)}
 try{
  const acl=await acessoRHServer(usuario,'holerites')
  if(!acl.consultar||(modo==='edicao'&&!acl.editar))return {error:erro('Sem autorização para os holerites do RH.',403)}
  return {usuario,podeEditar:acl.editar}
 }catch(e){console.error('Permissão de holerites',e);return {error:erro('Não foi possível conferir a autorização de RH.',503)}}
}
function centavos(valor:unknown):number|null{
 if(valor===null||valor===undefined||valor==='')return null
 const n=Number(valor)
 if(!Number.isFinite(n)||n<0||n>999999999||Math.abs(n*100-Math.round(n*100))>0.001)return null
 return Math.round(n*100)
}
function diaValido(valor:string){
 if(!valor)return true
 if(!/^\d{4}-\d{2}-\d{2}$/.test(valor))return false
 const d=new Date(valor+'T12:00:00.000Z')
 return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===valor
}
function validar(b:any){
 const pessoaId=texto(b.rh_pessoa_id,60),competencia=texto(b.competencia,7)
 if(!uuid.test(pessoaId))return {error:'Selecione um funcionário cadastrado para salvar.'}
 if(!competenciaValida.test(competencia))return {error:'Informe a competência no formato AAAA-MM.'}
 const pagamento=texto(b.data_pagamento,10)
 if(!diaValido(pagamento))return {error:'Data de pagamento inválida.'}
 if(!Array.isArray(b.itens)||b.itens.length>60)return {error:'Informe até 60 rubricas de proventos ou descontos.'}
 let proventos=0,descontos=0
 const itens:Array<{tipo:'provento'|'desconto';descricao:string;referencia:string;valor:number}>=[]
 for(const x of b.itens){
  if(!x||!['provento','desconto'].includes(x.tipo))return {error:'Tipo de rubrica inválido.'}
  const descricao=texto(x.descricao,120),referencia=texto(x.referencia,60),valor=centavos(x.valor)
  if(descricao.length<2||valor===null)return {error:'Cada rubrica precisa de descrição e valor válido.'}
  if(x.tipo==='provento')proventos+=valor
  else descontos+=valor
  itens.push({tipo:x.tipo,descricao,referencia,valor:valor/100})
 }
 const liquido=proventos-descontos
 if(liquido<0)return {error:'O total de descontos não pode ultrapassar os proventos.'}
 const salarioBase=b.salario_base===''||b.salario_base==null?null:centavos(b.salario_base)
 if(salarioBase===null&&b.salario_base!==''&&b.salario_base!=null)return {error:'Salário base inválido.'}
 const situacao=texto(b.situacao,15)
 if(!['rascunho','emitido'].includes(situacao))return {error:'Situação inválida.'}
 if(situacao==='emitido'&&(!b.conferido||!itens.length||proventos===0))return {error:'Confira os valores e confirme a emissão antes de finalizar.'}
 return {dados:{
  rh_pessoa_id:pessoaId,competencia,
  empresa_nome:texto(b.empresa_nome,180),
  empresa_documento:texto(b.empresa_documento,30)||null,
  cargo_funcionario:texto(b.cargo_funcionario,120)||null,
  setor_funcionario:texto(b.setor_funcionario,120)||null,
  salario_base:salarioBase===null?null:salarioBase/100,
  data_pagamento:pagamento||null,
  itens,total_proventos:proventos/100,total_descontos:descontos/100,valor_liquido:liquido/100,
  observacoes:texto(b.observacoes,1000)||null,situacao
 }}
}
async function pessoaDaEmpresa(empresaId:string,pessoaId:string){
 return supabaseAdmin.from('rh_pessoas').select('id,nome,cpf_cnpj,cargo,setor,salario_base')
  .eq('empresa_id',empresaId).eq('id',pessoaId).eq('tipo','funcionario').maybeSingle()
}
export async function GET(req:NextRequest){
 const auth=await autenticar(req);if(auth.error)return auth.error
 const u=auth.usuario!
 try{
  const [pessoas,holerites]=await Promise.all([
   supabaseAdmin.from('rh_pessoas').select('id,nome,cpf_cnpj,cargo,setor,salario_base,ativo').eq('empresa_id',u.empresa_id).eq('tipo','funcionario').order('nome').limit(2000),
   supabaseAdmin.from('rh_holerites').select('id,rh_pessoa_id,competencia,empresa_nome,empresa_documento,nome_funcionario,cpf_funcionario,cargo_funcionario,setor_funcionario,salario_base,data_pagamento,itens,total_proventos,total_descontos,valor_liquido,observacoes,situacao,created_at,emitido_em').eq('empresa_id',u.empresa_id).order('created_at',{ascending:false}).limit(500)
  ])
  if(pessoas.error||holerites.error){
   if(preview()&&[pessoas.error,holerites.error].filter(Boolean).every(e=>['42P01','PGRST205','42703'].includes(e!.code||''))){
    return NextResponse.json({ok:true,pessoas:pessoas.data||[],holerites:holerites.data||[],simulacao:true},{headers:{'Cache-Control':'private, no-store'}})
   }
   throw pessoas.error||holerites.error
  }
  return NextResponse.json({ok:true,podeEditar:auth.podeEditar,pessoas:pessoas.data||[],holerites:holerites.data||[]},{headers:{'Cache-Control':'private, no-store'}})
 }catch(e){console.error('RH holerites GET',e);return erro('Não foi possível consultar os holerites.',500)}
}
export async function POST(req:NextRequest){
 const auth=await autenticar(req,'edicao');if(auth.error)return auth.error
 if(preview())return erro('Prévia sem gravação: use banco isolado para homologar.',423)
 const u=auth.usuario!
 try{
  const b=await req.json(),validado=validar(b)
  if('error' in validado)return erro(validado.error!)
  const {data:pessoa,error:erroPessoa}=await pessoaDaEmpresa(u.empresa_id,validado.dados!.rh_pessoa_id)
  if(erroPessoa)throw erroPessoa
  if(!pessoa)return erro('Funcionário não encontrado na empresa.',404)
  const {data,error}=await supabaseAdmin.from('rh_holerites').insert({
   ...validado.dados,nome_funcionario:pessoa.nome,cpf_funcionario:pessoa.cpf_cnpj||null,
   empresa_id:u.empresa_id,criado_por_id:u.id,criado_por_nome:u.nome,
   emitido_em:validado.dados!.situacao==='emitido'?new Date().toISOString():null
  }).select('id').single()
  if(error)throw error
  return NextResponse.json({ok:true,id:data.id},{status:201})
 }catch(e){console.error('RH holerites POST',e);return erro('Falha ao salvar holerite.',500)}
}
export async function PATCH(req:NextRequest){
 const auth=await autenticar(req,'edicao');if(auth.error)return auth.error
 if(preview())return erro('Prévia sem gravação: use banco isolado para homologar.',423)
 const u=auth.usuario!
 try{
  const b=await req.json(),id=texto(b.id,60)
  if(!uuid.test(id))return erro('Identificação inválida.')
  const {data:atual,error:erroAtual}=await supabaseAdmin.from('rh_holerites').select('id,situacao')
   .eq('empresa_id',u.empresa_id).eq('id',id).maybeSingle()
  if(erroAtual)throw erroAtual
  if(!atual)return erro('Holerite não encontrado.',404)
  if(atual.situacao==='emitido')return erro('Holerite emitido é imutável; crie outro para correção.',409)
  const validado=validar(b)
  if('error' in validado)return erro(validado.error!)
  const {data:pessoa,error:erroPessoa}=await pessoaDaEmpresa(u.empresa_id,validado.dados!.rh_pessoa_id)
  if(erroPessoa)throw erroPessoa
  if(!pessoa)return erro('Funcionário não encontrado na empresa.',404)
  const {data,error}=await supabaseAdmin.from('rh_holerites').update({
   ...validado.dados,nome_funcionario:pessoa.nome,cpf_funcionario:pessoa.cpf_cnpj||null,
   emitido_em:validado.dados!.situacao==='emitido'?new Date().toISOString():null,
   updated_at:new Date().toISOString()
  }).eq('empresa_id',u.empresa_id).eq('id',id).eq('situacao','rascunho').select('id').maybeSingle()
  if(error)throw error
  if(!data)return erro('Holerite alterado por outra operação; atualize a lista.',409)
  return NextResponse.json({ok:true,id:data.id})
 }catch(e){console.error('RH holerites PATCH',e);return erro('Falha ao atualizar holerite.',500)}
}
