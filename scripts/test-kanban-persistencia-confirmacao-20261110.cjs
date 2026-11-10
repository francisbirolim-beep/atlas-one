const assert=require('node:assert/strict')
const fs=require('node:fs')
const ler=p=>fs.readFileSync(p,'utf8')
const telas=[
 ['Kanban desta obra',ler('components/clientes/VendaKanbanObra.tsx')],
 ['Kanban Geral',ler('app/visao-geral-projetos/page.tsx')],
 ['Kanban do Cliente',ler('components/clientes/Cliente360KanbanObras.tsx')]
]
for(const [nome,s] of telas){
 for(const trecho of ['leituraAtual=useRef(0)','movimentoEmCurso=useRef(false)','++leituraAtual.current',
  "cache:'no-store'","setAviso('Salvando", "setAviso('✓ ", 'role="status"',
  'fixed bottom-20 right-5','z-[120]','aria-live="polite"']){
  assert.ok(s.includes(trecho),nome+' falta '+trecho)
 }
 assert.ok(s.includes('setErro('),'Não mostra falha na gravação: '+nome)
 assert.ok(s.includes('colunaId!=='),'Não verifica retorno servidor: '+nome)
}
const venda=telas[0][1],geral=telas[1][1],cliente=telas[2][1]
assert.ok(venda.includes('if(movimentacaoEmCurso.current||geracao!==leituraAtual.current)return'))
assert.ok(geral.includes('if(movimentoEmCurso.current||geracao!==leituraAtual.current)return'))
assert.ok(cliente.includes('if(movimentoEmCurso.current||geracao!==leituraAtual.current)return'))
assert.ok(venda.includes("setDados(p=>p?{...p,cards:p.cards.map"))
assert.ok(geral.includes("setCards(p=>p.map"))
assert.ok(cliente.includes("setDados(p=>p?{...p,cards:p.cards.map"))
for(const [nome,s] of telas){
 assert.ok(s.includes("fetch('/api/visao-geral-projetos/mover'"),nome+' não usa a API auditada')
 assert.ok(s.includes('setAviso(\'✓ '),nome+' não exibe sucesso confirmado')
 assert.ok(s.includes('setErro(e instanceof Error'),nome+' não exibe erro de API')
}
console.log('PASS: cards otimistas, bloqueio de GET antigo, confirmação de leitura e avisos fixos nas 3 telas')
