const assert=require('node:assert/strict')
const ts=require('typescript'),fs=require('node:fs')
const moduleObj={exports:{}}
new Function('module','exports',ts.transpileModule(
 fs.readFileSync('lib/instalacaoCapacidade.ts','utf8'),
 {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}
).outputText)(moduleObj,moduleObj.exports)
const {mesValido,capacidadeMensal,avaliarReserva}=moduleObj.exports
const itens=[
 {vendaId:'a',cliente:'A',numeroOrcamento:'#12',mes:'2026-11',valor:50000,estado:'previsto'},
 {vendaId:'b',cliente:'B',numeroOrcamento:'#13',mes:'2026-11',valor:25000,estado:'confirmado'},
 {vendaId:'c',cliente:'C',numeroOrcamento:'#14',mes:'2026-11',valor:8000,estado:'concluido'},
 {vendaId:'d',cliente:'D',numeroOrcamento:'#15',mes:'2026-11',valor:150000,estado:'cancelado'},
 {vendaId:'e',cliente:'E',numeroOrcamento:'#16',mes:'2026-12',valor:100000,estado:'previsto'},
]
assert.equal(mesValido('2026-11'),true)
assert.equal(mesValido('2026-13'),false)
assert.equal(mesValido('2026-00'),false)
assert.equal(mesValido('26-11'),false)
const r=capacidadeMensal('2026-11',100000,itens)
assert.equal(r.programado,83000)
assert.equal(r.confirmado,25000)
assert.equal(r.concluido,8000)
assert.equal(r.saldo,17000)
assert.equal(r.utilizacao,83)
assert.equal(r.quantidade,3)
assert.equal(r.situacao,'disponivel')
assert.equal(capacidadeMensal('2026-11',null,itens).situacao,'sem_meta')
assert.equal(capacidadeMensal('2026-11',80000,itens).situacao,'excedido')
assert.equal(capacidadeMensal('2026-11',90000,itens).situacao,'atencao')
assert.equal(avaliarReserva('2026-11',100000,itens,{vendaId:'z',valor:20000}).ultrapassa,true)
assert.equal(avaliarReserva('2026-11',100000,itens,{vendaId:'a',valor:40000}).ultrapassa,false,'Reprogramação de mesma venda não soma duas vezes')
assert.throws(()=>capacidadeMensal('2026-99',100000,itens))
assert.throws(()=>capacidadeMensal('2026-11',0,itens))
assert.throws(()=>avaliarReserva('2026-11',100000,itens,{vendaId:'a',valor:-1}))
const sql=fs.readFileSync('supabase/migrations/20261025030000_instalacao_planejamento_visao_geral_v1.sql','utf8')
for(const termo of ['pg_advisory_xact_lock','registrar_meta_instalacao_v1','programar_instalacao_financeira_v1',
 'instalacao_planejamento_auditoria','enable row level security','revoke all','grant execute','role=\'master\''])
 assert(sql.includes(termo),'Proteção ausente: '+termo)
console.log('PASS: capacidade mensal, meta, excesso, reprogramação sem duplicação e proteções estruturais SQL.')
