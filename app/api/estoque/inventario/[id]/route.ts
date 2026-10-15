import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarCompras } from '@/lib/comprasServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, {params}: {params: {id: string}}) {
 const usuario = await autenticarCompras(req)
 if (!usuario) return NextResponse.json({error:'Sessão inválida.'},{status:401})
 try {
  const {data:inventario,error} = await supabaseAdmin.from('estoque_inventarios')
   .select('id,status,created_at,local_id,observacoes,criado_por_nome,aprovado_por_nome,aprovado_em,local:estoque_locais(nome,codigo)')
   .eq('id',params.id).eq('empresa_id',usuario.empresa_id).maybeSingle()
  if(error) throw error
  if(!inventario) return NextResponse.json({error:'Inventário não encontrado.'},{status:404})
  const {data:itens,error:erroItens} = await supabaseAdmin.from('estoque_inventario_itens')
   .select('id,produto_id,quantidade_contada,saldo_referencia,saldo_referencia_id,custo_inicial_referencia,quantidade_aplicada_delta,produto:produtos(codigo,nome,categoria,unidade,foto_url)')
   .eq('empresa_id',usuario.empresa_id).eq('inventario_id',inventario.id).order('created_at')
  if(erroItens) throw erroItens
  return NextResponse.json({ok:true,master:usuario.role==='master',inventario,
   itens:(itens||[]).map(item=>({
    ...item,
    custo_inicial_referencia:usuario.role==='master'?item.custo_inicial_referencia:null,
   })),
  })
 } catch(e) {
  console.error('Erro ao consultar inventário:',e)
  return NextResponse.json({error:'Não foi possível consultar o inventário.'},{status:500})
 }
}
