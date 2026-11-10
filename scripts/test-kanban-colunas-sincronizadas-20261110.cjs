const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const load = (path, required={}) => {
 const compiled = ts.transpileModule(fs.readFileSync(path,'utf8'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
 }).outputText
 const module={exports:{}}
 new Function('require','module','exports',compiled)(name=>{
  assert.ok(name in required,'Import inesperado: '+name)
  return required[name]
 },module,module.exports)
 return module.exports
}
const geral=load('lib/visaoGeralProjetos.ts')
const col=load('lib/kanbanColunasSincronizadas.ts',{'./visaoGeralProjetos':geral})
const cliente=load('lib/cliente360KanbanObras.ts',{'./visaoGeralProjetos':geral})

assert.equal(geral.COLUNAS_GERAIS_PADRAO.length,9)
assert.equal(geral.COLUNAS_GERAIS_PADRAO[0].id,'vendido')
assert.equal(geral.COLUNAS_GERAIS_PADRAO[1].id,'validacao_projeto')
assert.equal(geral.COLUNAS_GERAIS_PADRAO[1].nome,'Validação de Projeto')
assert.deepEqual(geral.validarColunasGerais(geral.COLUNAS_GERAIS_PADRAO),[])

const originais=col.colunasKanbanEmpresa(null)
assert.equal(originais.length,9)
const criado=geral.criarColunaGeral(originais,'manual_12345','Aprovação adicional')
const novaOrdem=geral.reordenarColunasGerais(criado,
 [criado[0].id,'manual_12345',...criado.slice(1,-1).map(c=>c.id)])
assert.equal(novaOrdem[1].id,'manual_12345')
assert.deepEqual(geral.validarColunasGerais(novaOrdem),[])
const card={vendaId:'venda_unica',colunaId:'vendido',etapaOperacional:'vendido',projeto:'Obra 360'}
const movido=col.posicionarCardVisual(card,{
 estado:'manual',coluna_visual_id:'manual_12345',etapa_visual:'vendido',motivo:'organização da obra'
},novaOrdem)
assert.equal(movido.colunaId,'manual_12345')
assert.equal(movido.etapaOperacional,'vendido') // nenhuma operação mudou
assert.equal(card.colunaId,'vendido') // card original imutável
const validacao=col.posicionarCardVisual(card,{
 estado:'manual',coluna_visual_id:'validacao_projeto',etapa_visual:'conferir_projeto'
},geral.COLUNAS_GERAIS_PADRAO)
assert.equal(validacao.colunaId,'validacao_projeto')
assert.equal(validacao.etapaOperacional,'conferir_projeto')
const multi=cliente.agruparKanbanObras([{id:'obra1',numero:360,nome:'Obra',status:'vendida',cidade:null,
 previsaoEntrega:null,fotoProjetoUrl:null,orcamentos:1}],{
 obra1:[{vendaId:'v1',numero:1,colunaId:'producao',etapaOperacional:'producao',progresso:null,progressoDescricao:''},
 {vendaId:'v2',numero:2,colunaId:'manual_12345',etapaOperacional:'vendido',progresso:null,progressoDescricao:''}]
},novaOrdem)
assert.equal(multi[0].colunaId,'manual_12345')
const sql=fs.readFileSync('supabase/migrations/20261110140000_kanban_colunas_compartilhadas_20261110.sql','utf8')
for(const text of ['coluna_visual_id','coluna_anterior','coluna_nova','p_coluna_id',
 'where id=p_usuario and empresa_id=p_empresa','where id=p_venda and empresa_id=p_empresa',
 "v_setor is distinct from 'edicao'","{acoes,clientes.kanban_obra.mover}",
 'insert into public.visao_geral_cards_historico','security invoker',
 'revoke all on function','grant execute on function',
 '"id":"validacao_projeto"'])assert.ok(sql.includes(text),'Falta: '+text)
assert.doesNotMatch(sql,/\bupdate public\.(vendas_obras|ordens_producao|compras_solicitacoes)/i)
const api=fs.readFileSync('app/api/clientes/[id]/kanban-obras/route.ts','utf8')
const venda=fs.readFileSync('components/clientes/VendaKanbanObra.tsx','utf8')
const geralUI=fs.readFileSync('app/visao-geral-projetos/page.tsx','utf8')
for(const x of ['posicionarCardVisual','agruparKanbanObras(cardsBase,agrupadas,colunas)','NextResponse.json({cards,colunas'])
 assert.ok(api.includes(x),'Cliente 360 não compartilha coluna: '+x)
for(const x of ['const colunas=dados?.colunas||COLUNAS_GERAIS_PADRAO',
 'projeto.colunaId===col.id','moverPrincipal(col.id)'])
 assert.ok(venda.includes(x),'Venda não compartilha coluna: '+x)
for(const x of ['onDragStart','soltarColuna(c.id)','p.colunaId===c.id','moverCardVisual(id,destinoVisual)'])
 assert.ok(geralUI.includes(x),'Kanban Geral não compartilha coluna: '+x)
console.log('PASS: 9 colunas, validação, novas etapas, ordem por arraste, espelhamento, tenant, permissões e auditoria')
