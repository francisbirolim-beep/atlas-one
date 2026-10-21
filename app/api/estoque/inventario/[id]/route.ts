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
  const ids = (itens || []).map(i => i.produto_id)
  const fotos = new Map<string,string>()
  if (ids.length) {
    const {data:imagens,error:imagensErro} = await supabaseAdmin.from('produto_imagens')
      .select('produto_id,url').eq('empresa_id',usuario.empresa_id)
      .eq('ativo',true).in('produto_id',ids)
      .order('principal',{ascending:false})
    if (imagensErro) throw imagensErro
    for (const i of imagens || []) if(i.url && !fotos.has(i.produto_id)) fotos.set(i.produto_id,i.url)
  }
  return NextResponse.json({ok:true,master:usuario.role==='master',inventario,
   itens:(itens||[]).map(item=>{
    const produto = Array.isArray(item.produto) ? item.produto[0] : item.produto
    return {...item,
      produto: produto ? { ...produto, foto_url: produto.foto_url || fotos.get(item.produto_id) || null } : null,
      custo_inicial_referencia: usuario.role==='master'?item.custo_inicial_referencia:null,
    }
   }),
  })
 } catch(e) {
  console.error('Erro ao consultar inventário:',e)
  return NextResponse.json({error:'Não foi possível consultar o inventário.'},{status:500})
 }
}
