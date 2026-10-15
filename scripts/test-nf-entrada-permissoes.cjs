const fs = require('fs')
const path = require('path')
const assert = require('node:assert/strict')
const Module = require('node:module')
const ts = require('typescript')

async function run() {
  const file = path.resolve(__dirname,'../lib/nfEntradaAcessoServer.ts')
  const code = fs.readFileSync(file,'utf8')
  const js = ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
  const calls = []
  const mod = new Module(file,module)
  mod.filename=file;mod.paths=module.paths
  mod.require = (id) => {
    if (id!=='./acessoUsuarioServer') return require(id)
    return {usuarioPodeAcaoServer:async (args) => {
      calls.push(args)
      if (args.role==='master') return true
      if (args.usuarioId==='oculto') return false
      if (args.usuarioId==='consulta') return args.minimo==='consulta'
      if (args.usuarioId==='bloqueado-acao') return args.acaoId !== 'compras.notas.lancar'
      return args.usuarioId==='gabrielle' && args.empresaId==='empresa-correta'
    }}
  }
  mod._compile(js,file)
  const {podeConsultarNF,podeLancarNF}=mod.exports
  const usuario=(id,role='funcionario',empresa_id='empresa-correta')=>({id,role,empresa_id})
  assert.equal(await podeConsultarNF(usuario('gabrielle')),true)
  assert.equal(await podeLancarNF(usuario('gabrielle')),true)
  assert.equal(await podeConsultarNF(usuario('consulta')),true)
  assert.equal(await podeLancarNF(usuario('consulta')),false)
  assert.equal(await podeLancarNF(usuario('oculto')),false)
  assert.equal(await podeConsultarNF(usuario('oculto')),false)
  assert.equal(await podeLancarNF(usuario('gabrielle','funcionario','outra-empresa')),false)
  assert.equal(await podeLancarNF(usuario('bloqueado-acao')),false)
  assert.equal(await podeLancarNF(usuario('master','master')),true)
  assert.equal(calls.every(c=>c.setorId==='compras'&&c.empresaId),true)
  assert.deepEqual([...new Set(calls.map(c=>c.acaoId))].sort(),['compras.notas.consultar','compras.notas.lancar'])
  const guarded=[
    ['app/api/compras/nf-entrada/preview/route.ts','podeLancarNF'],
    ['app/api/compras/nf-entrada/catalogo/route.ts','podeLancarNF'],
    ['app/api/compras/nf-entrada/confirmar/route.ts','podeLancarNF'],
    ['app/api/compras/produtos/vincular/route.ts','podeLancarNF'],
    ['app/api/compras/nfs/route.ts','podeConsultarNF'],
    ['app/api/compras/nfs/[id]/route.ts','podeConsultarNF']
  ]
  for (const [f,permission] of guarded) {
    const s=fs.readFileSync(path.resolve(__dirname,'..',f),'utf8')
    assert(s.includes('await '+permission+'(usuario)'),f+' sem guard')
    assert(s.includes('status: 403'),f+' sem negação')
  }
  const products=fs.readFileSync(path.resolve(__dirname,'../app/api/compras/nf-entrada/catalogo/route.ts'),'utf8')
  assert(products.includes(".eq('empresa_id', usuario.empresa_id)"))
  const nfe=fs.readFileSync(path.resolve(__dirname,'../lib/nfeEntradaServer.ts'),'utf8')
  assert(nfe.includes(".eq('empresa_id', empresaId"))
  console.log('PASS: permissões NF, leitura x gravação, isolamento empresa, Master e rotas')
}
run().catch(e=>{console.error(e);process.exit(1)})
