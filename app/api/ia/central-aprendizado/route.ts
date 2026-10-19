import {textoCatalogoGeometrico} from '@/lib/ai/catalogoPdfTexto'
import {pesoDecimalCatalogo} from '@/lib/ai/catalogoPeso'
import {podeAtualizarCandidatoCatalogo,dadosReanaliseCatalogo} from '@/lib/ai/catalogoReanalise'
import {extrairLinhasCatalogo, VERSAO_REGRAS_CATALOGO} from '@/lib/ai/catalogoLinhas'
import {extrairCartoesGeometricos,codigoColadoDeOutrasColunas} from '@/lib/ai/catalogoCartoesGeometria'
import {avaliarCatalogoLote} from '@/lib/ai/catalogoLoteSeguro'
import {compararGeometria, codigoPerfil} from '@/lib/ai/equivalenciaPerfilTecnico'
import {carregarPermissoesIA} from '@/lib/ai/permissoesServer'
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
  if(typeof v==='number')return Number.isFinite(v)?v:null
  if(v===null||v===undefined||v==='') return null
  const n=Number(String(v).replace(/\s/g,'').replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.'))
  return Number.isFinite(n)?n:null
}
// Dados técnicos de catálogo: somente cotas reais, sem inventar dimensões.
function medidasMmCatalogo(valor: unknown): Record<string,number> {
  const resultado: Record<string,number> = {}
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return resultado
  for (const [chave, original] of Object.entries(valor)) {
    if (!/^(A|B|C|D|e)$/.test(chave) || original === '' || original == null) continue
    const n = pesoDecimalCatalogo(original)
    if (n === null || n <= 0 || n > 100000) throw new Error('Cota inválida em ' + chave + '. Use milímetros, por exemplo 23,5.')
    resultado[chave] = n
  }
  return resultado
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
async function podeValidar(usuario:UsuarioTenant,c:any,snapshot?:Awaited<ReturnType<typeof carregarPermissoesIA>>){
 if(usuario.role==='master')return true
 const acesso=snapshot||await carregarPermissoesIA(usuario)
 const dominio=String(c?.modulo||(c?.tipo==='fornecedor'?'compras':'engenharia'))
 if(!acesso.edicoes[dominio])return false
 if(c?.tipo==='produto')return Boolean(acesso.edicoes.catalogo_produto)
 if(c?.tipo==='fornecedor')return Boolean(acesso.edicoes.catalogo_fornecedor)
 return true
}
async function lerPdfCatalogo(b:Buffer){
  const paginas:Array<{pagina:number;texto:string;items?:any[]}>=[]
  const p=await pdfParse(b,{pagerender:async(pageData:any)=>{
    const tc=await pageData.getTextContent({normalizeWhitespace:false,disableCombineTextItems:false})
    const textoPagina=textoCatalogoGeometrico(tc?.items||[])
    paginas.push({pagina:paginas.length+1,texto:textoPagina,items:tc.items})
    return textoPagina
  }})
  return {texto:String(p.text||'').replace(/\r/g,'').trim().slice(0,250000),paginas}
}

async function preparar(usuario:UsuarioTenant,id:string,a:any){
  if(!a)return {path:null as string|null,texto:'',imagens:[] as OpenCodeAnexo[],paginas:[] as Array<{pagina:number;texto:string;items?:any[]}>,size:0}
  const mime=a.mediaType||'application/octet-stream'
  const ehTexto=mime.startsWith('text/')||mime==='application/json'
  let b:Buffer,texto=''
  const imagens:OpenCodeAnexo[]=[]
  const paginas:Array<{pagina:number;texto:string;items?:any[]}>=[]
  if(ehTexto){ texto=String(a.dados).slice(0,250000); b=Buffer.from(a.dados,'utf8') }
  else {
    b=Buffer.from(a.dados,'base64')
    if(b.length>MAX)throw new Error('Arquivo maior que 50 MB.')
    if(mime==='application/pdf'){
      const lido=await lerPdfCatalogo(b)
      texto=lido.texto
      paginas.push(...lido.paginas)
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
  // Produtos em duas colunas viravam F42-012F42-014. Nunca tratar
  // dois códigos completos como um único código cadastral.
  if(codigoColadoDeOutrasColunas(x))return ''
  if(!x||x.length>24||!/\d/.test(x)||/^(LINHA|PERFIL)\d/.test(x))return ''
  const prefixo=x.split(/[-_/]/)[0]||''
  if(['VISTA','PERFIL','LINHA','BARRA','ACABAMENTO','SUPERIOR','INFERIOR','LATERAL','TRAVESSA','MONTANTE'].includes(prefixo))return ''
  if(/^[A-Z]{1,6}\d{0,3}(?:[-_/][A-Z0-9]{2,8}){1,2}$/.test(x))return x
  if(/^[A-Z]{1,6}\d{2,8}[A-Z]{0,3}$/.test(x))return x
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
  if(/^AS INFORMACOES CONTID/.test(x)||/ESTAO SUJEITAS A ALTERACOES/.test(x))return true
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
function extrairProdutosCatalogoLocal(texto:string,fornecedorNome?:string|null,paginas:Array<{pagina:number;texto:string;items?:any[]}>=[]){
  const linhas=texto.split(/\r?\n/).map(limparLinhaCatalogo)
  const linhaPorIndice:string[]=[]
  let linhaAtual=''
  for(let i=0;i<linhas.length;i++){
    const atual=norm(linhas[i])
    const linhaExplicita=linhas[i].match(/^Linha\s+(.{1,60})$/i)
    if(linhaExplicita)linhaAtual='Linha '+linhaExplicita[1]
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

  const cartoes=extrairCartoesGeometricos(paginas)
  const paginaPorCodigo=new Map<string,number>()
  for(const pg of paginas){
    // Cada token do PDF é um código individual; não usar a linha textual
    // agregada que mistura duas colunas com tabulação.
    for(const token of pg.items||[]){
      const codigo=ehCodigoCatalogo(token?.str)
      if(codigo&&!paginaPorCodigo.has(codigo))paginaPorCodigo.set(codigo,pg.pagina)
    }
    for(const l of String(pg.texto||'').split(/\r?\n/)){
      const codigo=ehCodigoCatalogo(l)
      if(codigo&&!paginaPorCodigo.has(codigo))paginaPorCodigo.set(codigo,pg.pagina)
    }
  }

  const itens:any[]=extrairLinhasCatalogo(paginas.length?paginas:[{pagina:1,texto}])
  // Cartões do PDF têm o peso abaixo do código, e a descrição acima
  // NA MESMA posição X. Preferir esta evidência ao texto plano.
  const existentes=new Map(itens.map((i:any)=>[i.codigo,i]))
  for(const card of cartoes){
    const anterior=existentes.get(card.codigo)
    if(anterior){
      const idx=itens.findIndex((i:any)=>i.codigo===card.codigo)
      if(idx>=0)itens[idx]={...anterior,...card}
    }else{
      itens.push(card)
    }
  }
  const vistos=new Set<string>(itens.map(i=>i.codigo))
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
      codigo,descricao,categoria:categoriaCatalogo(descricao,peso),unidade:categoriaCatalogo(descricao,peso)==='perfil'?'KG':null,
      preco:null,peso_kg_m:peso,tamanho_barra_mm:null,linha:linhaPorIndice[i]||null,
      aplicacao:null,conteudo:null,pagina_catalogo:paginaPorCodigo.get(codigo)||null,confianca:peso!==null?.97:.65,
    })

  }
  return itens
}
function analisarCatalogoLocal(tipo:string,descricao:string,nome:string|null,texto:string,paginas:Array<{pagina:number;texto:string;items?:any[]}>=[]){
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

async function remapearCatalogoExistente(usuario:UsuarioTenant,entrada:any){
  if(!entrada?.storage_path||entrada?.mime_type!=='application/pdf')return {mapeados:0,total:0}
  const {data:file,error}=await supabaseAdmin.storage.from('atlas-aprendizado').download(entrada.storage_path)
  if(error||!file)throw new Error('Não foi possível reabrir o PDF do catálogo para preparar as imagens.')
  const buffer=Buffer.from(await file.arrayBuffer())
  const lido=await lerPdfCatalogo(buffer)
  const fornecedorNome=nomeFornecedorCatalogo(lido.texto)
  const extraidos=extrairProdutosCatalogoLocal(lido.texto,fornecedorNome,lido.paginas)
  const porCodigo=new Map(extraidos.map((i:any)=>[cod(i.codigo),i]))
  const paginaPorCodigo=new Map<string,number>()
  for(const pg of lido.paginas){
    for(const token of pg.items||[]){
      const codigo=ehCodigoCatalogo(token?.str)
      if(codigo&&!paginaPorCodigo.has(cod(codigo)))paginaPorCodigo.set(cod(codigo),pg.pagina)
    }
    for(const linha of String(pg.texto||'').split(/\\r?\\n/)){
      const codigo=ehCodigoCatalogo(linha)
      if(codigo&&!paginaPorCodigo.has(cod(codigo)))paginaPorCodigo.set(cod(codigo),pg.pagina)
    }
  }
  const {data:candidatos,error:ce}=await supabaseAdmin.from('ai_aprendizado_candidatos')
    .select('id,dados,status,validado_em,updated_at').eq('empresa_id',usuario.empresa_id).eq('entrada_id',entrada.id).eq('tipo','produto').eq('status','pendente').limit(2000)
  if(ce)throw ce
  let mapeados=0
  const lista=candidatos||[]
  for(let i=0;i<lista.length;i+=20){
    const lote=lista.slice(i,i+20)
    await Promise.all(lote.map(async(c:any)=>{
      // Releitura da página não pode substituir revisão feita pelo usuário.
      if(!podeAtualizarCandidatoCatalogo(c))return
      const codigo=cod(c?.dados?.codigo)
      const item=porCodigo.get(codigo) as any
      const pagina=paginaPorCodigo.get(codigo)||num(item?.pagina_catalogo)
      if(!pagina&&!item)return
      const linhaNova=txt(item?.linha,120)||null
      const linhaAtual=txt(c?.dados?.linha,120)||null
      const linhaAtualValida=linhaAtual&&!ruidoCatalogo(linhaAtual,fornecedorNome)?linhaAtual:null
      const dados={
        ...(c.dados||{}),
        pagina_catalogo:pagina,
        linha:linhaNova||linhaAtualValida,
      }
      const {data:gravado,error:ue}=await supabaseAdmin.from('ai_aprendizado_candidatos').update({dados,updated_at:new Date().toISOString()})
        .eq('empresa_id',usuario.empresa_id).eq('id',c.id).eq('status','pendente')
        .eq('updated_at',c.updated_at).select('id').maybeSingle()
      if(ue)throw ue
      if(gravado&&pagina)mapeados++
    }))
  }
  await supabaseAdmin.from('ai_aprendizado_entradas').update({
    metadados:{...(entrada.metadados||{}),paginas_mapeadas_em:new Date().toISOString(),itens_com_pagina:mapeados},
    updated_at:new Date().toISOString()
  }).eq('empresa_id',usuario.empresa_id).eq('id',entrada.id)
  await log(usuario,'catalogo_paginas_mapeadas',entrada.id,null,{mapeados,total:lista.length})
  return {mapeados,total:lista.length}
}

async function analisar(token:string,tipo:string,descricao:string,nome:string|null,texto:string,imagens:OpenCodeAnexo[],paginas:Array<{pagina:number;texto:string;items?:any[]}>=[]){
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
    const {data}=await supabaseAdmin.from('produto_fornecedores').select('produto_id,codigo_fornecedor,produtos(id,nome,codigo,categoria,unidade,peso_kg_m,tamanho_barra_mm,foto_url)').eq('empresa_id',empresaId).eq('fornecedor_id',fornecedorId).eq('ativo',true).limit(5000)
    const x=(data||[]).find((i:any)=>cod(i.codigo_fornecedor)===c)
    if(x)return {produto:(x as any).produtos,metodo:'codigo_fornecedor',confianca:1}
  }
  const {data}=await supabaseAdmin.from('produtos').select('id,nome,codigo,codigo_origem,categoria,unidade,peso_kg_m,tamanho_barra_mm,status_validacao,foto_url').eq('empresa_id',empresaId).limit(10000)
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

async function lerTodas(query:any){
  const rows:any[]=[]
  for(let offset=0;;offset+=1000){
    const {data,error}=await query.range(offset,offset+999)
    if(error)throw error
    rows.push(...(data||[]))
    if(!data||data.length<1000)return {data:rows,error:null}
  }
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
      supabaseAdmin.from('produtos').select('id,nome,codigo,codigo_origem,categoria,unidade,peso_kg_m,tamanho_barra_mm,status_validacao,foto_url').eq('empresa_id',usuario.empresa_id).limit(12000),
      fornecedor?.id
        ?supabaseAdmin.from('produto_fornecedores').select('produto_id,codigo_fornecedor,produtos(id,nome,codigo,categoria,unidade,peso_kg_m,tamanho_barra_mm,foto_url)').eq('empresa_id',usuario.empresa_id).eq('fornecedor_id',fornecedor.id).eq('ativo',true).limit(12000)
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
  for(const item of Array.isArray(x?.itens)?x.itens:[]){
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
        dados:{codigo:codigo||null,descricao:descricao||null,categoria:cat,unidade:txt(item.unidade,30)||null,preco_fornecedor:num(item.preco),peso_kg_m:pesoDecimalCatalogo(item.peso_kg_m),tamanho_barra_mm:num(item.tamanho_barra_mm),linha:txt(item.linha,120)||null,aplicacao:txt(item.aplicacao,1000)||null,pagina_catalogo:num(item.pagina_catalogo),paginas_referencia:item.paginas_referencia||[item.pagina_catalogo].filter(Boolean),conflito_peso_catalogo:item.conflito_peso_catalogo||null,medidas_mm:item.medidas_mm||{},medidas_polegadas:item.medidas_polegadas||{},evidencia_tabela:item.evidencia_tabela||null,imagem_tipo:item.imagem_tipo||null,familia:item.familia||null,regras_versao:VERSAO_REGRAS_CATALOGO,fornecedor_nome:txt(f?.nome,220)||null,fornecedor_cnpj:dig(f?.cnpj)||null},
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

  const {data:anteriores,error:buscaErro}=await lerTodas(supabaseAdmin.from('ai_aprendizado_candidatos').select('*').eq('empresa_id',usuario.empresa_id).eq('entrada_id',entradaId).order('id'))
  if(buscaErro)throw buscaErro
  const chave=(r:any)=>r.tipo==='produto'?'produto:'+cod(r.dados?.codigo):r.tipo==='fornecedor'?'fornecedor':'conhecimento:'+norm(r.titulo)
  const porChave=new Map((anteriores||[]).map((r:any)=>[chave(r),r]))
  const novos:any[]=[]
  for(const row of rows){
    const anterior=porChave.get(chave(row)) as any
    if(!anterior){novos.push(row);porChave.set(chave(row),row);continue}
    if(!podeAtualizarCandidatoCatalogo(anterior))continue
    const {error}=await supabaseAdmin.from('ai_aprendizado_candidatos').update({
      titulo:row.titulo,dados:dadosReanaliseCatalogo(anterior.dados,row.dados),
      deduplicacao:row.deduplicacao,acao_sugerida:row.acao_sugerida,confianca:row.confianca,
      updated_at:new Date().toISOString()
    }).eq('empresa_id',usuario.empresa_id).eq('id',anterior.id).eq('status','pendente').eq('updated_at',anterior.updated_at)
    if(error)throw error
  }
  for(let i=0;i<novos.length;i+=100){
    const {error}=await supabaseAdmin.from('ai_aprendizado_candidatos').insert(novos.slice(i,i+100))
    if(error)throw error
  }
  return novos.length
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
  if(!await podeValidar(usuario,c))throw Error('Sem permissão para aplicar aprendizado neste destino.')
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
        const {data,error}=await supabaseAdmin.from('produtos').insert({empresa_id:usuario.empresa_id,nome:descricao.toUpperCase(),descricao,codigo,codigo_origem:codigo,categoria,unidade:txt(d.unidade,30)||(categoria==='perfil'?'KG':'UN'),preco:0,peso_kg_m:pesoDecimalCatalogo(d.peso_kg_m),tamanho_barra_mm:num(d.tamanho_barra_mm),foto_url:d.imagem_confirmada===true?d.imagem_item_url||null:null,origem:'central_aprendizado',ativo:true,status_validacao:'revisado',validado_em:new Date().toISOString(),validado_por_id:usuario.id,validado_por_nome:usuario.nome,observacao_validacao:'Validado pela Central de Aprendizado.',criado_por_id:usuario.id,criado_por_nome:usuario.nome,dados_origem:{entrada_id:entrada.id,linha:d.linha||null,medidas_mm:d.medidas_mm||{},medidas_polegadas:d.medidas_polegadas||{},pagina_catalogo:d.pagina_catalogo||null,aplicacao:d.aplicacao||null}}).select('id').single()
        if(error){
          if((error as any)?.code==='23505'&&codigo){
            const existente=await esperarProdutoPorCodigoBanco(usuario.empresa_id,codigo)
            if(existente)produtoId=existente.id
            else throw new Error('O código '+codigo+' já existe, mas ainda não foi possível reconciliá-lo. Tente novamente em alguns segundos.')
          }else throw new Error(error.message)
        }else produtoId=data.id
      }
    }
    if(produtoId){
      const {data:atual,error:le}=await supabaseAdmin.from('produtos').select('id,peso_kg_m,foto_url,dados_origem,updated_at').eq('empresa_id',usuario.empresa_id).eq('id',produtoId).single()
      if(le)throw le
      const patch:any={}
      if(atual.peso_kg_m==null&&pesoDecimalCatalogo(d.peso_kg_m)!==null)patch.peso_kg_m=pesoDecimalCatalogo(d.peso_kg_m)
      if(!atual.foto_url&&d.imagem_confirmada===true&&cod(d.imagem_codigo_validado)===cod(d.codigo))patch.foto_url=d.imagem_item_url
      const origem={...(atual.dados_origem||{})}
      let origemMudou=false
      for(const campo of ['linha','medidas_mm','medidas_polegadas']){
        if((origem[campo]==null||(typeof origem[campo]==='object'&&!Object.keys(origem[campo]).length))&&d[campo]!=null){origem[campo]=d[campo];origemMudou=true}
      }
      if(origemMudou)patch.dados_origem=origem
      if(Object.keys(patch).length){
        const {data:gravado,error:ue}=await supabaseAdmin.from('produtos').update({...patch,updated_at:new Date().toISOString()}).eq('empresa_id',usuario.empresa_id).eq('id',produtoId).eq('updated_at',atual.updated_at).select('id').maybeSingle()
        if(ue)throw ue
        if(!gravado)throw Error('O produto foi alterado por outro usuário. Atualize antes de validar novamente.')
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
  const pesoNovo=pesoDecimalCatalogo(d.peso_kg_m), pesoAtlas=pesoDecimalCatalogo(p.peso_kg_m)
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
    if(Array.isArray(c.dados?.conflito_peso_catalogo)&&c.dados.conflito_peso_catalogo.length>1)return 'O mesmo código apresenta pesos diferentes no catálogo. Confirme o peso e a imagem antes de validar.'
    if(c.dados?.categoria==='perfil'&&(pesoDecimalCatalogo(c.dados?.peso_kg_m)??0)<=0)return 'Peso por metro não identificado. Confira o catálogo.'
    if(c.acao_sugerida==='revisar_ambiguidade')return 'Encontrei mais de um produto possível para o mesmo item.'
    if(!txt(c.dados?.codigo,120))return 'O catálogo não trouxe código suficiente para vincular este item.'
    if(!ehCodigoCatalogo(c.dados?.codigo))return 'Código com formato incompatível com os códigos técnicos. Corrija antes de aplicar.'
    if(conflitosProdutoCatalogo(c).length)return 'O catálogo diverge de dados técnicos já cadastrados no Atlas.'
    const existente=c.deduplicacao?.produto_existente
    const fotoCadastro=Boolean(existente && cod(existente.codigo)===cod(c.dados?.codigo)
      && String(existente.categoria||'')===String(c.dados?.categoria||'')
      && txt(existente.foto_url))
    const fotoConfirmada=Boolean(txt(c.dados?.imagem_item_url)
      && c.dados?.imagem_confirmada===true
      && cod(c.dados?.imagem_codigo_validado)===cod(c.dados?.codigo))
    if(!fotoCadastro&&!fotoConfirmada)return 'Imagem técnica não confirmada para este código. O cadastro ficará pendente para validação.'

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
  const {data:lista}=await lerTodas(supabaseAdmin.from('ai_aprendizado_candidatos').select('*')
    .eq('empresa_id',usuario.empresa_id).eq('entrada_id',entradaId)
    .in('status',['pendente','corrigido','aprovado']).order('created_at',{ascending:true}).order('id'))
  if(usuario.role!=='master'){
    const snapshot=await carregarPermissoesIA(usuario)
    const autorizados=await Promise.all((lista||[]).map(c=>podeValidar(usuario,c,snapshot)))
    if(autorizados.some(ok=>!ok)){
      await supabaseAdmin.from('ai_aprendizado_entradas').update({status:'aguardando_validacao',updated_at:new Date().toISOString()}).eq('empresa_id',usuario.empresa_id).eq('id',entradaId)
      return {aplicados:0,pendentes:(lista||[]).length}
    }
  }
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
  const outros=(lista||[]).filter((x:any)=>x.tipo!=='fornecedor'&&!x.dados?.arquivado_em)
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
      if(c.status==='corrigido'||c.status==='aprovado'||c.dados?.revisado_manualmente)return 0
      const reconciliado=c.tipo==='produto'?await reconciliarProdutoCatalogoNoBanco(usuario,c):c
      const motivo=motivoPendenciaCatalogo(reconciliado)
      if(motivo){await pendenciarCatalogo(usuario,reconciliado,motivo);return 0}
      await aplicarCatalogoAutomatico(usuario,reconciliado,entrada,{fornecedorId,documentoId})
      return 1
    }))
    aplicados+=resultados.reduce((s:number,n:number)=>s+n,0)
  }

  const {data:restantes}=await lerTodas(supabaseAdmin.from('ai_aprendizado_candidatos').select('id,acao_sugerida')
    .eq('empresa_id',usuario.empresa_id).eq('entrada_id',entradaId).in('status',['pendente','corrigido','aprovado']).order('id'))
  const reais=(restantes||[]).filter((c:any)=>c.acao_sugerida!=='aguardar_fornecedor')
  await supabaseAdmin.from('ai_aprendizado_entradas').update({
    status:reais.length?'aguardando_validacao':'concluido',
    metadados:{...(entrada.metadados||{}),modo_catalogo:'automatico_por_excecao',itens_aplicados_automaticamente:aplicados,pendencias_reais:reais.length},
    updated_at:new Date().toISOString()
  }).eq('empresa_id',usuario.empresa_id).eq('id',entradaId)
  return {aplicados,pendentes:reais.length}
}

async function concluir(empresaId:string,entradaId:string){
  const {data}=await lerTodas(supabaseAdmin.from('ai_aprendizado_candidatos').select('status').eq('empresa_id',empresaId).eq('entrada_id',entradaId).order('id'))
  if(!(data||[]).some((c:any)=>['pendente','corrigido','aprovado'].includes(c.status)))await supabaseAdmin.from('ai_aprendizado_entradas').update({status:'concluido',updated_at:new Date().toISOString()}).eq('empresa_id',empresaId).eq('id',entradaId)
}

// Homologação em lote é sempre restrita ao catálogo, ao tenant e ao usuário.
// O plano não escreve; o executor reavalia a fonte e todas as permissões.
async function planoValidacaoCatalogoLote(
  u:UsuarioTenant, entradaId:string,
  autorizacao:Awaited<ReturnType<typeof carregarPermissoesIA>>,
){
  if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(entradaId))
    throw new Error('Selecione um catálogo válido para a conferência.')
  let q=supabaseAdmin.from('ai_aprendizado_entradas').select('*')
    .eq('empresa_id',u.empresa_id).eq('id',entradaId)
  if(u.role!=='master')q=q.eq('criado_por_id',u.id)
  const {data:entrada,error:e}=await q.maybeSingle()
  if(e)throw e
  if(!entrada||!['catalogo','tabela_preco'].includes(String(entrada.tipo))||
      entrada.mime_type!=='application/pdf'||!entrada.storage_path)
    throw new Error('Catálogo PDF original não encontrado ou não autorizado.')
  if(entrada.metadados?.arquivado_em||entrada.status==='analisando')
    throw new Error('Este catálogo está arquivado ou em análise.')
  const {data:candidatos,error:cErro}=await lerTodas(
    supabaseAdmin.from('ai_aprendizado_candidatos').select('*').eq('empresa_id',u.empresa_id)
      .eq('entrada_id',entrada.id).eq('tipo','produto').eq('status','pendente')
      .order('created_at',{ascending:true}).order('id'))
  if(cErro)throw cErro
  if(candidatos.length>750)throw new Error('Catálogo grande demais para uma única conferência em lote. Divida em etapas.')
  const {data:pdf,error:pdfErro}=await supabaseAdmin.storage.from('atlas-aprendizado').download(entrada.storage_path)
  if(pdfErro||!pdf)throw new Error('O PDF original não está disponível; nenhuma validação será realizada.')
  const lido=await lerPdfCatalogo(Buffer.from(await pdf.arrayBuffer()))
  const fontePorCodigo=new Map<string,any>()
  for(const item of extrairProdutosCatalogoLocal(lido.texto,nomeFornecedorCatalogo(lido.texto),lido.paginas)){
    const codigo=cod(item.codigo)
    if(codigo)fontePorCodigo.set(codigo,item)
  }
  const fornecedorId=await resolverFornecedor(u,entrada,null)
  const semFornecedor=!fornecedorId
  const repetidos=new Map<string,number>()
  for(const c of candidatos){
    const codigo=cod(c.dados?.codigo)
    if(codigo)repetidos.set(codigo,(repetidos.get(codigo)||0)+1)
  }
  // Também confere o cadastro geral para não misturar categorias que
  // compartilham o mesmo código técnico ou código cadastrado em duplicidade.
  const existentesPorCodigo=new Map<string,Array<{id:string;codigo:string;categoria:string}>>()
  const codigosBanco=[...new Set(candidatos.map(c=>txt(c.dados?.codigo,120).toUpperCase()).filter(Boolean))]
  for(let i=0;i<codigosBanco.length;i+=100){
    const {data:existentes,error:exErro}=await supabaseAdmin.from('produtos')
      .select('id,codigo,categoria').eq('empresa_id',u.empresa_id)
      .in('codigo',codigosBanco.slice(i,i+100)).limit(300)
    if(exErro)throw exErro
    for(const p of existentes||[]){
      const chave=cod(p.codigo)
      existentesPorCodigo.set(chave,[...(existentesPorCodigo.get(chave)||[]),p])
    }
  }
  const aptos:Array<{id:string;codigo:string;descricao:string;entrada_id:string;imagem_url:string;dados:Record<string,any>;updated_at:string}>=[]
  const bloqueados:Array<{id:string;codigo:string;motivo:string;imagem_url:string|null}>=[]
  for(const candidato of candidatos){
    const codigo=txt(candidato.dados?.codigo,120)
    let motivo:string|null=null
    const permitido=await podeValidar(u,candidato,autorizacao)
    if(!permitido)motivo='Sem permissão para homologar este produto.'
    else if(!ehCodigoCatalogo(codigo))motivo='Código técnico inválido.'
    else if((repetidos.get(cod(codigo))||0)>1)motivo='Código repetido neste catálogo.'
    else if(semFornecedor)motivo='Fornecedor do catálogo ainda não validado.'
    const resultado=avaliarCatalogoLote(candidato,fontePorCodigo.get(cod(codigo))||null)
    const existentes=existentesPorCodigo.get(cod(codigo))||[]
    if(!motivo)motivo=resultado.motivo
    if(!motivo&&existentes.length>1)motivo='Código duplicado no cadastro de produtos Atlas.'
    if(!motivo&&existentes.some(p=>String(p.categoria||'').toLowerCase()!==String(resultado.dados?.categoria||'').toLowerCase()))
      motivo='Este código já existe com categoria diferente no Atlas.'
    if(motivo||!resultado.dados){
      bloqueados.push({id:candidato.id,codigo,motivo:motivo||'Conferência individual necessária.',
        imagem_url:candidato.dados?.imagem_confirmada===true
          ?txt(candidato.dados?.imagem_item_url,2000)||null:null})
      continue
    }
    aptos.push({id:candidato.id,codigo,descricao:String(resultado.dados.descricao||''),
      entrada_id:entrada.id,imagem_url:txt(candidato.dados?.imagem_item_url,2000),
      dados:resultado.dados,updated_at:candidato.updated_at})
  }
  return {entrada,aptos,bloqueados,total:candidatos.length,fonte_total:fontePorCodigo.size,fornecedorId}
}

export async function GET(req:NextRequest){
  try{
    const u=await autenticarTenant(req);if(!u)return NextResponse.json({error:'Sessão inválida.'},{status:401})
    const autorizacao=await carregarPermissoesIA(u)
    if(!autorizacao.geral)return NextResponse.json({error:'Sem acesso à IA.'},{status:403})
    // Sugestões para conferência visual. Nunca mescla, reclassifica ou aprova produtos.
    const candidatoComparar=txt(req.nextUrl.searchParams.get('compararPerfil'),80)
    if(candidatoComparar){
      const {data:c,error:ce}=await supabaseAdmin.from('ai_aprendizado_candidatos')
        .select('id,entrada_id,tipo,status,dados,empresa_id')
        .eq('empresa_id',u.empresa_id).eq('id',candidatoComparar).maybeSingle()
      if(ce)throw ce
      if(!c||c.tipo!=='produto')return NextResponse.json({error:'Produto não encontrado.'},{status:404})
      const {data:entrada,error:ee}=await supabaseAdmin.from('ai_aprendizado_entradas')
        .select('id,criado_por_id,fornecedor_nome_sugerido')
        .eq('empresa_id',u.empresa_id).eq('id',c.entrada_id).maybeSingle()
      if(ee)throw ee
      if(!entrada||(u.role!=='master'&&entrada.criado_por_id!==u.id))
        return NextResponse.json({error:'Catálogo não autorizado.'},{status:403})
      if(!['perfil','acessorio'].includes(String(c.dados?.categoria)))
        return NextResponse.json({sugestoes:[],motivo:'Selecione um perfil ou acessório técnico.'})
      const foto=String(c.dados?.imagem_item_url||'')
      // Mesmo sem recorte do novo catálogo, mostra os perfis já cadastrados
      // para pesquisa visual. Sem imagem confirmada NÃO permite vinculação.
      const {data:base,error:be}=await supabaseAdmin.from('produtos')
        .select('id,codigo,nome,categoria,peso_kg_m,foto_url,dados_origem,unidade')
        .eq('empresa_id',u.empresa_id).eq('categoria',c.dados.categoria)
        .not('foto_url','is',null).limit(2000)
      if(be)throw be
      const origem={codigo:c.dados.codigo,categoria:c.dados.categoria,
        medidas_mm:c.dados.medidas_mm,peso_kg_m:c.dados.peso_kg_m}
      const lista=(base||[]).filter(p=>p.foto_url)
        .map(p=>{
          const comp=compararGeometria(origem,{codigo:p.codigo,categoria:p.categoria,
            medidas_mm:p.dados_origem?.medidas_mm,peso_kg_m:p.peso_kg_m})
          const mesmoCodigo=codigoPerfil(c.dados.codigo)===codigoPerfil(p.codigo)
          return {id:p.id,codigo:p.codigo,nome:p.nome,categoria:p.categoria,
            peso_kg_m:p.peso_kg_m,medidas_mm:p.dados_origem?.medidas_mm||{},
            foto_url:p.foto_url,unidade:p.unidade,
            funcao:p.dados_origem?.aplicacao||null,
            mesmoCodigo,geometria:comp,
            prioridade:comp.medidasCompativeis?3:mesmoCodigo?2:comp.medidasComuns?1:0}
        })
        .sort((a,b)=>b.prioridade-a.prioridade||b.geometria.medidasComuns-a.geometria.medidasComuns)
        .slice(0,60)
      const ids=lista.map(p=>p.id)
      const {data:vinculos,error:ve}=ids.length
        ?await supabaseAdmin.from('produto_fornecedores')
          .select('produto_id,codigo_fornecedor,fornecedor_id,preco_atual')
          .eq('empresa_id',u.empresa_id).in('produto_id',ids).eq('ativo',true).limit(500)
        :{data:[],error:null}
      if(ve)throw ve
      const fids=[...new Set((vinculos||[]).map(v=>v.fornecedor_id).filter(Boolean))]
      const {data:fornecedores,error:fe}=fids.length
        ?await supabaseAdmin.from('fornecedores').select('id,nome')
          .eq('empresa_id',u.empresa_id).in('id',fids)
        :{data:[],error:null}
      if(fe)throw fe
      const nomes=new Map((fornecedores||[]).map(f=>[f.id,f.nome]))
      const {data:variantes,error:verro}=ids.length
        ?await supabaseAdmin.from('fornecedor_catalogo_itens')
          .select('produto_id,fornecedor_id,codigo_fornecedor,dados_extraidos')
          .eq('empresa_id',u.empresa_id).in('produto_id',ids).limit(500)
        :{data:[],error:null}
      if(verro)throw verro
      return NextResponse.json({
        candidato_id:c.id,codigo_origem:c.dados.codigo,
        desenho_origem:foto,comparacao_visual:'orientativa',
        sugestoes:lista.map(p=>({...p,fornecedores:(vinculos||[])
          .filter(v=>v.produto_id===p.id)
          .map(v=>{
            const variante=(variantes||[]).find(d=>d.fornecedor_id===v.fornecedor_id
              &&codigoPerfil(d.codigo_fornecedor)===codigoPerfil(v.codigo_fornecedor)
              &&d.produto_id===p.id)
            return {nome:nomes.get(v.fornecedor_id)||'Fornecedor',
              codigo:v.codigo_fornecedor,preco:v.preco_atual,
              peso_kg_m:variante?.dados_extraidos?.peso_kg_m??null,
              desenho_url:variante?.dados_extraidos?.desenho_url||null}
          })})),
        aviso:!foto?'Este catálogo ainda não tem desenho individual salvo. Você pode pesquisar produtos existentes, mas precisa confirmar o desenho antes de vincular.'
          :base?.length===2000?'Pesquisa limitada aos primeiros 2000 produtos com foto. Use o cadastro completo para outras referências.':null,
      },{headers:{'Cache-Control':'private, no-store'}})
    }
    // Simulação completa, sem gravações. Revalidação acontece novamente a cada lote.
    const preverLote=txt(req.nextUrl.searchParams.get('preverLote'),5)==='1'
    if(preverLote){
      const id=txt(req.nextUrl.searchParams.get('entradaId'),80)
      const plano=await planoValidacaoCatalogoLote(u,id,autorizacao)
      return NextResponse.json({
        entrada_id:plano.entrada.id,entrada_nome:plano.entrada.titulo,
        total:plano.total,aptos:plano.aptos.map(({id,codigo,descricao,entrada_id,imagem_url})=>({id,codigo,descricao,entrada_id,imagem_url})),
        bloqueados:plano.bloqueados,fonte_total:plano.fonte_total,
        somenteLeitura:process.env.VERCEL_ENV==='preview',
      },{headers:{'Cache-Control':'private, no-store'}})
    }
    // Consulta explicita da tabela original; nenhuma escrita nos candidatos ou produtos.
    const conferirTabelaId=txt(req.nextUrl.searchParams.get('conferirTabela'),80)
    if(conferirTabelaId){
      let q=supabaseAdmin.from('ai_aprendizado_entradas').select('id,tipo,mime_type,storage_path')
        .eq('empresa_id',u.empresa_id).eq('id',conferirTabelaId)
      if(u.role!=='master')q=q.eq('criado_por_id',u.id)
      const {data:entrada,error:erroEntrada}=await q.single()
      if(erroEntrada||!entrada)return NextResponse.json({error:'Catálogo não localizado.'},{status:404})
      if(!['catalogo','tabela_preco'].includes(String(entrada.tipo))||entrada.mime_type!=='application/pdf'||!entrada.storage_path)
        return NextResponse.json({error:'Esta fonte não é um catálogo PDF consultável.'},{status:400})
      const {data:pdf,error:erroPdf}=await supabaseAdmin.storage.from('atlas-aprendizado').download(entrada.storage_path)
      if(erroPdf||!pdf)return NextResponse.json({error:'PDF original indisponível.'},{status:404})
      const lido=await lerPdfCatalogo(Buffer.from(await pdf.arrayBuffer()))
      const itens=extrairProdutosCatalogoLocal(lido.texto,nomeFornecedorCatalogo(lido.texto),lido.paginas).map(item=>({
        codigo:item.codigo,descricao:item.descricao,categoria:item.categoria,unidade:item.unidade,
        peso_kg_m:item.peso_kg_m,medidas_mm:item.medidas_mm,medidas_polegadas:item.medidas_polegadas,
        linha:item.linha,pagina_catalogo:item.pagina_catalogo,imagem_tipo:item.imagem_tipo,
        familia:item.familia,evidencia_tabela:item.evidencia_tabela,
        conflito_peso_catalogo:item.conflito_peso_catalogo||null
      }))
      return NextResponse.json({itens,total:itens.length,consulta:true},
        {headers:{'Cache-Control':'private, no-store'}})
    }
    const entradaId=txt(req.nextUrl.searchParams.get('entradaId'),80), status=txt(req.nextUrl.searchParams.get('status'),40)
    let q=supabaseAdmin.from('ai_aprendizado_entradas').select('*').eq('empresa_id',u.empresa_id).order('created_at',{ascending:false}).order('id');if(entradaId)q=q.eq('id',entradaId)
    if(u.role!=='master')q=q.eq('criado_por_id',u.id)
    const {data:entradas,error:e1}=await lerTodas(q);if(e1)throw e1
    let qc=supabaseAdmin.from('ai_aprendizado_candidatos').select('*').eq('empresa_id',u.empresa_id).order('created_at',{ascending:false}).order('id');if(entradaId)qc=qc.eq('entrada_id',entradaId);if(['pendente','aprovado','rejeitado','corrigido','aplicado'].includes(status))qc=qc.eq('status',status)
    if(u.role!=='master')qc=qc.in('entrada_id',(entradas||[]).map(e=>e.id))
    const {data:candidatos,error:e2}=await lerTodas(qc);if(e2)throw e2
    // Comparação estrita de código e categoria: nenhuma imagem é inferida por nome parecido.
    // Consulta em lotes para evitar URL demasiadamente grande no PostgREST.
    const codigos=[...new Set((candidatos||[])
      .filter((c:any)=>c.tipo==='produto' && ['pendente','corrigido','aprovado','aplicado'].includes(c.status))
      .map((c:any)=>txt(c.dados?.codigo,120).toUpperCase())
      .filter((codigo:string)=>Boolean(codigo)&&ehCodigoCatalogo(codigo)))];
    const fotosPorCodigo=new Map<string,any[]>()
    for(let i=0;i<codigos.length;i+=100){
      const lote=codigos.slice(i,i+100)
      const {data:cadastro,error:erroFotos}=await supabaseAdmin.from('produtos')
        .select('id,codigo,nome,categoria,foto_url')
        .eq('empresa_id',u.empresa_id).in('codigo',lote).limit(500)
      if(erroFotos)throw erroFotos
      for(const produto of cadastro||[]){
        const codigo=txt(produto.codigo,120).toUpperCase()
        fotosPorCodigo.set(codigo,[...(fotosPorCodigo.get(codigo)||[]),produto])
      }
    }
    const cs=await Promise.all((candidatos||[]).map(async(c:any)=>{
      const codigo=txt(c.dados?.codigo,120).toUpperCase()
      const categoria=txt(c.dados?.categoria,80).toLowerCase()
      const correspondencias=(fotosPorCodigo.get(codigo)||[])
        .filter(p=>categoria!=='outro'&&String(p.categoria||'').toLowerCase()===categoria)
      const unico=correspondencias.length===1?correspondencias[0]:null
      return {
        ...c,
        pode_validar:await podeValidar(u,c,autorizacao),
        codigo_verificavel:c.tipo==='produto'?Boolean(ehCodigoCatalogo(codigo)):true,
        foto_cadastro:unico?.foto_url||null,
        produto_cadastro:unico?{id:unico.id,codigo:unico.codigo,nome:unico.nome,categoria:unico.categoria}:null,
        codigo_ambiguo:correspondencias.length>1,
      }
    }))
    const es=entradas||[]
    return NextResponse.json({
      somenteLeitura:process.env.VERCEL_ENV==='preview',
      entradas:await Promise.all(es.map(assinar)),
      candidatos:cs,
      totais:{
        pendentes:cs.filter(c=>['pendente','corrigido','aprovado'].includes(c.status)&&c.acao_sugerida!=='aguardar_fornecedor'&&!es.find((e:any)=>e.id===c.entrada_id)?.metadados?.arquivado_em).length,
        aplicados:cs.filter(c=>c.status==='aplicado').length,
        rejeitados:cs.filter(c=>c.status==='rejeitado').length,
        entradasAguardando:es.filter((e:any)=>e.status==='aguardando_validacao').length,
        entradasAnalisando:es.filter((e:any)=>e.status==='analisando').length,
        entradasConcluidas:es.filter((e:any)=>e.status==='concluido').length,
        errosHistoricos:es.filter((e:any)=>e.status==='erro').length,
      }
    })
  }catch(e:any){return NextResponse.json({error:e?.message||'Erro ao carregar Central.'},{status:500})}
}

export async function POST(req:NextRequest){
  let id:string|null=null
  try{
    const u=await autenticarTenant(req);if(!u)return NextResponse.json({error:'Sessão inválida.'},{status:401})
    const autorizacao=await carregarPermissoesIA(u)
    if(!autorizacao.geral)return NextResponse.json({error:'Sem acesso à IA.'},{status:403})
    if(process.env.VERCEL_ENV==='preview')return NextResponse.json({error:'Prévia de homologação em modo somente leitura. Nenhum cadastro real pode ser modificado aqui.'},{status:409})
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
    const autorizacao=await carregarPermissoesIA(u)
    if(!autorizacao.geral)return NextResponse.json({error:'Sem acesso à IA.'},{status:403})
    if(process.env.VERCEL_ENV==='preview')return NextResponse.json({error:'Prévia de homologação em modo somente leitura. Nenhum cadastro real pode ser modificado aqui.'},{status:409})
    const b=await req.json(),acao=txt(b?.acao,40)
    if(acao==='validar_lote_catalogo'){
      const entradaId=txt(b?.entrada_id,80)
      const ids=Array.isArray(b?.ids)?b.ids:[]
      if(!ids.length||ids.length>5||ids.some((id:any)=>typeof id!=='string'||!/^[-0-9a-f]{36}$/i.test(id))||
         new Set(ids).size!==ids.length)
        return NextResponse.json({error:'Selecione de 1 a 5 produtos por etapa, sem duplicidade.'},{status:422})
      const plano=await planoValidacaoCatalogoLote(u,entradaId,autorizacao)
      const selecionados=new Map(plano.aptos.map(c=>[c.id,c]))
      const resultados:Array<{id:string;status:'aplicado'|'ignorado'|'erro';motivo?:string}>=[]
      for(const id of ids){
        const item=selecionados.get(id)
        if(!item){
          resultados.push({id,status:'ignorado',motivo:plano.bloqueados.find(x=>x.id===id)?.motivo||'Produto não está mais apto.'})
          continue
        }
        // Refaz o lock otimista; nunca aplicar se outro usuário alterou o item.
        const dados:Record<string,any>={...item.dados,imagem_preview_local:false}
        delete dados.conferencia_tabela_visualizada
        delete dados.divergencias_tabela
        const {data:marcado,error:me}=await supabaseAdmin.from('ai_aprendizado_candidatos')
          .update({status:'aprovado',dados,validado_por_id:u.id,validado_por_nome:u.nome,
            validado_em:new Date().toISOString(),observacao_validacao:'Homologação em lote: código, desenho individual e tabela PDF conferidos.',
            updated_at:new Date().toISOString()})
          .eq('empresa_id',u.empresa_id).eq('entrada_id',entradaId).eq('id',id)
          .eq('status','pendente').eq('updated_at',item.updated_at).select('*').maybeSingle()
        if(me||!marcado){
          resultados.push({id,status:'ignorado',motivo:'Produto modificado por outro usuário. Atualize a conferência.'})
          continue
        }
        try{
          const destino=await aplicar(u,{...marcado,dados},plano.entrada,{fornecedorId:plano.fornecedorId})
          const {data:concluido,error:ce}=await supabaseAdmin.from('ai_aprendizado_candidatos')
            .update({status:'aplicado',destino_id:destino,updated_at:new Date().toISOString()})
            .eq('empresa_id',u.empresa_id).eq('entrada_id',entradaId).eq('id',id).eq('status','aprovado')
            .select('id').maybeSingle()
          if(ce||!concluido)throw new Error('Cadastro aplicado, mas o status final não foi confirmado. Confira este item.')
          // O produto não deve voltar como erro se só a gravação do evento de
          // auditoria falhar depois de a homologação já estar concluída.
          try{
            await log(u,'catalogo_validado_em_lote',entradaId,id,{codigo:item.codigo,destino_id:destino})
          }catch(e){console.error('Falha no log do catálogo em lote já aplicado',e)}
          resultados.push({id,status:'aplicado'})
        }catch(e:any){
          // Conserva o status aprovado para revisão e eventual recuperação individual.
          // Não repete uma aplicação parcial cegamente.
          resultados.push({id,status:'erro',motivo:String(e?.message||'Falha ao aplicar.').slice(0,300)})
        }
      }
      await concluir(u.empresa_id,entradaId)
      return NextResponse.json({entrada_id:entradaId,resultados,aplicados:resultados.filter(r=>r.status==='aplicado').length,
        restantes:resultados.filter(r=>r.status!=='aplicado').length})
    }
    if(acao==='arquivar_entrada'||acao==='restaurar_entrada'){
      const entradaId=txt(b?.entrada_id,80)
      const {data:entrada,error:le}=await supabaseAdmin.from('ai_aprendizado_entradas').select('*').eq('empresa_id',u.empresa_id).eq('id',entradaId).maybeSingle()
      if(le)throw le
      if(!entrada||(u.role!=='master'&&entrada.criado_por_id!==u.id))return NextResponse.json({error:'Material não encontrado.'},{status:404})
      if(entrada.status==='analisando')return NextResponse.json({error:'Aguarde a análise terminar antes de arquivar.'},{status:409})
      const {data:itens,error:ie}=await lerTodas(supabaseAdmin.from('ai_aprendizado_candidatos').select('*').eq('empresa_id',u.empresa_id).eq('entrada_id',entradaId).order('id'))
      if(ie)throw ie
      for(const item of itens||[])if(!await podeValidar(u,item))return NextResponse.json({error:'Sem permissão para arquivar este material.'},{status:403})
      if(!(itens||[]).length&&u.role!=='master')return NextResponse.json({error:'Somente Master pode arquivar uma análise sem itens.'},{status:403})
      const arquivar=acao==='arquivar_entrada'
      const {error}=await supabaseAdmin.from('ai_aprendizado_entradas').update({metadados:{...(entrada.metadados||{}),arquivado_em:arquivar?new Date().toISOString():null,arquivado_por:arquivar?u.id:null},updated_at:new Date().toISOString()}).eq('empresa_id',u.empresa_id).eq('id',entradaId).eq('updated_at',entrada.updated_at).select('id').single()
      if(error)throw error
      await log(u,arquivar?'entrada_arquivada':'entrada_restaurada',entradaId)
      return NextResponse.json({mensagem:arquivar?'Material arquivado. Histórico e cadastros preservados.':'Material restaurado.'})
    }
    if(acao==='mapear_catalogo'){
      if(!await podeValidar(u,{tipo:'produto',modulo:'engenharia'})||!await podeValidar(u,{tipo:'fornecedor',modulo:'compras'}))return NextResponse.json({error:'Sem permissão para alterar este catálogo.'},{status:403})

      const entradaId=txt(b?.entrada_id,80)
      if(!entradaId)return NextResponse.json({error:'Catálogo não informado.'},{status:400})
      const {data:entrada}=await supabaseAdmin.from('ai_aprendizado_entradas').select('*').eq('empresa_id',u.empresa_id).eq('id',entradaId).maybeSingle()
      if(!entrada)return NextResponse.json({error:'Catálogo não encontrado.'},{status:404})
      if(u.role!=='master'&&entrada.criado_por_id!==u.id)return NextResponse.json({error:'Material não encontrado.'},{status:404})
      if(!['catalogo','tabela_preco'].includes(String(entrada.tipo)))return NextResponse.json({error:'Somente catálogo ou tabela pode ter imagens preparadas.'},{status:400})
      const mapa=await remapearCatalogoExistente(u,entrada)
      return NextResponse.json({mensagem:'Catálogo preparado: '+mapa.mapeados+' de '+mapa.total+' item(ns) foram ligados à página correta para gerar o recorte visual.',...mapa})
    }
    if(acao==='reprocessar_entrada'){
      if(!await podeValidar(u,{tipo:'produto',modulo:'engenharia'})||!await podeValidar(u,{tipo:'fornecedor',modulo:'compras'}))return NextResponse.json({error:'Sem permissão para alterar este catálogo.'},{status:403})

      const entradaId=txt(b?.entrada_id,80)
      if(!entradaId)return NextResponse.json({error:'Catálogo não informado.'},{status:400})
      const {data:entrada}=await supabaseAdmin.from('ai_aprendizado_entradas').select('*').eq('empresa_id',u.empresa_id).eq('id',entradaId).maybeSingle()
      if(!entrada)return NextResponse.json({error:'Catálogo não encontrado.'},{status:404})
      if(u.role!=='master'&&entrada.criado_por_id!==u.id)return NextResponse.json({error:'Material não encontrado.'},{status:404})
      if(!['catalogo','tabela_preco'].includes(String(entrada.tipo)))return NextResponse.json({error:'Somente catálogo ou tabela de preço pode ser reprocessado por esta ação.'},{status:400})
      if(entrada.metadados?.arquivado_em)return NextResponse.json({error:'Restaure o catálogo antes de reanalisar.'},{status:409})
      if(entrada.status==='analisando'&&Date.now()-new Date(entrada.updated_at).getTime()<600000)return NextResponse.json({error:'Este catálogo já está em análise.'},{status:409})
      const {data:travada,error:te}=await supabaseAdmin.from('ai_aprendizado_entradas').update({status:'analisando',erro:null,updated_at:new Date().toISOString()}).eq('empresa_id',u.empresa_id).eq('id',entradaId).eq('updated_at',entrada.updated_at).select('id').maybeSingle()
      if(te)throw te
      if(!travada)return NextResponse.json({error:'O catálogo mudou. Atualize a tela antes de tentar novamente.'},{status:409})
      try{
        if(!entrada.storage_path||entrada.mime_type!=='application/pdf')throw Error('A reanálise completa exige o PDF original. Envie o arquivo para extrair todos os itens.')
        const {data:file,error:fe}=await supabaseAdmin.storage.from('atlas-aprendizado').download(entrada.storage_path)
        if(fe||!file)throw Error('Não foi possível abrir o catálogo original.')
        const lido=await lerPdfCatalogo(Buffer.from(await file.arrayBuffer()))
        const x=analisarCatalogoLocal(entrada.tipo,entrada.descricao||'',entrada.fonte_nome,lido.texto,lido.paginas)
        if(!x.itens.length)throw Error('Nenhum produto foi identificado com segurança. O PDF pode precisar de leitura visual; os cadastros anteriores foram preservados.')
        if(entrada.fornecedor_nome_sugerido)x.documento.fornecedor={cnpj:'',contato:'',telefone:'',email:'',cidade:'',...x.documento.fornecedor,nome:entrada.fornecedor_nome_sugerido}
        let fornecedor:any=null
        if(entrada.fornecedor_id_sugerido){
          const r=await supabaseAdmin.from('fornecedores').select('id,nome').eq('empresa_id',u.empresa_id).eq('id',entrada.fornecedor_id_sugerido).maybeSingle()
          if(r.error)throw r.error
          fornecedor=r.data
        }
        const novos=await criarCandidatos(u,entradaId,x,{existente:fornecedor,ambiguos:[]})
        const auto=await processarCatalogoAutomatico(u,entradaId)
        await log(u,'catalogo_reanalisado',entradaId,null,{regras_versao:VERSAO_REGRAS_CATALOGO,novos,extraidos:x.itens.length,...auto})
        return NextResponse.json({mensagem:'Reanálise concluída: '+x.itens.length+' produtos lidos, '+novos+' candidatos novos, '+auto.aplicados+' aplicados e '+auto.pendentes+' pendências. Correções anteriores preservadas.',novos,...auto})
      }catch(error:any){
        await supabaseAdmin.from('ai_aprendizado_entradas').update({status:'erro',erro:error.message,updated_at:new Date().toISOString()}).eq('empresa_id',u.empresa_id).eq('id',entradaId)
        throw error
      }
    }
    const id=txt(b?.id,80);if(!id)return NextResponse.json({error:'Candidato não informado.'},{status:400})
    const {data:c}=await supabaseAdmin.from('ai_aprendizado_candidatos').select('*').eq('empresa_id',u.empresa_id).eq('id',id).maybeSingle();if(!c)return NextResponse.json({error:'Candidato não encontrado.'},{status:404});if(!(await podeValidar(u,c)))return NextResponse.json({error:'Sem permissão para validar.'},{status:403})
    const {data:entrada}=await supabaseAdmin.from('ai_aprendizado_entradas').select('*').eq('empresa_id',u.empresa_id).eq('id',c.entrada_id).maybeSingle();if(!entrada)return NextResponse.json({error:'Entrada não encontrada.'},{status:404})
      if(u.role!=='master'&&entrada.criado_por_id!==u.id)return NextResponse.json({error:'Material não encontrado.'},{status:404})
    if(entrada.metadados?.arquivado_em)return NextResponse.json({error:'Restaure o material para editar ou validar.'},{status:409})
    if(acao==='vincular_equivalente_perfil'){
      if(c.tipo!=='produto'||!['pendente','corrigido'].includes(String(c.status)))
        return NextResponse.json({error:'Esta referência já está aplicada ou não está aguardando validação.'},{status:409})
      if(b?.confirmar_equivalencia!==true)
        return NextResponse.json({error:'A equivalência técnica precisa ser confirmada pelo responsável.'},{status:422})
      const destinoId=txt(b?.produto_id,80)
      if(!/^[0-9a-f-]{36}$/i.test(destinoId))
        return NextResponse.json({error:'Selecione um produto cadastrado válido.'},{status:422})
      const d=c.dados||{}, codigo=txt(d.codigo,120)
      if(!ehCodigoCatalogo(codigo)||!['perfil','acessorio'].includes(String(d.categoria)))
        return NextResponse.json({error:'Código ou categoria técnica não verificados.'},{status:422})
      const caminho='/catalogo-itens/'+u.empresa_id+'/'+entrada.id+'/'+c.id+'/'
      if(d.imagem_confirmada!==true||cod(d.imagem_codigo_validado)!==cod(codigo)||
         !String(d.imagem_item_url||'').includes(caminho))
        return NextResponse.json({error:'Confirme primeiro o desenho individual do novo fornecedor.'},{status:422})
      const {data:p,error:pe}=await supabaseAdmin.from('produtos')
        .select('id,codigo,nome,categoria,unidade,peso_kg_m,foto_url,dados_origem')
        .eq('empresa_id',u.empresa_id).eq('id',destinoId).maybeSingle()
      if(pe)throw pe
      if(!p||!p.foto_url||p.categoria!==d.categoria)
        return NextResponse.json({error:'O produto existente precisa ter desenho e categoria correspondentes.'},{status:422})
      const medidas=compararGeometria(
        {categoria:d.categoria,medidas_mm:d.medidas_mm},
        {categoria:p.categoria,medidas_mm:p.dados_origem?.medidas_mm})
      if(!medidas.medidasCompativeis)
        return NextResponse.json({error:'Não é seguro vincular: confirme pelo menos duas medidas compatíveis em ambos os desenhos.'},{status:422})
      const fornecedorId=await resolverFornecedor(u,entrada,null)
      if(!fornecedorId)
        return NextResponse.json({error:'Confirme o fornecedor deste catálogo antes de vincular um produto.'},{status:422})
      const {data:ja,error:je}=await supabaseAdmin.from('produto_fornecedores')
        .select('id,produto_id,codigo_fornecedor')
        .eq('empresa_id',u.empresa_id).eq('fornecedor_id',fornecedorId)
        .ilike('codigo_fornecedor',codigo).limit(2)
      if(je)throw je
      if((ja||[]).some(v=>v.produto_id!==destinoId))
        return NextResponse.json({error:'Este código já está vinculado a outro produto do fornecedor. Confirme antes de alterar.'},{status:409})
      if((ja||[]).length>1)
        return NextResponse.json({error:'Há vínculos duplicados para este código. Solicite revisão manual.'},{status:409})
      const docId=await copiarFonte(u,entrada,fornecedorId)
      if(!docId)return NextResponse.json({error:'Não foi possível preservar o catálogo original do fornecedor.'},{status:409})
      const {data:registro,error:re}=await supabaseAdmin.from('fornecedor_catalogo_itens')
        .select('id,produto_id,dados_extraidos').eq('empresa_id',u.empresa_id)
        .eq('documento_id',docId).eq('codigo_fornecedor',codigo).limit(2)
      if(re)throw re
      if((registro||[]).some(v=>v.produto_id&&v.produto_id!==destinoId))
        return NextResponse.json({error:'O catálogo já está vinculado a outro produto. Não alterei o cadastro.'},{status:409})
      if((registro||[]).length>1)
        return NextResponse.json({error:'Itens duplicados no catálogo; vinculação requer revisão.'},{status:409})
      const pesoAnterior=pesoDecimalCatalogo(registro?.[0]?.dados_extraidos?.peso_kg_m)
      const pesoNovo=pesoDecimalCatalogo(d.peso_kg_m)
      if(pesoAnterior!=null&&pesoNovo!=null
        &&Math.abs(pesoNovo-pesoAnterior)>Math.max(.01,pesoAnterior*.03))
        return NextResponse.json({error:'O mesmo fornecedor já tem outro peso registrado para este código. Confira antes de substituir.'},{status:409})
      // Lock do candidato antes de criar vínculos; se concorrência, recusar.
      const dados={...d,equivalencia_confirmada_com:destinoId,
        equivalencia_confirmada_por:u.id,equivalencia_confirmada_em:new Date().toISOString(),
        peso_kg_m:pesoDecimalCatalogo(d.peso_kg_m),imagem_preview_local:false}
      const {data:travado,error:te}=await supabaseAdmin.from('ai_aprendizado_candidatos')
        .update({status:'aprovado',destino_id:destinoId,acao_sugerida:'vincular_existente',
          dados,validado_por_id:u.id,validado_por_nome:u.nome,validado_em:new Date().toISOString(),
          observacao_validacao:'Correspondência por desenhos e medidas conferida manualmente.',
          updated_at:new Date().toISOString()})
        .eq('empresa_id',u.empresa_id).eq('id',c.id).eq('status',c.status)
        .eq('updated_at',c.updated_at).select('*').maybeSingle()
      if(te)throw te
      if(!travado)return NextResponse.json({error:'O item foi alterado por outro usuário. Atualize a tela.'},{status:409})
      // Produto principal permanece único e conserva foto/peso técnicos homologados.
      const destino=await aplicar(u,{...travado,dados,destino_id:destinoId},entrada,{fornecedorId,documentoId:docId})
      if(destino!==destinoId)throw Error('A aplicação não corresponde ao produto selecionado.')
      const dadosFornecedor={
        codigo,codigo_fornecedor:codigo,peso_kg_m:pesoDecimalCatalogo(d.peso_kg_m),
        medidas_mm:d.medidas_mm||{},medidas_polegadas:d.medidas_polegadas||{},
        desenho_url:d.imagem_item_url,pagina_catalogo:d.pagina_catalogo||null,
        linha:d.linha||null,aplicacao:d.aplicacao||null,
        produto_atlas_id:destinoId,referencia_atlas_codigo:p.codigo,
        equivalencia_confirmada_por:u.id,equivalencia_confirmada_em:new Date().toISOString(),
      }
      // Dados técnicos do fabricante nunca substituem silenciosamente os de outro.
      if((registro||[]).length===1){
        const anterior=registro![0]
        const {error:ue}=await supabaseAdmin.from('fornecedor_catalogo_itens').update({
          produto_id:destinoId,status:'vinculado',
          dados_extraidos:{...(anterior.dados_extraidos||{}),...dadosFornecedor},
          updated_at:new Date().toISOString(),
        }).eq('empresa_id',u.empresa_id).eq('id',anterior.id)
        if(ue)throw new Error('Não foi possível preservar a ficha técnica deste fornecedor: '+ue.message)
      }else{
        const {error:ie}=await supabaseAdmin.from('fornecedor_catalogo_itens').insert({
          empresa_id:u.empresa_id,documento_id:docId,fornecedor_id:fornecedorId,
          produto_id:destinoId,codigo_fornecedor:codigo,
          descricao:txt(d.descricao,400)||c.titulo,categoria_sugerida:d.categoria,
          unidade:txt(d.unidade,30)||'KG',
          preco:num(d.preco_fornecedor),status:'vinculado',dados_extraidos:dadosFornecedor,
          criado_por_id:u.id,criado_por_nome:u.nome,
        })
        if(ie)throw new Error('Vínculo comercial criado, mas o registro técnico do fornecedor precisa ser revisado: '+ie.message)
      }
      const {data:concluido,error:ce}=await supabaseAdmin.from('ai_aprendizado_candidatos')
        .update({status:'aplicado',destino_id:destinoId,updated_at:new Date().toISOString()})
        .eq('empresa_id',u.empresa_id).eq('id',c.id).eq('status','aprovado').select('id').maybeSingle()
      if(ce||!concluido)throw Error('O vínculo foi aplicado, mas o status final requer revisão. Não repita automaticamente.')
      await concluir(u.empresa_id,entrada.id)
      try{await log(u,'perfil_equivalente_vinculado',entrada.id,c.id,
        {produto_id:destinoId,codigo_origem:codigo,codigo_atlas:p.codigo})}
      catch(e){console.error('Falha no log de equivalência já aplicada',e)}
      return NextResponse.json({mensagem:'Perfil '+codigo+' vinculado ao produto '+p.codigo+
        ' sem duplicar cadastro. Peso, desenho e medidas do novo fornecedor preservados no histórico técnico.',
        destino_id:destinoId})
    }
    if(acao==='salvar_imagem_catalogo'){
      if(c.tipo!=='produto')return NextResponse.json({error:'Imagem só pode ser vinculada a produto.'},{status:400})
      const dataUrl=String(b?.imagem||'')
      const m=dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i)
      if(!m)return NextResponse.json({error:'Imagem inválida.'},{status:400})
      const formato=String(m[1]).toLowerCase()==='jpg'?'jpeg':String(m[1]).toLowerCase()
      const buffer=Buffer.from(m[2],'base64')
      if(!buffer.length||buffer.length>4*1024*1024)return NextResponse.json({error:'Recorte de imagem inválido ou maior que 4 MB.'},{status:400})
      const extensao=formato==='jpeg'?'jpg':formato
      // URL única por confirmação evita imagem antiga no cache quando um desenho é substituído.
      const path='catalogo-itens/'+u.empresa_id+'/'+entrada.id+'/'+c.id+'/'+randomUUID()+'.'+extensao
      const {error:up}=await supabaseAdmin.storage.from('fotos').upload(path,buffer,{contentType:'image/'+formato,upsert:false})
      if(up)throw new Error(up.message)
      const {data:pub}=supabaseAdmin.storage.from('fotos').getPublicUrl(path)
      const url=pub.publicUrl
      const dados={...(c.dados||{}),imagem_item_url:url,imagem_catalogo_pagina:num(c?.dados?.pagina_catalogo),
        imagem_confirmada:true,imagem_codigo_validado:txt(c.dados?.codigo,120),imagem_origem:'revisada_na_central'}
      const {data:atualizado,error:ce}=await supabaseAdmin.from('ai_aprendizado_candidatos').update({dados,updated_at:new Date().toISOString()})
        .eq('empresa_id',u.empresa_id).eq('id',id).eq('updated_at',c.updated_at).select('*').maybeSingle()
      if(ce)throw ce
      if(!atualizado)throw new Error('O cadastro foi alterado durante a confirmação. Atualize a página e confira novamente.')
      if(c.destino_id){
        // Nunca sobrescrever foto de um produto já catalogado, nem copiar imagem
        // para produto com código/categoria divergentes da fonte em validação.
        const {data:produto,error:peBusca}=await supabaseAdmin.from('produtos')
          .select('codigo,categoria,foto_url').eq('empresa_id',u.empresa_id).eq('id',c.destino_id).maybeSingle()
        if(peBusca)throw peBusca
        if(produto && cod(produto.codigo)===cod(c.dados?.codigo)
          && String(produto.categoria||'')===String(c.dados?.categoria||'')
          && !txt(produto.foto_url)){
          const {error:pe}=await supabaseAdmin.from('produtos')
            .update({foto_url:url,updated_at:new Date().toISOString()})
            .eq('empresa_id',u.empresa_id).eq('id',c.destino_id).is('foto_url',null)
          if(pe)throw pe
        }
      }
      await log(u,'catalogo_imagem_item_salva',entrada.id,id,{destino_id:c.destino_id||null,pagina:num(c?.dados?.pagina_catalogo)})
      return NextResponse.json({candidato:{...atualizado,pode_validar:true},imagem_url:url})
    }
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
        revisado_manualmente:true,
        codigo,
        descricao,
        categoria,
        unidade:txt(recebido.unidade??anterior.unidade,30)||null,
        preco_fornecedor:num(recebido.preco_fornecedor??anterior.preco_fornecedor),
        peso_kg_m:pesoDecimalCatalogo(recebido.peso_kg_m??anterior.peso_kg_m),
        tamanho_barra_mm:num(recebido.tamanho_barra_mm??anterior.tamanho_barra_mm),
        medidas_mm:medidasMmCatalogo(recebido.medidas_mm??anterior.medidas_mm),
        medidas_polegadas:recebido.medidas_polegadas&&typeof recebido.medidas_polegadas==='object'?recebido.medidas_polegadas:(anterior.medidas_polegadas||{}),
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
          unidade:dados.unidade||(categoria==='perfil'?'KG':'UN'),
          peso_kg_m:dados.peso_kg_m,
          tamanho_barra_mm:dados.tamanho_barra_mm,
          dados_origem:{...(produtoAtual.dados_origem||{}),entrada_id:entrada.id,linha:dados.linha,medidas_mm:dados.medidas_mm||{},medidas_polegadas:dados.medidas_polegadas||{},pagina_catalogo:dados.pagina_catalogo||null,aplicacao:dados.aplicacao},
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
      const {data,error}=await supabaseAdmin.from('ai_aprendizado_candidatos').update({titulo:txt(b?.titulo,180)||c.titulo,modulo:modulo||c.modulo,dados:{...c.dados,...(b?.dados&&typeof b.dados==='object'?b.dados:{}),revisado_manualmente:true},status:'corrigido',observacao_validacao:txt(b?.observacao,3000)||null,updated_at:new Date().toISOString()}).eq('empresa_id',u.empresa_id).eq('id',id).select('*').single();if(error)throw error;await log(u,'candidato_corrigido',entrada.id,id);return NextResponse.json({candidato:{...data,pode_validar:true}})
    }
    if(acao==='rejeitar'){
      const {data,error}=await supabaseAdmin.from('ai_aprendizado_candidatos').update({status:'rejeitado',validado_por_id:u.id,validado_por_nome:u.nome,validado_em:new Date().toISOString(),observacao_validacao:txt(b?.observacao,3000)||null,updated_at:new Date().toISOString()}).eq('empresa_id',u.empresa_id).eq('id',id).select('*').single();if(error)throw error;await log(u,'candidato_rejeitado',entrada.id,id);await concluir(u.empresa_id,entrada.id);return NextResponse.json({candidato:{...data,pode_validar:true}})
    }
    if(acao==='aprovar'){
      if(!['pendente','corrigido','aprovado'].includes(String(c.status)))return NextResponse.json({error:'Item já concluído.'},{status:409})
      if(c.tipo==='produto'){
        const candidatoDados=b?.dados&&typeof b.dados==='object'?b.dados:c.dados||{}
        const codigo=txt(candidatoDados.codigo,120)
        if(!ehCodigoCatalogo(codigo))return NextResponse.json({
          error:'Código não reconhecido como referência técnica. Confira e corrija no catálogo antes de validar.',
        },{status:422})
        const categoria=txt(candidatoDados.categoria,60)
        if(categoria==='perfil'&&(pesoDecimalCatalogo(candidatoDados.peso_kg_m)??0)<=0)return NextResponse.json({error:'Confira e informe o peso kg/m antes de validar o perfil.'},{status:422})
        let fotoValida=Boolean(txt(c.dados?.imagem_item_url)
          && c.dados?.imagem_confirmada === true
          && cod(c.dados?.imagem_codigo_validado) === cod(codigo))
        if(!fotoValida){
          const {data:existentes,error:erroFoto}=await supabaseAdmin.from('produtos')
            .select('id,codigo,categoria,foto_url').eq('empresa_id',u.empresa_id)
            .ilike('codigo',codigo).limit(5)
          if(erroFoto)throw erroFoto
          const unicos=(existentes||[]).filter(p=>cod(p.codigo)===cod(codigo)
            && String(p.categoria||'')===categoria)
          fotoValida=unicos.length===1&&Boolean(txt(unicos[0].foto_url))
        }
        if(!fotoValida)return NextResponse.json({
          error:'Para validar este produto, confirme o código e vincule primeiro a foto ou desenho correto. Sem imagem verificada, ele permanece pendente.',
        },{status:422})
      }
      // Dados revisados no PDF devem continuar no candidato homologado;
      // senão a lista do catálogo voltava a exibir peso e cotas em branco.
      const candidatoDadosAprovados=b?.dados&&typeof b.dados==='object'?b.dados:{}
      const dadosAprovados={
        ...c.dados,...candidatoDadosAprovados,
        imagem_item_url:c.dados?.imagem_item_url||null,
        imagem_confirmada:c.dados?.imagem_confirmada===true,
        imagem_codigo_validado:c.dados?.imagem_codigo_validado||null,
        // Flags locais nunca são registradas como homologação real.
        imagem_preview_local:false,
        peso_kg_m:c.tipo==='produto'
          ?pesoDecimalCatalogo(candidatoDadosAprovados.peso_kg_m??c.dados?.peso_kg_m)
          :c.dados?.peso_kg_m,
        medidas_mm:c.tipo==='produto'
          ?medidasMmCatalogo(candidatoDadosAprovados.medidas_mm??c.dados?.medidas_mm)
          :c.dados?.medidas_mm,
      }
      const {data:marcado,error:marcaErro}=await supabaseAdmin.from('ai_aprendizado_candidatos').update({
        status:'aprovado',dados:dadosAprovados,
        validado_por_id:u.id,validado_por_nome:u.nome,validado_em:new Date().toISOString(),
        observacao_validacao:txt(b?.observacao,3000)||null,updated_at:new Date().toISOString()
      }).eq('empresa_id',u.empresa_id).eq('id',id).eq('updated_at',c.updated_at).select('id').maybeSingle()
      if(marcaErro)throw marcaErro
      if(!marcado)return NextResponse.json({error:'O item mudou durante a validação. Atualize e confira novamente.'},{status:409})
      const candidatoAplicar={...c,dados:dadosAprovados}
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
