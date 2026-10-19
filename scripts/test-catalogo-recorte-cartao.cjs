const assert=require('node:assert/strict')
const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),pdf=require('pdf-parse')
const mod={exports:{}}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/ai/catalogoRecorteCartao.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:mod,exports:mod.exports})
const {limitesRecorteCartao}=mod.exports
async function conferir(nome,arquivo,checks){
 const paginas=new Map()
 let n=0
 await pdf(fs.readFileSync(process.env.HOME+'/Downloads/'+arquivo),{pagerender:async page=>{
   n++
   const c=await page.getTextContent({normalizeWhitespace:false,disableCombineTextItems:false})
   if(checks.some(x=>x.pagina===n)){
     const zoom=2,view=page.getViewport(zoom)
     const itens=c.items.filter(x=>x?.str&&x?.transform).map(x=>({str:x.str,x:x.transform[4]*zoom,
       y:view.height-x.transform[5]*zoom,w:(x.width||0)*zoom,h:Math.max(10,(x.height||0)*zoom)}))
     paginas.set(n,{itens,view,zoom})
   }
   return c.items.map(x=>x.str).join(' ')
 }})
 let vistos=0
 for(const caso of checks){
   const {itens,view,zoom}=paginas.get(caso.pagina)||{}
   assert.ok(itens,'Página não analisada: '+caso.pagina)
   const t=itens.find(x=>x.str.trim()===caso.codigo)
   assert.ok(t,'Código ausente: '+caso.codigo)
   const limites=limitesRecorteCartao(itens,t,zoom,view.width,view.height)
   if(caso.semCartao){assert.equal(limites,null,'Não alterar o recorte de família: '+caso.codigo);vistos++;continue}
   if(!limites)console.log('CROP_DEBUG',caso.codigo,JSON.stringify({t,weight:itens.filter(i=>/KG/i.test(i.str)).map(i=>({str:i.str,x:i.x,y:i.y,diffY:i.y-t.y,diffX:i.x-t.x})),vw:view.width,vh:view.height}));
   assert.ok(limites,'Cartão não detectado: '+caso.codigo)
   assert.ok(limites.sh>180&&limites.sw>180,'Recorte muito estreito: '+caso.codigo)
   assert.ok(limites.sh<=Math.round(285*zoom),'Recorte ainda muito alto: '+caso.codigo)
   assert.ok(limites.sy<t.y,'Descrição não ficou visível: '+caso.codigo)
   assert.ok(limites.sy+limites.sh>t.y+80,'Desenho abaixo não ficou visível: '+caso.codigo)
   const oldHeight=view.height-25*zoom-(t.y-t.h-12*zoom)
   assert.ok(limites.sh<oldHeight*.85,'Imagem continua incluindo o rodapé: '+caso.codigo)
   console.log(caso.codigo,'page',caso.pagina,'crop px',JSON.stringify(limites),'before_height=',Math.round(oldHeight))
   vistos++
 }
 assert.equal(vistos,checks.length,'Páginas verificadas')
}

async function main(){
 await conferir('fortal','Catalogo Digital 2026.pdf',[
  {pagina:75,codigo:'F42-012'},{pagina:75,codigo:'F42-014'},
  {pagina:62,codigo:'FLG-162'},{pagina:62,codigo:'FLG-164'}])
 await conferir('feld','Catalogo Feld.pdf',[{pagina:4,codigo:'L-612',semCartao:true}])
 console.log('PASS: desenho dos quatro códigos de duas colunas enquadrado sem rodapé; recorte Feld original preservado')
}
main().catch(e=>{console.error(e);process.exitCode=1})
