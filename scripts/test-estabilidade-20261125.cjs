const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const compile=(f,mocks)=>{const m={exports:{}};new Function('module','exports','require','navigator',ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(m,m.exports,id=>mocks[id],{onLine:true});return m.exports}
const shared=compile('lib/leiturasEmCurso.ts',{})
const limit=compile('lib/limiteConsulta.ts',{})
let sessoes=0,perfis=0,token='a-token',uid='a',pending=null
const supabase={auth:{getSession:async()=>{sessoes++;if(pending)await pending;return {data:{session:{access_token:token,user:{id:uid},expires_at:Math.floor(Date.now()/1000)+600}}}},signOut:async()=>{}},from:()=>{let id;const q={select:()=>q,eq:(_k,v)=>{id=v;return q},maybeSingle:async()=>{perfis++;await Promise.resolve();return {data:{id,nome:id,role:'funcionario'}}}};return q}}
const auth=compile('lib/auth.ts',{'./supabase':{supabase},'./leiturasEmCurso':shared,'./limiteConsulta':limit})
;(async()=>{
 const respostas=await Promise.all(Array.from({length:12},()=>auth.usuarioAtual()))
 assert.equal(sessoes,1);assert.equal(perfis,1);assert.ok(respostas.every(u=>u.id==='a'))
 await auth.usuarioAtual();assert.equal(sessoes,2);assert.equal(perfis,2)
 await auth.logout();uid='b';token='b-token'
 assert.equal((await auth.usuarioAtual()).id,'b')
 let liberar;pending=new Promise(r=>{liberar=r})
 const antiga=auth.usuarioAtual();await Promise.resolve();await auth.logout();liberar();await antiga.then(u=>assert.equal(u,null))
 const ler=shared.leiturasEmCurso()
 await assert.rejects(ler('a',async()=>{throw Error('falha')}),/falha/)
 assert.equal(await ler('a',async()=>42),42)
 const page=fs.readFileSync('app/visao-geral-projetos/page.tsx','utf8')
 assert.match(page,/consultaEmCurso.current\|\|Date.now\(\)<proximaConsulta.current/)
 assert.match(page,/document.visibilityState==='visible'/)
 assert.match(page,/Math.min\(120000/)
 assert.match(page,/await carregar\(true\)/)
 console.log('PASS: 12 leituras em uma, ausência de cache, troca de usuário, logout, recuperação de falhas, polling limitado e atualização explícita.')
})().catch(e=>{console.error(e);process.exitCode=1})

