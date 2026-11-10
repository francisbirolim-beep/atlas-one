import {NextRequest,NextResponse} from 'next/server'
import {autenticarTenant} from '@/lib/tenantServer'
import {supabaseAdmin as db} from '@/lib/supabaseAdmin'
import {usuarioPodeAcaoServer} from '@/lib/acessoUsuarioServer'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
const resposta=(body:unknown,status=200)=>NextResponse.json(body,{
 status,headers:{'Cache-Control':'private, no-store, max-age=0'},
})
const erro=(mensagem:string,status=400)=>resposta({ok:false,error:mensagem},status)

async function autorizado(u:{id:string;role:string;empresa_id:string}){
 return usuarioPodeAcaoServer({usuarioId:u.id,role:u.role,empresaId:u.empresa_id,
  setorId:'portal-cliente',acaoId:'clientes.portal.excluir_venda',minimo:'edicao'})
}

/** Consulta de capacidade para mostrar a ação no Cliente 360. */
export async function GET(req:NextRequest){
 const usuario=await autenticarTenant(req)
 if(!usuario)return erro('Sessão inválida.',401)
 try{return resposta({ok:true,podeExcluir:await autorizado(usuario)})}
 catch{return erro('Não foi possível conferir as permissões.',503)}
}

/**
 * Exclusão lógica auditada. Não apaga a venda do banco, o orçamento nem a obra.
 * A RPC é transacional: recusa movimentações operacionais/financeiras e cancela
 * APENAS pré-lançamentos automáticos sem pagamento.
 */
export async function POST(req:NextRequest){
 const usuario=await autenticarTenant(req)
 if(!usuario)return erro('Sessão inválida. Entre novamente.',401)
 try{
  if(!(await autorizado(usuario)))return erro('Sem permissão para excluir vendas incorretas.',403)
 }catch{return erro('Não foi possível conferir as permissões.',503)}
 // A prévia compartilha a base de dados: proibido mudar registros reais por essa URL.
 if(process.env.VERCEL_ENV==='preview')return erro('Exclusão indisponível no ambiente de prévia.',409)
 const b=await req.json().catch(()=>({})) as Record<string,unknown>
 const vendaId=String(b.vendaId||'').trim()
 const clienteId=String(b.clienteId||'').trim()
 const motivo=String(b.motivo||'').trim()
 const confirmar=String(b.confirmacao||'').trim().toUpperCase()
 if(!UUID.test(vendaId)||!UUID.test(clienteId))return erro('Venda ou cliente inválido.')
 if(motivo.length<8||motivo.length>1000)return erro('Informe um motivo entre 8 e 1000 caracteres.')
 try{
  const {data:venda,error:falhaVenda}=await db.from('vendas_obras')
   .select('id,numero,cliente_id,status,excluida_em,orcamento_id')
   .eq('id',vendaId).eq('cliente_id',clienteId).eq('empresa_id',usuario.empresa_id)
   .maybeSingle()
  if(falhaVenda)throw falhaVenda
  if(!venda)return erro('Venda não encontrada neste cliente.',404)
  if(venda.excluida_em)return erro('Esta venda já foi excluída.',409)
  if(confirmar!=='EXCLUIR '+venda.numero)
   return erro('Para confirmar, digite EXCLUIR '+venda.numero+'.')
  // Toda verificação de movimentações e a auditoria acontecem atomicamente na RPC
  // já instalada no Atlas; não usar DELETE direto nem atualizações separadas.
  const {data,error}=await db.rpc('excluir_venda_incorreta_v1',{
   p_empresa:usuario.empresa_id,p_usuario:usuario.id,p_venda:venda.id,p_motivo:motivo,
  })
  if(error){
   const msg=String(error.message||'')
   const regras=[
    'Usuário sem permissão de excluir vendas',
    'Venda concluída exige revisão administrativa',
    'Venda possui produção, cotação ou instalação vinculada',
    'Há recebimento ou movimentação financeira',
    'Há lançamento financeiro manual vinculado',
    'Venda já excluída','Venda não localizada nesta empresa',
    'Informe motivo entre 8 e 1000 caracteres',
   ]
   const regra=regras.find(t=>msg.includes(t))
   return erro(regra?msg:'Não foi possível excluir a venda com segurança. Verifique os vínculos no Financeiro e na obra.',409)
  }
  if(!data?.ok)return erro('A exclusão não foi confirmada no banco.',409)
  // Confirmar a exclusão no mesmo registro, evitando resposta de sucesso falsa.
  const {data:conferida,error:falhaConferencia}=await db.from('vendas_obras')
   .select('id,excluida_em').eq('empresa_id',usuario.empresa_id).eq('id',vendaId).maybeSingle()
  if(falhaConferencia||!conferida?.excluida_em)
   return erro('A gravação foi solicitada, mas a conferência da exclusão falhou. Atualize a lista antes de tentar novamente.',503)
  return resposta({
   ok:true,vendaId,numero:venda.numero,
   contasCanceladas:Number(data.contasCanceladas||0),
   mensagem:'Venda retirada da lista. Histórico e orçamento preservados.',
  })
 }catch(e){
  console.error('[Excluir venda incorreta] falha',e)
  return erro('Falha ao excluir a venda. Nenhum dado foi apagado diretamente.',503)
 }
}
