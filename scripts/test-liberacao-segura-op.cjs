const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const m={exports:{}}
new Function('module','exports',ts.transpileModule(fs.readFileSync('lib/vendaLiberacaoProducao.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(m,m.exports)
const avaliar=m.exports.avaliarLiberacaoProducao
const id='a1111111-1111-4111-8111-111111111111', compraId='b1111111-1111-4111-8111-111111111111'
const base={
  medicoes:[{id:'m1',status_operacional:'aprovado'}],medicoesComCardLiberado:['m1'],pacoteStatus:'calculado',pacoteOrigem:'medicao_final',
  materiais:[{id,quantidade_ajustada:3,status_compra:'recebido'}],separacoes:[],
  comprasPacote:[{id:compraId,quantidade_ajustada:3,status:'comprado'}],
  necessidades:[{observacoes:'[pacote_compra:'+compraId+']',status:'recebido'}],
  ordens:[{id:'op1',tipo_producao:'esquadria',origem:'reconstrucao_wvetro',status:'aguardando',bloqueada:true},
    {id:'manual',tipo_producao:'esquadria',origem:'manual',status:'aguardando',bloqueada:true},
    {id:'cm',tipo_producao:'contramarco',origem:'reconstrucao_wvetro',status:'aguardando',bloqueada:true}],
}
assert.deepEqual(avaliar(base).ordensElegiveis,['op1'])
assert.equal(avaliar(base).podeLiberar,true)
const invalido=[
  {...base,medicoes:[{id:'m1',status_operacional:'concluido'}]},
  {...base,medicoesComCardLiberado:[]},
  {...base,pacoteStatus:'rascunho'},
  {...base,pacoteOrigem:'projeto_conferido'},
  {...base,materiais:[]},
  {...base,materiais:[{id,quantidade_ajustada:3,status_compra:'cotacao'}]},
  {...base,necessidades:[{observacoes:'[pacote_compra:'+compraId+']',status:'cotacao'}]},
  {...base,comprasPacote:[{id:compraId,quantidade_ajustada:3}],necessidades:[]},
  {...base,ordens:[]},
  {...base,medicoes:[...base.medicoes,{id:'m2',status_operacional:'aguardando_conferencia'}]},
]
invalido.forEach((x,i)=>{assert.equal(avaliar(x).podeLiberar,false,'Cenário não pode liberar: '+i);assert.deepEqual(avaliar(x).ordensElegiveis,[])})
assert.equal(avaliar({...base,materiais:[{id,quantidade_ajustada:3,status_compra:'cotacao'}],
 separacoes:[{material_id:id,quantidade:3,status:'separado'}]}).podeLiberar,true,'Estoque separado cobre material')
assert.equal(avaliar({...base,materiais:[{id,quantidade_ajustada:3,status_compra:'cotacao'}],
 separacoes:[{material_id:id,quantidade:2,status:'reservado'}]}).podeLiberar,false,'Estoque apenas reservado não libera')
assert.equal(avaliar({...base,ordens:[{...base.ordens[0],bloqueada:false,status:'liberada'}]}).podeLiberar,false,'Liberação idempotente')
assert.equal(avaliar({...base,ordens:[{...base.ordens[0],bloqueada:false,status:'liberada'}]}).jaLiberadas,1)
console.log('PASS: medição, card, material, compras e liberação explícita de ordens vinculadas.')
