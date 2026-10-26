const fs=require('node:fs')
const assert=require('node:assert/strict')
const tela=fs.readFileSync('app/visao-geral-projetos/page.tsx','utf8')
const api=fs.readFileSync('app/api/visao-geral-projetos/route.ts','utf8')
const tipo=fs.readFileSync('lib/visaoGeralDemo.ts','utf8')
const shell=fs.readFileSync('components/system/AppShell.tsx','utf8')

for(const s of ['#07182b','#079c51','#0759e8','#6417e9','#fa5208','#ed0c41','#d99500','#e60d74','#077e85']){
  assert.ok(tela.includes(s),'Paleta visual esperada: '+s)
}
for(const s of ['Projetos no total','Em andamento','Atrasados','Finalizados','Previstos para instalação',
  'Filtros','Personalizar Kanban','Modo TV','Novo Projeto',
  'Visão Geral','Materiais','Compras','Produção','Instalação','Histórico',
  'Abrir Cliente 360','Calendário de Instalação','Imagem ainda não cadastrada']){
  assert.ok(tela.includes(s),'Parte visual ausente: '+s)
}
assert.ok(tela.includes("60_000"),'Reconsulta operacional a cada minuto')
assert.ok(tela.includes("tokenAtual()")&&tela.includes("cache:'no-store'"),'Dados autenticados em tempo real')
assert.ok(tela.includes("c.criterios.includes(p.etapaOperacional"),'O card deve refletir a etapa operacional do Cliente 360')
assert.ok(!tela.includes('moverCard(')&&!tela.includes('supabase.from('),'O painel geral deve permanecer leitura: movimentação no Cliente 360')
assert.ok(tela.includes('fotoSegura(url)')&&tela.includes('onError={()=>setFalhou(true)}'),'Foto vinculada à obra ou fallback honesto')
assert.ok(!tela.includes('unsplash.com')&&!tela.includes('picsum'),'Proibidas fotos falsas de obras')
assert.ok(tela.includes('<FotoReal url={i.fotoUrl}'),'Fotos de produtos em listas detalhadas')
for(const key of ['fotoProjetoUrl','dataInstalacao','observacoes','dataVenda']){
 assert.ok(tipo.includes(key)&&tela.includes(key)&&api.includes(key),'Contrato real ausente: '+key)
}
assert.ok(api.includes("podeConsultarPainelGeral(u,'visao-geral-projetos')"),'Backend deve continuar protegendo acesso')
assert.ok(api.includes(".eq('empresa_id',empresa)"),'Consultas isoladas por empresa')
assert.ok(api.includes("'id,numero,fotos_urls,observacoes'"),'Fotos reais de orçamento')
assert.ok(api.includes("buscar('produtos','id,nome,codigo,foto_url'"),'Produtos usam fotos oficiais')
assert.ok(tela.includes("configuravel")&&api.includes("usuarioMaster:u.role==='master'"),'Personalização segue Master')
assert.ok(shell.includes('atlas-sidebar-shell'),'Menu existente não deve ser removido')
assert.ok(tela.includes('atlas-visual-geral')&&tela.includes('atlas-app-shell:has(.atlas-visual-geral)'), 'A imersão visual deve ficar isolada nesta tela, sem alterar AppShell')
assert.ok(tela.includes('Navegação principal do Atlas One')&&tela.includes('bg-[#0a1a30]'), 'Cabeçalho escuro igual à referência visual')
assert.ok(tela.includes('md:top-[52px]'),'Painel lateral abre abaixo da navegação escura')
console.log('PASS: paleta premium, 8 etapas, cinco KPIs, fotos reais/fallback, Cliente 360, filtros, calendário e isolamento tenant')
