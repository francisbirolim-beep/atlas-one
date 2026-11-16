import { NextRequest, NextResponse } from 'next/server'
import { autenticarBalcao } from '@/lib/balcaoServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime='nodejs'
export const dynamic='force-dynamic'

// Prévia de consulta. Nenhuma mutação de custos, cores ou precificação oficial.
export async function GET(req:NextRequest){
  const usuario=await autenticarBalcao(req,'venda-balcao','consulta')
  if(!usuario||usuario.role!=='master')
    return NextResponse.json({error:'Prévia restrita ao perfil Master.'},{status:403})
  try{
    const [config,cores]=await Promise.all([
      supabaseAdmin.from('configuracoes_precificacao').select('valor')
        .eq('empresa_id',usuario.empresa_id).eq('chave','preco_kg_aluminio').maybeSingle(),
      supabaseAdmin.from('cores').select('id,nome,ativo,adicional_kg,pintura')
        .eq('ativo',true).order('nome',{ascending:true}).limit(500),
    ])
    if(config.error||cores.error)throw config.error||cores.error
    // Zero/nulo no alumínio natural significa preço pendente para orçamento.
    const bruto=config.data?.valor==null?null:Number(config.data.valor)
    const natural=bruto!=null&&Number.isFinite(bruto)&&bruto>0?bruto:null
    return NextResponse.json({
      natural,cores:(cores.data||[]).map(c=>({
        id:c.id,nome:c.nome,ativo:c.ativo,pintura:c.pintura,
        adicionalKg:c.adicional_kg==null?null:Number(c.adicional_kg),
      })),somenteLeitura:true,
    },{headers:{'Cache-Control':'no-store'}})
  }catch(e){
    console.error('Erro na consulta de preços do alumínio para prévia:',e)
    return NextResponse.json({error:'Não foi possível carregar a precificação do alumínio.'},{status:500})
  }
}
