import { NextRequest, NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'
import { autenticarCompras } from '@/lib/comprasServer'
import { obterComprasAcessos } from '@/lib/comprasPermissoesServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { extrairLinhasCompra, extrairCondicoesCotacao, normalizarCodigoCompra } from '@/lib/comprasImportacaoPdf'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const erro=(s:string,status=400)=>NextResponse.json({error:s},{status})
type ProdutoBanco={id:string;codigo:string|null;nome:string;categoria:string|null;unidade:string|null;foto_url:string|null}
export async function POST(req:NextRequest){
 const usuario=await autenticarCompras(req)
 if(!usuario)return erro('Sessão inválida',401)
 try{
  const acesso=await obterComprasAcessos(usuario)
  if(!acesso.solicitar&&!acesso.cotar&&!acesso.comprar)return erro('Sem permissão para importar lista ou cotação.',403)
  const form=await req.formData()
  const tipo=String(form.get('tipo')||'lista')
  if(tipo!=='lista'&&tipo!=='cotacao')return erro('Tipo de importação inválido.')
  const arquivo=form.get('arquivo')
  if(!(arquivo instanceof File))return erro('Escolha um arquivo PDF.')
  if(arquivo.size<5||arquivo.size>12*1024*1024)return erro('PDF deve ter até 12 MB.',413)
  if(!arquivo.name.toLowerCase().endsWith('.pdf')&&!/application\/pdf/i.test(arquivo.type))return erro('Envie um PDF.')
  const buffer=Buffer.from(await arquivo.arrayBuffer())
  if(buffer.subarray(0,5).toString()!=='%PDF-')return erro('Arquivo não é um PDF válido.')
  const doc=await pdfParse(buffer,{max:100})
  if(doc.numpages>100)return erro('PDF muito extenso: máximo de 100 páginas.')
  if(!doc.text?.trim())return erro('O PDF não contém texto selecionável. Faça a seleção manual ou use um PDF pesquisável.')
  const linhas=extrairLinhasCompra(doc.text,tipo)
  if(!linhas.length)return erro('Não foram identificados códigos de produtos com segurança. Revise o PDF e faça inclusão manual.')
  const encontrados=new Map<string,ProdutoBanco[]>()
  for(let offset=0;offset<30000;offset+=1000){
   const {data,error}=await supabaseAdmin.from('produtos')
    .select('id,codigo,nome,categoria,unidade,foto_url')
    .eq('empresa_id',usuario.empresa_id).eq('ativo',true).order('id').range(offset,offset+999)
   if(error)throw error
   for(const p of data||[]){
    const codigo=normalizarCodigoCompra(p.codigo||'')
    if(!codigo)continue
    const lista=encontrados.get(codigo)||[]
    lista.push(p);encontrados.set(codigo,lista)
   }
   if(!data||data.length<1000)break
  }
  const produtoIdsSemFoto=[...new Set(linhas.flatMap(l=>{
   const candidatos=encontrados.get(normalizarCodigoCompra(l.codigo))||[]
   return candidatos.length===1&&!candidatos[0].foto_url?[candidatos[0].id]:[]
  }))]
  const fotos=new Map<string,string>()
  for(let i=0;i<produtoIdsSemFoto.length;i+=150){
   const {data}=await supabaseAdmin.from('produto_imagens')
    .select('produto_id,url,principal').in('produto_id',produtoIdsSemFoto.slice(i,i+150))
    .eq('ativo',true).eq('status_validacao','validada')
    .order('principal',{ascending:false}).limit(500)
   for(const item of data||[])if(!fotos.has(item.produto_id))fotos.set(item.produto_id,item.url)
  }
  const itens=linhas.map(l=>{
   const produtos=encontrados.get(normalizarCodigoCompra(l.codigo))||[]
   const produto=produtos.length===1?{...produtos[0],foto_url:produtos[0].foto_url||fotos.get(produtos[0].id)||null}:null
   return {...l,produto,confianca:produtos.length===1?'codigo_exato':produtos.length>1?'codigo_duplicado':'nao_encontrado'}
  })
  return NextResponse.json({
   nomeArquivo:arquivo.name.slice(0,150),paginas:doc.numpages,tipo,itens,
   condicoes:tipo==='cotacao'?extrairCondicoesCotacao(doc.text):null,
   aviso:'Extração preliminar. Confirme produto, imagem, quantidades e valores antes de usar na compra.',
  })
 }catch(error){
  console.error('[compras importar pdf]',error)
  return erro('Não foi possível interpretar o PDF. Verifique o arquivo e tente novamente.',422)
 }
}
