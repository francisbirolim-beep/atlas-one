const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
require.extensions['.ts']=(mod,filename)=>{
  const source=fs.readFileSync(filename,'utf8')
  mod._compile(ts.transpileModule(source,{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,
  }}).outputText,filename)
}
const {
  colunaRecebimentoWVetro,MOTIVO_PADRAO_WVETRO,ehEmAndamento,
  ehOrcamentoFeito,podeIrParaOrcamentoFeitoWVetro
}=require('../lib/wvetroEtapaComercial.ts')
const {snapshotItemWVetro}=require('../lib/wvetroValidacaoItem.ts')
const colunas=[
  {id:'fazer',nome:'Fazer orçamento'},
  {id:'andamento',nome:'Em andamento'},
  {id:'feito',nome:'Orçamento feito'},
  {id:'enviado',nome:'Enviado ao cliente'},
  {id:'vendido',nome:'Vendido'},
]
assert.equal(colunaRecebimentoWVetro(colunas).id,'andamento')
assert.equal(colunaRecebimentoWVetro([...colunas].reverse()).id,'andamento','Ordem visual não interfere')
assert.throws(()=>colunaRecebimentoWVetro(colunas.filter(c=>c.id!=='andamento')),/Importação W.Vetro interrompida/)
assert.ok(MOTIVO_PADRAO_WVETRO.length>=8)
assert.equal(ehEmAndamento(' EM   ANDAMENTO '),true)
assert.equal(ehOrcamentoFeito('Orçamento feito'),true)
const item={id:'i1',tipo_esquadria:'outro',tipo_outro_texto:'Basculante',quantidade:2,largura_mm:1000,altura_mm:2000,cor:'Branco',variaveis:{a:'A',b:'B'}}
const fluxo={origem:'wvetro_api',validacao_por_item:true,validacao_status:'aguardando'}
const card={wvetro_fluxo:fluxo,itens:[item]}
assert.equal(podeIrParaOrcamentoFeitoWVetro(card),false,'Importado sem validação não é feito')
const validacoes={i1:{snapshot:snapshotItemWVetro(item),resultado:'correto'}}
assert.equal(podeIrParaOrcamentoFeitoWVetro({
 wvetro_fluxo:{...fluxo,validacao_status:'validado',validacoes_itens:validacoes},
 itens:[item]
}),true)
assert.equal(podeIrParaOrcamentoFeitoWVetro({
 wvetro_fluxo:{...fluxo,validacao_status:'validado',validacoes_itens:validacoes},
 itens:[{...item,largura_mm:1100}]
}),false,'Correção posterior exige revalidação')
assert.equal(podeIrParaOrcamentoFeitoWVetro({
 wvetro_fluxo:{origem:'wvetro_api',validacao_status:'validado'},itens:[item]
}),true,'Validação global legada preservada')
assert.equal(podeIrParaOrcamentoFeitoWVetro({
 wvetro_fluxo:{origem:'cadastro_atlas'},itens:[item]
}),true,'Orçamento Atlas não exige validação W.Vetro')

const src=fs.readFileSync('app/api/integracoes/wvetro/orcamentos/sincronizar/route.ts','utf8')
assert.ok(src.includes('colunaRecebimentoWVetro(colunas)'),'Importação usa Em andamento')
assert.ok(src.includes('kanban_motivo_andamento: MOTIVO_PADRAO_WVETRO'),'Motivo inicial automático')
assert.ok(src.includes('moverPendenteParaConferencia'),'Mesma referência pendente corrigida sem apagar validações')
assert.ok(src.includes(".eq('empresa_id', empresaId).order('ordem')"),'Colunas limitadas à empresa')
const historico=fs.readFileSync('app/api/integracoes/wvetro/orcamentos/candidatos-cliente/route.ts','utf8')
assert.ok(historico.includes('colunaRecebimentoWVetro(colunas || [])'),'Histórico W.Vetro usa Em andamento')
const migration=fs.readFileSync('supabase/migrations/20261026115000_wvetro_orcamento_em_andamento_v1.sql','utf8')
assert.ok(migration.includes("lower(btrim(feito.nome))='orçamento feito'"))
assert.ok(migration.includes("lower(coalesce(o.wvetro_fluxo->>'validacao_status',''))<>'validado'"))
assert.ok(migration.includes('raise exception'), 'Bloqueio no banco')
assert.ok(migration.includes('insert into public.historico'), 'Backfill auditado')
console.log('PASS: W.Vetro em andamento, motivo, validação individual, isolamento tenant, históricos e proteção SQL')
