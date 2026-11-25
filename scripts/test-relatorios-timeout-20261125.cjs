const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const src=fs.readFileSync('lib/limiteConsulta.ts','utf8')
const code=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const m={exports:{}}
let fetchMode='ok', abortCount=0
const fetch=async (_url,init)=>{
 if(fetchMode==='ok')return {ok:true,status:200}
 return new Promise((resolve,reject)=>{
  const abort=()=>{abortCount++;reject(new Error('aborted'))}
  if(init.signal.aborted)abort()
  else init.signal.addEventListener('abort',abort,{once:true})
 })
}
new Function('module','exports','fetch',code)(m,m.exports,fetch)
async function main(){
 const {comLimiteConsulta,fetchConsulta}=m.exports
 assert.equal(await comLimiteConsulta(Promise.resolve(7),20),7)
 await assert.rejects(comLimiteConsulta(new Promise(()=>{}),5),/demorou/)
 await assert.rejects(comLimiteConsulta(Promise.reject(new Error('negado')),20),/negado/)
 assert.equal((await fetchConsulta('/test',{},20)).status,200)
 fetchMode='hang'
 await assert.rejects(fetchConsulta('/test',{},5),/demorou/)
 const c=new AbortController()
 const pedido=fetchConsulta('/test',{signal:c.signal},100)
 c.abort()
 await assert.rejects(pedido,/demorou/)
 assert.equal(abortCount,2)
 const acesso=fs.readFileSync('components/relatorios/RelatoriosAcesso.tsx','utf8')
 assert.match(acesso,/if\(!resp.ok\)throw/)
 assert.match(acesso,/setAcessos\(null\)/)
 assert.match(acesso,/Tentar novamente/)
 const guard=fs.readFileSync('components/system/SetorRouteGuard.tsx','utf8')
 assert.match(guard,/nivel:'indisponivel'/)
 assert.match(guard,/if\(atual==='indisponivel'\)return/)
 const page=fs.readFileSync('app/relatorios/page.tsx','utf8')
 assert.match(page,/consultaAtual.current\?\.abort\(\)/)
 assert.match(page,/if\(atual\(\)\)setDados/)
 console.log('PASS: timeout, abort, erros preservados, acesso não liberado em falha e cancelamento de consulta anterior.')
}
main().catch(e=>{console.error(e);process.exitCode=1})

