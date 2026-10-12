const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const moduleTS={exports:{}}
const source=fs.readFileSync('lib/producaoMedicaoElegibilidade.ts','utf8')
new Function('module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(moduleTS,moduleTS.exports)
const filtrar=moduleTS.exports.medicoesElegiveisParaProducao
const filtrarComParcial=moduleTS.exports.medicoesElegiveisComParcial
const medicoes=[
 {id:'aprovada',status_operacional:'aprovado'},
 {id:'concluida',status_operacional:'concluido'},
 {id:'pendente',status_operacional:'aprovado'},
 {id:'agrupada',status_operacional:'aprovado'},
 {id:'rascunho',status_operacional:'em_medicao'},
 {id:'sem-itens',status_operacional:'aprovado'},
 {id:'parcial',status_operacional:'concluido'},
 {id:'parcial-em-medicao',status_operacional:'em_medicao'},
]
const itens=[
 {medicao_id:'aprovada',medido:true,quantidade:1},
 {medicao_id:'concluida',medido:true,quantidade:1},
 {medicao_id:'pendente',medido:false,quantidade:1},
 {medicao_id:'agrupada',medido:true,quantidade:3},
 {medicao_id:'rascunho',medido:true,quantidade:1},
 {medicao_id:'parcial',medido:true,quantidade:1,status_medicao:'aprovada'},
 {medicao_id:'parcial',medido:false,quantidade:1},
 {medicao_id:'parcial-em-medicao',medido:true,quantidade:1,status_medicao:'aprovada'},
 {medicao_id:'parcial-em-medicao',medido:false,quantidade:1},
]
assert.deepEqual(filtrar(medicoes,itens).map(x=>x.id),['aprovada','concluida'])
assert.deepEqual(filtrar(medicoes,[]),[],'Sem leitura de itens nao ha producao')
assert.deepEqual(filtrarComParcial(medicoes,itens).map(x=>x.id),[
  'aprovada','concluida','parcial','parcial-em-medicao',
],'Peças não medidas não aparecem, mas uma posição aprovada pode entrar como parcial')
const api=fs.readFileSync('app/api/producao/medicoes-finais/sincronizar/route.ts','utf8')
const page=fs.readFileSync('app/producao/page.tsx','utf8')
assert.match(api,/for \(const medicao of todasMedicoes\)/)
assert.match(api,/status_medicao', 'aprovada'/)
assert.match(api,/quantidade', 1/)
assert.match(page,/temMarcadorMedicaoDoCard\(c\)&&Boolean\(vincularCardAMedicao\(c,medicoes\)\)/)
console.log('PASS: fluxo de Produção preserva gate completo e aceita somente parcial aprovado.')
