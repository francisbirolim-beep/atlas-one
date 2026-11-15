import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarBalcao } from '@/lib/balcaoServer'
import { correspondeBuscaAtlas } from '@/lib/buscaAtlas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Prévia SOMENTE LEITURA: não cria clientes, imagens, vendas ou registros de estoque.
const categorias=['todos','perfil','acessorio','vidro','pronto','outros'] as const
type Categoria=typeof categorias[number]
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const pronto=['produto','porta_janela_padrao','kit','pu']
const normalizar=(v:unknown)=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
const campos='id,codigo,nome,descricao,categoria,unidade,preco,preco_promocional,linha_id,foto_url,custo,custo_wvetro_ultimo,custo_wvetro_min,custo_wvetro_max,peso_kg_m,peso_kg,margem_percentual'
const categoriasConhecidas=['perfil','acessorio','vidro',...pronto]

// Isola a tipagem genérica profunda do builder PostgREST de relações cruzadas.
// O runtime continua usando apenas as operações de leitura e os filtros whitelisted.
function aplicarCategoria(consulta:any,categoria:Categoria,prefixo=''):any{
  const campo=prefixo+'categoria'
  if(categoria==='pronto')return consulta.in(campo,pronto)
  if(categoria==='outros')return consulta.not(campo,'in','('+categoriasConhecidas.map(c=>'"'+c+'"').join(',')+')')
  if(categoria!=='todos')return consulta.eq(campo,categoria)
  return consulta
}

export async function GET(request:NextRequest){
  const usuario=await autenticarBalcao(request,'venda-balcao','consulta')
  if(!usuario||usuario.role!=='master')return NextResponse.json({error:'Prévia disponível somente para o perfil Master.'},{status:403})
  const tipo=request.nextUrl.searchParams.get('tipo')||'produtos'
  const q=(request.nextUrl.searchParams.get('q')||'').slice(0,110).trim()
  try{
    if(tipo==='clientes'){
      if(q.length<2)return NextResponse.json({clientes:[]})
      const tokens=q.split(/\s+/).filter(x=>x.length>1).slice(0,5)
      let query=supabaseAdmin.from('clientes')
        .select('id,nome,apelido,cpf_cnpj,telefone,whatsapp,cidade')
        .eq('empresa_id',usuario.empresa_id).eq('ativo',true)
      for(const raw of tokens){
        const t=raw.replace(/[^A-Za-zÀ-ÿ0-9-]/g,'')
        if(t)query=query.or('nome.ilike.%'+t+'%,apelido.ilike.%'+t+'%,cpf_cnpj.ilike.%'+t+'%,telefone.ilike.%'+t+'%,whatsapp.ilike.%'+t+'%')
      }
      const {data,error}=await query.order('nome').limit(250)
      if(error)throw error
      const clientes=(data||[]).filter(c=>correspondeBuscaAtlas(q,c.nome,c.apelido,c.cpf_cnpj,c.telefone,c.whatsapp,c.cidade)).slice(0,20)
      return NextResponse.json({clientes})
    }
    if(tipo==='obras'){
      const clienteId=request.nextUrl.searchParams.get('clienteId')||''
      if(!uuid.test(clienteId))return NextResponse.json({obras:[]})
      const {data,error}=await supabaseAdmin.from('obras')
        .select('id,nome,cidade,bairro,endereco,cliente_id')
        .eq('empresa_id',usuario.empresa_id).eq('cliente_id',clienteId).order('nome').limit(60)
      if(error)throw error
      return NextResponse.json({obras:data||[]})
    }
    if(tipo!=='produtos')return NextResponse.json({error:'Tipo de consulta inválido.'},{status:400})
    const categoria=request.nextUrl.searchParams.get('categoria')||'todos'
    if(!categorias.includes(categoria as Categoria))return NextResponse.json({error:'Categoria inválida.'},{status:400})
    const tipoCategoria=categoria as Categoria
    const precoFiltro=request.nextUrl.searchParams.get('precoFiltro')||'todos'
    if(!['todos','com','sem'].includes(precoFiltro))return NextResponse.json({error:'Filtro de preço inválido.'},{status:400})
    const linhaId=request.nextUrl.searchParams.get('linhaId')||''
    if(linhaId&&!uuid.test(linhaId))return NextResponse.json({error:'Linha inválida.'},{status:400})

    // A relação verdadeira de produtos está em linha_produtos -> linhas_tecnicas,
    // NÃO no campo produtos.linha_id nem na tabela antiga linhas.
    // Consultar vínculos reais por categoria, inclusive linhas históricas inativas.
    const linhaIds=new Set<string>()
    for(let offset=0;offset<3500;offset+=900){
      let vinculos:any=supabaseAdmin.from('linha_produtos')
        .select('linha_id,produtos!inner(categoria,ativo)')
        .eq('empresa_id',usuario.empresa_id).eq('produtos.ativo',true)
      vinculos=aplicarCategoria(vinculos,tipoCategoria,'produtos.')
      const {data,error}=await vinculos.range(offset,offset+899)
      if(error)throw error
      for(const link of data||[])linhaIds.add(link.linha_id)
      if((data||[]).length<900)break
    }
    const {data:linhasBrutas,error:erroLinhas}=linhaIds.size
      ?await supabaseAdmin.from('linhas_tecnicas').select('id,nome,ativo').in('id',[...linhaIds]).order('nome').limit(200)
      :{data:[],error:null}
    if(erroLinhas)throw erroLinhas
    const linhas=(linhasBrutas||[]).map(l=>({id:l.id,nome:l.nome,ativa:l.ativo}))

    if(linhaId&&!linhaIds.has(linhaId))return NextResponse.json({produtos:[],linhas,limitado:false})

    // O !inner aplica o vínculo real no servidor, antes de limitar e paginar.
    // Assim "Perfil + SUPREMA" não devolve perfis de outra linha.
    let query:any=supabaseAdmin.from('produtos')
      .select(campos+(linhaId?',linha_produtos!inner(linha_id,empresa_id)':''))
      .eq('empresa_id',usuario.empresa_id).eq('ativo',true)
    query=aplicarCategoria(query,tipoCategoria)
    if(linhaId)query=query.eq('linha_produtos.linha_id',linhaId).eq('linha_produtos.empresa_id',usuario.empresa_id)
    if(precoFiltro==='com')query=query.or('preco.gt.0,preco_promocional.gt.0')
    if(precoFiltro==='sem')query=query.or('and(preco.is.null,preco_promocional.is.null),and(preco.is.null,preco_promocional.lte.0),and(preco.lte.0,preco_promocional.is.null),and(preco.lte.0,preco_promocional.lte.0)')
    const termos=(q.match(/[A-Za-zÀ-ÿ0-9-]{2,}/g)||[]).slice(0,7)
    for(const bruto of termos){
      const termo=bruto.replace(/[^A-Za-zÀ-ÿ0-9-]/g,'')
      if(termo)query=query.or('codigo.ilike.%'+termo+'%,nome.ilike.%'+termo+'%,descricao.ilike.%'+termo+'%')
    }
    const {data,error}=await query.order('nome').limit(120)
    if(error)throw error
    const encontrados=(data||[]).filter((p:any)=>{
      const texto=normalizar([p.codigo,p.nome,p.descricao].join(' '))
      return termos.every(t=>texto.includes(normalizar(t)))
    }).slice(0,90)

    const ids=encontrados.map((p:any)=>p.id)
    const {data:associacoes,error:erroAssociacoes}=ids.length
      ?await supabaseAdmin.from('linha_produtos').select('produto_id,linha_id').eq('empresa_id',usuario.empresa_id).in('produto_id',ids).limit(700)
      :{data:[],error:null}
    if(erroAssociacoes)throw erroAssociacoes
    const nomePorId=new Map(linhas.map(l=>[l.id,l.nome]))
    const linhasPorProduto=new Map<string,string[]>()
    const vinculosPorProduto=new Map<string,{id:string;nome:string}[]>()
    for(const a of associacoes||[]){
      const nome=nomePorId.get(a.linha_id)
      if(!nome)continue
      const atuais=linhasPorProduto.get(a.produto_id)||[]
      if(!atuais.includes(nome))atuais.push(nome)
      linhasPorProduto.set(a.produto_id,atuais)
      const vinculos=vinculosPorProduto.get(a.produto_id)||[]
      if(!vinculos.some(x=>x.id===a.linha_id))vinculos.push({id:a.linha_id,nome})
      vinculosPorProduto.set(a.produto_id,vinculos)
    }

    // Fotos já cadastradas são exibidas automaticamente, por vínculo exato de produto_id.
    // Fotos importadas pendentes recebem sinalização de origem, sem bloquear visualização.
    // Não é criada, buscada ou substituída nenhuma imagem fictícia.
    const fotos=new Map<string,string>()
    const candidatas=new Map<string,string>()
    const urlSegura=(v:string)=>{try{const u=new URL(v);return u.protocol==='https:'&&['urtqbvjpwnrfaayolymt.supabase.co','api.wvetro.com.br'].includes(u.hostname)}catch{return false}}
    if(ids.length){
      const {data:imagens,error:erroFotos}=await supabaseAdmin.from('produto_imagens')
        .select('produto_id,url,principal,origem,status_validacao')
        .eq('empresa_id',usuario.empresa_id).eq('ativo',true)
        .in('produto_id',ids).order('principal',{ascending:false}).limit(250)
      if(erroFotos)throw erroFotos
      for(const foto of imagens||[]){
        if(!foto.url||!urlSegura(foto.url))continue
        if(foto.status_validacao==='validada'){
          if(!fotos.has(foto.produto_id))fotos.set(foto.produto_id,foto.url)
        }else if(foto.status_validacao==='pendente'&&foto.origem==='wvetro'){
          if(!candidatas.has(foto.produto_id))candidatas.set(foto.produto_id,foto.url)
        }
      }
    }
    return NextResponse.json({
      produtos:encontrados.map((p:any)=>({
        id:p.id,codigo:p.codigo||'',nome:p.nome,descricao:p.descricao||'',
        categoria:p.categoria||'',unidade:p.unidade||'un.',linhaId:null,
        linha:(linhasPorProduto.get(p.id)||[]).join(' / ')||null,
        linhasVinculadas:vinculosPorProduto.get(p.id)||[],
        fotoUrl:fotos.get(p.id)||(!candidatas.has(p.id)&&p.foto_url&&urlSegura(p.foto_url)?p.foto_url:null),
        fotoCandidataUrl:fotos.has(p.id)?null:candidatas.get(p.id)||null, // Aparece automaticamente com aviso de validação pendente.
        preco:Number(p.preco||0)>0?Number(p.preco):null,
        precoPromocional:p.preco_promocional!=null&&Number(p.preco_promocional)>0?Number(p.preco_promocional):null,
        custo:p.custo!=null?Number(p.custo):null,
        custoWvetroUltimo:p.custo_wvetro_ultimo!=null?Number(p.custo_wvetro_ultimo):null,
        custoWvetroMin:p.custo_wvetro_min!=null?Number(p.custo_wvetro_min):null,
        custoWvetroMax:p.custo_wvetro_max!=null?Number(p.custo_wvetro_max):null,
        margemPercentual:p.margem_percentual!=null?Number(p.margem_percentual):null,
        pesoKgM:p.peso_kg_m!=null?Number(p.peso_kg_m):null,
        pesoKg:p.peso_kg!=null?Number(p.peso_kg):null,
      })),linhas,limitado:(data||[]).length===120
    })
  }catch(e){
    console.error('Falha na prévia comercial de leitura',e)
    return NextResponse.json({error:'Não foi possível consultar os cadastros agora.'},{status:500})
  }
}
