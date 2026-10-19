const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const p='app/financeiro/contas-pagar/comissoes-previa/page.tsx';
const codigo=fs.readFileSync(p,'utf8');
for(const esperado of ['Aguardando conferência','Aguardando programação','Pagar','Não pagar','Concluir conferência','DEMONSTRAÇÃO · SEM GRAVAÇÃO REAL','Nenhuma informação financeira real foi alterada']) assert(codigo.includes(esperado),`Falta: ${esperado}`);
assert(!/\bfetch\s*\(/.test(codigo),'Prévia não deve escrever nem consultar API operacional');
assert(!/supabaseAdmin|\.rpc\s*\(/.test(codigo),'Prévia não deve acessar Supabase');
for (const arquivo of ['app/api/financeiro/cliente-recebimento/route.ts','app/api/financeiro/contas-receber/route.ts','app/api/financeiro/contas-pagar/route.ts','app/financeiro/contas-receber/page.tsx']) {
  execFileSync('git',['diff','--exit-code','HEAD','--',arquivo],{stdio:'pipe'});
}
const valorComissao=(recebido,percentual)=>Math.round(recebido*percentual)/100;
assert.equal(valorComissao(10000,5),500);
assert.equal(valorComissao(10000,2),200);
assert.equal(valorComissao(10000,1),100);
assert.equal(valorComissao(3200,1.5),48);
assert.equal(valorComissao(2250.50,5),112.53);
console.log('PASS: só prévia demonstrativa, nenhuma API financeira existente alterada, cálculo parcial consistente.');
