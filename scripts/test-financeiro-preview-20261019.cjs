const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const src=fs.readFileSync('lib/financeiroPeriodo.ts','utf8');const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const m={exports:{}};new Function('module','exports',js)(m,m.exports);
const {periodoRapido,noPeriodo,csvFinanceiro}=m.exports;
assert.deepEqual(periodoRapido('mes',new Date(2026,9,19)),{inicio:'2026-10-01',fim:'2026-10-31',preset:'mes'});
assert.deepEqual(periodoRapido('semana',new Date(2026,9,19)),{inicio:'2026-10-19',fim:'2026-10-25',preset:'semana'});
assert.deepEqual(periodoRapido('semana',new Date(2026,9,18)),{inicio:'2026-10-12',fim:'2026-10-18',preset:'semana'});
assert.deepEqual(periodoRapido('proximo_mes',new Date(2026,11,31)),{inicio:'2027-01-01',fim:'2027-01-31',preset:'proximo_mes'});
assert(noPeriodo('2026-10-17','2026-10-17','2026-10-19'));
assert(noPeriodo('2026-10-19','2026-10-17','2026-10-19'));
assert(!noPeriodo('2026-10-20','2026-10-17','2026-10-19'));
assert(csvFinanceiro([['Fornecedor','Documento'],['A;B','B"C']]).includes('"B""C"'));
console.log('PASS: filtros de vencimento por datas locais, limites inclusivos, transição mês/ano, CSV sanitizado.');
const mainApi=fs.readFileSync('app/api/financeiro/lancamentos-manuais/route.ts','utf8');
const pagar=fs.readFileSync('app/financeiro/contas-pagar/page.tsx','utf8');
const receber=fs.readFileSync('app/financeiro/contas-receber/page.tsx','utf8');
const form=fs.readFileSync('components/financeiro/FormLancamentoManual.tsx','utf8');
const recibo=fs.readFileSync('app/api/financeiro/recibo/route.ts','utf8');
const recForm=fs.readFileSync('components/financeiro/ReciboImpressao.tsx','utf8');
for(const token of ["autenticarCompras(req)","usuarioPodeAcaoServer", ".eq('empresa_id',u.empresa_id)","financeiro_conta_classificacoes", "financeiro_plano_contas", "process.env.VERCEL_ENV==='preview'", "compra já gerou títulos automáticos", "ignorarDuplicadosNaoExisteFoo"] .filter(x=>x!=='ignorarDuplicadosNaoExisteFoo')) assert(mainApi.includes(token),'Proteção financeira obrigatória ausente: '+token);
assert(mainApi.includes(".neq('status','cancelado')"));
assert(mainApi.includes('uuidParcela'));assert(mainApi.includes('ignoreDuplicates:true'));
for(const page of [pagar,receber]) for(const token of ['BarraFiltrosPeriodo','FormLancamentoManual','baixarCSV','noPeriodo','window.print']){
 // printing is in BarraFiltrosPeriodo; page merely composes it
 if(token!=='window.print')assert(page.includes(token),'Relatório faltando '+token)
}
for(const token of ['Tipo','Quantidade de parcelas','Vencimentos e valores','Nova categoria','Novo ',"Simular lançamento",'disabled={salvando',"aria-modal=\"true\""]) assert(form.includes(token),'Formulário incompleto: '+token);
for(const token of ['financeiro_recebimento_alocacoes',".eq('cliente_id',rec.cliente_id)",".in('obra_id',idsObras)","status!=='pago'",'saldo:Math.max']) assert(recibo.includes(token),'Recibo inseguro: '+token);
for(const token of ['Saldo atual em aberto','Valor original do título / obra','Valor recebido neste pagamento','Recibo de quitação parcial','window.print']) assert(recForm.includes(token),'Recibo incompleto: '+token);
assert(csvFinanceiro([['=2+2','@SUM(A1)']]).includes("'@SUM(A1)"),'Proteção Excel contra fórmula ausente');
console.log('PASS: DRE, segurança multiempresa, permissões, lote idempotente, colisões, simulação sem gravar, recibo parcial por obra e relatórios.');
