const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
require.extensions['.ts'] = (mod,filename) => {
  mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
  }).outputText,filename)
}
const pdfParse = require('pdf-parse')
const { textoCatalogoGeometrico }=require('../lib/ai/catalogoPdfTexto.ts')
const { diagnosticarRelatorio }=require('../lib/engenhariaImportacaoWvetro.ts')

function pdfSimples() {
  const campos=[
    ['CODIGO','EIXO','COMPRIMENTO','QUANTIDADE'],
    ['SU001','L','1492','2'],
    ['SU053','H','2294','2'],
  ]
  const conteudo = ['BT','/F1 11 Tf']
  for (const [indice,linha] of campos.entries()) for (const [coluna,texto] of linha.entries()) {
    const x=[50,140,220,360][coluna], y=745-indice*28
    conteudo.push(`1 0 0 1 ${x} ${y} Tm (${texto}) Tj`)
  }
  conteudo.push('ET')
  const stream=conteudo.join('\n')+'\n'
  const objetos=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
  ]
  let texto='%PDF-1.4\n'
  const offsets=[0]
  for (const [i,obj] of objetos.entries()) {
    offsets.push(Buffer.byteLength(texto))
    texto+=`${i+1} 0 obj\n${obj}\nendobj\n`
  }
  const posicaoXref=Buffer.byteLength(texto)
  texto+=`xref\n0 ${objetos.length+1}\n0000000000 65535 f \n`
  for (const offset of offsets.slice(1)) texto+=`${String(offset).padStart(10,'0')} 00000 n \n`
  texto+=`trailer\n<< /Size ${objetos.length+1} /Root 1 0 R >>\nstartxref\n${posicaoXref}\n%%EOF\n`
  return Buffer.from(texto)
}
async function main() {
  const buffer=pdfSimples()
  assert.equal(buffer.subarray(0,5).toString(),'%PDF-')
  const normal=await pdfParse(buffer,{max:7})
  assert.equal(normal.numpages,1)
  const geometrico=await pdfParse(buffer,{max:7,pagerender:async page=>{
    const itens=await page.getTextContent({normalizeWhitespace:false})
    return textoCatalogoGeometrico(itens.items)
  }})
  const lidos=diagnosticarRelatorio(geometrico.text,'amostra-cortes.pdf')
  assert.equal(lidos.estado,'lista_corte',geometrico.text)
  assert.equal(lidos.componentes.length,2,JSON.stringify(lidos))
  assert.deepEqual(lidos.componentes.map(x=>x.comprimento_mm),[1492,2294])
  console.log('OK: PDF real em memória, extração geométrica de tabelas e leitura dos cortes.')
}
main().catch(err=>{console.error(err); process.exitCode=1})
