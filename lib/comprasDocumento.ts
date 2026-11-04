import {jsPDF} from 'jspdf'
const COMPRAS_LOGO_WEBP_BASE64='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'
export type ItemDocumentoCompra={
 id:string;codigo:string;descricao:string;categoria:string;quantidade:number|null;unidade:string;
 destino:string;cliente:string;obra:string;imagem:string|null;status:string;
 fornecedor:string;quantidade_recebida:number;
}
export type DocumentoCompra={
 tipo:'solicitacao'|'necessidade'|'carrinho';id:string;numero:string;data:string;
 status:string;solicitante:string;cliente:string;obra:string;destino:string;fornecedor?:string;
 observacoes:string;itens:ItemDocumentoCompra[];
}
export function numeroCompra(tipo:'solicitacao'|'necessidade'|'carrinho',id:string,data:string){
 const dia=Number.isFinite(Date.parse(data))?new Date(data).toISOString().slice(0,10).replace(/-/g,''):'00000000'
 return (tipo==='solicitacao'?'SC':tipo==='necessidade'?'NC':'PC')+'-'+dia+'-'+id.replace(/-/g,'').slice(0,8).toUpperCase()
}
const dataPt=(s:string)=>s?new Date(s).toLocaleDateString('pt-BR'):'—'
const qtd=(n:number|null)=>n==null?'A definir':n.toLocaleString('pt-BR',{maximumFractionDigits:4})
const pequena=(s:string,len=80)=>s.length>len?s.slice(0,len-1)+'…':s
async function carregarImagem(url:string|null):Promise<{bin:Uint8Array;formato:'PNG'|'JPEG'|'WEBP'}|null>{
 if(!url)return null
 try{
  const origem=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL||'')
  const alvo=new URL(url)
  if(alvo.origin!==origem.origin||!alvo.pathname.startsWith('/storage/v1/object/'))return null
  const resp=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(4500)})
  if(!resp.ok)return null
  const tipo=(resp.headers.get('content-type')||'').split(';')[0]
  if(!['image/jpeg','image/png','image/webp'].includes(tipo))return null
  const contentLength=Number(resp.headers.get('content-length')||0)
  if(contentLength>3_000_000)return null
  const buffer=new Uint8Array(await resp.arrayBuffer())
  if(buffer.length>3_000_000)return null
  return {bin:buffer,formato:tipo==='image/png'?'PNG':tipo==='image/jpeg'?'JPEG':'WEBP'}
 }catch{return null}
}
export async function gerarPdfCompra(doc:DocumentoCompra):Promise<Uint8Array>{
 const pdf=new jsPDF({format:'a4',orientation:'portrait',unit:'mm',compress:true})
 const w=210,padrao=12
 let pagina=1,y=12
 const escreve=(s:string,x:number,yy:number,size=9,bold=false)=>{
  pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(size)
  pdf.text(pequena(s,120),x,yy)
 }
 async function logo(){
  try{
   const bin=Buffer.from(COMPRAS_LOGO_WEBP_BASE64,'base64')
   pdf.addImage(new Uint8Array(bin),'WEBP',padrao,9,70,13)
  }catch{escreve('ESQUADRIFÁCIO',padrao,17,16,true)}
 }
 async function cabecalho(continuacao=false){
  pdf.setFillColor(242,246,250);pdf.rect(0,0,w,36,'F')
  await logo()
  escreve(continuacao?'Continuação — conferência':'LISTA DE COMPRA E CONFERÊNCIA',109,13,11,true)
  escreve('Nº '+doc.numero,109,21,11,true)
  escreve('Emissão '+dataPt(doc.data)+'  ·  '+doc.status.replace(/_/g,' '),109,28,8)
  pdf.setDrawColor(190,202,214);pdf.line(12,38,198,38)
 }
 async function proximaPagina(){
  pdf.addPage();pagina++;await cabecalho(true);y=43
 }
 await cabecalho()
 y=45
 escreve('Destino: '+doc.destino,12,y,10,true);y+=6
 if(doc.fornecedor){escreve('Fornecedor: '+doc.fornecedor,12,y,10,true);y+=6}
 if(doc.cliente){escreve('Cliente: '+doc.cliente,12,y,10);y+=5}
 if(doc.obra){escreve('Obra: '+doc.obra,12,y,9);y+=5}
 escreve('Solicitante: '+doc.solicitante,12,y,9);y+=6
 if(doc.observacoes){const obs=pdf.splitTextToSize('Observações: '+doc.observacoes,184) as string[]
  for(const linha of obs.slice(0,4)){escreve(linha,12,y,8);y+=4.5}y+=1}
 pdf.setFillColor(235,241,247);pdf.rect(12,y,186,8,'F')
 escreve('IMAGEM / CÓDIGO / PRODUTO',14,y+5.5,9,true)
 escreve('PEDIDO',146,y+5.5,8,true);escreve('CHEGOU',171,y+5.5,8,true)
 y+=10
 const imagens=await Promise.all(doc.itens.map(item=>carregarImagem(item.imagem)))
 for(let i=0;i<doc.itens.length;i++){
  const item=doc.itens[i],imagem=imagens[i]
  const h=31
  if(y+h>272)await proximaPagina()
  pdf.setDrawColor(205,216,223);pdf.rect(12,y,186,h)
  pdf.setFillColor(249,251,252);pdf.rect(14,y+2,25,25,'F')
  if(imagem){
   try{
    const props=pdf.getImageProperties(imagem.bin)
    const fator=Math.min(23/props.width,23/props.height)
    pdf.addImage(imagem.bin,imagem.formato,15+(23-props.width*fator)/2,y+3+(23-props.height*fator)/2,props.width*fator,props.height*fator)
   }catch{escreve('Imagem',15,y+14,7);escreve('pendente',15,y+18,7)}
  }else{escreve('Imagem',15,y+14,7);escreve('pendente',15,y+18,7)}
  escreve('#'+(i+1)+'  '+(item.codigo||'SEM CÓDIGO'),42,y+7,9,true)
  const descr=pdf.splitTextToSize(item.descricao,98) as string[]
  descr.slice(0,2).forEach((linha,ix)=>escreve(linha,42,y+12+ix*4.5,8))
  escreve('Destino: '+pequena(item.destino==='estoque'?'Estoque':(item.cliente+' / '+item.obra),55),42,y+25,7)
  escreve(qtd(item.quantidade)+' '+item.unidade,146,y+13,8,true)
  escreve('_____  '+item.unidade,170,y+13,8)
  escreve('Falta: ______',170,y+23,8)
  if(item.quantidade_recebida>0)escreve('Já recebido: '+qtd(item.quantidade_recebida),42,y+29,7)
  y+=h+2
 }
 if(y+36>274)await proximaPagina()
 y+=5;pdf.setDrawColor(120,130,140)
 pdf.line(12,y,82,y);pdf.line(111,y,198,y)
 escreve('Conferido por / assinatura',12,y+4,8);escreve('Data e horário do recebimento',111,y+4,8)
 y+=14
 escreve('Observações da conferência: __________________________________________________________',12,y,8)
 escreve('____________________________________________________________________________________',12,y+8,8)
 const total=pdf.getNumberOfPages()
 for(let i=1;i<=total;i++){
  pdf.setPage(i);pdf.setFontSize(8);pdf.setTextColor(95,105,115)
  pdf.text('Esquadrifácio · '+doc.numero+' · Via para Kanban físico / conferência',12,289)
  pdf.text('Página '+i+' de '+total,198,289,{align:'right'})
 }
 return new Uint8Array(pdf.output('arraybuffer'))
}
