import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarCompras, limiteSeguro } from '@/lib/comprasServer'

export const runtime='nodejs'
export const dynamic='force-dynamic'

export async function GET(req:NextRequest){
  const usuario=await autenticarCompras(req)
  if(!usuario)return NextResponse.json({error:'Sessão inválida.'},{status:401})
  try{
    const q=(req.nextUrl.searchParams.get('q')||'').trim().toUpperCase()
    const limite=limiteSeguro(req.nextUrl.searchParams.get('limit'),500,1000)
    const {data,error}=await supabaseAdmin
      .from('estoque_saldos')
      .select('id,produto_id,local_id,endereco_id,unidade,quantidade,quantidade_reservada,custo_medio,valor_estoque,updated_at,produto:produtos(id,codigo,nome,categoria),local:estoque_locais(id,codigo,nome,tipo,permite_venda,unidade:unidades_operacionais(id,codigo,nome,tipo,cidade)),endereco:estoque_enderecos(id,codigo,zona,corredor,estante,prateleira,caixa,descricao)')
      .eq('empresa_id',usuario.empresa_id)
      .order('updated_at',{ascending:false}).limit(limite)
    if(error)throw error
    let saldos=(data||[]) as any[]
    if(q)saldos=saldos.filter(s=>[s.produto?.codigo,s.produto?.nome,s.local?.nome,s.local?.unidade?.nome,s.endereco?.codigo,s.endereco?.corredor,s.endereco?.prateleira,s.endereco?.caixa].some(v=>String(v||'').toUpperCase().includes(q)))
    saldos=saldos.map(s=>({...s,quantidade_disponivel:Math.max(0,Number(s.quantidade||0)-Number(s.quantidade_reservada||0))}))
    const {data:movimentos}=await supabaseAdmin
      .from('estoque_movimentos')
      .select('id,produto_id,tipo,quantidade,unidade,custo_unitario,valor_total,origem_tipo,local_origem_id,local_destino_id,nf_id,recebimento_id,criado_por_nome,created_at')
      .eq('empresa_id',usuario.empresa_id)
      .order('created_at',{ascending:false}).limit(100)
    const {data:unidades}=await supabaseAdmin
      .from('unidades_operacionais')
      .select('id,codigo,nome,tipo,cidade,ativo')
      .eq('empresa_id',usuario.empresa_id)
      .eq('ativo',true)
      .order('nome')
    return NextResponse.json({ok:true,saldos,movimentos:movimentos||[],unidades:unidades||[]})
  }catch(e){console.error('Erro estoque',e);return NextResponse.json({error:'Não foi possível carregar o estoque.'},{status:500})}
}
