const assert=require('node:assert/strict'),fs=require('node:fs')
const ler=p=>fs.readFileSync(p,'utf8')
const cliente=ler('components/clientes/Cliente360KanbanObras.tsx')
const obra=ler('components/clientes/VendaKanbanObra.tsx')
const geral=ler('app/visao-geral-projetos/page.tsx')
const api=ler('app/api/clientes/[id]/kanban-obras/route.ts')
const alca=ler('components/kanban/AlcaArrastarCard.tsx')
assert.ok(api.includes('permissoesKanbanObra(u)')&&api.includes('podeMoverCards'),'Servidor precisa verificar permissão')
assert.ok(cliente.includes('card.vendas.length===1'),'Só move venda inequivocamente associada à obra')
assert.ok(cliente.includes('card.vendas.length>1'),'Obras com múltiplas vendas precisam de orientação')
assert.ok(cliente.includes("fetch('/api/visao-geral-projetos/mover'"),'Usar única API auditada')
assert.ok(cliente.includes('data-kanban-coluna={col.id}')&&cliente.includes('data-kanban-scroll'))
assert.ok(cliente.includes('void moverVenda(atual.vendaId,destino)'),'Alça deve chamar gravação para destino válido')
assert.ok(cliente.includes("e.dataTransfer.setData('text/plain','atlas-principal:'"),'Também permitir arrastar pelo próprio card')
for(const [nome,c] of [['obra',obra],['geral',geral]]){
 assert.ok(c.includes('data-kanban-card'),'Falta card inteiro arrastável: '+nome)
 assert.ok(c.includes('onSoltar={destino=>void mover'),'Falta handle pointer: '+nome)
 assert.ok(c.includes('setAviso('),'Falta confirmação de salvamento: '+nome)
}
for(const termo of ["cloneNode(true)","fantasma.current","document.body.appendChild","pointerEvents:'none'","fantasma.current?.remove()"]){
 assert.ok(alca.includes(termo),'Cópia visual de arraste incompleta: '+termo)
}
console.log('PASS: os três Kanbans possuem arraste completo, permissão no servidor e retorno de salvamento')
