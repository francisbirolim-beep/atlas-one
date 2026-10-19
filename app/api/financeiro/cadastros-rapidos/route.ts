import {NextRequest,NextResponse} from 'next/server'
import {autenticarCompras} from '@/lib/comprasServer'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import {usuarioPodeAcaoServer} from '@/lib/acessoUsuarioServer'
import type {GrupoConta} from '@/lib/financeiroPlanoContas'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const erro=(m:string,s=400)=>NextResponse.json({error:m},{status:s})
async function autorizado(u:any,acao:string,minimo:'consulta'|'edicao'='consulta'){return usuarioPodeAcaoServer({usuarioId:u.id,role:u.role,empresaId:u.empresa_id,setorId:'financeiro',acaoId:acao,minimo})}
export async function GET(req:NextRequest){
 const u=await autenticarCompras(req);if(!u)return erro('Sessão inválida.',401)
 const [ap,ar]=await Promise.all([autorizado(u,'financeiro.contas_pagar.consultar'),autorizado(u,'financeiro.contas_receber.consultar')])
 if(!ap&&!ar)return erro('Sem permissão para consultar cadastros financeiros.',403)
 const clienteId=req.nextUrl.searchParams.get('clienteId')||''
 const [fornecedores,clientes,planos,obras]=await Promise.all([
  ap?supabaseAdmin.from('fornecedores').select('id,nome').eq('empresa_id',u.empresa_id).eq('ativo',true).order('nome').limit(500):Promise.resolve({data:[],error:null}),
  ar?supabaseAdmin.from('clientes').select('id,nome').eq('empresa_id',u.empresa_id).order('nome').limit(700):Promise.resolve({data:[],error:null}),
  ap?supabaseAdmin.from('financeiro_plano_contas').select('id,codigo,nome,grupo').eq('empresa_id',u.empresa_id).eq('ativo',true).order('codigo').limit(500):Promise.resolve({data:[],error:null}),
  ar&&/^[0-9a-f-]{36}$/i.test(clienteId)?supabaseAdmin.from('obras').select('id,nome').eq('empresa_id',u.empresa_id).eq('cliente_id',clienteId).order('nome').limit(200):Promise.resolve({data:[],error:null})
 ])
 if(fornecedores.error||clientes.error||planos.error||obras.error)return erro('Falha ao carregar cadastros financeiros. Confira acesso ao plano de contas.',500)
 return NextResponse.json({fornecedores:fornecedores.data||[],clientes:clientes.data||[],planos:planos.data||[],obras:obras.data||[]})
}
export async function POST(req:NextRequest){
 const u=await autenticarCompras(req);if(!u)return erro('Sessão inválida.',401)
 if(!(await autorizado(u,'financeiro.contas_pagar.cadastrar','edicao')))return erro('Sem permissão de cadastro financeiro.',403)
 try{
  const b=await req.json(),tipo=String(b.tipo||'')
  const nome=String(b.nome||'').trim().slice(0,180)
  if(nome.length<3)return erro('Informe um nome com pelo menos 3 caracteres.')
  if(tipo==='fornecedor'){
   const {data:existentes,error:e}=await supabaseAdmin.from('fornecedores').select('id,nome').eq('empresa_id',u.empresa_id).ilike('nome',nome).limit(1)
   if(e)throw e
   if(existentes?.length)return NextResponse.json({ok:true,cadastro:existentes[0],existente:true})
   const {data,error}=await supabaseAdmin.from('fornecedores').insert({empresa_id:u.empresa_id,nome,ativo:true,criado_por_id:u.id,criado_por_nome:u.nome}).select('id,nome').single()
   if(error)throw error
   return NextResponse.json({ok:true,cadastro:data})
  }
  if(tipo==='categoria'){
   const grupo=String(b.grupo||'') as GrupoConta
   if(!['receita','cmv','tributo','despesa_operacional','despesa_financeira','estoque','investimento','transferencia'].includes(grupo))return erro('Grupo do DRE inválido.')
   const {data:existentes}=await supabaseAdmin.from('financeiro_plano_contas').select('id,nome').eq('empresa_id',u.empresa_id).eq('grupo',grupo).ilike('nome',nome).limit(1)
   if(existentes?.length)return NextResponse.json({ok:true,cadastro:existentes[0],existente:true})
   const codigo='8.'+crypto.randomUUID().slice(0,8).toUpperCase()
   const {data,error}=await supabaseAdmin.from('financeiro_plano_contas').insert({empresa_id:u.empresa_id,nome,grupo,codigo,ativo:true}).select('id,codigo,nome,grupo').single()
   if(error)throw error
   return NextResponse.json({ok:true,cadastro:data})
  }
  return erro('Cadastro inválido.')
 }catch(e){console.error(e);return erro('Não foi possível criar cadastro financeiro.',500)}
}
