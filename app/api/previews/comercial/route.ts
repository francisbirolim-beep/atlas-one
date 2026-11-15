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
const campos='id,codigo,nome,descricao,categoria,unidade,preco,preco_promocional,linha_id'
const categoriasConhecidas=['perfil','acessorio','vidro',...pronto]

function aplicarCategoria<T extends {eq:(...args:any[])=>T;in:(...args:any[])=>T;not:(...args:any[])=>T}>(consulta:T,categoria:Categoria,prefixo=''):T{
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
    const linhaId=request.nextUrl.searchParams.get('linhaId')||''
    if(linhaId&&!uuid.test(linhaId))return NextResponse.json({error:'Linha inválida.'},{status:400})

    // A relação verdadeira de produtos está em linha_produtos -> linhas_tecnicas,
    // NÃO no campo produtos.linha_id nem na tabela antiga linhas.
    // Consultar vínculos reais por categoria, inclusive linhas históricas inativas.
    const linhaIds=new Set<string>()
    for(let offset=0;offset<3500;offset+=900){
      let vinculos=supabaseAdmin.from('linha_produtos')
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
    let query=supabaseAdmin.from('produtos')
      .select(campos+(linhaId?',linha_produtos!inner(linha_id,empresa_id)':''))
      .eq('empresa_id',usuario.empresa_id).eq('ativo',true)
    query=aplicarCategoria(query,tipoCategoria)
    if(linhaId)query=query.eq('linha_produtos.linha_id',linhaId).eq('linha_produtos.empresa_id',usuario.empresa_id)
    const termos=(q.match(/[A-Za-zÀ-ÿ0-9-]{2,}/g)||[]).slice(0,7)
    for(const bruto of termos){
      const termo=bruto.replace(/[^A-Za-zÀ-ÿ0-9-]/g,'')
      if(termo)query=query.or('codigo.ilike.%'+termo+'%,nome.ilike.%'+termo+'%,descricao.ilike.%'+termo+'%')
    }
    const {data,error}=await query.order('nome').limit(120)
    if(error)throw error
    const encontrados=(data||[]).filter(p=>{
      const texto=normalizar([p.codigo,p.nome,p.descricao].join(' '))
      return termos.every(t=>texto.includes(normalizar(t)))
    }).slice(0,90)

    const ids=encontrados.map(p=>p.id)
    const {data:associacoes,error:erroAssociacoes}=ids.length
      ?await supabaseAdmin.from('linha_produtos').select('produto_id,linha_id').eq('empresa_id',usuario.empresa_id).in('produto_id',ids).limit(700)
      :{data:[],error:null}
    if(erroAssociacoes)throw erroAssociacoes
    const nomePorId=new Map(linhas.map(l=>[l.id,l.nome]))
    const linhasPorProduto=new Map<string,string[]>()
    for(const a of associacoes||[]){
      const nome=nomePorId.get(a.linha_id)
      if(!nome)continue
      const atuais=linhasPorProduto.get(a.produto_id)||[]
      if(!atuais.includes(nome))atuais.push(nome)
      linhasPorProduto.set(a.produto_id,atuais)
    }

    // Fotos Wvetro importadas estão pendentes de conferência e podem estar erradas.
    // Somente fotos MANUAIS explicitamente validadas podem aparecer automaticamente.
    const fotos=new Map<string,string>()
    if(ids.length){
      const {data:validadas,error:erroFotos}=await supabaseAdmin.from('produto_imagens')
        .select('produto_id,url,principal').eq('empresa_id',usuario.empresa_id)
        .eq('ativo',true).eq('origem','manual').eq('status_validacao','validada')
        .in('produto_id',ids).order('principal',{ascending:false}).limit(200)
      if(erroFotos)throw erroFotos
      for(const foto of validadas||[])if(!fotos.has(foto.produto_id))fotos.set(foto.produto_id,foto.url)
    }
    return NextResponse.json({
      produtos:encontrados.map(p=>({
        id:p.id,codigo:p.codigo||'',nome:p.nome,descricao:p.descricao||'',
        categoria:p.categoria||'',unidade:p.unidade||'un.',linhaId:null,
        linha:(linhasPorProduto.get(p.id)||[]).join(' / ')||null,
        fotoUrl:fotos.get(p.id)||null, // NUNCA usa imagem importada sem validação.
        preco:Number(p.preco||0)>0?Number(p.preco):null,
        precoPromocional:p.preco_promocional!=null&&Number(p.preco_promocional)>0?Number(p.preco_promocional):null,
      })),linhas,limitado:(data||[]).length===120
    })
  }catch(e){
    console.error('Falha na prévia comercial de leitura',e)
    return NextResponse.json({error:'Não foi possível consultar os cadastros agora.'},{status:500})
  }
}
