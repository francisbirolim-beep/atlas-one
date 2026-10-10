import { NextRequest, NextResponse } from 'next/server'
import { autenticarCompras } from '@/lib/comprasServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const categorias = ['perfil','acessorios','vidro','outros'] as const
type Categoria = typeof categorias[number]
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const erro = (msg:string,status=400)=>NextResponse.json({error:msg},{status})
const numero=(n:unknown)=>{const v=Number(n);return Number.isFinite(v)?v:0}
function categoriaMaterial(c:unknown):Categoria {
  const x=String(c||'').toLocaleLowerCase('pt-BR')
  if(x.includes('perfil'))return 'perfil'
  if(x.includes('acess'))return 'acessorios'
  if(x.includes('vidro'))return 'vidro'
  return 'outros'
}

async function carregarVenda(empresaId:string,vendaId:string) {
  const res=await supabaseAdmin.from('vendas_obras')
    .select('id,orcamento_id,cliente_id,obra_id')
    .eq('id',vendaId).eq('empresa_id',empresaId).maybeSingle()
  if(res.error)throw res.error
  return res.data
}

export async function GET(req:NextRequest) {
  const usuario=await autenticarCompras(req)
  if(!usuario)return erro('Sessão inválida.',401)
  const vendaId=req.nextUrl.searchParams.get('vendaId')||''
  const loteId=req.nextUrl.searchParams.get('loteId')||''
  if(!uuid.test(vendaId))return erro('Venda inválida.')
  try{
    const venda=await carregarVenda(usuario.empresa_id,vendaId)
    if(!venda)return erro('Venda não encontrada nesta empresa.',404)
    let consulta=supabaseAdmin.from('venda_cotacao_lotes')
      .select('id,venda_obra_id,pacote_id,categoria,status,itens,quantidade_itens,versao,gerado_por_nome,created_at,updated_at')
      .eq('empresa_id',usuario.empresa_id).eq('venda_obra_id',vendaId)
    if(loteId){
      if(!uuid.test(loteId))return erro('Cotação inválida.')
      consulta=consulta.eq('id',loteId)
    }
    const {data,error}=await consulta.order('created_at',{ascending:true})
    if(error)throw error
    return NextResponse.json({ok:true,lotes:data||[]},{headers:{'Cache-Control':'no-store'}})
  }catch(e){
    console.error('[Venda][LotesCotacao][GET]',e)
    return erro('Não foi possível consultar as listas de cotação.',500)
  }
}

export async function POST(req:NextRequest) {
  const usuario=await autenticarCompras(req)
  if(!usuario)return erro('Sessão inválida.',401)
  try{
    const body=await req.json().catch(()=>({}))
    const vendaId=String(body.vendaId||'')
    const categoria=String(body.categoria||'') as Categoria
    const reemitir=body.reemitir===true
    const ids=Array.isArray(body.materialIds)
      ? Array.from(new Set<string>(body.materialIds.map((v:unknown)=>String(v||'').trim()).filter((v:string)=>uuid.test(v))))
      : []
    if(!uuid.test(vendaId)||!categorias.includes(categoria)||ids.length>1000)
      return erro('Venda, categoria ou seleção de materiais inválida.')

    const venda=await carregarVenda(usuario.empresa_id,vendaId)
    if(!venda)return erro('Venda não encontrada nesta empresa.',404)
    const {data:pacote,error:pacoteErr}=await supabaseAdmin.from('pacotes_tecnicos')
      .select('id,status')
      .eq('empresa_id',usuario.empresa_id).eq('orcamento_id',venda.orcamento_id)
      .neq('status','substituido').order('created_at',{ascending:false}).limit(1).maybeSingle()
    if(pacoteErr)throw pacoteErr
    if(!pacote)return erro('Gere o pacote técnico antes de emitir a cotação.',409)

    const [materiaisResp,sobrasResp]=await Promise.all([
      supabaseAdmin.from('pacote_tecnico_materiais')
        .select('id,produto_id,categoria,codigo,descricao,unidade,quantidade_ajustada,quantidade_tecnica,cor_ref,comprimento_corte_mm,comprimento_barra_mm')
        .eq('empresa_id',usuario.empresa_id).eq('pacote_id',pacote.id).eq('excluido',false),
      supabaseAdmin.from('pacote_tecnico_separacoes')
        .select('material_id,tipo_origem,quantidade,status')
        .eq('empresa_id',usuario.empresa_id).eq('pacote_id',pacote.id).neq('status','cancelado'),
    ])
    if(materiaisResp.error)throw materiaisResp.error
    if(sobrasResp.error)throw sobrasResp.error
    const usados=new Map<string,number>()
    for(const s of sobrasResp.data||[]){
      if(s.tipo_origem!=='sobra_estoque'||!s.material_id)continue
      usados.set(s.material_id,(usados.get(s.material_id)||0)+Math.max(0,numero(s.quantidade)))
    }
    const itens=(materiaisResp.data||[])
      .filter(m=>categoriaMaterial(m.categoria)===categoria&&(!ids.length||ids.includes(m.id)))
      .map(m=>{
        const tecnica=Math.max(0,numero(m.quantidade_ajustada??m.quantidade_tecnica))
        const sobra=Math.min(tecnica,usados.get(m.id)||0)
        return {
          material_id:m.id,
          produto_id:m.produto_id||null,
          codigo:m.codigo||null,
          descricao:m.descricao,
          cor:m.cor_ref||null,
          unidade:m.unidade||'UN',
          quantidade_tecnica:tecnica,
          sobra_utilizada:sobra,
          quantidade_cotar:Math.max(0,tecnica-sobra),
          comprimento_corte_mm:m.comprimento_corte_mm||null,
          comprimento_barra_mm:m.comprimento_barra_mm||null,
        }
      })
      .filter(m=>m.quantidade_cotar>0)
      .sort((a,b)=>(a.codigo||a.descricao).localeCompare(b.codigo||b.descricao,'pt-BR'))
    if(!itens.length)return erro('Não há materiais desta categoria com quantidade a cotar. Confira a lista técnica e as sobras.',409)

    const {data:existente,error:existingErr}=await supabaseAdmin.from('venda_cotacao_lotes')
      .select('id,status,versao,itens,quantidade_itens')
      .eq('empresa_id',usuario.empresa_id).eq('venda_obra_id',venda.id)
      .eq('pacote_id',pacote.id).eq('categoria',categoria).maybeSingle()
    if(existingErr)throw existingErr
    if(existente&&!reemitir)return erro('Esta categoria já possui cotação. Abra o card em Compras ou confirme a reemissão para atualizar a lista.',409)
    if(existente&&existente.status!=='cotacao')return erro('A cotação já avançou no fluxo. Não é permitido substituir a lista após a compra.',409)

    let resultado:any
    if(existente){
      const {error:historicoErr}=await supabaseAdmin.from('venda_cotacao_lotes_revisoes').insert({
        empresa_id:usuario.empresa_id,lote_id:existente.id,versao:existente.versao,
        itens:existente.itens,usuario_id:usuario.id,usuario_nome:usuario.nome,
      })
      if(historicoErr)throw historicoErr
      const {data,error}=await supabaseAdmin.from('venda_cotacao_lotes').update({
        itens,quantidade_itens:itens.length,versao:existente.versao+1,
        gerado_por_id:usuario.id,gerado_por_nome:usuario.nome,updated_at:new Date().toISOString(),
      }).eq('id',existente.id).eq('empresa_id',usuario.empresa_id)
        .eq('status','cotacao').eq('versao',existente.versao).select('id,categoria,status,versao,quantidade_itens').maybeSingle()
      if(error)throw error
      if(!data)return erro('A cotação foi alterada em outra sessão. Atualize antes de emitir novamente.',409)
      resultado=data
    }else{
      const {data,error}=await supabaseAdmin.from('venda_cotacao_lotes').insert({
        empresa_id:usuario.empresa_id,venda_obra_id:venda.id,pacote_id:pacote.id,
        categoria,status:'cotacao',itens,quantidade_itens:itens.length,
        gerado_por_id:usuario.id,gerado_por_nome:usuario.nome,
      }).select('id,categoria,status,versao,quantidade_itens').single()
      if(error){
        if(error.code==='23505')return erro('A cotação já foi criada em outra sessão. Atualize a página.',409)
        throw error
      }
      resultado=data
    }
    return NextResponse.json({ok:true,lote:resultado,mensagem:'Lista técnica validada. Card de cotação gerado em Compras.'})
  }catch(e){
    console.error('[Venda][LotesCotacao][POST]',e)
    return erro('Não foi possível emitir a cotação. Nenhuma compra foi aprovada ou recebida.',500)
  }
}
