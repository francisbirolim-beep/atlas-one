/* Teste isolado de uma folha A4 — não acessa o banco ou os pedidos existentes. */
const fs = require('fs')
const path = require('path')
const puppeteer = require(path.join(process.env.HOME,'.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer'))
const pdfParse = require('pdf-parse')
const assert = require('assert')
const root = path.resolve(__dirname,'..')
const css = fs.readFileSync(path.join(root,'components/clientes/ClienteRomaneios.css'),'utf8')
const logo = fs.readFileSync(path.join(root,'public/logo.png')).toString('base64')
const long = 'Perfil de alumínio Linha Suprema — marco superior para esquadria de grandes dimensões'
const rows = Array.from({length:10},(_,i)=>(
  '<tr><td>'+(i+1)+'</td><td><img src="data:image/png;base64,'+logo+'"/></td>'
  +'<td class="rom-descricao"><b>PF-'+String(100+i)+'</b><span>'+(i===6?long:'Perfil de alumínio para pintura, modelo '+(i+1))+'</span></td>'
  +'<td>6.000 mm</td><td class="rom-qtd">'+(i+1)+'</td>'
  +'<td>Lote '+(i+1)+' — conferir antes do envio</td></tr>'
)).join('')
const html='<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><style>'
  +css+'</style></head><body><article class="rom-pagina" id="romaneio-documento">'
  +'<header class="rom-header"><img src="data:image/png;base64,'+logo+'"/>'
  +'<div class="rom-header-titulo"><strong>ROMANEIO DE PINTURA</strong><span>ROM-000001 · 09/11/2026</span></div></header>'
  +'<div class="rom-faixa"><span>CLIENTE: <b>Cliente de Demonstração</b></span><span>OBRA: <b>Obra de Demonstração</b></span><span>STATUS: <b>Enviado</b></span></div>'
  +'<div class="rom-dados"><section><h4>IDENTIFICAÇÃO DA OBRA</h4><p><small>Cliente</small><b>Cliente de Demonstração</b></p><p><small>Obra</small><b>Obra de Demonstração</b></p><p><small>Endereço</small><b>José Bonifácio — SP</b></p></section>'
  +'<section><h4>INSTRUÇÕES PARA PINTURA</h4><p><small>Destino</small><b>Pintura eletrostática</b></p><p class="rom-cor"><small>COR</small><b>BRANCO FOSCO</b></p><p><small>Código da cor</small><b>RAL 9003</b></p><p><small>Acabamento</small><b>Microtextura</b></p></section></div>'
  +'<div class="rom-itens-cabecalho"><h4>RELAÇÃO DOS MATERIAIS</h4><b>10 itens cadastrados</b></div>'
  +'<table class="rom-tabela"><colgroup><col style="width:7%"/><col style="width:16%"/><col style="width:32%"/><col style="width:13%"/><col style="width:9%"/><col style="width:23%"/></colgroup>'
  +'<thead><tr><th>Nº</th><th>Foto</th><th>Perfil / Produto</th><th>Medida</th><th>Qtd.</th><th>Observações</th></tr></thead><tbody>'+rows+'</tbody></table>'
  +'<div class="rom-rodape"><div class="rom-resumo"><b>TOTAL: 55 unidades / peças</b><span><strong>COR PARA PINTURA:</strong> Branco Fosco (RAL 9003)</span></div>'
  +'<div class="rom-observacoes"><b>OBSERVAÇÕES GERAIS</b><p>Conferir perfil, medidas e cor antes de pintar.</p></div>'
  +'<div class="rom-assinaturas"><div><span>Enviado por: Teste</span><i/>Assinatura / conferência</div><div><span>Recebido por: Pintura</span><i/>Assinatura / conferência</div></div></div>'
  +'<footer class="rom-footer"><span>ESQUADRIFÁCIO · SOLUÇÕES EM ALUMÍNIO</span><span>Romaneio ROM-000001 · Página 1/1</span></footer>'
  +'</article></body></html>'
async function main() {
 const b = await puppeteer.launch({headless:true,args:['--no-sandbox']})
 try {
  const page = await b.newPage()
  await page.setContent(html,{waitUntil:'load'})
  const sizes=await page.evaluate(()=>{
    const doc=document.querySelector('#romaneio-documento')
    const footer=document.querySelector('.rom-footer')
    const rows=document.querySelectorAll('.rom-tabela tbody tr')
    return {docHeight:doc.clientHeight,scrollHeight:doc.scrollHeight,
      footerBottom:footer.getBoundingClientRect().bottom-doc.getBoundingClientRect().top,rows:rows.length}
  })
  assert.equal(sizes.rows,10)
  assert(sizes.scrollHeight<=sizes.docHeight+1,'Conteúdo ultrapassou a folha: '+JSON.stringify(sizes))
  assert(sizes.footerBottom<=sizes.docHeight+1,'Rodapé fora da folha')
  const out='/tmp/atlas-romaneios-a4-validacao.pdf'
  await page.pdf({path:out,format:'A4',preferCSSPageSize:true,printBackground:true})
  const pdf=await pdfParse(fs.readFileSync(out))
  assert.equal(pdf.numpages,1,'PDF gerou '+pdf.numpages+' páginas')
  assert(pdf.text.includes('PF-109'),'Último perfil não aparece no PDF')
  assert(pdf.text.includes('BRANCO FOSCO'),'Cor da pintura não aparece no PDF')
  assert(pdf.text.includes('Página 1/1'),'Rodapé não aparece no PDF')
  console.log('ROMANEIO_A4_OK',JSON.stringify({...sizes,paginas:pdf.numpages,pdf:out}))
 } finally {await b.close()}
}
main().catch(e=>{console.error(e);process.exit(1)})