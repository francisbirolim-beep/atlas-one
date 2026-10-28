import {NextRequest,NextResponse} from 'next/server'
import {autenticarTenant} from '@/lib/tenantServer'
import {supabaseAdmin} from '@/lib/supabaseAdmin'

export const runtime='nodejs'
export const dynamic='force-dynamic'

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const erro=(mensagem:string,status=400)=>NextResponse.json({error:mensagem},{status,headers:{'Cache-Control':'no-store'}})

export async function POST(req:NextRequest){
 const usuario=await autenticarTenant(req)
 if(!usuario)return erro('Sessão inválida.',401)
 if(usuario.role!=='master')return erro('Somente o Master pode excluir uma venda.',403)
 if(process.env.VERCEL_ENV==='preview')return erro('Prévia somente leitura. Exclusão indisponível.',409)
 const body=await req.json().catch(()=>({}))
 const vendaId=String(body?.vendaId||'')
 const clienteId=String(body?.clienteId||'')
 const motivo=String(body?.motivo||'').trim()
 if(!uuid.test(vendaId)||!uuid.test(clienteId))return erro('Venda ou cliente inválido.')
 if(motivo.length<8||motivo.length>1000)return erro('Informe um motivo de 8 a 1000 caracteres.')
 if(body?.confirmar!==true)return erro('Confirme a exclusão individual da venda.')
 try{
   const {data:venda,error:consultaErro}=await supabaseAdmin.from('vendas_obras')
    .select('id,cliente_id,excluida_em')
    .eq('empresa_id',usuario.empresa_id).eq('cliente_id',clienteId)
    .eq('id',vendaId).maybeSingle()
   if(consultaErro)throw consultaErro
   if(!venda)return erro('Venda não encontrada para esta cliente.',404)
   if(venda.excluida_em)return erro('Venda já excluída.',409)
   const {data,error:rpcErro}=await supabaseAdmin.rpc('excluir_venda_incorreta_v1',{
     p_empresa:usuario.empresa_id,p_usuario:usuario.id,p_venda:vendaId,p_motivo:motivo,
   })
   if(rpcErro){
    const msg=String(rpcErro.message||'')
    if(/recebimento|movimenta|produção|cotação|instalação|concluída|excluída|master|motivo/i.test(msg))
      return erro(msg,409)
    console.error('[Venda][Excluir] Falha na rotina auditada:',rpcErro)
    return erro('Não foi possível excluir esta venda. Nenhum registro foi apagado.',500)
   }
   return NextResponse.json({ok:true,resultado:data,mensagem:'Venda retirada com auditoria. Outras vendas preservadas.'},
    {headers:{'Cache-Control':'no-store'}})
 }catch(e){
   console.error('[Venda][Excluir] Erro inesperado:',e)
   return erro('Falha ao excluir a venda. Confira os registros antes de repetir.',500)
 }
}
