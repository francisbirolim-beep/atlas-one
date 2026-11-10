const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const load=()=>{
 const js=ts.transpileModule(fs.readFileSync('lib/visaoGeralProjetos.ts','utf8'),
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
 const mod={exports:{}}
 new Function('module','exports','require',js)(mod,mod.exports,require)
 return mod.exports
}
const geral=load()
const original=geral.COLUNAS_GERAIS_PADRAO
const c=original.find(x=>x.id==='validacao_projeto')
const configuradas=geral.atualizarColunaVisual(original,c.id,{
 nome:c.nome,descricao:'Validação técnica',
 cor:'#1565aa',prazoDias:null,prazoHoras:24,
 statusDisponiveis:[
  {id:'em_validacao',nome:'Em validação',conclusivo:false},
  {id:'validado',nome:'Projeto validado',conclusivo:true},
 ]
})
assert.deepEqual(geral.validarColunasGerais(configuradas),[])
assert.equal(configuradas.find(x=>x.id===c.id).prazoHoras,24)
assert.equal(original.find(x=>x.id===c.id).prazoDias,null)
const inicio='2026-11-10T08:00:00.000Z'
const andamento=geral.situacaoPrazoEtapa({entrouEm:inicio,prazoHoras:24,agora:'2026-11-10T16:00:00.000Z'})
assert.equal(andamento.estado,'amarelo')
assert.equal(andamento.horasRestantes,16)
const vencido=geral.situacaoPrazoEtapa({entrouEm:inicio,prazoHoras:24,agora:'2026-11-11T09:00:00.000Z'})
assert.equal(vencido.estado,'vermelho')
const concluido=geral.situacaoPrazoEtapa({entrouEm:inicio,prazoHoras:24,
 agora:'2026-11-13T12:00:00.000Z',concluida:true,concluiuEm:'2026-11-10T16:00:00.000Z'})
assert.equal(concluido.estado,'verde')
assert.equal(geral.situacaoPrazoEtapa({entrouEm:null,prazoHoras:24,agora:'2026-11-13T12:00:00.000Z'}).estado,'sem_prazo')
const comDuplicado=configuradas.map(x=>x.id===c.id?{...x,statusDisponiveis:[
 {id:'um',nome:'Teste'},{id:'um',nome:'Repetido'}]}:x)
assert.ok(geral.validarColunasGerais(comDuplicado).length>0)
const ui=fs.readFileSync('app/visao-geral-projetos/page.tsx','utf8')
const api=fs.readFileSync('app/api/visao-geral-projetos/status/route.ts','utf8')
const consulta=fs.readFileSync('app/api/visao-geral-projetos/route.ts','utf8')
const sql=fs.readFileSync('supabase/migrations/20261111003000_kanban_status_por_etapa_v1.sql','utf8')
for(const s of ['setEditarColunaId(col.id)','abaConfigColuna','Salvar alterações','Progresso nome="Produção"',
 'Progresso nome="Instalação"','statusEtapa','/api/visao-geral-projetos/status'])
 assert.ok(ui.includes(s),'Falta no editor: '+s)
assert.ok(!ui.includes('FotoReal url={card.fotoProjetoUrl}'),'Card ainda contém imagem grande')
for(const s of ['permissoes.mover','podeMoverKanbanGeral','p_empresa:usuario.empresa_id','salvar_visao_geral_status_etapa_v1'])
 assert.ok(api.includes(s),'Falta API: '+s)
for(const s of ['visao_geral_cards_status_etapa','statusEtapa','situacaoPrazoEtapa'])
 assert.ok(consulta.includes(s),'Falta leitura: '+s)
for(const s of ['enable row level security','revoke all','grant execute','service_role',
 'visao_geral_cards_status_etapa_historico','status_anteriores','status_novos'])
 assert.ok(sql.includes(s),'Falta isolamento/auditoria: '+s)
console.log('PASS: metadados, status múltiplos auditáveis, ACL e SLA em horas, sem inventar entrada de cards')
