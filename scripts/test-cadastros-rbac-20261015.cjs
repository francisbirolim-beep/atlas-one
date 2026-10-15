const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),Module=require('module'),ts=require('typescript')
const root=path.resolve(__dirname,'..')
const filename=path.join(root,'lib/acessoCadastroOperacional.ts')
const js=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const mod=new Module(filename,module);mod.filename=filename
let rights={}
let config={visiveis:['produtos','fornecedores','linhas','materiais','catalogo_tecnico','historico','avancados','precificacao','clientes'],acoes:{}}
mod.require=id=>{
 if(id==='./setores')return {listarPermissoesUsuario:async id=>rights[id]||{}}
 if(id==='./cadastrosUsuario')return {
  lerCadastrosUsuarioConfig:async ()=>config,
  temPermissaoCadastro360:(user,cfg,id,action)=>cfg.visiveis.includes(id)&&((cfg.acoes?.[id]||['ver','criar','editar','excluir','aprovar']).includes(action)),
 }
 throw Error('Unexpected dependency '+id)
}
mod._compile(js,filename)
const {carregarAcessoCadastro,podeAcaoCadastro}=mod.exports
async function test(){
 const daiane={id:'daiane',role:'funcionario'},master={id:'master',role:'master'}
 rights.daiane={cadastro:'edicao'}
 const d=await carregarAcessoCadastro(daiane)
 assert.equal(podeAcaoCadastro(d,'produtos','ver'),true)
 assert.equal(podeAcaoCadastro(d,'produtos','editar'),true)
 assert.equal(podeAcaoCadastro(d,'fornecedores','criar'),true)
 assert.equal(podeAcaoCadastro(d,'avancados','ver'),false)
 assert.equal(podeAcaoCadastro(d,'historico','ver'),false)
 assert.equal(podeAcaoCadastro(d,'campos','ver'),false)
 const m=await carregarAcessoCadastro(master)
 assert.equal(podeAcaoCadastro(m,'avancados','excluir'),true)
 assert.equal(podeAcaoCadastro(m,'historico','ver'),true)
 rights.daiane={cadastro:'consulta'}
 const consult=await carregarAcessoCadastro(daiane)
 assert.equal(podeAcaoCadastro(consult,'produtos','ver'),true)
 assert.equal(podeAcaoCadastro(consult,'produtos','editar'),false)
 assert.equal(podeAcaoCadastro(consult,'fornecedores','excluir'),false)
 rights.daiane={cadastro:'oculto'}
 const hidden=await carregarAcessoCadastro(daiane)
 assert.equal(podeAcaoCadastro(hidden,'produtos','ver'),false)
 rights.daiane={cadastro:'edicao'}
 config={visiveis:['fornecedores'],acoes:{fornecedores:['ver']}}
 const limited=await carregarAcessoCadastro(daiane)
 assert.equal(podeAcaoCadastro(limited,'fornecedores','ver'),true)
 assert.equal(podeAcaoCadastro(limited,'fornecedores','criar'),false)
 assert.equal(podeAcaoCadastro(limited,'produtos','ver'),false)
 assert.equal(podeAcaoCadastro(await carregarAcessoCadastro(null),'produtos','ver'),false)
 assert(fs.readFileSync(path.join(root,'lib/guias.ts'),'utf8').includes("masterOnly: true"))
 for(const file of [
  'app/cadastros/page.tsx','app/cadastro/produtos/page.tsx',
  'app/cadastro/fornecedores/page.tsx','app/cadastro/catalogo-tecnico/page.tsx',
  'app/cadastro/produtos/precificacao/page.tsx','app/cadastro/materiais/page.tsx',
  'components/Sidebar.tsx',
 ]){
  const source=fs.readFileSync(path.join(root,file),'utf8')
  assert(source.includes('podeAcaoCadastro'),file)
 }
 const material=fs.readFileSync(path.join(root,'app/cadastro/materiais/page.tsx'),'utf8')
 assert(material.includes("setPodeEditar(me?.role==='master')"),'global writes must stay master-only')
 console.log('PASS: master preservado; Daiane edição; consulta; oculto; matriz 360; operações globais protegidas')
}
test().catch(err=>{console.error(err);process.exitCode=1})
