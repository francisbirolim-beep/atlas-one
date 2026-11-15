import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarBalcao } from '@/lib/balcaoServer'
import { correspondeBuscaAtlas } from '@/lib/buscaAtlas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Prévia de leitura: nunca cria, altera ou confirma produtos, clientes, obras ou vendas.
const categorias = ['todos','perfil','acessorio','vidro','pronto'] as const
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const normalizar = (v:unknown) => String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
const pronto = ['produto','porta_janela_padrao','kit','pu']

export async function GET(request:NextRequest){
  // Permissão temporária de Master para uma prévia isolada, sem criar novas permissões.
  const usuario = await autenticarBalcao(request,'venda-balcao','consulta')
  if(!usuario || usuario.role!=='master')
    return NextResponse.json({error:'Prévia disponível somente para o usuário Master.'},{status:403})

  const tipo = request.nextUrl.searchParams.get('tipo')||'produtos'
  const q = (request.nextUrl.searchParams.get('q')||'').slice(0,100).trim()
  try{
    if(tipo==='clientes'){
      if(q.length<2)return NextResponse.json({clientes:[]})
      const {data,error}=await supabaseAdmin.from('clientes')
        .select('id,nome,apelido,cpf_cnpj,telefone,whatsapp,cidade')
        .eq('empresa_id',usuario.empresa_id).eq('ativo',true).order('nome').limit(1000)
      if(error)throw error
      const clientes=(data||[]).filter(c=>correspondeBuscaAtlas(q,c.nome,c.apelido,c.cpf_cnpj,c.telefone,c.whatsapp,c.cidade)).slice(0,16)
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
    if(tipo!=='produtos')return NextResponse.json({error:'Tipo inválido.'},{status:400})
    const categoria=request.nextUrl.searchParams.get('categoria')||'todos'
    if(!categorias.includes(categoria as typeof categorias[number]))
      return NextResponse.json({error:'Categoria inválida.'},{status:400})
    const linhaId=request.nextUrl.searchParams.get('linhaId')||''
    if(linhaId && !uuid.test(linhaId))
      return NextResponse.json({error:'Linha inválida.'},{status:400})

    const linhasResp=await supabaseAdmin.from('linhas').select('id,nome').eq('ativo',true).order('nome').limit(250)
    if(linhasResp.error)throw linhasResp.error
    const linhas=linhasResp.data||[]
    const nomeLinha=new Map(linhas.map(l=>[l.id,l.nome]))

    let consulta=supabaseAdmin.from('produtos')
      .select('id,codigo,nome,descricao,categoria,unidade,preco,preco_promocional,foto_url,linha_id')
      .eq('empresa_id',usuario.empresa_id).eq('ativo',true)
    if(categoria==='pronto')consulta=consulta.in('categoria',pronto)
    else if(categoria!=='todos')consulta=consulta.eq('categoria',categoria)
    if(linhaId)consulta=consulta.eq('linha_id',linhaId)

    const termos=q.split(/\s+/).map(normalizar).filter(Boolean)
    if(termos.length){
      const base=(q.match(/[a-zA-ZÀ-ú0-9-]{2,}/)||[])[0]||''
      if(base)consulta=consulta.or('codigo.ilike.%'+base+'%,nome.ilike.%'+base+'%,descricao.ilike.%'+base+'%')
    }
    const {data,error}=await consulta.order('nome').limit(450)
    if(error)throw error
    const encontrados=(data||[]).filter(p=>{
      const texto=normalizar([p.codigo,p.nome,p.descricao,p.categoria,nomeLinha.get(p.linha_id)].join(' '))
      return termos.every(t=>texto.includes(t))
    }).slice(0,90)

    // Imagens reais, previamente validadas no catálogo. Sem gerar fotos fictícias.
    const semImagem=encontrados.filter(p=>!p.foto_url).map(p=>p.id)
    const imagens=new Map<string,string>()
    if(semImagem.length){
      const resp=await supabaseAdmin.from('produto_imagens')
        .select('produto_id,url,principal').eq('empresa_id',usuario.empresa_id)
        .eq('ativo',true).eq('status_validacao','validada')
        .in('produto_id',semImagem).order('principal',{ascending:false}).limit(200)
      if(!resp.error)for(const foto of resp.data||[])if(!imagens.has(foto.produto_id))imagens.set(foto.produto_id,foto.url)
    }
    const produtos=encontrados.map(p=>({
      id:p.id,codigo:p.codigo||'',nome:p.nome,descricao:p.descricao||'',
      categoria:p.categoria||'',unidade:p.unidade||'un.',linhaId:p.linha_id||null,
      linha:nomeLinha.get(p.linha_id)||null, fotoUrl:p.foto_url||imagens.get(p.id)||null,
      preco:Number(p.preco||0)>0?Number(p.preco):null,
      precoPromocional:p.preco_promocional==null?null:Number(p.preco_promocional),
    }))
    return NextResponse.json({produtos,linhas,limitado:encontrados.length>=90})
  }catch(e){
    console.error('Falha em prévia comercial (somente leitura)',e)
    return NextResponse.json({error:'Não foi possível consultar os cadastros agora.'},{status:500})
  }
}
