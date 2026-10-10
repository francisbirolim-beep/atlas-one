import {NextRequest,NextResponse} from 'next/server'
import {autenticarTenant} from '@/lib/tenantServer'
import {supabaseAdmin} from '@/lib/supabaseAdmin'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const error=(message:string,status=400)=>NextResponse.json({error:message},{status})

export async function GET(req:NextRequest){
  const usuario=await autenticarTenant(req)
  if(!usuario)return error('Sessão inválida.',401)
  const vendaId=String(req.nextUrl.searchParams.get('vendaId')||'')
  if(!uuid.test(vendaId))return error('Venda inválida.')
  const {data:venda, error:erroVenda}=await supabaseAdmin.from('vendas_obras')
    .select('id,cliente_id,obra_id,orcamento_id').eq('empresa_id',usuario.empresa_id)
    .eq('id',vendaId).maybeSingle()
  if(erroVenda)return error('Não foi possível consultar a venda.',500)
  if(!venda)return error('Venda não localizada.',404)
  const {data:obras,error:erroObras}=await supabaseAdmin.from('obras')
    .select('id,numero,nome,cidade,status,created_at').eq('empresa_id',usuario.empresa_id)
    .eq('cliente_id',venda.cliente_id).order('created_at',{ascending:false})
  if(erroObras)return error('Não foi possível carregar obras do cliente.',500)
  return NextResponse.json({ok:true,vendaId:venda.id,obraAtualId:venda.obra_id,obras:obras||[]})
}

export async function POST(req:NextRequest){
  const usuario=await autenticarTenant(req)
  if(!usuario)return error('Sessão inválida.',401)
  if(usuario.role!=='master')return error('Vincular obra à venda exige autorização do Master.',403)
  const body=await req.json().catch(()=>({}))
  const vendaId=String(body?.vendaId||'')
  const obraId=body?.obraId==null?null:String(body.obraId)
  const nome=body?.nomeNovaObra==null?null:String(body.nomeNovaObra).trim()
  const cidade=body?.cidade==null?null:String(body.cidade).trim()
  if(!uuid.test(vendaId)||obraId!=null&&!uuid.test(obraId))return error('Venda ou obra inválida.')
  if((obraId===null)===(nome===null||nome===''))return error('Selecione obra existente ou informe uma nova obra.')
  if(nome&&(nome.length<3||nome.length>150))return error('Nome da obra deve ter de 3 a 150 caracteres.')
  if(cidade&&cidade.length>150)return error('Cidade deve ter até 150 caracteres.')
  if(body?.confirmar!==true)return error('Confirme explicitamente o vínculo desta venda.')
  try{
    const {data,error:erroRpc}=await supabaseAdmin.rpc('fn_vincular_venda_obra_segura_v1',{
      p_empresa_id:usuario.empresa_id,
      p_venda_id:vendaId,
      p_obra_id:obraId,
      p_nome_nova_obra:nome,
      p_cidade:cidade,
      p_usuario_id:usuario.id,
      p_usuario_nome:usuario.nome,
    })
    if(erroRpc){
      const msg=String(erroRpc.message||'')
      return error(msg||'Não foi possível vincular esta obra. Confira os dados.',409)
    }
    return NextResponse.json({ok:true,obraId:data,mensagem:'Venda, orçamento e registros operacionais vinculados à obra com segurança.'})
  }catch(e){
    console.error('[Venda][Vincular obra]',e)
    return error('Falha ao vincular a obra. Consulte os registros antes de repetir.',500)
  }
}
