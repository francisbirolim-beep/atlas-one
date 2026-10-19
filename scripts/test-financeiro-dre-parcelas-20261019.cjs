const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript')
const api=fs.readFileSync('app/api/financeiro/lancamentos-manuais/route.ts','utf8')
const ui=fs.readFileSync('components/financeiro/FormLancamentoManual.tsx','utf8')
const inicio=api.indexOf('const uuid='),meio=api.indexOf('async function autorizado'),fn=api.indexOf('function partesParcelas'),fim=api.indexOf('// A prévia permite')
assert(inicio>=0&&meio>inicio&&fn>meio&&fim>fn)
const script=`${api.slice(inicio,meio)}\n${api.slice(fn,fim)}\nmodule.exports={validarParcelas,partesParcelas};`
const js=ts.transpileModule(script,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const m={exports:{}};new Function('module','exports',js)(m,m.exports)
const{validarParcelas,partesParcelas}=m.exports
const caso={quantidade:3,valorTotal:12690.42,vencimentos:['2026-10-29','2026-11-12','2026-12-26'],dataEmissao:'2026-10-19',chaveLote:'01234567-89ab-4cde-8f01-234567890abc'}
assert.deepEqual(validarParcelas(caso).parcelas,[4230.14,4230.14,4230.14],'Divisão igual deve continuar igual')
assert.deepEqual(validarParcelas({...caso,valoresParcelas:[4000,4000,4690.42]}).parcelas,[4000,4000,4690.42])
assert.deepEqual(validarParcelas({...caso,valorTotal:12000,valoresParcelas:[4000,4000,4000]}).parcelas,[4000,4000,4000])
for(const valores of [[4000,4000,4000],[4230.14,4230.14],[0,4230.14,8460.28],[-1,4200,8491.42],[4230.145,4230.135,4230.14],['4230.14',4230.14,4230.14]]){
 assert(validarParcelas({...caso,valoresParcelas:valores}).error,`Deve rejeitar ${JSON.stringify(valores)}`)
}
assert.deepEqual(partesParcelas(100,3),[0.34,0.33,0.33])
for(const x of ['editar-categoria','excluir-categoria','financeiro.contas_pagar.editar',".eq('empresa_id',u.empresa_id)",".eq('plano_conta_id',id)",'Esse código já está usado','código de categoria já existe']){
 if(!api.toLowerCase().includes(x.toLowerCase()))throw Error(`API: ${x}`)
}
for(const x of ['Editar / excluir cadastro do DRE','Editar código do DRE','Editar nome do DRE','Excluir categoria','valoresIndividuais','Valor da parcela','Atualizar total pela soma das parcelas','Dividir igualmente / redistribuir','valoresParcelas:valoresIndividuais'])assert(ui.includes(x),`UI: ${x}`)
assert(api.includes("process.env.VERCEL_ENV==='preview'"),'Prévia não pode gravar no Supabase')
for(const f of ['app/api/financeiro/cliente-recebimento/route.ts','app/api/financeiro/contas-pagar/route.ts','app/api/financeiro/contas-receber/route.ts','app/clientes/[id]/financeiro/recebimento/page.tsx']){
 const changed=require('node:child_process').execFileSync('git',['diff','--name-only','HEAD','--',f],{encoding:'utf8'}).trim();assert(!changed,`Fluxo homologado alterado: ${f}`)
}
console.log('PASS: DRE editar/excluir com proteção histórica, permissões, parcelas personalizadas, soma exata, validação monetária e regressão de divisão igual.')
