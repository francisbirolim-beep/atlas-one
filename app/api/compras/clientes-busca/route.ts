import {NextRequest,NextResponse} from 'next/server'
import {autenticarCompras} from '@/lib/comprasServer'
import {obterComprasAcessos} from '@/lib/comprasPermissoesServer'
import {supabaseAdmin as db} from '@/lib/supabaseAdmin'
import {filtrosBuscaCliente,finalDocumento} from '@/lib/comprasBuscaClientes'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i
const erro=(mensagem:string,status=400)=>NextResponse.json({error:mensagem},{status})
const headers={'Cache-Control':'private, no-store','Vary':'Authorization'}
export async function GET(req:NextRequest){
 const usuario=await autenticarCompras(req)
 if(!usuario)return erro('Sessão expirada.',401)
 try{
  const a=await obterComprasAcessos(usuario)
  if(!(a.solicitar||a.consultar||a.verProprios||a.editarProprios||a.editarTodos||a.cotar||a.aprovar||a.comprar))
   return erro('Sem permissão para consultar clientes de Compras.',403)
  const empresaId=usuario.empresa_id
  const id=req.nextUrl.searchParams.get('clienteId')
  const obrasId=req.nextUrl.searchParams.get('obrasClienteId')
  if(id!==null){
   if(!uuid.test(id))return erro('Cliente inválido.')
   const {data,error}=await db.from('clientes').select('id,nome,apelido')
    .eq('empresa_id',empresaId).eq('id',id).maybeSingle()
   if(error)throw error
   if(!data)return erro('Cliente não encontrado.',404)
   return NextResponse.json({cliente:data},{headers})
  }
  if(obrasId!==null){
   if(!uuid.test(obrasId))return erro('Cliente inválido.')
   const {data:cliente,error:ec}=await db.from('clientes').select('id')
    .eq('empresa_id',empresaId).eq('id',obrasId).maybeSingle()
   if(ec)throw ec
   if(!cliente)return erro('Cliente não encontrado nesta empresa.',404)
   const {data,error}=await db.from('obras').select('id,nome,cliente_id')
    .eq('empresa_id',empresaId).eq('cliente_id',obrasId)
    .order('nome').limit(501)
   if(error)throw error
   return NextResponse.json({obras:(data||[]).slice(0,500),limiteAtingido:(data||[]).length>500},{headers})
  }
  const filtro=filtrosBuscaCliente(req.nextUrl.searchParams.get('busca'))
  if(!filtro)return NextResponse.json({clientes:[],minimo:2},{headers})
  const {data,error}=await db.from('clientes')
   .select('id,nome,apelido,telefone,whatsapp,cpf_cnpj')
   .eq('empresa_id',empresaId).eq('ativo',true)
   .or(filtro).order('nome').limit(20)
  if(error)throw error
  return NextResponse.json({clientes:(data||[]).map(c=>({
   id:c.id,nome:c.nome,apelido:c.apelido||null,
   telefoneFinal:finalDocumento(c.telefone||c.whatsapp),
   documentoFinal:finalDocumento(c.cpf_cnpj)
  }))},{headers})
 }catch(e){
  console.error('[compras clientes busca]',e)
  return erro('Não foi possível pesquisar clientes.',500)
 }
}
