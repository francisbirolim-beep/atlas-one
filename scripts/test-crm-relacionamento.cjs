const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const codigo = fs.readFileSync('app/api/crm/comercial/relacionamento/route.ts', 'utf8')
const compilado = ts.transpileModule(codigo,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
let usuario = {id:'vendedor-a',role:'funcionario',empresa_id:'empresa-a'}
let podeCRM = true, podeHistorico = true, podeTarefas = true, escopo = 'proprios', erroLeitura = false
const consultas=[]
const dados={
  orcamentos:[{id:'11111111-1111-4111-8111-111111111111',empresa_id:'empresa-a',cliente_id:'c-1',cliente_nome:'Cliente A',criado_por_id:'vendedor-a'},
    {id:'22222222-2222-4222-8222-222222222222',empresa_id:'empresa-a',cliente_id:'c-2',cliente_nome:'Cliente B',criado_por_id:'vendedor-b'},
    {id:'33333333-3333-4333-8333-333333333333',empresa_id:'empresa-b',cliente_id:'c-3',cliente_nome:'Outra empresa',criado_por_id:'vendedor-a'}],
  prospeccoes:[{id:'44444444-4444-4444-8444-444444444444',empresa_id:'empresa-a',responsavel_id:'vendedor-a',cliente_id:null,nome_cliente:'Prospect A'},
    {id:'55555555-5555-4555-8555-555555555555',empresa_id:'empresa-a',responsavel_id:'vendedor-b',cliente_id:'c-2',nome_cliente:'Prospect B'}],
  crm_interacoes:[{id:'i1',empresa_id:'empresa-a',orcamento_id:'11111111-1111-4111-8111-111111111111',cliente_id:'c-1',tipo:'ligacao',descricao:'Contato proprio',usuario_nome:'Francis'},
    {id:'i2',empresa_id:'empresa-a',orcamento_id:null,cliente_id:'c-1',tipo:'nota',descricao:'Contato de terceiros',usuario_nome:'Outro'}],
  prospeccao_interacoes:[{id:'ip1',empresa_id:'empresa-a',prospeccao_id:'44444444-4444-4444-8444-444444444444',tipo:'visita',descricao:'Visita propria',usuario_nome:'Francis'}],
  crm_tarefas:[{id:'t1',empresa_id:'empresa-a',orcamento_id:'11111111-1111-4111-8111-111111111111',cliente_id:'c-1',responsavel_id:'vendedor-a',titulo:'Ligar',concluida:false},
    {id:'t2',empresa_id:'empresa-a',orcamento_id:null,cliente_id:'c-1',responsavel_id:'vendedor-b',titulo:'Tarefa de terceiros',concluida:false}],
}
function from(t){
  if(!(t in dados)) throw new Error('Tabela inesperada '+t)
  const filtros=[]
  const q={
    select(){return q},
    eq(k,v){filtros.push([k,v]);return q},
    or(expr){filtros.push(['or',expr]);return q},
    order(){return q},
    limit(){return q},
    maybeSingle:async()=>{
      consultas.push({t,filtros})
      const d=dados[t].find(x=>filtros.every(([k,v])=>k==='or'?true:x[k]===v))
      return {data:d||null,error:erroLeitura?{message:'db'}:null}
    },
    then(resolve,reject){
      consultas.push({t,filtros})
      const rows=dados[t].filter(x=>filtros.every(([k,v])=>{
        if(k!=='or')return x[k]===v
        return String(v).split(',').some(part=>{
          const dot=part.indexOf('.eq.')
          return dot>=0&&String(x[part.slice(0,dot)])===part.slice(dot+4)
        })
      }))
      return Promise.resolve({data:rows,error:erroLeitura?{message:'db'}:null}).then(resolve,reject)
    }
  }
  return q
}
const imports={
  'next/server':{NextResponse:{json:(data,options={})=>({status:options.status||200,data})}},
  '@/lib/tenantServer':{autenticarTenant:async()=>usuario},
  '@/lib/supabaseAdmin':{supabaseAdmin:{from}},
  '@/lib/acessoUsuarioServer':{
    lerAcessoConfigServer:async()=>({crmEscopo:escopo}),
    usuarioPodeAcaoServer:async p=>{
      assert.equal(p.empresaId,'empresa-a')
      if(p.acaoId==='comercial.crm.consultar')return podeCRM
      if(p.acaoId==='comercial.crm.interacoes')return podeHistorico
      if(p.acaoId==='comercial.crm.tarefas')return podeTarefas
      throw new Error('Ação inesperada')
    },
  },
}
const exportsLocal={}
vm.runInNewContext(compilado,{exports:exportsLocal,require:n=>{if(!(n in imports))throw Error('Import: '+n);return imports[n]},console})
const get=exportsLocal.GET
const req=(fonte,id)=>({nextUrl:new URL('https://example.test/api/crm/comercial/relacionamento?fonte='+fonte+'&id='+id)})
;(async()=>{
 const own='11111111-1111-4111-8111-111111111111'
 const other='22222222-2222-4222-8222-222222222222'
 const cross='33333333-3333-4333-8333-333333333333'
 const pro='44444444-4444-4444-8444-444444444444'
 let r=await get(req('orc',own))
 assert.equal(r.status,200)
 assert.equal(r.data.historico.length,1,'Não revelar contatos gerais de terceiros na carteira própria')
 assert.equal(r.data.tarefas.length,1)
 assert.ok(consultas.every(x=>x.filtros.some(y=>y[0]==='empresa_id'&&y[1]==='empresa-a')))
 assert.ok(consultas.filter(x=>x.t==='orcamentos').every(x=>x.filtros.some(y=>y[0]==='criado_por_id'&&y[1]==='vendedor-a')))
 consultas.length=0
 r=await get(req('orc',other));assert.equal(r.status,404)
 assert.equal(consultas.length,1,'Não consultar interações de carteira alheia')
 consultas.length=0
 r=await get(req('orc',cross));assert.equal(r.status,404);assert.equal(consultas.length,1)
 r=await get(req('pro',pro));assert.equal(r.status,200)
 assert.equal(r.data.historico[0].descricao,'Visita propria')
 podeHistorico=false;podeTarefas=false;consultas.length=0
 r=await get(req('orc',own));assert.equal(r.status,200)
 assert.equal(r.data.historicoVisivel,false);assert.equal(r.data.tarefasVisiveis,false)
 assert.equal(r.data.historico.length,0);assert.equal(consultas.length,1)
 podeHistorico=true;podeTarefas=true;escopo='todos'
 r=await get(req('orc',other));assert.equal(r.status,200)
 consultas.length=0;podeCRM=false
 r=await get(req('orc',own));assert.equal(r.status,403);assert.equal(consultas.length,0)
 podeCRM=true;usuario=null;consultas.length=0
 r=await get(req('orc',own));assert.equal(r.status,401);assert.equal(consultas.length,0)
 usuario={id:'vendedor-a',role:'funcionario',empresa_id:'empresa-a'}
 r=await get(req('orc','bad'));assert.equal(r.status,400)
 erroLeitura=true
 r=await get(req('orc',own));assert.equal(r.status,503)
 assert.ok(!JSON.stringify(r.data).includes('db'))
 assert.doesNotMatch(codigo,/\.(insert|upsert|update|delete|rpc)\s*\(/)
 console.log('PASS: histórico e tarefas por oportunidade/empresa, escopo próprio vs. geral, bloqueios 401/403/404, permissões independentes, falha segura, sem escrita.')
})().catch(e=>{console.error(e);process.exitCode=1})