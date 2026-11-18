import { NextRequest, NextResponse } from 'next/server'
import { autenticarCompras } from '@/lib/comprasServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const tipos = ['funcionario','prestador','terceiro','fornecedor'] as const
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const texto = (v:unknown,max=200) => String(v??'').trim().slice(0,max)
const erro = (m:string,status=400) => NextResponse.json({error:m},{status})
const preview = () => process.env.VERCEL_ENV === 'preview'

async function master(req:NextRequest) {
 const u=await autenticarCompras(req)
 if(!u)return {error:erro('Sessão inválida.',401)}
 if(u.role!=='master')return {error:erro('Cadastro completo de RH restrito ao Master.',403)}
 return {u}
}

function campos(b:any) {
 const nome=texto(b.nome,170)
 const tipo=texto(b.tipo,20)
 const cpf_cnpj=texto(b.cpf_cnpj,30)
 const email=texto(b.email,160)
 if(nome.length<3)return {error:'Informe nome ou razão social com pelo menos 3 caracteres.'}
 if(!tipos.includes(tipo as typeof tipos[number]))return {error:'Selecione funcionário, prestador, terceiro ou fornecedor.'}
 if(cpf_cnpj && ![11,14].includes(cpf_cnpj.replace(/\D/g,'').length))return {error:'CPF/CNPJ deve conter 11 ou 14 dígitos quando informado.'}
 if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return {error:'E-mail inválido.'}
 const salario=b.salario_base==null||String(b.salario_base).trim()===''?null:Number(b.salario_base)
 if(salario!==null && (!Number.isFinite(salario)||salario<0||Math.abs(Math.round(salario*100)-salario*100)>0.001))return {error:'Salário base inválido.'}
 const data=texto(b.data_admissao,10)
 if(data){
  const date=new Date(data+'T12:00:00Z')
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data)||Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==data)return {error:'Data de admissão inválida.'}
 }
 return {dados:{nome,tipo,cpf_cnpj:cpf_cnpj||null,telefone:texto(b.telefone,30)||null,
  email:email||null,endereco:texto(b.endereco,250)||null,cargo:texto(b.cargo,120)||null,
  setor:texto(b.setor,100)||null,data_admissao:data||null,salario_base:salario,
  observacoes:texto(b.observacoes,1000)||null,ativo:b.ativo!==false}}
}
export async function GET(req:NextRequest) {
 const auth=await master(req);if(auth.error)return auth.error
 const u=auth.u!
 const {data,error}=await supabaseAdmin.from('rh_pessoas')
  .select('id,nome,tipo,cpf_cnpj,telefone,email,endereco,cargo,setor,data_admissao,salario_base,observacoes,ativo,created_at')
  .eq('empresa_id',u.empresa_id).order('nome',{ascending:true}).limit(2000)
 if(error && preview() && ['42P01','PGRST205'].includes(error.code||'')){
  return NextResponse.json({ok:true,pessoas:[],simulacao:true},{headers:{'Cache-Control':'private, no-store'}})
 }
 if(error){console.error('RH GET',error);return erro('Não foi possível carregar o cadastro de RH.',500)}
 return NextResponse.json({ok:true,pessoas:data||[]},{headers:{'Cache-Control':'private, no-store'}})
}
export async function POST(req:NextRequest) {
 const auth=await master(req);if(auth.error)return auth.error
 if(preview())return erro('Homologação somente leitura: nada foi gravado.',423)
 const u=auth.u!
 try {
  const b=await req.json(),v=campos(b)
  if('error' in v)return erro(v.error!)
  const dados=v.dados!
  const duplicadas=await supabaseAdmin.from('rh_pessoas').select('id,nome,tipo,cpf_cnpj')
   .eq('empresa_id',u.empresa_id).ilike('nome',dados.nome).eq('tipo',dados.tipo).limit(10)
  if(duplicadas.error)throw duplicadas.error
  if(duplicadas.data?.some(p=>p.nome.toLocaleLowerCase('pt-BR')===dados.nome.toLocaleLowerCase('pt-BR')))
   return erro('Já existe uma pessoa com este nome e tipo. Pesquise antes de criar outro cadastro.',409)
  const {data,error}=await supabaseAdmin.from('rh_pessoas')
   .insert({...dados,empresa_id:u.empresa_id,criado_por_id:u.id,criado_por_nome:u.nome})
   .select('id,nome,tipo').single()
  if(error){if(error.code==='23505')return erro('CPF/CNPJ já cadastrado no RH.',409);throw error}
  return NextResponse.json({ok:true,pessoa:data},{status:201})
 }catch(e){console.error('RH POST',e);return erro('Falha ao cadastrar pessoa no RH.',500)}
}
export async function PATCH(req:NextRequest) {
 const auth=await master(req);if(auth.error)return auth.error
 if(preview())return erro('Homologação somente leitura: nada foi gravado.',423)
 const u=auth.u!
 try {
  const b=await req.json(),id=texto(b.id,60)
  if(!uuid.test(id))return erro('Identificação inválida.')
  const v=campos(b)
  if('error' in v)return erro(v.error!)
  const {data,error}=await supabaseAdmin.from('rh_pessoas').update({...v.dados,updated_at:new Date().toISOString()})
   .eq('empresa_id',u.empresa_id).eq('id',id).select('id,nome,tipo').maybeSingle()
  if(error){if(error.code==='23505')return erro('CPF/CNPJ já cadastrado no RH.',409);throw error}
  if(!data)return erro('Pessoa não encontrada nesta empresa.',404)
  return NextResponse.json({ok:true,pessoa:data})
 }catch(e){console.error('RH PATCH',e);return erro('Falha ao atualizar pessoa.',500)}
}
