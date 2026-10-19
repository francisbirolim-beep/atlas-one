const fs=require('node:fs'),assert=require('node:assert/strict')
const route=fs.readFileSync('app/api/ia/central-aprendizado/route.ts','utf8')
const ini=route.indexOf('async function aplicar(')
const fim=route.indexOf('function conflitosProdutoCatalogo(',ini)
assert.ok(ini>=0&&fim>ini,'Função aplicar precisa existir')
const aplicar=route.slice(ini,fim)
assert.match(aplicar,/if\(d\.equivalencia_confirmada_com&&produtoId!==d\.equivalencia_confirmada_com\)/)
assert.match(aplicar,/if\(produtoId&&!d\.equivalencia_confirmada_com\)/,
  'Não atualizar peso, foto ou medidas do cadastro principal por fornecedor equivalente')
assert.match(aplicar,/if\(d\.equivalencia_confirmada_com\)\{/)
assert.match(aplicar,/\.some\(x=>x\.produto_id!==produtoId\)/,
  'Não remapear código de fornecedor de outro produto')
const eq=aplicar.slice(aplicar.indexOf('if(d.equivalencia_confirmada_com){'))
assert.match(eq,/\.insert\(vinculo\)/,
  'Não usar upsert perigoso em equivalência nova')
assert.match(eq,/\.eq\('produto_id',produtoId\)/,
  'Só editar vínculo já pertencente ao destino confirmado')
assert.match(eq,/\.upsert\(vinculo,\{onConflict:'fornecedor_id,codigo_fornecedor'\}\)/,
  'Fluxo já homologado de cadastro não equivalente permanece inalterado')
assert.match(route,/if\(process\.env\.VERCEL_ENV==='preview'\)return/,
  'Prévias continuam sem gravação')
console.log('PASS: equivalência não altera foto/peso/medidas do cadastro principal nem transfere vínculo de fornecedor.')
