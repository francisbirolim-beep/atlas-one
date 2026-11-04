'use client'

export type ColunaPdf={titulo:string;largura:number;alinhar?:'left'|'right'}
export type LinhaPdf={valores:string[]}
export type GrupoPdf={nome:string;total:number;linhas:LinhaPdf[];imagem?:string|null}
export type DocumentoPdf={
 titulo:string;periodo:string;filtro:string;observacao:string;colunas:ColunaPdf[];
 grupos:GrupoPdf[];total:number;totalRegistros:number;unidadeTotal:'R$'
}
const safe=(v:string)=>String(v||'—').replace(/[\u0000-\u001f]/g,' ')
async function imagemCanvas(url:string,maxWidth=500,formato:'JPEG'|'PNG'='JPEG'){
 if(!url.startsWith('https://')&&!url.startsWith('/'))return null
 return new Promise<string|null>(resolve=>{
  const img=new Image()
  img.crossOrigin='anonymous'
  const timer=window.setTimeout(()=>resolve(null),4500)
  img.onload=()=>{
   window.clearTimeout(timer)
   try{
    const canvas=document.createElement('canvas')
    const escala=Math.min(1,maxWidth/Math.max(img.naturalWidth,img.naturalHeight))
    canvas.width=Math.max(1,Math.round(img.naturalWidth*escala))
    canvas.height=Math.max(1,Math.round(img.naturalHeight*escala))
    const ctx=canvas.getContext('2d')
    if(!ctx){resolve(null);return}
    if(formato==='JPEG'){ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height)}
    ctx.drawImage(img,0,0,canvas.width,canvas.height)
    resolve(formato==='PNG'?canvas.toDataURL('image/png'):canvas.toDataURL('image/jpeg',0.84))
   }catch{resolve(null)}
  }
  img.onerror=()=>{window.clearTimeout(timer);resolve(null)}
  img.src=url
 })
}
export async function baixarPdfGerencial(info:DocumentoPdf){
 const {jsPDF}=await import('jspdf')
 const doc=new jsPDF({unit:'mm',format:'a4',orientation:'landscape',compress:true})
 const w=297,h=210,left=12,right=285,bottom=195
 let y=0
 let pagina=0
 const moeda=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
 const colunas=info.colunas
 const logo=await imagemCanvas('/branding/esquadrifacio-logo-r-transparente-claro.webp',1280,'PNG')
 const fotosCache=new Map<string,string|null>()
 const fotos=[...new Set(info.grupos.map(g=>g.imagem).filter((x):x is string=>Boolean(x)))]
 for(let i=0;i<fotos.length;i+=8){
  await Promise.all(fotos.slice(i,i+8).map(async url=>fotosCache.set(url,await imagemCanvas(url))))
 }
 if(colunas.reduce((s,c)=>s+c.largura,0)>273.1)throw Error('Largura inválida do relatório.')
 const cabecalho=()=>{
  pagina++
  doc.setFillColor(244,247,250);doc.rect(0,0,w,31,'F')
  doc.setTextColor(18,50,75);doc.setFont('helvetica','bold');doc.setFontSize(13)
  doc.text('ESQUADRIFÁCIO',left,11)
  if(logo)try{doc.addImage(logo,'PNG',right-63,2,63,11.6)}catch{}
  doc.setFontSize(15);doc.text(safe(info.titulo),left,21)
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(80,92,105)
  doc.text(safe('Período: '+info.periodo),left,27)
  doc.text(safe('Emitido em '+new Date().toLocaleString('pt-BR')),right,21,{align:'right'})
  doc.setTextColor(55,70,85)
  const filtros=doc.splitTextToSize(safe('Filtro: '+info.filtro),273)
  doc.text(filtros.slice(0,2),left,36)
  y=36+Math.min(2,filtros.length)*4+3
 }
 const rodape=()=>{
  doc.setDrawColor(210,219,228);doc.line(left,198,right,198)
  doc.setTextColor(110,120,130);doc.setFont('helvetica','normal');doc.setFontSize(8)
  doc.text('Atlas One · Relatório gerencial · Valores conforme registros disponíveis na data da emissão',left,203)
  doc.text('Página '+pagina,right,203,{align:'right'})
 }
 const novaPagina=()=>{if(pagina){rodape();doc.addPage()}cabecalho()}
 const garantir=(altura:number)=>{if(y+altura>bottom)novaPagina()}
 const cabecalhoTabela=()=>{
  garantir(8)
  doc.setFillColor(228,234,241);doc.rect(left,y,273,7,'F')
  doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(40,58,73)
  let x=left
  for(const c of colunas){
   if(c.alinhar==='right')doc.text(safe(c.titulo),x+c.largura-2,y+4.6,{align:'right'})
   else doc.text(safe(c.titulo),x+2,y+4.6)
   x+=c.largura
  }
  y+=7
 }
 novaPagina()
 doc.setTextColor(25,35,50);doc.setFont('helvetica','bold');doc.setFontSize(10)
 doc.text('Total: '+moeda(info.total)+'   |   '+info.totalRegistros+' lançamento(s)   |   '+info.grupos.length+' grupo(s)',left,y+4)
 y+=11
 cabecalhoTabela()
 for(const grupo of info.grupos){
  const foto=grupo.imagem?fotosCache.get(grupo.imagem)||null:null
  const usaImagem=!!grupo.imagem
  const alturaGrupo=usaImagem?15:10
  garantir(alturaGrupo+8)
  doc.setFillColor(239,245,246);doc.rect(left,y,273,alturaGrupo,'F')
  doc.setTextColor(20,71,69);doc.setFont('helvetica','bold');doc.setFontSize(9.5)
  if(foto)try{doc.addImage(foto,'JPEG',left+2,y+1.2,12,12)}catch{}
  else if(usaImagem){doc.setFont('helvetica','normal');doc.setFontSize(6);doc.text('Foto não',left+2,y+6);doc.text('disponível',left+2,y+9)}
  const desloca=usaImagem?17:2
  const nomeQuebrado=doc.splitTextToSize(safe(grupo.nome),175)
  doc.text(nomeQuebrado.slice(0,2),left+desloca,y+4.5)
  doc.setFont('helvetica','bold');doc.setFontSize(9)
  doc.text('Subtotal: '+moeda(grupo.total),right-2,y+4.5,{align:'right'})
  y+=alturaGrupo
  for(const linha of grupo.linhas){
   const segmentos=linha.valores.map((v,index)=>doc.splitTextToSize(safe(v),colunas[index].largura-4))
   const linhasAlt=Math.max(1,...segmentos.map(a=>a.length))
   const altura=Math.max(7,linhasAlt*3.9+2)
   garantir(altura)
   // Títulos repetidos após quebra de página para leitura em papel.
   if(y<48)cabecalhoTabela()
   doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(45,55,68)
   let x=left
   for(let index=0;index<colunas.length;index++){
    const coluna=colunas[index]
    const t=segmentos[index]
    if(coluna.alinhar==='right')doc.text(t,x+coluna.largura-2,y+4,{align:'right'})
    else doc.text(t,x+2,y+4)
    x+=coluna.largura
   }
   doc.setDrawColor(236,238,240);doc.line(left,y+altura,right,y+altura)
   y+=altura
  }
 }
 garantir(18)
 doc.setFillColor(226,235,246);doc.rect(left,y,273,12,'F')
 doc.setTextColor(12,38,68);doc.setFont('helvetica','bold');doc.setFontSize(11)
 doc.text('TOTAL DO RELATÓRIO',left+3,y+7.5)
 doc.text(moeda(info.total),right-3,y+7.5,{align:'right'})
 y+=16
 const observacao=doc.splitTextToSize(safe(info.observacao),273)
 doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(90,100,110)
 for(const linha of observacao.slice(0,10)){
  garantir(4)
  doc.text(linha,left,y);y+=4
 }
 rodape()
 const nome='atlas-'+info.titulo.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').slice(0,45)+'.pdf'
 doc.save(nome)
}
