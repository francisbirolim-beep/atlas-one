import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import pdfParse from 'pdf-parse'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarTenant, type UsuarioTenant } from '@/lib/tenantServer'
import { consultarOpenCode, statusOpenCode, type OpenCodeAnexo } from '@/lib/ai/opencode'
import { especialistaDoModulo } from '@/lib/ai/specialists'
import type { AIModulo } from '@/lib/ai/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAX = 50 * 1024 * 1024
const MODULOS = new Set(['gestao','comercial','orcamento','medicao_final','engenharia','compras','estoque','producao','instalacao','financeiro','marketing','rh','qualidade','pd'])
const TIPOS = new Set(['catalogo','tabela_preco','curso','apostila','regra','foto','arquivo','conversa','outro'])
const CATEGORIAS = new Set(['produto','acessorio','perfil','vidro','kit','porta_janela_padrao','pu','outro'])

function txt(v: unknown, n=500){ return String(v ?? '').trim().slice(0,n) }
function dig(v: unknown){ return String(v ?? '').replace(/\D/g,'') }
function num(v: unknown): number|null {
  if(v===null||v===undefined||v==='') return null
  const n=Number(String(v).replace(/\s/g,'').replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.'))
  return Number.isFinite(n)?n:null
}
function norm(v: unknown){ return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim() }
function cod(v: unknown){ return txt(v,120).toUpperCase().replace(/[^A-Z0-9]/g,'') }
function tokensNome(v: unknown){
  return new Set(norm(v).split(' ').filter(t=>t.length>=3&&!['LTDA','EIRELI','INDUSTRIA','COMERCIO','DISTRIBUIDORA','DISTRIBUICAO'].includes(t)))
}
function similaridadeNome(a: unknown,b: unknown){
  const na=norm(a), nb=norm(b)
  if(!na||!nb)return 0
  if(na===nb)return 1
  if((na.includes(nb)||nb.includes(na))&&Math.min(na.length,nb.length)>=6)return .9
  const ta=tokensNome(a), tb=tokensNome(b)
  if(!ta.size||!tb.size)return 0
  let inter=0
  for(const t of ta)if(tb.has(t))inter++
  return inter/Math.max(ta.size,tb.size)
}
function jsonIA(v:string){
  const s=String(v||'').trim().replace(/^\s*```(?:json)?\s*/i,'').replace(/\s*```\s*$/i,'').trim()
  try{return JSON.parse(s)}catch{}
  const i=s.indexOf('{'), f=s.lastIndexOf('}')
  if(i>=0&&f>i){ try{return JSON.parse(s.slice(i,f+1))}catch{} }
  return null
}
function anexo(v:any){
  if(!v||typeof v!=='object'||!v.dados)return null
  return {nome:txt(v.nome,180)||'arquivo',mediaType:txt(v.mediaType,120).toLowerCase().split(';')[0],dados:String(v.dados)}
}
async function anexoRemoto(v:any, usuario:UsuarioTenant){
  if(!v||typeof v!=='object'||!v.path)return null
  const nome=txt(v.nome,180)||'arquivo'
  const mediaType=txt(v.mediaType,120).toLowerCase().split(';')[0]||'application/octet-stream'
  const tamanho=Number(v.tamanho||0)
  if(tamanho>MAX)throw new Error('Arquivo maior que 50 MB.')
  const path=txt(v.path,500)
  const prefixo=`ingest/${usuario.id}/`
  if(!path.startsWith(prefixo))throw new Error('Caminho de arquivo não autorizado.')
  const {data,error}=await supabaseAdmin.storage.from('atlas-aprendizado').download(path)
  if(error||!data)throw new Error('Não foi possível abrir o arquivo enviado.')
  const ab=await data.arrayBuffer()
  if(ab.byteLength>MAX)throw new Error('Arquivo maior que 50 MB.')
  return {nome,mediaType,dados:Buffer.from(ab).toString('base64'),ingestPath:path}
}
function ext(nome:string,mime:string){
  const e=(nome.split('.').pop()||'').toLowerCase().replace(/[^a-z0-9]/g,'')
  if(e)return e.slice(0,10)
  if(mime==='application/pdf')return 'pdf'
  if(mime==='image/jpeg')return 'jpg'
  if(mime==='image/png')return 'png'
  if(mime==='image/webp')return 'webp'
  if(mime==='text/csv')return 'csv'
  return 'txt'
}
async function log(usuario:UsuarioTenant,evento:string,entradaId?:string|null,candidatoId?:string|null,detalhe:any={}){
  await supabaseAdmin.from('ai_aprendizado_eventos').insert({empresa_id:usuario.empresa_id,entrada_id:entradaId||null,candidato_id:candidatoId||null,usuario_id:usuario.id,usuario_nome:usuario.nome||null,evento,detalhe})
}
async function podeValidar(usuario:UsuarioTenant,c:any){
  if(usuario.role==='master')return true
  const {data}=await supabaseAdmin.from('permissoes').select('setor_id,nivel').eq('empresa_id',usuario.empresa_id).eq('usuario_id',usuario.id).eq('nivel','edicao')
  const ed=new Set((data||[]).map((p:any)=>String(p.setor_id)))
  const modulo=String(c?.modulo||'')
  if(modulo){
    const e=especialistaDoModulo(modulo as AIModulo)
    return Boolean(e?.setorIds.some(id=>ed.has(id)))
  }
  return ['compras','engenharia'].some(m=>especialistaDoModulo(m as AIModulo)?.setorIds.some(id=>ed.has(id)))
}
async function preparar(usuario:UsuarioTenant,id:string,a:any){
  if(!a)return {path:null as string|null,texto:'',imagens:[] as OpenCodeAnexo[],paginas:[] as Array<{pagina:number;texto:string}>,size:0}
  const mime=a.mediaType||'application/octet-stream'
  const ehTexto=mime.startsWith('text/')||mime==='application/json'
  let b:Buffer,texto=''
  const imagens:OpenCodeAnexo[]=[]
  const paginas:Array<{pagina:number;texto:string}>=[]
  if(ehTexto){ texto=String(a.dados).slice(0,250000); b=Buffer.from(a.dados,'utf8') }
  else {
    b=Buffer.from(a.dados,'base64')
    if(b.length>MAX)throw new Error('Arquivo maior que 50 MB.')
    if(mime==='application/pdf'){
      const p=await pdfParse(b,{pagerender:async(pageData:any)=>{
        const tc=await pageData.getTextContent({normalizeWhitespace:false,disableCombineTextItems:false})
        let lastY:number|undefined,textoPagina=''
        for(const item of (tc?.items||[])){
          const y=Number(item?.transform?.[5])
          const str=String(item?.str||'')
          if(lastY===undefined||y===lastY)textoPagina+=str
          else textoPagina+='\n'+str
          lastY=y
        }
        paginas.push({pagina:paginas.length+1,texto:textoPagina})
        return textoPagina
      }})
      texto=String(p.text||'').replace(/\r/g,'').trim().slice(0,250000)
    }
    else if(mime.startsWith('image/')) imagens.push({nome:a.nome,mediaType:mime,dados:a.dados})
  }
  const path=usuario.empresa_id+'/'+id+'/'+randomUUID()+'.'+ext(a.nome,mime)
  const {error}=await supabaseAdmin.storage.from('atlas-aprendizado').upload(path,b,{contentType:mime,upsert:false})
  if(error)throw new Error(error.message)
  return {path,texto,imagens,paginas,size:b.length}
}

function limparLinhaCatalogo(v: unknown){
  return String(v??'').replace(/[\x00-\x1f\x7f-\x9f]/g,' ').replace(/\s+/g,' ').trim()
}
function ehCodigoCatalogo(v: unknown){
  const x=limparLinhaCatalogo(v).toUpperCase().replace(/\s+/g,'')
  if(!x||x.length>24||!/\d/.test(x))return ''
  const prefixo=x.split(/[-_/]/)[0]||''
  if(['VISTA','PERFIL','LINHA','BARRA','ACABAMENTO','SUPERIOR','INFERIOR','LATERAL','TRAVESSA','MONTANTE'].includes(prefixo))return ''
  if(/^[A-Z]{1,6}\d{0,3}(?:[-_/][A-Z0-9]{2,8}){1,2}$/.test(x))return x
  if(/^[A-Z]{2,6}\d{2,8}$/.test(x))return x
  return ''
}
function pesoKgM(v: unknown){
  const x=limparLinhaCatalogo(v).toUpperCase().replace(/\s+/g,'')
  const m=x.match(/(\d{1,3}(?:[.,]\d{2,4}))KG\/?M/)
  if(!m)return null
  const n=Number(m[1].replace(',','.'))
  return Number.isFinite(n)?n:null
}
function linhaNumericaCatalogo(v: unknown){
  const x=limparLinhaCatalogo(v)
  return Boolean(x)&&/^[\d\s.,xX/]+$/.test(x)
}
function ruidoCatalogo(v: unknown,fornecedorNome?:string|null){
  const x=norm(limparLinhaCatalogo(v))
  if(!x)return true
  if(x==='LINHA'||/^A L U M I N I O S$/.test(x)||x==='ALUMINIOS')return true
  if(/^AS INFORMACOES CONTIDAS NESTE CAT/.test(x)||/ESTAO SUJEITAS A ALTERACOES/.test(x))return true
  if(/^PAGINA\b/.test(x))return true
  if(fornecedorNome){
    const fn=norm(fornecedorNome), partes=fn.split(' ').filter(Boolean)
    if(x===fn)return true
    if(partes.length>1&&x===partes[partes.length-1])return true
  }
  return false
}
function catalogoProvavel(tipo:string,nome:string|null,texto:string){
  if(tipo==='catalogo'||tipo==='tabela_preco')return true
  const n=norm(nome)
  if(/\bCATALOG/.test(n)||/\bTABELA\b/.test(n))return true
  const t=norm(texto.slice(0,12000))
  return /\bCATALOGO DE PRODUTOS\b/.test(t)||(/\bCATALOGO\b/.test(t)&&/\bLINHA/.test(t))
}
function nomeFornecedorCatalogo(texto:string){
  const linhas=texto.split(/\r?\n/).map(limparLinhaCatalogo).filter(Boolean).slice(0,220)
  for(const l of linhas){
    const m=l.match(/Alum[ií]nios?\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9&.-]{2,40})/i)
    if(m?.[1])return 'Alumínios '+m[1]
  }
  const i=linhas.findIndex(l=>/CAT.?LOGO DE PRODUTOS/i.test(l))
  if(i>0){
    const partes=linhas.slice(Math.max(0,i-3),i).map(x=>x.replace(/[^A-Za-zÀ-ÿ]/g,'')).filter(x=>x.length>=2&&x.length<=12)
    const junto=partes.join('')
    if(junto.length>=4&&junto.length<=24)return junto
  }
  return null
}
function categoriaCatalogo(descricao:string,peso:number|null){
  if(peso!==null)return 'perfil'
  const x=norm(descricao)
  if(/ROLDANA|FECHADURA|PUXADOR|PARAFUSO|ESCOVA|BORRACHA|VEDA|GUIA|CONCHA|CREMONA|DOBRADICA|ACESSORIO/.test(x))return 'acessorio'
  if(/VIDRO|LAMINADO|TEMPERADO|REFLETIVO|INCOLOR/.test(x))return 'vidro'
  if(/PERFIL|TUBO|CANTONEIRA|BARRA|MONTANTE|TRAVESSA|MARCO|CONTRAMARCO|BAGUETE|TRILHO|COLUNA|CAPA|CADEIRINHA/.test(x))return 'perfil'
  return 'outro'
}
function extrairProdutosCatalogoLocal(texto:string,fornecedorNome?:string|null,paginas:Array<{pagina:number;texto:string}>=[]){
  const linhas=texto.split(/\r?\n/).map(limparLinhaCatalogo)
  const linhaPorIndice:string[]=[]
  let linhaAtual=''
  for(let i=0;i<linhas.length;i++){
    const atual=norm(linhas[i])
    if(atual==='LINHA'){
      const partes:string[]=[]
      for(let j=i-1;j>=0&&j>=i-3;j--){
        if(ruidoCatalogo(linhas[j],fornecedorNome)||pesoKgM(linhas[j])!==null||linhaNumericaCatalogo(linhas[j])||ehCodigoCatalogo(linhas[j]))continue
        partes.unshift(limparLinhaCatalogo(linhas[j]))
      }
      if(partes.length)linhaAtual=partes.join(' ').slice(0,120)
    }
    linhaPorIndice[i]=linhaAtual
  }

  const paginaPorCodigo=new Map<string,number>()
  for(const pg of paginas){
    for(const l of String(pg.texto||'').split(/\r?\n/)){
      const codigo=ehCodigoCatalogo(l)
      if(codigo&&!paginaPorCodigo.has(codigo))paginaPorCodigo.set(codigo,pg.pagina)
    }
  }

  const itens:any[]=[]
  const vistos=new Set<string>()
  for(let i=0;i<linhas.length;i++){
    const codigo=ehCodigoCatalogo(linhas[i])
    if(!codigo||vistos.has(codigo))continue

    let peso:number|null=null
    for(const j of [i-2,i-1,i+1,i+2]){
      if(j>=0&&j<linhas.length){
        const p=pesoKgM(linhas[j])
        if(p!==null){peso=p;break}
      }
    }

    let descricao=''
    for(let j=i-1;j>=0&&j>=i-5;j--){
      const l=linhas[j]
      if(!l||ruidoCatalogo(l,fornecedorNome)||pesoKgM(l)!==null||linhaNumericaCatalogo(l))continue
      if(ehCodigoCatalogo(l))break
      const n=norm(l)
      if(n==='LINHA'||/^PERFIL \d+(?:MM)?$/.test(n))continue
      descricao=l
      break
    }
    if(!descricao){
      for(let j=i+1;j<linhas.length&&j<=i+4;j++){
        const l=linhas[j]
        if(!l||ruidoCatalogo(l,fornecedorNome)||pesoKgM(l)!==null||linhaNumericaCatalogo(l)||ehCodigoCatalogo(l))continue
        descricao=l
        break
      }
    }
    if(!descricao)descricao='Perfil '+codigo

    vistos.add(codigo)
    itens.push({
      tipo:'produto',titulo:codigo+' — '+descricao,modulo:'engenharia',
      codigo,descricao,categoria:categoriaCatalogo(descricao,peso),unidade:null,
      preco:null,peso_kg_m:peso,tamanho_barra_mm:null,linha:linhaPorIndice[i]||null,
      aplicacao:null,conteudo:null,pagina_catalogo:paginaPorCodigo.get(codigo)||null,confianca:peso!==null?.97:.65,
    })
    if(itens.length>=1200)break
  }
  return itens
}
function analisarCatalogoLocal(tipo:string,descricao:string,nome:string|null,texto:string,paginas:Array<{pagina:number;texto:string}>=[]){
  const fornecedorNome=nomeFornecedorCatalogo(texto)
  const itens=extrairProdutosCatalogoLocal(texto,fornecedorNome,paginas)
  const tipoDetectado=tipo==='tabela_preco'?'tabela_preco':'catalogo'
  return {
    documento:{
      tipo:tipoDetectado,
      titulo:nome||descricao.slice(0,100)||'Catálogo de fornecedor',
      resumo:'Catálogo identificado e lido localmente pelo Atlas, sem depender do OpenCode. '+itens.length+' código(s) de produto foram extraídos para reconciliação automática.',
      setores:['compras','engenharia'],
      fornecedor:fornecedorNome?{nome:fornecedorNome,cnpj:'',contato:'',telefone:'',email:'',cidade:''}:null,
      extracao_metodo:'catalogo_local',
    },
    itens,
  }
}

async function analisar(token:string,tipo:string,descricao:string,nome:string|null,texto:string,imagens:OpenCodeAnexo[],paginas:Array<{pagina:number;texto:string}>=[]){
  if(catalogoProvavel(tipo,nome,texto)){
    const local=analisarCatalogoLocal(tipo,descricao,nome,texto,paginas)
    if(local.itens.length>0)return local
  }
  const st=await statusOpenCode()
  if(!st.configurado)return {documento:{tipo,titulo:nome||descricao.slice(0,100)||'Material',resumo:descricao||texto.slice(0,1200),setores:[]},itens:descricao?[{tipo:'conhecimento',titulo:descricao.slice(0,120),conteudo:descricao,confianca:.5}]:[]}
  const system=`Você analisa materiais da Central de Aprendizado do ERP Atlas One (esquadrias de alumínio).
Não invente código, preço, peso, dimensão, linha, aplicação, fornecedor nem regra.
Catálogo e tabela oficial de fornecedor são fontes documentais confiáveis: extraia tudo que estiver explícito para reconciliação automática. Só divergências, ambiguidades ou campos insuficientes serão enviados à validação humana.
Para foto, conversa, curso, fórmula, procedimento, plano/lista de corte ou regra operacional, extraia como conhecimento candidato e preserve a necessidade de validação humana antes de virar regra do Atlas.
Classifique o documento entre catalogo,tabela_preco,curso,apostila,regra,foto,arquivo,conversa,outro.
Módulos válidos: gestao,comercial,orcamento,medicao_final,engenharia,compras,estoque,producao,instalacao,financeiro,marketing,rh,qualidade,pd.
Extraia fornecedor (nome,CNPJ,contato,telefone,email,cidade) quando houver.
Extraia itens: produto (código,descrição,categoria,unidade,preço,peso_kg_m,tamanho_barra_mm,linha,aplicação) e conhecimento (título,módulo,conteúdo).
Responda SOMENTE JSON válido:
{"documento":{"tipo":"catalogo","titulo":"","resumo":"","setores":["engenharia"],"fornecedor":{"nome":"","cnpj":"","contato":"","telefone":"","email":"","cidade":""}},"itens":[{"tipo":"produto","titulo":"","modulo":"engenharia","codigo":"","descricao":"","categoria":"perfil","unidade":"","preco":null,"peso_kg_m":null,"tamanho_barra_mm":null,"linha":"","aplicacao":"","conteudo":null,"confianca":0.9}]}`
  const prompt=[`Tipo informado: ${tipo}`,nome?`Arquivo: ${nome}`:'',descricao?`Explicação do usuário:\n${descricao}`:'',texto?`Texto extraído:\n${texto.slice(0,55000)}`:'',imagens.length?'Analise também a imagem anexada.':''].filter(Boolean).join('\n\n')
  const r=await consultarOpenCode({accessToken:token,tituloSessao:'Central de Aprendizado Atlas',system,prompt,anexos:imagens})
  return jsonIA(r.resposta)||{documento:{tipo,titulo:nome||'Material',resumo:r.resposta.slice(0,4000),setores:[]},itens:[]}
}
async function fornecedorExistente(empresaId:string,f:any){
  if(!f)return {existente:null as any,ambiguos:[] as any[]}
  const {data}=await supabaseAdmin.from('fornecedores').select('id,nome,cnpj_cpf,contato,telefone,email,cidade').eq('empresa_id',empresaId).limit(3000)
  const lista=data||[]
  const c=dig(f.cnpj)
  if(c){
    const x=lista.find((i:any)=>dig(i.cnpj_cpf)===c)
    if(x)return {existente:x,ambiguos:[]}
  }
  const n=norm(f.nome)
  if(n){
    const exatos=lista.filter((i:any)=>norm(i.nome)===n)
    if(exatos.length===1)return {existente:exatos[0],ambiguos:[]}
    const proximos=lista
      .map((i:any)=>({item:i,score:similaridadeNome(f.nome,i.nome)}))
      .filter((x:any)=>x.score>=.92)
      .sort((a:any,b:any)=>b.score-a.score)
      .slice(0,2)
    if(proximos.length===1)return {existente:proximos[0].item,ambiguos:[]}
  }
  return {existente:null,ambiguos:[]}
}
async function produtoExistente(empresaId:string,fornecedorId:string|null,codigo:string,descricao:string){
  const c=cod(codigo)
  if(fornecedorId&&c){
    const {data}=await supabaseAdmin.from('produto_fornecedores').select('produto_id,codigo_fornecedor,produtos(id,nome,codigo,categoria,unidade,peso_kg_m,tamanho_barra_mm)').eq('empresa_id',empresaId).eq('fornecedor_id',fornecedorId).eq('ativo',true).limit(5000)
    const x=(data||[]).find((i:any)=>cod(i.codigo_fornecedor)===c)
    if(x)return {produto:(x as any).produtos,metodo:'codigo_fornecedor',confianca:1}
  }
  const {data}=await supabaseAdmin.from('produtos').select('id,nome,codigo,codigo_origem,categoria,unidade,peso_kg_m,tamanho_barra_mm,status_validacao').eq('empresa_id',empresaId).limit(10000)
  if(c){
    const xs=(data||[]).filter((p:any)=>[p.codigo,p.codigo_origem].some(v=>cod(v)===c))
    if(xs.length===1)return {produto:xs[0],metodo:'codigo_atlas',confianca:.98}
    if(xs.length>1)return {produto:null,metodo:'ambiguo',confianca:.3,ambiguos:xs.slice(0,8)}
  }
  const n=norm(descricao)
  if(n){ const xs=(data||[]).filter((p:any)=>norm(p.nome)===n); if(xs.length===1)return {produto:xs[0],metodo:'nome_exato',confianca:.9}; if(xs.length>1)return {produto:null,metodo:'ambiguo',confianca:.3,ambiguos:xs.slice(0,8)} }
  return {produto:null,metodo:'novo',confianca:c?.length?0.8:0.6}
}
async function produtoPorCodigoBanco(empresaId:string,codigo:string){
  const c=txt(codigo,120)
  if(!c)return null
  const {data,error}=await supabaseAdmin.from('produtos')
    .select('id,nome,descricao,codigo,codigo_origem,categoria,unidade,peso_kg_m,tamanho_barra_mm,status_validacao')
    .eq('empresa_id',empresaId).ilike('codigo',c).limit(2)
  if(error)throw new Error(error.message)
  return (data||[])[0]||null
}
async function esperarProdutoPorCodigoBanco(empresaId:string,codigo:string,tentativas=8){
  for(let i=0;i<tentativas;i++){
    const existente=await produtoPorCodigoBanco(empresaId,codigo)
    if(existente)return existente
    if(i<tentativas-1)await new Promise(resolve=>setTimeout(resolve,60*(i+1)))
  }
  return null
}

async function reconciliarProdutoCatalogoNoBanco(usuario:UsuarioTenant,c:any){
  if(c?.tipo!=='produto')return c
  const codigo=txt(c?.dados?.codigo,120)
  if(!codigo)return c
  const existente=await produtoPorCodigoBanco(usuario.empresa_id,codigo)
  if(!existente)return c
  const atualizado={
    ...c,
    destino_id:existente.id,
    acao_sugerida:'vincular_existente',
    deduplicacao:{...(c.deduplicacao||{}),metodo:'codigo_banco',produto_existente:existente,ambiguos:[]}
  }
  await supabaseAdmin.from('ai_aprendizado_candidatos').update({
    destino_id:existente.id,
    acao_sugerida:'vincular_existente',
    deduplicacao:atualizado.deduplicacao,
    updated_at:new Date().toISOString()
  }).eq('empresa_id',usuario.empresa_id).eq('id',c.id)
  return atualizado
}

async function criarCandidatos(usuario:UsuarioTenant,entradaId:string,x:any,fornecedorInfo:any){
  const rows:any[]=[]
  const f=x?.documento?.fornecedor||null
  const fornecedor=fornecedorInfo?.existente||null
  const fornecedorAmbiguos=fornecedorInfo?.ambiguos||[]
  const ehCatalogo=['catalogo','tabela_preco'].includes(String(x?.documento?.tipo||''))
  if(f?.nome||f?.cnpj||ehCatalogo)rows.push({
    entrada_id:entradaId,empresa_id:usuario.empresa_id,tipo:'fornecedor',modulo:'compras',
    titulo:fornecedor?`Fornecedor identificado: ${fornecedor.nome}`:fornecedorAmbiguos.length?`Confirmar fornecedor: ${txt(f?.nome,180)||'catálogo'}`:f?.nome?`Cadastrar fornecedor: ${txt(f.nome,180)}`:'Identificar fornecedor do catálogo',
    dados:{nome:txt(f?.nome,220)||null,cnpj_cpf:dig(f?.cnpj)||null,contato:txt(f?.contato,180)||null,telefone:txt(f?.telefone,80)||null,email:txt(f?.email,180)||null,cidade:txt(f?.cidade,120)||null},
    deduplicacao:{existente:fornecedor||null,ambiguos:fornecedorAmbiguos},
    acao_sugerida:fornecedor?'usar_existente':fornecedorAmbiguos.length?'revisar_ambiguidade':'cadastrar_novo',
    confianca:fornecedor?1:fornecedorAmbiguos.length?.55:.9,
    destino_id:fornecedor?.id||null,
  })
  const chavesProdutos=new Set<string>()
  let produtosCatalogo:any[]=[]
  let vinculosCatalogo:any[]=[]
  if(ehCatalogo){
    const [rp,rv]=await Promise.all([
      supabaseAdmin.from('produtos').select('id,nome,codigo,codigo_origem,categoria,unidade,peso_kg_m,tamanho_barra_mm,status_validacao').eq('empresa_id',usuario.empresa_id).limit(12000),
      fornecedor?.id
        ?supabaseAdmin.from('produto_fornecedores').select('produto_id,codigo_fornecedor,produtos(id,nome,codigo,categoria,unidade,peso_kg_m,tamanho_barra_mm)').eq('empresa_id',usuario.empresa_id).eq('fornecedor_id',fornecedor.id).eq('ativo',true).limit(12000)
        :Promise.resolve({data:[] as any[]}),
    ])
    produtosCatalogo=rp.data||[]
    vinculosCatalogo=rv.data||[]
  }
  function produtoCatalogo(codigo:string,descricao:string){
    const c=cod(codigo)
    if(fornecedor?.id&&c){
      const v=vinculosCatalogo.find((i:any)=>cod(i.codigo_fornecedor)===c)
      if(v)return {produto:(v as any).produtos,metodo:'codigo_fornecedor',confianca:1}
    }
    if(c){
      const xs=produtosCatalogo.filter((p:any)=>[p.codigo,p.codigo_origem].some(v=>cod(v)===c))
      if(xs.length===1){
        const mesmoNome=norm(xs[0].nome)===norm(descricao)
        if(mesmoNome)return {produto:xs[0],metodo:'codigo_atlas_nome',confianca:.99}
        return {produto:null,metodo:'ambiguo',confianca:.45,ambiguos:xs}
      }
      if(xs.length>1)return {produto:null,metodo:'ambiguo',confianca:.3,ambiguos:xs.slice(0,8)}
    }
    const n=norm(descricao)
    if(n){
      const xs=produtosCatalogo.filter((p:any)=>norm(p.nome)===n)
      if(xs.length===1)return {produto:xs[0],metodo:'nome_exato',confianca:.9}
      if(xs.length>1)return {produto:null,metodo:'ambiguo',confianca:.3,ambiguos:xs.slice(0,8)}
    }
    return {produto:null,metodo:'novo',confianca:c?.length?0.8:0.6}
  }
  for(const item of Array.isArray(x?.itens)?x.itens.slice(0,1200):[]){
    if(String(item.tipo)==='produto'||String(item.tipo)==='preco'){
      const codigo=txt(item.codigo,120), descricao=txt(item.descricao||item.titulo,400)
      if(!codigo&&!descricao)continue
      const chaveProduto=codigo?'COD:'+cod(codigo):'DESC:'+norm(descricao)
      if(chavesProdutos.has(chaveProduto))continue
      chavesProdutos.add(chaveProduto)
      const p=ehCatalogo?produtoCatalogo(codigo,descricao):await produtoExistente(usuario.empresa_id,fornecedor?.id||null,codigo,descricao)
      const cat=CATEGORIAS.has(txt(item.categoria,80).toLowerCase())?txt(item.categoria,80).toLowerCase():'outro'
      rows.push({
        entrada_id:entradaId,empresa_id:usuario.empresa_id,tipo:'produto',
        modulo:MODULOS.has(txt(item.modulo,50))?txt(item.modulo,50):'engenharia',
        titulo:codigo?`${codigo} — ${descricao||'Produto'}`:descricao,
        dados:{codigo:codigo||null,descricao:descricao||null,categoria:cat,unidade:txt(item.unidade,30)||null,preco_fornecedor:num(item.preco),peso_kg_m:num(item.peso_kg_m),tamanho_barra_mm:num(item.tamanho_barra_mm),linha:txt(item.linha,120)||null,aplicacao:txt(item.aplicacao,1000)||null,pagina_catalogo:num(item.pagina_catalogo),fornecedor_nome:txt(f?.nome,220)||null,fornecedor_cnpj:dig(f?.cnpj)||null},
        deduplicacao:{metodo:p.metodo,produto_existente:p.produto||null,ambiguos:(p as any).ambiguos||[]},
        acao_sugerida:p.produto?'vincular_existente':p.metodo==='ambiguo'?'revisar_ambiguidade':'cadastrar_novo',
        confianca:Math.min(num(item.confianca)??p.confianca,p.produto?1:.95),
        destino_id:p.produto?.id||null,
      })
    } else if(String(item.tipo)==='conhecimento'){
      const conteudo=txt(item.conteudo||item.descricao,30000); if(!conteudo)continue
      const modulo=MODULOS.has(txt(item.modulo,50))?txt(item.modulo,50):null
      rows.push({entrada_id:entradaId,empresa_id:usuario.empresa_id,tipo:'conhecimento',modulo,titulo:txt(item.titulo,180)||conteudo.slice(0,120),dados:{conteudo,aplicacao:txt(item.aplicacao,1000)||null},deduplicacao:{},acao_sugerida:modulo?'validar_conhecimento_setorial':'definir_setor',confianca:num(item.confianca)??.7})
    }
  }
  if(rows.length){const {error}=await supabaseAdmin.from('ai_aprendizado_candidatos').insert(rows);if(error)throw new Error(error.message)}
  return rows.length
}
async function assinar(e:any){
  if(!e?.storage_path)return {...e,fonte_url:null}
  const {data}=await supabaseAdmin.storage.from('atlas-aprendizado').createSignedUrl(e.storage_path,1800)
  return {...e,fonte_url:data?.signedUrl||null}
}
async function resolverFornecedor(usuario:UsuarioTenant,entrada:any,c:any){
  if(c?.tipo==='fornecedor'&&c.destino_id)return c.destino_id
  if(entrada.fornecedor_id_sugerido)return entrada.fornecedor_id_sugerido
  const {data}=await supabaseAdmin.from('ai_aprendizado_candidatos').select('destino_id').eq('empresa_id',usuario.empresa_id).eq('entrada_id',entrada.id).eq('tipo','fornecedor').eq('status','aplicado').limit(1).maybeSingle()
  return data?.destino_id||null
}
async function copiarFonte(usuario:UsuarioTenant,entrada:any,fornecedorId:string){
  if(!entrada.storage_path||!entrada.fonte_nome)return null
  const {data:ja}=await supabaseAdmin.from('fornecedor_documentos').select('id').eq('empresa_id',usuario.empresa_id).eq('fornecedor_id',fornecedorId).eq('nome_arquivo',entrada.fonte_nome).limit(1).maybeSingle()
  if(ja)return ja.id
  const {data:file,error}=await supabaseAdmin.storage.from('atlas-aprendizado').download(entrada.storage_path);if(error||!file)return null
  const nome=String(entrada.fonte_nome).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9._-]+/g,'_').slice(0,140)
  const path=`fornecedores/${fornecedorId}/${randomUUID()}-${nome}`
  const buffer=Buffer.from(await file.arrayBuffer())
  const {error:up}=await supabaseAdmin.storage.from('fotos').upload(path,buffer,{contentType:entrada.mime_type||'application/octet-stream',upsert:false});if(up)return null
  const {data:pub}=supabaseAdmin.storage.from('fotos').getPublicUrl(path)
  const {data:doc}=await supabaseAdmin.from('fornecedor_documentos').insert({empresa_id:usuario.empresa_id,fornecedor_id:fornecedorId,tipo:entrada.tipo==='tabela_preco'?'tabela_preco':'catalogo',nome_arquivo:entrada.fonte_nome,url:pub.publicUrl,mime_type:entrada.mime_type,tamanho_bytes:entrada.tamanho_bytes,status:'processado',texto_extraido:entrada.texto_extraido,extracao_metodo:'central_aprendizado_validada',custo_modelo:0,criado_por_id:usuario.id,criado_por_nome:usuario.nome}).select('id').single()
  return doc?.id||null
}
async function aplicar(usuario:UsuarioTenant,c:any,entrada:any,contexto?:{fornecedorId?:string|null;documentoId?:string|null}){
  if(c.tipo==='fornecedor'){
    if(c.destino_id){await supabaseAdmin.from('ai_aprendizado_entradas').update({fornecedor_id_sugerido:c.destino_id,updated_at:new Date().toISOString()}).eq('empresa_id',usuario.empresa_id).eq('id',entrada.id);await copiarFonte(usuario,entrada,c.destino_id);return c.destino_id}
    const d=c.dados||{}, cnpj=dig(d.cnpj_cpf), nome=txt(d.nome,220)
    if(!nome)throw new Error('Fornecedor sem nome.')
    const {data,error}=await supabaseAdmin.from('fornecedores').insert({empresa_id:usuario.empresa_id,nome,cnpj_cpf:cnpj||null,contato:txt(d.contato,180)||null,telefone:txt(d.telefone,80)||null,email:txt(d.email,180)||null,cidade:txt(d.cidade,120)||null,ativo:true,criado_por_id:usuario.id,criado_por_nome:usuario.nome,observacoes:'Criado após validação na Central de Aprendizado Atlas.'}).select('id').single();if(error)throw new Error(error.message)
    await supabaseAdmin.from('ai_aprendizado_entradas').update({fornecedor_id_sugerido:data.id,updated_at:new Date().toISOString()}).eq('empresa_id',usuario.empresa_id).eq('id',entrada.id);await copiarFonte(usuario,entrada,data.id);return data.id
  }
  if(c.tipo==='produto'){
    const d=c.dados||{};let produtoId=c.destino_id as string|null
    if(!produtoId){
      const descricao=txt(d.descricao||c.titulo,400),codigo=txt(d.codigo,120)||null,categoria=CATEGORIAS.has(String(d.categoria||''))?String(d.categoria):'outro'
      if(codigo){
        const existente=await produtoPorCodigoBanco(usuario.empresa_id,codigo)
        if(existente)produtoId=existente.id
      }
      if(!produtoId){
        const {data,error}=await supabaseAdmin.from('produtos').insert({empresa_id:usuario.empresa_id,nome:descricao.toUpperCase(),descricao,codigo,codigo_origem:codigo,categoria,unidade:txt(d.unidade,30)||(categoria==='perfil'?'BR':'UN'),preco:0,peso_kg_m:num(d.peso_kg_m),tamanho_barra_mm:num(d.tamanho_barra_mm),origem:'central_aprendizado',ativo:true,status_validacao:'revisado',validado_em:new Date().toISOString(),validado_por_id:usuario.id,validado_por_nome:usuario.nome,observacao_validacao:'Validado pela Central de Aprendizado.',criado_por_id:usuario.id,criado_por_nome:usuario.nome,dados_origem:{entrada_id:entrada.id,linha:d.linha||null,aplicacao:d.aplicacao||null}}).select('id').single()
        if(error){
          if((error as any)?.code==='23505'&&codigo){
            const existente=await esperarProdutoPorCodigoBanco(usuario.empresa_id,codigo)
            if(existente)produtoId=existente.id
            else throw new Error('O código '+codigo+' já existe, mas ainda não foi possível reconciliá-lo. Tente novamente em alguns segundos.')
          }else throw new Error(error.message)
        }else produtoId=data.id
      }
    }
    const fornecedorId=contexto?.fornecedorId!==undefined?contexto.fornecedorId:await resolverFornecedor(usuario,entrada,null)
    const temFornecedorNoMaterial=Boolean(entrada.fornecedor_nome_sugerido||entrada.fornecedor_cnpj_sugerido)
    if(temFornecedorNoMaterial&&!fornecedorId)throw new Error('Valide o fornecedor deste material antes de aprovar os produtos.')
    if(fornecedorId){
      const docId=contexto?.documentoId!==undefined?contexto.documentoId:await copiarFonte(usuario,entrada,fornecedorId)
      const codigo=txt(d.codigo,120)
      if(!codigo)throw new Error('Informe o código do fornecedor antes de aprovar este item.')
      const {data:v,error}=await supabaseAdmin.from('produto_fornecedores').upsert({empresa_id:usuario.empresa_id,produto_id:produtoId,fornecedor_id:fornecedorId,codigo_fornecedor:codigo,descricao_fornecedor:txt(d.descricao,400)||c.titulo,unidade_compra:txt(d.unidade,30)||null,preco_atual:num(d.preco_fornecedor),documento_origem_id:docId,preco_atualizado_em:num(d.preco_fornecedor)!==null?new Date().toISOString():null,preferencial:false,ativo:true,criado_por_id:usuario.id,criado_por_nome:usuario.nome,updated_at:new Date().toISOString()},{onConflict:'fornecedor_id,codigo_fornecedor'}).select('id').single();if(error)throw new Error(error.message)
      const preco=num(d.preco_fornecedor)
      if(preco!==null&&v?.id)await supabaseAdmin.from('produto_fornecedor_precos_historico').insert({empresa_id:usuario.empresa_id,produto_fornecedor_id:v.id,fornecedor_id:fornecedorId,produto_id:produtoId,preco,unidade_compra:txt(d.unidade,30)||null,documento_origem_id:docId,criado_por_id:usuario.id,criado_por_nome:usuario.nome})
    }
    return produtoId
  }
  if(c.tipo==='conhecimento'){
    const modulo=String(c.modulo||'');if(!MODULOS.has(modulo))throw new Error('Defina o setor antes de aprovar.')
    const titulo=txt(c.titulo,180),conteudo=txt(c.dados?.conteudo,50000);if(!titulo||!conteudo)throw new Error('Título e conteúdo obrigatórios.')
    const {data:m,error:me}=await supabaseAdmin.from('ai_memorias').insert({empresa_id:usuario.empresa_id,escopo:'especialista:'+modulo,titulo,conteudo,aprovado_por_id:usuario.id,aprovado_por_nome:usuario.nome,ativo:true}).select('id').single();if(me)throw new Error(me.message)
    const {data:k,error}=await supabaseAdmin.from('ai_conhecimento_setor').insert({empresa_id:usuario.empresa_id,modulo,titulo,conteudo,resumo_ia:entrada.resumo_ia||null,fonte_tipo:entrada.tipo==='curso'||entrada.tipo==='apostila'?'arquivo':'conversa',fonte_nome:entrada.fonte_nome||null,status:'validado',criado_por_id:entrada.criado_por_id||usuario.id,criado_por_nome:entrada.criado_por_nome||usuario.nome,validado_por_id:usuario.id,validado_por_nome:usuario.nome,validado_em:new Date().toISOString(),memoria_id:m.id,metadados:{origem:'central_aprendizado',entrada_id:entrada.id,candidato_id:c.id}}).select('id').single();if(error)throw new Error(error.message);return k.id
  }
  throw new Error('Tipo de candidato não suportado.')
}
function conflitosProdutoCatalogo(c:any){
  const d=c?.dados||{}, p=c?.deduplicacao?.produto_existente
  const conflitos:Array<{campo:string;atlas:any;catalogo:any}>=[]
  if(!p)return conflitos
  const descAtlas=txt(p.nome||p.descricao,400), descCatalogo=txt(d.descricao,400)
  const na=norm(descAtlas), nc=norm(descCatalogo)
  if(na&&nc&&na!==nc&&!na.includes(nc)&&!nc.includes(na))conflitos.push({campo:'descricao',atlas:descAtlas,catalogo:descCatalogo})
  const cat=String(d.categoria||'')
  if(cat&&cat!=='outro'&&p.categoria&&String(p.categoria)!=='outro'&&norm(cat)!==norm(p.categoria))conflitos.push({campo:'categoria',atlas:p.categoria,catalogo:cat})
  if(d.unidade&&p.unidade&&norm(d.unidade)!==norm(p.unidade))conflitos.push({campo:'unidade',atlas:p.unidade,catalogo:d.unidade})
  const pesoNovo=num(d.peso_kg_m), pesoAtlas=num(p.peso_kg_m)
  if(pesoNovo!==null&&pesoAtlas!==null&&Math.abs(pesoNovo-pesoAtlas)>Math.max(.01,Math.abs(pesoAtlas)*.03))conflitos.push({campo:'peso_kg_m',atlas:pesoAtlas,catalogo:pesoNovo})
  const barraNova=num(d.tamanho_barra_mm), barraAtlas=num(p.tamanho_barra_mm)
  if(barraNova!==null&&barraAtlas!==null&&Math.abs(barraNova-barraAtlas)>2)conflitos.push({campo:'tamanho_barra_mm',atlas:barraAtlas,catalogo:barraNova})
  return conflitos
}

function motivoPendenciaCatalogo(c:any){
  if(c.tipo==='fornecedor'){
    if(c.acao_sugerida==='revisar_ambiguidade')return 'Encontrei fornecedor parecido. Confirme qual é para evitar duplicidade.'
    if(!txt(c.dados?.nome,220)&&!dig(c.dados?.cnpj_cpf))return 'Não consegui identificar o fornecedor com segurança.'
    return null
  }
  if(c.tipo==='produto'){
    if(c.acao_sugerida==='revisar_ambiguidade')return 'Encontrei mais de um produto possível para o mesmo item.'
    if(!txt(c.dados?.codigo,120))return 'O catálogo não trouxe código suficiente para vincular este item.'
    if(conflitosProdutoCatalogo(c).length)return 'O catálogo diverge de dados técnicos já cadastrados no Atlas.'
    if(Number(c.confianca??0)<.72)return 'A leitura deste item ficou com confiança baixa.'
    return null
  }
  if(c.tipo==='conhecimento'){
    if(!c.modulo)return 'A IA não conseguiu definir o setor deste conhecimento.'
    if(Number(c.confianca??0)<.85)return 'O conteúdo técnico ficou com confiança baixa.'
    return null
  }
  return 'Item precisa de revisão.'
}

async function pendenciarCatalogo(usuario:UsuarioTenant,c:any,motivo:string){
  const conflitos=c.tipo==='produto'?conflitosProdutoCatalogo(c):[]
  await supabaseAdmin.from('ai_aprendizado_candidatos').update({
    status:'pendente',
    acao_sugerida:conflitos.length?'revisar_conflito':c.acao_sugerida==='revisar_ambiguidade'?'revisar_ambiguidade':'revisar_pendencia',
    deduplicacao:{...(c.deduplicacao||{}),conflitos},
    observacao_validacao:motivo,
    updated_at:new Date().toISOString()
  }).eq('empresa_id',usuario.empresa_id).eq('id',c.id)
  await log(usuario,'catalogo_pendencia_detectada',c.entrada_id,c.id,{motivo,conflitos})
}

async function aplicarCatalogoAutomatico(usuario:UsuarioTenant,c:any,entrada:any,contexto?:{fornecedorId?:string|null;documentoId?:string|null}){
  const destino=await aplicar(usuario,c,entrada,contexto)
  await supabaseAdmin.from('ai_aprendizado_candidatos').update({
    status:'aplicado',destino_id:destino,validado_por_id:usuario.id,
    validado_por_nome:'Atlas — catálogo oficial',validado_em:new Date().toISOString(),
    observacao_validacao:'Aplicado automaticamente a partir de catálogo/tabela oficial do fornecedor.',
    updated_at:new Date().toISOString()
  }).eq('empresa_id',usuario.empresa_id).eq('id',c.id)
  await log(usuario,'catalogo_item_aplicado_automaticamente',entrada.id,c.id,{tipo:c.tipo,destino_id:destino})
}

async function processarCatalogoAutomatico(usuario:UsuarioTenant,entradaId:string){
  let {data:entrada}=await supabaseAdmin.from('ai_aprendizado_entradas').select('*').eq('empresa_id',usuario.empresa_id).eq('id',entradaId).maybeSingle()
  if(!entrada)return {aplicados:0,pendentes:0}
  const {data:lista}=await supabaseAdmin.from('ai_aprendizado_candidatos').select('*')
    .eq('empresa_id',usuario.empresa_id).eq('entrada_id',entradaId)
    .in('status',['pendente','corrigido','aprovado']).order('created_at',{ascending:true})
  let aplicados=0

  for(const c of (lista||[]).filter((x:any)=>x.tipo==='fornecedor')){
    const motivo=motivoPendenciaCatalogo(c)
    if(motivo){await pendenciarCatalogo(usuario,c,motivo);continue}
    await aplicarCatalogoAutomatico(usuario,c,entrada);aplicados++
    const r=await supabaseAdmin.from('ai_aprendizado_entradas').select('*').eq('empresa_id',usuario.empresa_id).eq('id',entradaId).maybeSingle()
    entrada=r.data||entrada
  }

  const fornecedorNecessario=entrada.tipo==='catalogo'||entrada.tipo==='tabela_preco'||Boolean(entrada.fornecedor_nome_sugerido||entrada.fornecedor_cnpj_sugerido)
  const fornecedorId=await resolverFornecedor(usuario,entrada,null)
  const documentoId=fornecedorId?await copiarFonte(usuario,entrada,fornecedorId):null
  const outros=(lista||[]).filter((x:any)=>x.tipo!=='fornecedor')
  for(let i=0;i<outros.length;i+=12){
    const lote=outros.slice(i,i+12)
    const resultados=await Promise.all(lote.map(async(c:any)=>{
      if(c.tipo==='produto'&&fornecedorNecessario&&!fornecedorId){
        await supabaseAdmin.from('ai_aprendizado_candidatos').update({
          acao_sugerida:'aguardar_fornecedor',
          observacao_validacao:'Aguardando apenas a confirmação do fornecedor; depois o Atlas continua este catálogo automaticamente.',
          updated_at:new Date().toISOString()
        }).eq('empresa_id',usuario.empresa_id).eq('id',c.id)
        return 0
      }
      const reconciliado=c.tipo==='produto'?await reconciliarProdutoCatalogoNoBanco(usuario,c):c
      const motivo=motivoPendenciaCatalogo(reconciliado)
      if(motivo){await pendenciarCatalogo(usuario,reconciliado,motivo);return 0}
      await aplicarCatalogoAutomatico(usuario,reconciliado,entrada,{fornecedorId,documentoId})
      return 1
    }))
    aplicados+=resultados.reduce((s:number,n:number)=>s+n,0)
  }

  const {data:restantes}=await supabaseAdmin.from('ai_aprendizado_candidatos').select('id,acao_sugerida')
    .eq('empresa_id',usuario.empresa_id).eq('entrada_id',entradaId).in('status',['pendente','corrigido','aprovado'])
  const reais=(restantes||[]).filter((c:any)=>c.acao_sugerida!=='aguardar_fornecedor')
  await supabaseAdmin.from('ai_aprendizado_entradas').update({
    status:reais.length?'aguardando_validacao':'concluido',
    metadados:{...(entrada.metadados||{}),modo_catalogo:'automatico_por_excecao',itens_aplicados_automaticamente:aplicados,pendencias_reais:reais.length},
    updated_at:new Date().toISOString()
  }).eq('empresa_id',usuario.empresa_id).eq('id',entradaId)
  return {aplicados,pendentes:reais.length}
}

async function concluir(empresaId:string,entradaId:string){
  const {data}=await supabaseAdmin.from('ai_aprendizado_candidatos').select('status').eq('empresa_id',empresaId).eq('entrada_id',entradaId)
  if(!(data||[]).some((c:any)=>['pendente','corrigido','aprovado'].includes(c.status)))await supabaseAdmin.from('ai_aprendizado_entradas').update({status:'concluido',updated_at:new Date().toISOString()}).eq('empresa_id',empresaId).eq('id',entradaId)
}

export async function GET(req:NextRequest){
  try{
    const u=await autenticarTenant(req);if(!u)return NextResponse.json({error:'Sessão inválida.'},{status:401})
    const entradaId=txt(req.nextUrl.searchParams.get('entradaId'),80), status=txt(req.nextUrl.searchParams.get('status'),40)
    let q=supabaseAdmin.from('ai_aprendizado_entradas').select('*').eq('empresa_id',u.empresa_id).order('created_at',{ascending:false}).limit(200);if(entradaId)q=q.eq('id',entradaId)
    const {data:entradas,error:e1}=await q;if(e1)throw e1
    let qc=supabaseAdmin.from('ai_aprendizado_candidatos').select('*').eq('empresa_id',u.empresa_id).order('created_at',{ascending:false}).limit(3000);if(entradaId)qc=qc.eq('entrada_id',entradaId);if(['pendente','aprovado','rejeitado','corrigido','aplicado'].includes(status))qc=qc.eq('status',status)
    const {data:candidatos,error:e2}=await qc;if(e2)throw e2
    const cs=await Promise.all((candidatos||[]).map(async(c:any)=>({...c,pode_validar:await podeValidar(u,c)})))
    return NextResponse.json({entradas:await Promise.all((entradas||[]).map(assinar)),candidatos:cs,totais:{pendentes:cs.filter(c=>['pendente','corrigido'].includes(c.status)&&c.acao_sugerida!=='aguardar_fornecedor').length,aplicados:cs.filter(c=>c.status==='aplicado').length,rejeitados:cs.filter(c=>c.status==='rejeitado').length}})
  }catch(e:any){return NextResponse.json({error:e?.message||'Erro ao carregar Central.'},{status:500})}
}

export async function POST(req:NextRequest){
  let id:string|null=null
  try{
    const u=await autenticarTenant(req);if(!u)return NextResponse.json({error:'Sessão inválida.'},{status:401})
    const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim(), body=await req.json()
    const tipo=TIPOS.has(txt(body?.tipo,40))?txt(body.tipo,40):'outro', descricao=txt(body?.descricao,12000), titulo=txt(body?.titulo,180)
    const a=anexo(body?.anexo) || await anexoRemoto(body?.arquivo,u)
    if(!descricao&&!a)return NextResponse.json({error:'Envie um arquivo ou escreva o que deseja ensinar.'},{status:400})
    const {data:entrada,error}=await supabaseAdmin.from('ai_aprendizado_entradas').insert({empresa_id:u.empresa_id,tipo,titulo:titulo||a?.nome||descricao.slice(0,120)||'Material',descricao:descricao||null,status:'analisando',fonte_nome:a?.nome||null,mime_type:a?.mediaType||null,criado_por_id:u.id,criado_por_nome:u.nome,metadados:{origem:'central_aprendizado_geral'}}).select('*').single();if(error)throw error;const entradaId=String(entrada.id);id=entradaId
    await log(u,'entrada_recebida',entradaId,null,{tipo})
    const fonte=await preparar(u,entradaId,a);await supabaseAdmin.from('ai_aprendizado_entradas').update({storage_path:fonte.path,tamanho_bytes:fonte.size||null,texto_extraido:fonte.texto||null,updated_at:new Date().toISOString()}).eq('empresa_id',u.empresa_id).eq('id',entradaId)
    if((a as any)?.ingestPath)await supabaseAdmin.storage.from('atlas-aprendizado').remove([(a as any).ingestPath])
    const x=await analisar(token,tipo,descricao,a?.nome||null,fonte.texto,fonte.imagens,fonte.paginas), fd=x?.documento?.fornecedor||null, f=await fornecedorExistente(u.empresa_id,fd)
    const total=await criarCandidatos(u,entradaId,x,f), tipoDetectado=TIPOS.has(txt(x?.documento?.tipo,40))?txt(x.documento.tipo,40):tipo, setores=Array.isArray(x?.documento?.setores)?x.documento.setores.filter((s:any)=>MODULOS.has(String(s))).slice(0,15):[]
    const catalogoAutomatico=tipoDetectado==='catalogo'||tipoDetectado==='tabela_preco'
    const {data:at,error:ue}=await supabaseAdmin.from('ai_aprendizado_entradas').update({
      tipo:tipoDetectado,titulo:txt(x?.documento?.titulo,180)||entrada.titulo,resumo_ia:txt(x?.documento?.resumo,8000)||null,
      setores_sugeridos:setores,fornecedor_id_sugerido:f?.existente?.id||null,fornecedor_nome_sugerido:txt(fd?.nome,220)||null,
      fornecedor_cnpj_sugerido:dig(fd?.cnpj)||null,status:catalogoAutomatico?'analisando':'aguardando_validacao',erro:null,
      metadados:{...(entrada.metadados||{}),validacao:catalogoAutomatico?'por_excecao':'humana',extracao_metodo:txt(x?.documento?.extracao_metodo,80)||'ia'},
      updated_at:new Date().toISOString()
    }).eq('empresa_id',u.empresa_id).eq('id',entradaId).select('*').single();if(ue)throw ue
    await log(u,'analise_concluida',entradaId,null,{tipo_detectado:tipoDetectado,total_candidatos:total,fornecedor_existente_id:f?.existente?.id||null})
    if(catalogoAutomatico){
      const auto=await processarCatalogoAutomatico(u,entradaId)
      const {data:final}=await supabaseAdmin.from('ai_aprendizado_entradas').select('*').eq('empresa_id',u.empresa_id).eq('id',entradaId).single()
      return NextResponse.json({
        entrada:await assinar(final||at),total_candidatos:total,pendencias:auto.pendentes,
        mensagem:auto.pendentes
          ?`Catálogo processado: ${auto.aplicados} item(ns) aplicados automaticamente e ${auto.pendentes} pendência(s) reais para validar.`
          :`Catálogo processado automaticamente: ${auto.aplicados} item(ns) cadastrados/vinculados, sem pendências para validação.`
      },{status:201})
    }
    return NextResponse.json({entrada:await assinar(at),total_candidatos:total,pendencias:total,mensagem:`Material analisado. ${total} item(ns) seguem para validação antes de virar regra.`},{status:201})
  }catch(e:any){if(id)await supabaseAdmin.from('ai_aprendizado_entradas').update({status:'erro',erro:String(e?.message||'Erro').slice(0,1000),updated_at:new Date().toISOString()}).eq('id',id);return NextResponse.json({error:e?.message||'Erro ao analisar material.'},{status:500})}
}

export async function PATCH(req:NextRequest){
  try{
    const u=await autenticarTenant(req);if(!u)return NextResponse.json({error:'Sessão inválida.'},{status:401})
    const b=await req.json(),acao=txt(b?.acao,40)
    if(acao==='reprocessar_entrada'){
      const entradaId=txt(b?.entrada_id,80)
      if(!entradaId)return NextResponse.json({error:'Catálogo não informado.'},{status:400})
      const {data:entrada}=await supabaseAdmin.from('ai_aprendizado_entradas').select('*').eq('empresa_id',u.empresa_id).eq('id',entradaId).maybeSingle()
      if(!entrada)return NextResponse.json({error:'Catálogo não encontrado.'},{status:404})
      if(!['catalogo','tabela_preco'].includes(String(entrada.tipo)))return NextResponse.json({error:'Somente catálogo ou tabela de preço pode ser reprocessado por esta ação.'},{status:400})
      await supabaseAdmin.from('ai_aprendizado_entradas').update({status:'analisando',erro:null,updated_at:new Date().toISOString()}).eq('empresa_id',u.empresa_id).eq('id',entradaId)
      const auto=await processarCatalogoAutomatico(u,entradaId)
      return NextResponse.json({
        mensagem:auto.pendentes
          ?'Catálogo reprocessado: '+auto.aplicados+' item(ns) aplicados e '+auto.pendentes+' pendência(s) para validar.'
          :'Catálogo reprocessado: '+auto.aplicados+' item(ns) aplicados, sem pendências.',
        ...auto,
      })
    }
    const id=txt(b?.id,80);if(!id)return NextResponse.json({error:'Candidato não informado.'},{status:400})
    const {data:c}=await supabaseAdmin.from('ai_aprendizado_candidatos').select('*').eq('empresa_id',u.empresa_id).eq('id',id).maybeSingle();if(!c)return NextResponse.json({error:'Candidato não encontrado.'},{status:404});if(!(await podeValidar(u,c)))return NextResponse.json({error:'Sem permissão para validar.'},{status:403})
    const {data:entrada}=await supabaseAdmin.from('ai_aprendizado_entradas').select('*').eq('empresa_id',u.empresa_id).eq('id',c.entrada_id).maybeSingle();if(!entrada)return NextResponse.json({error:'Entrada não encontrada.'},{status:404})
    if(acao==='editar_item_catalogo'){
      if(c.tipo!=='produto')return NextResponse.json({error:'Esta edição é exclusiva para itens de catálogo.'},{status:400})
      const recebido=b?.dados&&typeof b.dados==='object'?b.dados:{}
      const anterior=c.dados&&typeof c.dados==='object'?c.dados:{}
      const categoriaInformada=txt(recebido.categoria??anterior.categoria,80).toLowerCase()
      const categoria=CATEGORIAS.has(categoriaInformada)?categoriaInformada:'outro'
      const codigo=txt(recebido.codigo??anterior.codigo,120).toUpperCase()||null
      const descricao=txt(recebido.descricao??anterior.descricao??c.titulo,400)
      if(!descricao)return NextResponse.json({error:'Informe a descrição do item.'},{status:400})
      const dados={
        ...anterior,
        codigo,
        descricao,
        categoria,
        unidade:txt(recebido.unidade??anterior.unidade,30)||null,
        preco_fornecedor:num(recebido.preco_fornecedor??anterior.preco_fornecedor),
        peso_kg_m:num(recebido.peso_kg_m??anterior.peso_kg_m),
        tamanho_barra_mm:num(recebido.tamanho_barra_mm??anterior.tamanho_barra_mm),
        linha:txt(recebido.linha??anterior.linha,120)||null,
        aplicacao:txt(recebido.aplicacao??anterior.aplicacao,1000)||null,
        imagem_item_url:txt(recebido.imagem_item_url??anterior.imagem_item_url,2000)||null,
      }
      const titulo=codigo?`${codigo} — ${descricao}`:descricao

      if(c.status==='aplicado'&&c.destino_id){
        const {data:produtoAtual,error:produtoBuscaErro}=await supabaseAdmin.from('produtos')
          .select('id,dados_origem').eq('empresa_id',u.empresa_id).eq('id',c.destino_id).maybeSingle()
        if(produtoBuscaErro)throw produtoBuscaErro
        if(!produtoAtual)return NextResponse.json({error:'O produto vinculado não foi encontrado no Atlas.'},{status:404})
        const {error:produtoErro}=await supabaseAdmin.from('produtos').update({
          nome:descricao.toUpperCase(),
          descricao,
          codigo,
          codigo_origem:codigo,
          categoria,
          unidade:dados.unidade||(categoria==='perfil'?'BR':'UN'),
          peso_kg_m:dados.peso_kg_m,
          tamanho_barra_mm:dados.tamanho_barra_mm,
          dados_origem:{...(produtoAtual.dados_origem||{}),entrada_id:entrada.id,linha:dados.linha,aplicacao:dados.aplicacao},
          status_validacao:'revisado',
          validado_em:new Date().toISOString(),
          validado_por_id:u.id,
          validado_por_nome:u.nome,
        }).eq('empresa_id',u.empresa_id).eq('id',c.destino_id)
        if(produtoErro)throw new Error(produtoErro.message)

        const fornecedorId=await resolverFornecedor(u,entrada,null)
        if(fornecedorId){
          const {error:vinculoErro}=await supabaseAdmin.from('produto_fornecedores').update({
            codigo_fornecedor:codigo,
            descricao_fornecedor:descricao,
            unidade_compra:dados.unidade,
            preco_atual:dados.preco_fornecedor,
            preco_atualizado_em:dados.preco_fornecedor!==null?new Date().toISOString():null,
            updated_at:new Date().toISOString(),
          }).eq('empresa_id',u.empresa_id).eq('produto_id',c.destino_id).eq('fornecedor_id',fornecedorId)
          if(vinculoErro)throw new Error(vinculoErro.message)
        }
      }

      const statusNovo=c.status==='pendente'?'corrigido':c.status
      const {data,error}=await supabaseAdmin.from('ai_aprendizado_candidatos').update({
        titulo,dados,status:statusNovo,
        observacao_validacao:'Item revisado diretamente na visualização do catálogo.',
        validado_por_id:c.status==='aplicado'?u.id:c.validado_por_id,
        validado_por_nome:c.status==='aplicado'?u.nome:c.validado_por_nome,
        validado_em:c.status==='aplicado'?new Date().toISOString():c.validado_em,
        updated_at:new Date().toISOString(),
      }).eq('empresa_id',u.empresa_id).eq('id',id).select('*').single()
      if(error)throw error
      await log(u,'item_catalogo_editado',entrada.id,id,{destino_id:c.destino_id||null,aplicado:c.status==='aplicado'})
      return NextResponse.json({
        candidato:{...data,pode_validar:true},
        mensagem:c.status==='aplicado'
          ?'Item atualizado no catálogo, no produto Atlas e no vínculo do fornecedor.'
          :'Correção salva. O item continua aguardando validação antes de ser aplicado.',
      })
    }
    if(acao==='corrigir'){
      const modulo=txt(b?.modulo,50);if(modulo&&!MODULOS.has(modulo))return NextResponse.json({error:'Setor inválido.'},{status:400})
      const {data,error}=await supabaseAdmin.from('ai_aprendizado_candidatos').update({titulo:txt(b?.titulo,180)||c.titulo,modulo:modulo||c.modulo,dados:b?.dados&&typeof b.dados==='object'?b.dados:c.dados,status:'corrigido',observacao_validacao:txt(b?.observacao,3000)||null,updated_at:new Date().toISOString()}).eq('empresa_id',u.empresa_id).eq('id',id).select('*').single();if(error)throw error;await log(u,'candidato_corrigido',entrada.id,id);return NextResponse.json({candidato:{...data,pode_validar:true}})
    }
    if(acao==='rejeitar'){
      const {data,error}=await supabaseAdmin.from('ai_aprendizado_candidatos').update({status:'rejeitado',validado_por_id:u.id,validado_por_nome:u.nome,validado_em:new Date().toISOString(),observacao_validacao:txt(b?.observacao,3000)||null,updated_at:new Date().toISOString()}).eq('empresa_id',u.empresa_id).eq('id',id).select('*').single();if(error)throw error;await log(u,'candidato_rejeitado',entrada.id,id);await concluir(u.empresa_id,entrada.id);return NextResponse.json({candidato:{...data,pode_validar:true}})
    }
    if(acao==='aprovar'){
      if(!['pendente','corrigido','aprovado'].includes(String(c.status)))return NextResponse.json({error:'Item já concluído.'},{status:409})
      await supabaseAdmin.from('ai_aprendizado_candidatos').update({status:'aprovado',validado_por_id:u.id,validado_por_nome:u.nome,validado_em:new Date().toISOString(),observacao_validacao:txt(b?.observacao,3000)||null,updated_at:new Date().toISOString()}).eq('empresa_id',u.empresa_id).eq('id',id)
      const candidatoAplicar={...c,dados:b?.dados&&typeof b.dados==='object'?b.dados:c.dados}
      const destino=await aplicar(u,candidatoAplicar,entrada)
      const {data,error}=await supabaseAdmin.from('ai_aprendizado_candidatos').update({status:'aplicado',destino_id:destino,validado_por_id:u.id,validado_por_nome:u.nome,validado_em:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('empresa_id',u.empresa_id).eq('id',id).select('*').single();if(error)throw error
      await log(u,'candidato_aplicado',entrada.id,id,{tipo:c.tipo,destino_id:destino})
      let autoRestante:{aplicados:number;pendentes:number}|null=null
      if(c.tipo==='fornecedor'&&(entrada.tipo==='catalogo'||entrada.tipo==='tabela_preco')){
        autoRestante=await processarCatalogoAutomatico(u,entrada.id)
      }else{
        await concluir(u.empresa_id,entrada.id)
      }
      return NextResponse.json({
        candidato:{...data,pode_validar:true},
        mensagem:autoRestante
          ?`Fornecedor confirmado. O Atlas retomou o catálogo: ${autoRestante.aplicados} item(ns) processados automaticamente e ${autoRestante.pendentes} pendência(s) restantes.`
          :c.tipo==='conhecimento'?'Conhecimento aprovado e incorporado ao especialista.'
          :c.tipo==='fornecedor'?'Fornecedor confirmado e vinculado ao material.'
          :'Item aprovado e vinculado/cadastrado no Atlas.'
      })
    }
    return NextResponse.json({error:'Ação inválida.'},{status:400})
  }catch(e:any){return NextResponse.json({error:e?.message||'Erro ao validar item.'},{status:500})}
}