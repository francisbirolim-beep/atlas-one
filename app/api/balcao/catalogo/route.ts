import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarBalcao, nivelBalcaoUsuario } from '@/lib/balcaoServer'
import { correspondeBuscaAtlas } from '@/lib/buscaAtlas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type LinhaRede = {
  produto_id: string; local_id: string; unidade_id: string; unidade_codigo: string; unidade_nome: string;
  local_codigo: string; local_nome: string; unidade: string | null;
  quantidade_fisica: number | string | null; quantidade_reservada: number | string | null;
  quantidade_disponivel: number | string | null; custo_medio: number | string | null
}

type ProdutoCatalogo = {
  id: string; codigo: string | null; nome: string; descricao: string | null; categoria: string | null;
  unidade: string | null; custo: number | string | null; preco: number | string | null;
  margem_percentual: number | string | null; preco_minimo: number | string | null;
  preco_promocional: number | string | null; foto_url: string | null; ativo: boolean
}

type ClienteCatalogo = {
  id: string; nome: string; apelido: string | null; cpf_cnpj: string | null; telefone: string | null;
  whatsapp: string | null; email: string | null; cidade: string | null; bairro: string | null;
  endereco: string | null; cep: string | null
}

const CAMPOS_PRODUTO = 'id,codigo,nome,descricao,categoria,unidade,custo,preco,margem_percentual,preco_minimo,preco_promocional,foto_url,ativo'
const CAMPOS_CLIENTE = 'id,nome,apelido,cpf_cnpj,telefone,whatsapp,email,cidade,bairro,endereco,cep'

function termosBusca(valor: string) {
  return [...new Set(valor.trim().split(/\s+/).map(t => t.replace(/[,()%.'"\\]/g, '').trim()).filter(t => t.length >= 2))].slice(0, 8)
}
function textoNormalizado(valor: unknown) { return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() }
function textoProduto(p: ProdutoCatalogo) { return textoNormalizado(`${p.codigo || ''} ${p.nome || ''} ${p.descricao || ''} ${p.categoria || ''}`) }

async function buscarClientePorId(id: string, empresaId: string): Promise<ClienteCatalogo[]> {
  const { data, error } = await supabaseAdmin.from('clientes').select(CAMPOS_CLIENTE).eq('id', id).eq('empresa_id', empresaId).maybeSingle()
  if (error) throw error
  return data ? [data as ClienteCatalogo] : []
}

async function buscarClientes(q: string, empresaId: string): Promise<ClienteCatalogo[]> {
  const termos = termosBusca(q)
  if (!termos.length) return []
  const { data, error } = await supabaseAdmin.from('clientes').select(CAMPOS_CLIENTE).eq('empresa_id', empresaId).order('nome').limit(1000)
  if (error) throw error
  return ((data || []) as ClienteCatalogo[])
    .filter(c => correspondeBuscaAtlas(q, c.nome, c.apelido, c.cpf_cnpj, c.telefone, c.whatsapp, c.email, c.cidade, c.bairro, c.endereco, c.cep))
    .slice(0, 30)
}

async function buscarProdutos(q: string, empresaId: string): Promise<ProdutoCatalogo[]> {
  const termos = termosBusca(q)
  if (!termos.length) return []
  const contagens = await Promise.all(termos.map(async termo => {
    const filtro = `codigo.ilike.%${termo}%,nome.ilike.%${termo}%,descricao.ilike.%${termo}%,categoria.ilike.%${termo}%`
    const { count, error } = await supabaseAdmin.from('produtos').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('ativo', true).not('unidade', 'is', null).or(filtro)
    if (error) throw error
    return { termo, count: count ?? Number.MAX_SAFE_INTEGER }
  }))
  contagens.sort((a, b) => a.count - b.count)
  const termoBase = contagens[0]?.termo || termos[0]
  const filtroBase = `codigo.ilike.%${termoBase}%,nome.ilike.%${termoBase}%,descricao.ilike.%${termoBase}%,categoria.ilike.%${termoBase}%`
  const { data, error } = await supabaseAdmin.from('produtos').select(CAMPOS_PRODUTO).eq('empresa_id', empresaId).eq('ativo', true).not('unidade', 'is', null).or(filtroBase).order('nome').limit(800)
  if (error) throw error
  const termosNorm = termos.map(textoNormalizado)
  return ((data || []) as ProdutoCatalogo[]).filter(p => { const texto = textoProduto(p); return termosNorm.every(termo => texto.includes(termo)) }).slice(0, 120)
}

async function localPadrao(usuarioId: string, empresaId: string, localSolicitado?: string | null) {
  if (localSolicitado) {
    const { data } = await supabaseAdmin.from('estoque_locais').select('id,nome,codigo,unidade_id,unidades_operacionais(id,nome,codigo)').eq('id', localSolicitado).eq('empresa_id', empresaId).eq('ativo', true).maybeSingle()
    if (data) return data as any
  }
  const { data: caixa } = await supabaseAdmin.from('balcao_caixas').select('local_estoque_id').eq('empresa_id', empresaId).eq('operador_id', usuarioId).eq('status', 'aberto').order('aberto_em', { ascending: false }).limit(1).maybeSingle()
  if (caixa?.local_estoque_id) {
    const { data } = await supabaseAdmin.from('estoque_locais').select('id,nome,codigo,unidade_id,unidades_operacionais(id,nome,codigo)').eq('id', caixa.local_estoque_id).eq('empresa_id', empresaId).maybeSingle()
    if (data) return data as any
  }
  const { data } = await supabaseAdmin.from('estoque_locais').select('id,nome,codigo,unidade_id,unidades_operacionais!inner(id,nome,codigo)').eq('empresa_id', empresaId).eq('codigo', 'GERAL').eq('unidades_operacionais.codigo', 'MATRIZ').limit(1).maybeSingle()
  return data as any
}

export async function GET(req: NextRequest) {
  const usuario = await autenticarBalcao(req, 'venda-balcao', 'consulta')
  if (!usuario) return NextResponse.json({ error: 'Sem acesso à Venda Balcão.' }, { status: 403 })
  const tipo = req.nextUrl.searchParams.get('tipo') || 'produtos'
  const q = (req.nextUrl.searchParams.get('q') || '').trim()
  try {
    if (tipo === 'clientes') {
      const clienteId = (req.nextUrl.searchParams.get('clienteId') || '').trim()
      return NextResponse.json({ ok: true, clientes: clienteId ? await buscarClientePorId(clienteId, usuario.empresa_id) : await buscarClientes(q, usuario.empresa_id) })
    }
    const local = await localPadrao(usuario.id, usuario.empresa_id, req.nextUrl.searchParams.get('localId'))
    if (!local?.id) return NextResponse.json({ error: 'Nenhum local de estoque foi configurado para o balcão.' }, { status: 409 })
    const produtos = await buscarProdutos(q, usuario.empresa_id)
    const ids = produtos.map(p => p.id)
    const { data: rede, error: erroRede } = ids.length
      ? await supabaseAdmin.from('estoque_disponibilidade_rede').select('produto_id,local_id,unidade_id,unidade_codigo,unidade_nome,local_codigo,local_nome,unidade,quantidade_fisica,quantidade_reservada,quantidade_disponivel,custo_medio').in('produto_id', ids)
      : { data: [] as LinhaRede[], error: null }
    if (erroRede) throw erroRede

    const porProduto = new Map<string, LinhaRede[]>()
    for (const linha of (rede || []) as LinhaRede[]) { const atual = porProduto.get(linha.produto_id) || []; atual.push(linha); porProduto.set(linha.produto_id, atual) }
    const gestao = await nivelBalcaoUsuario(usuario.id, usuario.role, 'relatorios-balcao')
    const podeVerGestao = gestao !== 'oculto'
    const lista = produtos.map(p => {
      const linhas = porProduto.get(p.id) || []
      const agrupados = new Map<string, {localId:string;unidadeId:string;unidadeCodigo:string;unidadeNome:string;localCodigo:string;localNome:string;fisico:number;reservado:number;disponivel:number;custoValor:number;custoQtd:number;unidade:string}>()
      for (const r of linhas) {
        const a = agrupados.get(r.local_id) || { localId:r.local_id,unidadeId:r.unidade_id,unidadeCodigo:r.unidade_codigo,unidadeNome:r.unidade_nome,localCodigo:r.local_codigo,localNome:r.local_nome,fisico:0,reservado:0,disponivel:0,custoValor:0,custoQtd:0,unidade:r.unidade||p.unidade||'' }
        const fisico=Number(r.quantidade_fisica||0),reservado=Number(r.quantidade_reservada||0),disponivel=Number(r.quantidade_disponivel||0),custo=r.custo_medio==null?null:Number(r.custo_medio)
        a.fisico+=fisico;a.reservado+=reservado;a.disponivel+=disponivel;if(custo!=null&&fisico>0){a.custoValor+=custo*fisico;a.custoQtd+=fisico}agrupados.set(r.local_id,a)
      }
      const estoquesRede=Array.from(agrupados.values()).map(a=>({localId:a.localId,unidadeId:a.unidadeId,unidadeCodigo:a.unidadeCodigo,unidadeNome:a.unidadeNome,localCodigo:a.localCodigo,localNome:a.localNome,fisico:a.fisico,reservado:a.reservado,disponivel:a.disponivel,unidade:a.unidade,custoMedio:a.custoQtd>0?a.custoValor/a.custoQtd:null})).sort((a,b)=>(a.localId===local.id?-1:b.localId===local.id?1:b.disponivel-a.disponivel))
      const atual=estoquesRede.find(e=>e.localId===local.id),estoqueLocal=Number(atual?.disponivel||0),estoqueRede=estoquesRede.reduce((s,e)=>s+Number(e.disponivel||0),0),precoNormal=Number(p.preco||0),promocional=p.preco_promocional==null?null:Number(p.preco_promocional),precoEfetivo=promocional!=null&&promocional>=0?promocional:precoNormal
      return {id:p.id,codigo:p.codigo||'',nome:p.nome,descricao:p.descricao||null,categoria:p.categoria,unidade:p.unidade,fotoUrl:p.foto_url||null,estoque:estoqueLocal,estoqueLocal,estoqueRede,estoquesRede,unidadeEstoque:atual?.unidade||p.unidade,preco:precoNormal,precoPromocional:promocional,precoEfetivo,...(podeVerGestao?{custo:atual?.custoMedio==null?(p.custo==null?null:Number(p.custo)):Number(atual.custoMedio),margem:p.margem_percentual==null?null:Number(p.margem_percentual),precoMinimo:p.preco_minimo==null?null:Number(p.preco_minimo)}:{})}
    })
    return NextResponse.json({ok:true,produtos:lista,podeVerGestao,localAtual:{id:local.id,nome:local.nome,codigo:local.codigo,unidadeId:local.unidade_id,unidadeNome:(local.unidades_operacionais as any)?.nome||'Unidade',unidadeCodigo:(local.unidades_operacionais as any)?.codigo||''}})
  } catch (e) {
    console.error('Erro catálogo balcão', e)
    return NextResponse.json({ error: 'Não foi possível carregar o catálogo.' }, { status: 500 })
  }
}