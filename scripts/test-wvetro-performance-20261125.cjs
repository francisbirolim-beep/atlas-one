const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const rows = Array.from({length: 405}, (_,i) => ({id:String(i).padStart(4,'0'),numero_ref:i===0?' 001 ':i===201?'':String(i),numero_legado_ref:i===201?'LEG-201':null}))
let calls=[], alterado=false
const supabaseAdmin={from(table){
  assert.equal(table,'orcamentos')
  let fields='',ids=null,range=null,empresa=null
  const q={
    select(s){fields=s;return q},
    eq(k,v){assert.equal(k,'empresa_id');empresa=v;return q},
    order(k){assert.equal(k,'id');return q},
    range(a,b){range=[a,b];return q},
    in(k,v){assert.equal(k,'id');ids=v;return q},
    then(ok,err){
      assert.equal(empresa,'empresa')
      calls.push({fields,ids,range})
      if(range) return Promise.resolve({data:rows.slice(range[0],range[1]+1),error:null}).then(ok,err)
      const data=rows.filter(r=>ids.includes(r.id)).map(r=>({id:r.id,wvetro_fluxo:{numero:alterado?'mudou':r.numero_ref,numero_wvetro:r.numero_legado_ref},itens:[]}))
      return Promise.resolve({data,error:null}).then(ok,err)
    }
  }
  return q
}}
const source=fs.readFileSync('lib/wvetroContextoOrcamentos.ts','utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const m={exports:{}}
new Function('module','exports','require',js)(m,m.exports,id=>({supabaseAdmin}))
async function main(){
  const ler=m.exports.carregarOrcamentosContextoWVetro
  assert.deepEqual(await ler('empresa',new Set()),[])
  assert.equal(calls.length,0)
  const numeros=new Set(['001','LEG-201','404',...Array.from({length:15},(_,i)=>String(i+5))])
  const res=await ler('empresa',numeros)
  assert.equal(res.length,18)
  assert.equal(calls.filter(c=>c.range).length,3)
  assert.equal(calls.filter(c=>c.ids).length,2)
  assert.ok(calls.filter(c=>c.ids).every(c=>c.ids.length<=12))
  assert.ok(calls.filter(c=>c.range).every(c=>!c.fields.includes('itens')&&!c.fields.includes('anexos')))
  assert.ok(res.some(r=>r.id==='0201'))
  alterado=true
  await assert.rejects(ler('empresa',new Set(['001'])),/alteradas durante/)
  const route=fs.readFileSync('app/api/integracoes/wvetro/orcamentos/sincronizar/route.ts','utf8')
  assert.match(route,/carregarContexto\(usuario.empresa_id, numerosDaJanela\)/)
  assert.match(route,/reconciliarSincronizacaoWVetro\(existente, itens, fluxo, mesmoPayload\)/)
  console.log('PASS: contexto paginado, referência legada, lote limitado, escopo da empresa, sem ler itens desnecessários, conflito de referência bloqueia importação.')
}
main().catch(e=>{console.error(e);process.exitCode=1})

