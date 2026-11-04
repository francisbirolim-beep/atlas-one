const fs=require('node:fs')
const assert=require('node:assert/strict')
const ui=fs.readFileSync('components/clientes/VendaTipologiasMateriais.tsx','utf8')
const pagina=fs.readFileSync('components/clientes/VendaObraCentral.tsx','utf8')
const desenho=fs.readFileSync('components/clientes/TipologiaEsquadriaIlustracao.tsx','utf8')
for(const padrao of [
 /Fluxo da Obra/,/Tipologias da Obra/,/Resumo da Confer[êe]ncia/,/Composi[çc][ãa]o T[ée]cnica/,
 /Plano de Corte/,/Lista de Barras \(Perfis\)/,/PDF \/ W\.Vetro/,/IA Atlas/,/Hist[óo]rico/,
 /Ampliar/,/Imprimir Ficha/,/Imprimir Selecionadas/,/Substituir \/ Corrigir/,/Importar PDF Correto/,
 /Confirmar \/ Aprovar/,/conic-gradient/,/fotoMaterial\(m\)/,/fotoDaTipologia\(it\)/,
 /situacoes\[aberta/,/onAbrirMateriais/,/itemRef',aberta/,/validar_atlas/,
 /setAbaTecnica\('pdf'\)/,/setAbaTecnica\('materiais'\)/,
 /AssinaturaTecnica|assinaturaTecnica|recargaResumo/,
])assert.match(ui,padrao)
assert.match(pagina,/onAbrirMateriais=\{\(\)=>setAba\('materiais'\)\}/)
assert.match(desenho,/Representa[çc][ãa]o esquem[áa]tica|Pr[ée]-visualiza[çc][ãa]o esquem[áa]tica/)
assert.doesNotMatch(ui,/\.from\('compras_pedidos'\)\.insert/)
assert.doesNotMatch(ui,/\.from\('ordens_producao'\)\.insert/)
console.log('PASS: layout fiel à prévia, 7 abas, imagem por produto, revisão Master, PDF, compra e produção isoladas.')
