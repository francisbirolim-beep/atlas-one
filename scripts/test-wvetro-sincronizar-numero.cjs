const assert=require('node:assert/strict')
const fs=require('node:fs')
const vm=require('node:vm')
const ts=require('typescript')
const crypto=require('node:crypto')

const file='app/api/integracoes/wvetro/orcamentos/sincronizar-numero/route.ts'
const source=fs.readFileSync(file,'utf8')
const queries=[],writes=[],aprovacoes=[]
let numero='588',conflito=false,authorized=true
const originais={
  '588':{id:'h-588',cliente_id:null,cliente_nome_origem:'RONALDO SERON',
    numero_wvetro:'588',valor_total:33121.53,itens:Array.from({length:12},()=>({})),
    tipo_registro:'venda_historica_orcamento',data_emissao:'2026-04-29',situacao_wvetro:'Vendido',status_vinculo:'pendente'},
  '714':{id:'h-714',cliente_id:null,cliente_nome_origem:'ROBERTO MARCIO BARRETO SANTOS',
    numero_wvetro:'714',valor_total:16800,itens:Array.from({length:7},()=>({})),
    tipo_registro:'venda_historica_orcamento',data_emissao:'2026-06-03',situacao_wvetro:'Vendido',status_vinculo:'sem_cliente'}
}
const usuario={id:'u-1',nome:'Master',role:'master',empresa_id:'empresa-1'}
function query(tabela) {
  const q={};let filtros=[],acao='select',payload
  for(const nome of ['select','eq','order','contains','ilike','limit'])q[nome]=(...args)=>{filtros.push([nome,...args]);return q}
  q.insert=v=>{acao='insert';payload=v;writes.push([tabela,acao,v]);return q}
  q.upsert=v=>{acao='upsert';payload=v;writes.push([tabela,acao,v]);return q}
  const id=()=>filtros.find(x=>x[0]==='eq'&&x[1]==='id')?.[2]
  const resp=()=>{
    queries.push([tabela,acao,filtros])
    if(tabela==='wvetro_historico_comercial')return {data:[originais[numero]],error:null}
    if(tabela==='orcamentos')return {data:conflito?[{id:'orc1',cliente_id:'outro-cliente',cliente_nome:'OUTRO',modo_entrada:'wvetro_api'}]:[],error:null}
    if(tabela==='clientes'){
      if(acao==='insert')return {data:{id:'novo-1',nome:payload.nome},error:null}
      if(id())return {data:{id:id(),nome:'RONALDO S'},error:null}
      return {data:[],error:null}
    }
    return {data:[],error:null}
  }
  q.then=(a,b)=>Promise.resolve(resp()).then(a,b)
  q.maybeSingle=async()=>resp()
  q.single=async()=>resp()
  return q
}
class NextRequest {
  constructor(url,opts){this.nextUrl=new URL(url);this.headers={get:k=>opts?.headers?.[k]||null};this.body=opts?.body?JSON.parse(opts.body):{}}
  async json(){return this.body}
}
const NextResponse={json:(data,options={})=>({
  status:options.status||200,ok:!options.status||options.status<400,
  async json(){return data}
})}
const m={exports:{}}
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
vm.runInNewContext(js,{module:m,exports:m.exports,process:{env:{SUPABASE_SECRET_KEY:'apenas-chave-de-teste'}},Buffer,
  URL,console,require:name=>{
    const deps={
      'node:crypto':crypto,'next/server':{NextRequest,NextResponse},
      '@/lib/wvetroAcessoServer':{autenticarUsuarioWVetro:async()=>usuario},
      '@/lib/acessoUsuarioServer':{usuarioPodeAcaoServer:async()=>authorized},
      '@/lib/supabaseAdmin':{supabaseAdmin:{from:query}},
      '@/lib/wvetroApi':{buscarPedidoWVetro:async()=>{throw Error('Não deve consultar API se já está no histórico')}},
      '@/lib/wvetroClienteIdentidade':{
        normalizarNomeClienteWVetro:x=>String(x||'').toUpperCase().trim(),
        nomesClientesCompativeis:(a,b)=>String(a).trim()===String(b).trim()
      },
      '../candidatos-cliente/route':{POST:async req=>{
        const body=await req.json();aprovacoes.push(body)
        return NextResponse.json({ok:true,orcamentoAtlasId:'orc-test'})
      }},
    }
    if(name in deps)return deps[name]
    throw Error('Import inesperado: '+name)
  }})
const handler=m.exports.POST
async function chamar(body){
  return handler(new NextRequest('https://test.invalid/api/numero',{
    headers:{authorization:'Bearer teste'},body:JSON.stringify(body)
  }))
}
async function run(){
  numero='588'
  let resposta=await chamar({acao:'consultar',numero:'588',clienteId:'11111111-1111-1111-1111-111111111111'})
  assert.equal(resposta.status,200)
  let p=await resposta.json()
  assert.equal(p.nomeWVetro,'RONALDO SERON')
  assert.equal(p.quantidadeItens,12)
  assert.equal(p.compativel,false)
  assert.equal(writes.length,0,'Prévia nunca modifica banco')
  resposta=await chamar({acao:'confirmar',numero:'588',clienteId:'11111111-1111-1111-1111-111111111111',
    tokenConferencia:p.tokenConferencia,confirmaNumero:'588',confirmaNome:p.nomeWVetro,confirmouVinculo:true})
  assert.equal(resposta.status,400,'Diferença de nome exige confirmação extra')
  assert.equal(aprovacoes.length,0)
  resposta=await chamar({acao:'confirmar',numero:'588',clienteId:'11111111-1111-1111-1111-111111111111',
    tokenConferencia:p.tokenConferencia,confirmaNumero:'588',confirmaNome:p.nomeWVetro,
    confirmouVinculo:true,confirmouDivergencia:true})
  assert.equal(resposta.status,200)
  assert.equal(aprovacoes.length,1)
  assert.equal(aprovacoes[0].historicoId,'h-588')
  conflito=true
  resposta=await chamar({acao:'consultar',numero:'588',clienteId:'11111111-1111-1111-1111-111111111111'})
  assert.equal((await resposta.json()).conflito,true)
  resposta=await chamar({acao:'confirmar',numero:'588',clienteId:'11111111-1111-1111-1111-111111111111',
    tokenConferencia:p.tokenConferencia,confirmaNumero:'588',confirmaNome:p.nomeWVetro,
    confirmouVinculo:true,confirmouDivergencia:true})
  assert.equal(resposta.status,409)
  conflito=false
  numero='714'
  resposta=await chamar({acao:'consultar',numero:'714',criarNovo:true})
  p=await resposta.json()
  assert.equal(p.nomeWVetro,'ROBERTO MARCIO BARRETO SANTOS')
  assert.equal(p.quantidadeItens,7)
  resposta=await chamar({acao:'confirmar',numero:'714',criarNovo:true,
    tokenConferencia:p.tokenConferencia,confirmaNumero:'714',confirmaNome:p.nomeWVetro,confirmouVinculo:true})
  assert.equal(resposta.status,200)
  assert.equal(aprovacoes.at(-1).historicoId,'h-714')
  assert.equal(writes.length,1)
  assert.equal(writes[0][0],'clientes')
  assert.equal(writes[0][2].nome,'ROBERTO MARCIO BARRETO SANTOS')
  assert(!source.includes('.from(\'orcamentos\').update('),'Não regravar orçamentos existentes')
  console.log('PASS: consulta 588/714, 12/7 itens, nenhuma escrita na prévia, divergência exige confirmação, bloqueio de outro cliente e criação explícita')
}
run().catch(e=>{console.error(e);process.exit(1)})