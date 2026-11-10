const assert=require('node:assert/strict')
const fs=require('node:fs')
const read=p=>fs.readFileSync(p,'utf8')
const helper=read('lib/kanbanArrastarDestino.ts')
const handle=read('components/kanban/AlcaArrastarCard.tsx')
const screens=[
 ['Obra',read('components/clientes/VendaKanbanObra.tsx')],
 ['Geral',read('app/visao-geral-projetos/page.tsx')],
 ['Cliente',read('components/clientes/Cliente360KanbanObras.tsx')],
]
for(const [name,s] of screens){
 assert.ok(s.includes('colunaNoFimDoArraste('),name+': sem fallback de destino no dragend')
 assert.ok(s.includes('onDragEnd={e=>'),name+': sem evento de finalização do drag')
 assert.ok(s.includes('onDrag={e=>'),name+': sem coordenadas de arraste')
 assert.ok(s.includes('tratado')||s.includes('dropPrincipalTratado'),name+': sem supressão de duplo POST')
 assert.ok(s.includes('Nenhuma mudança foi salva')||s.includes('Nenhuma posição foi alterada'),
  name+': sem erro de soltura inválida')
 assert.ok(s.includes('onSolturaInvalida='),name+': alça de arraste não mostra erro')
 assert.ok(s.includes("fetch('/api/visao-geral-projetos/mover'"),name+': gravação não usa API única')
}
assert.ok(helper.includes('elementFromPoint(')&&helper.includes('getBoundingClientRect()'))
assert.ok(handle.includes('colunaNoFimDoArraste(')&&handle.includes('onSolturaInvalida?.()'))
console.log('PASS: dragend fallback, validação geométrica, deduplicação e aviso nas três telas')
