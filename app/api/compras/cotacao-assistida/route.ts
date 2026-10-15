import { obterComprasAcessos } from '@/lib/comprasPermissoesServer'
import { NextRequest, NextResponse } from 'next/server'
import { autenticarCompras } from '@/lib/comprasServer'
import { supabaseAdmin as db } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const UUID=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i
const moeda=(n:unknown)=>{const v=Number(n);return Number.isFinite(v)?v:null}

export async function GET(req:NextRequest) {
 const usuario=await autenticarCompras(req)
 if(!usuario)return NextResponse.json({error:'Sessão inválida.'},{status:401})
 if (!(await obterComprasAcessos(usuario)).cotar) return NextResponse.json({error:'Sem permissão para consultar cotações de fornecedores.'},{status:403})
 const produtoId=String(req.nextUrl.searchParams.get('produtoId')||'').trim()
 if(!UUID.test(produtoId))return NextResponse.json({error:'Selecione um produto cadastrado.'},{status:400})
 try{
  const empresaId=usuario.empresa_id
  const [pr,lig,hi,fo,saldo]=await Promise.all([
   db.from('produtos').select('id,codigo,nome,unidade,foto_url').eq('empresa_id',empresaId).eq('id',produtoId).maybeSingle(),
   db.from('produto_fornecedores').select('fornecedor_id,codigo_fornecedor,preco_atual,preco_atualizado_em,preferencial')
    .eq('empresa_id',empresaId).eq('produto_id',produtoId).eq('ativo',true).limit(500),
   db.from('historico_precos_compra').select('fornecedor_id,fornecedor_nome,produto_id,data_compra,created_at,valor_unitario_nf,custo_aquisicao_unitario')
    .eq('empresa_id',empresaId).eq('produto_id',produtoId).order('data_compra',{ascending:false}).limit(500),
   db.from('fornecedores').select('id,nome,pedido_minimo,prazo_entrega_dias').eq('empresa_id',empresaId).eq('ativo',true).limit(2000),
   db.from('estoque_saldos').select('quantidade,quantidade_reservada,unidade').eq('empresa_id',empresaId).eq('produto_id',produtoId),
  ])
  for(const x of [pr,lig,hi,fo,saldo])if(x.error)throw x.error
  if(!pr.data)return NextResponse.json({error:'Produto não encontrado nesta empresa.'},{status:404})
  const mapa=new Map((fo.data||[]).map(f=>[f.id,f]))
  const porFornecedor=new Map<string,{ultimoPreco:number|null;ultimaCompra:string|null;ultimoCusto:number|null}>()
  const referenciasSemCadastro:string[]=[]
  for(const h of hi.data||[]){
   if(!h.fornecedor_id){if(h.fornecedor_nome)referenciasSemCadastro.push(h.fornecedor_nome);continue}
   if(porFornecedor.has(h.fornecedor_id))continue
   porFornecedor.set(h.fornecedor_id,{ultimoPreco:moeda(h.valor_unitario_nf),
    ultimoCusto:moeda(h.custo_aquisicao_unitario),ultimaCompra:h.data_compra||h.created_at})
  }
  const mapeados=new Map((lig.data||[]).map(v=>[v.fornecedor_id,v]))
  const ids=new Set([...mapeados.keys(),...porFornecedor.keys()])
  const fornecedores=[...ids].map(id=>{
   const f=mapa.get(id);if(!f)return null
   const vinculo=mapeados.get(id),historico=porFornecedor.get(id)
   return {id:f.id,nome:f.nome,pedidoMinimo:moeda(f.pedido_minimo)||0,prazoDias:f.prazo_entrega_dias,
    codigoFornecedor:vinculo?.codigo_fornecedor||null,preferencial:!!vinculo?.preferencial,
    precoCatalogo:moeda(vinculo?.preco_atual),precoCatalogoData:vinculo?.preco_atualizado_em||null,
    ultimoPrecoPago:historico?.ultimoPreco??null,ultimoCusto:historico?.ultimoCusto??null,
    ultimaCompra:historico?.ultimaCompra||null,
    origem:[vinculo?'catalogo':null,historico?'historico_nf':null].filter(Boolean)}
  }).filter(Boolean).sort((a,b)=>{
   const x=a!,y=b!
   return Number(y.preferencial)-Number(x.preferencial) ||
    Number(!!y.ultimaCompra)-Number(!!x.ultimaCompra) || x.nome.localeCompare(y.nome,'pt-BR')
  })
  const fisico=(saldo.data||[]).reduce((a,x)=>a+Number(x.quantidade||0),0)
  const reservado=(saldo.data||[]).reduce((a,x)=>a+Number(x.quantidade_reservada||0),0)
  return NextResponse.json({produto:pr.data,estoque:{fisico,reservado,disponivel:fisico-reservado},
   fornecedores,semFornecedorConfirmado:fornecedores.length===0,
   aviso:'Valores históricos são referências de NF, não propostas atuais. O comprador deve confirmar preço e quantidade antes de emitir pedido.'},
   {headers:{'Cache-Control':'no-store'}})
 }catch(e){
  console.error('[Compras] cotação assistida',e)
  return NextResponse.json({error:'Não foi possível consultar o histórico de fornecedores.'},{status:500})
 }
}
