/* Valida 6 e 10 linhas com todas as fotos em PDF A4 sem imprimir no navegador. */
const fs=require('fs'),path=require('path'),Module=require('module'),ts=require('typescript'),assert=require('node:assert/strict')
const root=path.resolve(__dirname,'..'),source=path.join(root,'lib/romaneioPdfA4.ts')
const js=ts.transpileModule(fs.readFileSync(source,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText
const mod=new Module(source,module);mod.filename=source;mod.paths=Module._nodeModulePaths(path.dirname(source));mod._compile(js,source)
const {montarRomaneioPdfA4}=mod.exports
const logo= {data:'data:image/png;base64,'+fs.readFileSync(path.join(root,'public/logo.png')).toString('base64'),largura:800,altura:300}
const nomes=[
'D-103/DECAMP - MONTANTE','CT-002 NAT CANTONEIRA 5/8"',
'D-078 NAT TUBO 50X38 MACHO CUNHA','BAR-096 NAT BARRA CHATA 1.1/2"ESP 1/4"',
'TG-004 NAT TUBO RETANGULAR 50X12MM','MX-054 NAT RIPADO MUXARABI COM ESTAMPO',
'PERFIL TESTE BARRA SUPERIOR SÉRIE 100X50','PERFIL TESTE LATERAL SÉRIE 80X30',
'PERFIL TESTE TRAVESSA SÉRIE 70X30','PERFIL TESTE REFORÇO SÉRIE 100X20'
]
async function main(){
 for(const n of [6,10]){
  const itens=nomes.slice(0,n).map((nome,i)=>({codigo:'PF-00'+(i+1),nome,fotoUrl:'teste',medida:'6000 mm',quantidade:i+1,observacao:'Conferido / pintura'}))
  const dados={numero:'ROM-000001',tipo:'pintura',dataEmissao:'09/11/2026',cliente:'JEFFERSON LUCAS',obra:'Casa condomínio monte Carlo',endereco:'Rua Arlindo Silverio, S/n',destino:'META PERFIL',cor:'CAMBARA',codigoCor:'cod.0',acabamento:'Fosco',status:'Aguardando envio',observacoes:n===6?'':'Texto personalizado informado no campo de observações gerais.',entreguePor:'Francis',recebidoPor:'Pintura',itens}
  const blob=montarRomaneioPdfA4(dados,{logo,itens:itens.map(()=>logo)})
  const bytes=Buffer.from(await blob.arrayBuffer())
  assert.equal(bytes.subarray(0,4).toString(),'%PDF')
  assert(bytes.length>15000)
  const out='/tmp/romaneio-a4-real-'+n+'.pdf'
  fs.writeFileSync(out,bytes)
  console.log('PDF_A4_GERADO',n,'itens',bytes.length,'bytes',out)
 }
 assert.throws(()=>montarRomaneioPdfA4({numero:'1',itens:Array(11).fill({})},{logo,itens:[]}),/10 produtos/)
}
main().catch(e=>{console.error(e);process.exit(1)})