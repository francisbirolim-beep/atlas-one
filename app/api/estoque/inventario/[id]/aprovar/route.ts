import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarCompras } from '@/lib/comprasServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, {params}: {params: {id: string}}) {
 const usuario = await autenticarCompras(req)
 if (!usuario) return NextResponse.json({error:'Sessão inválida.'},{status:401})
 if (usuario.role !== 'master') return NextResponse.json({error:'Somente o Master pode aplicar ajustes de inventário.'},{status:403})
 try {
  const {data:inventario,error:erroConsulta} = await supabaseAdmin.from('estoque_inventarios')
   .select('id,status').eq('id',params.id).eq('empresa_id',usuario.empresa_id).maybeSingle()
  if(erroConsulta) throw erroConsulta
  if(!inventario) return NextResponse.json({error:'Inventário não encontrado.'},{status:404})
  if(inventario.status!=='rascunho') return NextResponse.json({error:'Inventário já processado. Nenhuma movimentação repetida.'},{status:409})
  const {data,error} = await supabaseAdmin.rpc('aprovar_inventario_estoque',{
   p_inventario_id:inventario.id,p_usuario_id:usuario.id,
  })
  if(error) {
   console.error('Falha transacional ao aplicar inventário:',error.message)
   return NextResponse.json({error:error.message || 'Aprovação não realizada. Nenhum ajuste deve ser aplicado.'},{status:409})
  }
  return NextResponse.json(data || {ok:true})
 } catch(e) {
  console.error('Falha na aprovação:',e)
  return NextResponse.json({error:'Falha ao aplicar inventário. Verifique e tente novamente.'},{status:500})
 }
}
