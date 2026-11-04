const fs = require('fs')
const assert = require('node:assert/strict')
const path = require('path')
const ler = (p) => fs.readFileSync(path.join(process.cwd(),p),'utf8')
const api = ler('app/api/vendas/wvetro/conferencia-documental/route.ts')
const ui = ler('components/clientes/VendaConferenciaDocumentalWVetro.tsx')
const fichas = ler('app/obras/[id]/tipologias/fichas/page.tsx')
const tipologias = ler('components/clientes/VendaTipologiasMateriais.tsx')
const obra = ler('components/clientes/VendaObraCentral.tsx')
for (const exp of [
 /await autenticarTenant\(req\)/,
 /\.eq\('empresa_id',u\.empresa_id\)/,
 /\.eq\('orcamento_id',venda\.orcamento_id\)/,
 /c\.u\.role!=='master'/,
 /file\.size>15\*1024\*1024/,
 /pdf\.hash/,
 /hashFonte/,
 /assinaturaTecnica/,
 /O PDF mudou depois da an[aá]lise/,
 /n[ãa]o corresponde ao/,
 /\.storage\.from\('atlas-aprendizado'\)/,
 /status:'concluido'/,
 /ai_aprendizado_eventos/,
 /Evid[êe]ncia de aprendizado supervisionado/,
]) assert.match(api,exp)
assert.doesNotMatch(api,/\.from\('ordens_producao'\)\.insert/)
assert.doesNotMatch(api,/\.from\('compras_pedidos'\)\.insert/)
for(const exp of [
 /Abrir PDF original vinculado pelo W\.Vetro/,
 /Ler e comparar PDF com o Atlas/,
 /Confirmar PDF correto e registrar aprendizado/,
 /Revis[ãa]o necess[áa]ria/,
 /Quantidade revisada manualmente/,
 /conferenciaManual/,
 /identidadeConfirmada/,
])assert.match(ui,exp)
for(const exp of [
 /Imprimir fichas/,
 /fichas\?pacote=/,
 /Selecionar esta tipologia para impress[ãa]o/,
 /VendaConferenciaDocumentalWVetro/,
])assert.match(tipologias,exp)
for(const exp of [/breakAfter:'page'/,/Perfis e cortes/,/Acess[óo]rios/,/Vidros/,/Imagem/])assert.match(fichas,exp)
assert.match(obra,/tipo="materiais"/)
assert.match(obra,/obraId=\{venda\.obra_id\}/)
console.log('PASS: conferência PDF por tipologia/obra, histórico supervisionado, revisão, imagens, impressão e segurança.')
