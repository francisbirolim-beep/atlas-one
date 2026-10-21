import { NextRequest,NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { usuarioPodeAcaoServer } from '@/lib/acessoUsuarioServer'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const idValido=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const falhar=(error:string,status=400,code?:string)=>
  NextResponse.json({ok:false,error,code},{status,headers:{'Cache-Control':'no-store'}})

// Conciliação retroativa EXPLÍCITA. Alterações FUTURAS do valor de venda
// são tratadas pelo trigger, sempre preservando parcelas com baixas/descontos.
export async function POST(req:NextRequest){
  const usuario=await autenticarTenant(req)
  if(!usuario)return falhar('Sua sessão expirou.',401)
  const podeEditar=usuario.role==='master'||usuario.role==='admin'||
    await usuarioPodeAcaoServer({
      usuarioId:usuario.id,role:usuario.role,empresaId:usuario.empresa_id,
      setorId:'financeiro',acaoId:'financeiro.contas_receber.receber',minimo:'edicao',
    })
  if(!podeEditar)return falhar('Sem permissão para ajustar o Contas a Receber.',403)
  const body=await req.json().catch(()=>({}))
  const vendaId=typeof body.vendaId==='string'?body.vendaId:''
  const valorConfirmado=Number(body.valorConfirmado)
  if(!idValido.test(vendaId)||!Number.isFinite(valorConfirmado)||valorConfirmado<=0)
    return falhar('Venda ou valor da confirmação inválidos.')
  const {data:venda,error:erroVenda}=await supabaseAdmin.from('vendas_obras')
    .select('id,valor_venda').eq('id',vendaId).eq('empresa_id',usuario.empresa_id).maybeSingle()
  if(erroVenda)return falhar('Não foi possível consultar o valor atualizado da venda.',503)
  if(!venda)return falhar('Venda não encontrada nesta empresa.',404)
  if(Math.abs(Number(venda.valor_venda)-valorConfirmado)>.009)
    return falhar('O valor da venda mudou. Atualize a página antes de conciliar.',409,'valor_alterado')

  // Nunca grava valores financeiros a partir da prévia Vercel.
  if(process.env.VERCEL_ENV==='preview')
    return NextResponse.json({ok:true,simulado:true,mensagem:'Prévia: conciliação simulada; nenhum lançamento foi alterado.'})
  const {data,error}=await supabaseAdmin.rpc('fn_financeiro_conciliar_valor_venda_v1',{
    p_empresa:usuario.empresa_id,p_venda:vendaId,
    p_origem:'conciliacao_confirmada',p_usuario:usuario.id,
  })
  if(error){console.error('[Financeiro][Conciliação]',error.code,error.message)
    return falhar('A conciliação não foi concluída. Confira os títulos antes de tentar novamente.',500)}
  if(!data?.ok)return falhar(String(data?.motivo||'Não foi possível conciliar essa venda automaticamente.'),409,String(data?.codigo||'nao_conciliado'))
  return NextResponse.json({ok:true,simulado:false,codigo:data.codigo,totalNovo:data.totalNovo},
    {headers:{'Cache-Control':'no-store'}})
}
