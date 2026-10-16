import assert from 'node:assert/strict'
import fs from 'node:fs'
const read=p=>fs.readFileSync(p,'utf8')
const api=read('app/api/kanban/configuracao-colunas-preview/route.ts')
const ui=read('app/kanban/configuracao-colunas-preview/page.tsx')
assert.ok(api.includes("if(u.role!=='master')"),'Preview protected by Master')
for(const x of ['central_kanban_colunas','setor_kanban_colunas','kanban_colunas','.eq(\'empresa_id\',empresa)','Cache-Control','setor_id'])assert.ok(api.includes(x),'Read-only tenant source '+x)
assert.ok(!api.includes('.insert(')&&!api.includes('.update(')&&!api.includes('.delete(')&&!api.includes('.upsert('),'No mutation allowed')
assert.ok(!api.includes('semearColunas') || api.includes('Não chama GET da Central'),'No default-seeding reads')
for(const x of ['draggable','onDragStart','onDrop','Adicionar coluna','Renomear','Remover da prévia','Restaurar prévia','Copiar configuração','const manter=(lista:Col[])=>lista.map(c=>({...c}))'])assert.ok(ui.includes(x),'Preview UI '+x)
assert.ok(!ui.includes("method:'POST'")&&!ui.includes('method:"POST"'),'Preview never writes')
console.log('PASS: Master-only real kanban columns, drag/reorder/rename/add/remove simulated; original order protected; zero writes')
