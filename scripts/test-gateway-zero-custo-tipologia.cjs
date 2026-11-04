const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
require.extensions['.ts'] = (mod, filename) => {
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename)
}
const {
  ehModeloGratuito,
  escolherModelosGratuitos,
  analisarComGatewayZeroCusto,
  ErroGatewayZeroCusto,
  limparDadosPessoaisRelatorio,
} = require('../lib/ai/gatewayZeroCustoTipologia.ts')

const modelo = (id, precoEntrada, precoSaida, modalidades=['text'], varies=false) =>
  ({ id, pricing:{input:precoEntrada,output:precoSaida,varies_by_provider:varies},
    modalities:{input:modalidades,output:['text']} })
const gratis = modelo('nvidia/nemotron-3.5-lightning-free','0','0')
const alternativo = modelo('reflection/beam-free','0','0')
const pago = modelo('inclusionai/ling-3.0-flash-vl','0.00001','0.00005',['text','image'])
const fake = modelo('fraude/free-but-paid-free','0.00001','0.00005',['text','image'])
const incerto = modelo('ref/beam-free','0','0',['text'],true)
assert.equal(ehModeloGratuito(gratis,'text'), true)
assert.equal(ehModeloGratuito(gratis,'image'), false)
assert.equal(ehModeloGratuito(pago,'text'), false)
assert.equal(ehModeloGratuito(fake,'text'), false)
assert.equal(ehModeloGratuito(incerto,'text'), false)
assert.deepEqual(escolherModelosGratuitos([pago, gratis,alternativo,fake,incerto],'text'),
  [gratis.id,alternativo.id])
assert.deepEqual(escolherModelosGratuitos([pago,gratis,alternativo],'image'),[])
const puro='Cliente: user@example.com CPF 123.456.789-00 CNPJ 12.345.678/0001-90 telefone (17) 99999-1234'
const limpo=limparDadosPessoaisRelatorio(puro)
assert(!limpo.includes('user@example.com'),limpo)
assert(!limpo.includes('123.456.789-00'),limpo)
assert(!limpo.includes('12.345.678/0001-90'),limpo)
assert(!limpo.includes('99999-1234'),limpo)

async function run() {
  const beforeFetch=global.fetch
  const beforeToken=process.env.VERCEL_OIDC_TOKEN
  const beforeKey=process.env.AI_GATEWAY_API_KEY
  const calls=[]
  process.env.VERCEL_OIDC_TOKEN='token-de-teste'
  delete process.env.AI_GATEWAY_API_KEY
  global.fetch=async(url,opt)=>{
    calls.push({url,model:opt?.body ? JSON.parse(opt.body).model : null})
    if(String(url).endsWith('/models'))
      return {ok:true,json:async()=>({data:[pago,gratis,alternativo]})}
    return {ok:true,json:async()=>({choices:[{message:{content:'{"componentes":[]}'}}]})}
  }
  try {
    const r=await analisarComGatewayZeroCusto({system:'Teste',prompt:'Leia' })
    assert.equal(r.modelo,gratis.id)
    assert.equal(r.resposta,'{"componentes":[]}')
    assert.equal(calls.length,2)
    assert.equal(calls[1].model,gratis.id)
    assert(!calls.some(x=>x.model===pago.id))
    await assert.rejects(analisarComGatewayZeroCusto({system:'Teste',prompt:'Foto',
      imagem:{mime:'image/png',base64:'AA=='}}),e=>e instanceof ErroGatewayZeroCusto &&
      e.codigo==='sem_modelo_gratuito')
    assert.equal(calls.length,2,'Nenhuma chamada paga nem OCR indisponível')
    delete process.env.VERCEL_OIDC_TOKEN
    await assert.rejects(analisarComGatewayZeroCusto({system:'Teste',prompt:'Leia'}),
      e=>e.codigo==='autenticacao_indisponivel')
  } finally {
    global.fetch=beforeFetch
    if(beforeToken===undefined)delete process.env.VERCEL_OIDC_TOKEN
    else process.env.VERCEL_OIDC_TOKEN=beforeToken
    if(beforeKey===undefined)delete process.env.AI_GATEWAY_API_KEY
    else process.env.AI_GATEWAY_API_KEY=beforeKey
  }
  console.log('OK: preço zero verificado, bloqueio de IA paga, filtros imagem, autenticação e remoção de dados pessoais.')
}
run().catch(e=>{console.error(e);process.exitCode=1})
