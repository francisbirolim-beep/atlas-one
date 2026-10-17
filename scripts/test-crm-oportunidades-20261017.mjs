import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {agruparOportunidades} from '../lib/crmAgrupamento.ts'
const uid=(n)=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0')
const item=(tipo,qtd,ambiente='')=>({tipo_esquadria:tipo,quantidade:qtd,ambiente})
const orc=(i,alteracoes={})=>({
 id:uid(i),numero:i,cliente_id:uid(100),cliente_nome:'João',obra_id:uid(200),
 created_at:'2026-10-'+String(i).padStart(2,'0')+'T10:00:00Z',status:'enviado',
 valor_estimado:1000,criado_por_id:uid(300),itens:[item('porta',5,'sala'),item('janela',8,'quarto')],...alteracoes,
})
function grupos(...args){return agruparOportunidades(...args).grupos}
{
 const r=grupos([orc(1),orc(2,{valor_estimado:1200,itens:[{...item('porta',5,'sala'),cor:'branco',contramarco:'nao'},{...item('janela',8,'quarto'),cor:'branco'}]})])
 assert.equal(r.length,1,'Cor/contramarco não cria oportunidade')
 assert.equal(r[0].orcamentos.length,2)
 assert.equal(r[0].valorReferencia,1200,'Não somar versões')
}
{
 const r=grupos([orc(1),orc(2,{itens:[item('portao ripado',1,'frente')]})])
 assert.equal(r.length,2,'Portão diferente abre nova oportunidade na mesma obra')
}
{
 const r=grupos([orc(1),orc(2,{itens:[item('porta',5,'sala'),item('janela',9,'quarto')]})])
 assert.equal(r.length,1,'Janela adicional à mesma negociação')
}
{
 const r=grupos([orc(1),orc(2,{obra_id:uid(201)})])
 assert.equal(r.length,2,'Obras diferentes não se unem')
}
{
 const r=grupos([orc(1),orc(2,{cliente_id:uid(101)})])
 assert.equal(r.length,2,'Clientes diferentes não se unem')
}
{
 const r=grupos([orc(1),orc(2,{obra_id:null})])
 assert.equal(r.length,2,'Obra sem ID não se une por nome')
 assert.equal(r.find(g=>!g.obraId)?.pendenteRevisao,true)
}
{
 const r=grupos([orc(1),orc(2,{itens:[item('porta',3,'sala')]})])
 assert.equal(r.length,2,'Escopo parcialmente semelhante fica pendente de revisão')
 assert.equal(r.some(g=>g.pendenteRevisao),true)
}
{
 const v=[{orcamento_id:uid(2),ancora_orcamento_id:uid(1)}]
 const r=grupos([orc(1),orc(2,{itens:[item('porta',3,'sala')]})],v)
 assert.equal(r.length,1,'Confirmação humana une versões')
}
{
 const v=[{orcamento_id:uid(2),ancora_orcamento_id:uid(2)}]
 const r=grupos([orc(1),orc(2)],v)
 assert.equal(r.length,2,'Confirmação humana de negócio distinto tem precedência')
}
{
 const r=grupos([orc(1),orc(2,{status:'vendido'})])
 assert.equal(r.length,1)
 assert.equal(r[0].status,'ganho','Venda confirmada gera oportunidade ganha')
}
{
 const r=grupos([orc(1),orc(2,{status:'aprovado'})])
 assert.notEqual(r[0].status,'ganho','Orçamento aprovado, sem venda confirmada, não vira ganho')
}
{
 const r=grupos([orc(1,{revisao_grupo_id:uid(900)}),orc(2,{revisao_grupo_id:uid(900),itens:[item('portao ripado',1)]})])
 assert.equal(r.length,1,'Grupo de revisões formal prevalece sobre diferença de tipologia')
}
{
 const a=orc(1,{itens:[{tipo_esquadria:'outro',tipo_outro_texto:'Portão ripado',quantidade:1,ambiente:'Frente'}]})
 const b=orc(2,{itens:[{tipo_esquadria:'outro',tipo_outro_texto:'Vidro fixo',quantidade:1,ambiente:'Frente'}]})
 assert.equal(grupos([a,b]).length,2,'Códigos outro não unem escopos diferentes')
}
{
 const a=orc(1,{itens:[item('l_suprema_porta_de_giro_01_folha',1,'Entrada')]})
 const b=orc(2,{itens:[item('l_suprema_porta_de_correr_01_folha',1,'Entrada')]})
 assert.equal(grupos([a,b]).length,2,'Porta de giro não é porta de correr')
}
{
 const a=orc(1,{itens:[{...item('janela_correr',1,'Quarto'),largura_mm:1000,altura_mm:1200}]})
 const b=orc(2,{itens:[{...item('janela_correr',1,'Quarto'),largura_mm:1450,altura_mm:1200}]})
 const rs=grupos([a,b])
 assert.equal(rs.length,2,'Dimensões significativamente diferentes exigem revisão')
 assert.equal(rs.some(r=>r.pendenteRevisao),true)
}
{
 const a=orc(1,{itens:[{...item('l_suprema_janela_de_correr_02_folhas',1,'Quarto'),largura_mm:1000,altura_mm:1200}]})
 const b=orc(2,{itens:[{...item('janela_correr',1,'Quarto'),largura_mm:1005,altura_mm:1198}]})
 assert.equal(grupos([a,b]).length,1,'Linhas e correções pequenas de medida preservam a mesma oportunidade')
}
const live=readFileSync('app/crm/comercial/page.tsx','utf8')
const novo=readFileSync('app/crm/oportunidades/page.tsx','utf8')
assert.match(live,/href="\/crm\/oportunidades"/)
assert.match(novo,/\.from\('vendas_obras'\)/)
assert.match(novo,/Promise\.all\(\[oq,tq,pq,supabase\.from\('vendas_obras'\)/, 'Consulta não depende de tabela de vínculos inexistente')
assert.match(novo,/setPersistencia\(false\)/, 'Confirmação manual depende de etapa futura')
assert.match(novo,/const podeGravar=false/, 'Modo consulta bloqueia escritas neste lançamento')
assert.match(novo,/Agendar no CRM atual/, 'Fluxo existente de agendamento preservado')
assert.doesNotMatch(novo,/\.from\('orcamentos'\)\.update\(|\.from\('orcamentos'\)\.delete\(/)
console.log('PASS: 15 cenários de CRM por obra, escopo, revisão, confirmação, vendas e regressão de Kanban.')