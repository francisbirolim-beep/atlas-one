import pdfParse from 'pdf-parse'

export type BarraWVetro={
 codigo:string;descricao:string;tipo:string;tratamento:string;quantidade:number;
 tamanho_mm:number;peso_kg:number|null;sobra_kg:number|null;pagina:number
}

export type RelatorioBarrasWVetro={
 numeroOrcamento:string;cliente:string|null;obra:string|null;itens:BarraWVetro[];paginas:number
}

function numero(v:string|undefined):number|null{
 if(!v)return null
 let s=v.trim().replace(/[^0-9,.-]/g,'')
 if(!s)return null
 if(s.includes(','))s=s.replace(/\./g,'').replace(',','.')
 const n=Number(s)
 return Number.isFinite(n)?n:null
}

export async function analisarPdfBarrasWVetro(buffer:Buffer):Promise<RelatorioBarrasWVetro>{
 if(buffer.length>8*1024*1024||buffer.length<100||buffer.subarray(0,5).toString()!=='%PDF-'){
  throw new Error('Envie um PDF válido do relatório Barras Utilizadas (até 8 MB).')
 }
 type Item={str:string;x:number;y:number}
 const paginas:Item[][]=[]
 const lido=await pdfParse(buffer,{
  max:16,
  pagerender:async(page:any)=>{
   const texto=await page.getTextContent()
   paginas.push((texto.items||[]).filter((x:any)=>String(x.str||'').trim()).map((x:any)=>({
    str:String(x.str||'').trim(),
    x:Math.round(Number(x.transform?.[4]||0)),
    y:Math.round(Number(x.transform?.[5]||0)),
   })))
   return ''
  }
 })
 if(!paginas.length||lido.numpages>16)throw new Error('PDF sem páginas válidas.')
 const full=paginas.flat().map(x=>x.str).join(' ')
 if(!/Relatório de Cotação de Barras/i.test(full))throw new Error('Este PDF não é o relatório Barras Utilizadas do WVetro.')
 const numeroOrcamento=full.match(/OR[ÇC]AMENTO\s*Nro\s*(\d+)/i)?.[1]||''
 if(!numeroOrcamento)throw new Error('Número de orçamento não identificado no relatório.')
 const linhas:BarraWVetro[]=[]
 let tipo=''
 let tratamento=''
 for(let pi=0;pi<paginas.length;pi++){
  // O WVetro coloca rótulo e valor da cor com 1-2 px de diferença vertical.
  // Agrupar por y exato deixa escapar mudanças de acabamento entre seções.
  const grupos:Array<{y:number;itens:Item[]}>= []
  for(const item of [...paginas[pi]].sort((a,b)=>b.y-a.y)){
   const row=grupos.find(x=>Math.abs(x.y-item.y)<=2)
   if(row)row.itens.push(item)
   else grupos.push({y:item.y,itens:[item]})
  }
  const ordenadas=grupos.sort((a,b)=>b.y-a.y)
  for(const {itens} of ordenadas){
   const t=itens.sort((a,b)=>a.x-b.x)
   const id=t.find(i=>i.x>=36&&i.x<=58&&i.str==='TIPO:')
   if(id){
    const valor=t.find(i=>i.x>60&&i.x<340&&i.str!=='TIPO:')
    if(valor)tipo=valor.str
   }
   const cor=t.find(i=>i.x>=36&&i.x<=60&&i.str==='TRATAMENTO:')
   if(cor){
    const valor=t.find(i=>i.x>70&&i.x<355&&i.str!=='TRATAMENTO:')
    if(valor)tratamento=valor.str
   }
   const codigo=t.find(i=>i.x>=54&&i.x<=120&&/^[A-Z0-9][A-Z0-9() /.-]{0,35}$/i.test(i.str)&&!['Perfil','Figura'].includes(i.str))
   const qtde=t.find(i=>i.x>=395&&i.x<=440&&/^\d+$/.test(i.str))
   const comprimento=t.find(i=>i.x>=440&&i.x<=483&&/^\d{3,5}$/.test(i.str))
   const descricao=t.find(i=>i.x>=145&&i.x<=350&&i.str!==codigo?.str)
   if(!codigo||!qtde||!comprimento||!descricao)continue
   const quantidade=Number(qtde.str),tamanho=Number(comprimento.str)
   if(quantidade<=0||quantidade>10000||tamanho<100||tamanho>15000)continue
   if(!tratamento||!tipo)throw new Error('Tratamento ou tipo não encontrado para '+codigo.str)
   linhas.push({
    codigo:codigo.str,descricao:descricao.str,tipo,tratamento,quantidade,
    tamanho_mm:tamanho,
    peso_kg:numero(t.find(i=>i.x>=485&&i.x<=545)?.str),
    sobra_kg:numero(t.find(i=>i.x>=547&&i.x<=601)?.str),
    pagina:pi+1,
   })
  }
 }
 if(!linhas.length)throw new Error('Não encontrei linhas de barras com código, quantidade e tamanho. Confira o PDF.')
 const registros=new Map<string,BarraWVetro>()
 for(const linha of linhas){
  const chave=[linha.codigo,linha.tipo,linha.tratamento,linha.tamanho_mm].map(String).join('|').toUpperCase()
  const atual=registros.get(chave)
  if(!atual)registros.set(chave,linha)
  else{
   atual.quantidade+=linha.quantidade
   atual.peso_kg=atual.peso_kg!=null&&linha.peso_kg!=null?atual.peso_kg+linha.peso_kg:null
   atual.sobra_kg=atual.sobra_kg!=null&&linha.sobra_kg!=null?atual.sobra_kg+linha.sobra_kg:null
  }
 }
 // Identidade do cliente e obra será verificada pelo cadastro Atlas, nunca inferida do PDF.
 return {numeroOrcamento,cliente:null,obra:null,itens:[...registros.values()],paginas:lido.numpages}
}
