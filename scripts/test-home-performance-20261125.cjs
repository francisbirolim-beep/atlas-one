const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const source = fs.readFileSync('lib/homeLeituras.ts','utf8')
const js = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const calls = {}
const read = (name,value) => async () => {calls[name]=(calls[name]||0)+1;return value}
const mod={exports:{}}
const mocks={
 './auth':{tokenAtual:read('token','test')},
 './tarefas':{listarColunasTarefas:read('colunas',[]),listarTarefas:read('tarefas',[])},
 './eventos':{listarEventosDoUsuario:read('eventos',[]),listarConclusoesEventosUsuario:read('conclusoes',{})},
 './tarefasEquipeCliente':{listarEquipe:read('equipe',[])}
}
const fetch=read('delegadas',{ok:true,json:async()=>({tarefas:[]})})
new Function('module','exports','require','fetch',js)(mod,mod.exports,id=>mocks[id],fetch)
async function main(){
 const {carregarTrabalhoHome,carregarAgendaHome,leituraSimultanea}=mod.exports
 const a=carregarTrabalhoHome('a'), b=carregarTrabalhoHome('a'), c=carregarAgendaHome('a')
 assert.equal(a,b)
 await Promise.all([a,b,c])
 for(const key of ['colunas','tarefas','eventos','conclusoes','equipe','delegadas','token'])assert.equal(calls[key],1,key)
 await carregarTrabalhoHome('a')
 assert.equal(calls.tarefas,2,'Não manter cache depois de concluir')
 await Promise.all([carregarTrabalhoHome('a'),carregarTrabalhoHome('b')])
 assert.equal(calls.tarefas,4,'Isolar usuários')
 const ler=leituraSimultanea()
 await assert.rejects(ler('falha',async()=>{throw new Error('falha')}))
 assert.equal(await ler('falha',async()=>42),42)
 console.log('PASS: consultas simultâneas compartilhadas, agenda deduplicada, usuários isolados, sem cache e recuperação de falhas.')
}
main().catch(e=>{console.error(e);process.exitCode=1})

