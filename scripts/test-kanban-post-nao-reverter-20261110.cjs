const assert=require('node:assert/strict')
const fs=require('node:fs')
const files=[
 ['Obra','components/clientes/VendaKanbanObra.tsx'],
 ['Geral','app/visao-geral-projetos/page.tsx'],
 ['Cliente','components/clientes/Cliente360KanbanObras.tsx']
]
for(const [nome,path] of files){
 const source=fs.readFileSync(path,'utf8')
 assert.ok(source.includes('gravouNoBanco'),'Falta distinguir POST confirmado de erro de leitura: '+nome)
 assert.ok(source.includes('gravouNoBanco=true'),'Falta registrar sucesso do POST: '+nome)
 assert.ok(source.includes('posicaoGravada.current')||source.includes('posicoesGravadas.current'),'Falta manter posição durante GET antigo: '+nome)
 assert.ok(source.includes('if(gravouNoBanco){'),'Falta tratamento especial pós-gravação: '+nome)
 assert.ok(source.includes('setAviso(\'✓ '),'Falta confirmação ao usuário: '+nome)
 assert.ok(source.includes('cache:\'no-store\''),'GET não garante recarregar os dados: '+nome)
 const start=source.indexOf('async function moverPrincipal(')>=0?
   source.indexOf('async function moverPrincipal('):
   source.indexOf('async function moverCardVisual(')>=0?
    source.indexOf('async function moverCardVisual('):
    source.indexOf('async function moverVenda(')
 const tail=source.slice(start)
 assert.ok(tail.includes('if(!res.ok||!j.ok)')||tail.includes('if(!r.ok||!j.ok)')||tail.includes('if(!res.ok||!json.ok)'),'POST precisa confirmar sucesso: '+nome)
}
console.log('PASS: três Kanbans preservam posição confirmada pelo banco após resposta antiga/erro no GET')
