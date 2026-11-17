// Testes isolados do CRM de Prospecção, sem banco real e sem alterar produção.
// Executar: node scripts/test-prospeccao-campo-20261117.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function carregar(caminho, modulos={}) {
  const fonte=fs.readFileSync(caminho,'utf8')
  const js=ts.transpileModule(fonte,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
  const m={exports:{}}
  const fn=vm.runInThisContext('(function(require,module,exports){\n'+js+'\n})',{filename:caminho})
  fn(id=>{
    if(Object.prototype.hasOwnProperty.call(modulos,id))return modulos[id]
    throw Error('Dependência não simulada: '+id+' em '+caminho)
  },m,m.exports)
  return m.exports
}

async function main(){
  const cep=carregar('lib/geocodificacaoCep.ts')
  const exemplo=[
    {cep:'15200-101',logradouro:'Rua das Flores',bairro:'Centro',localidade:'José Bonifácio',uf:'SP',complemento:'até 999'},
    {cep:'15200-102',logradouro:'Rua das Flores',bairro:'Centro',localidade:'José Bonifácio',uf:'SP',complemento:'de 1000 a 1999'},
  ]
  const varios=cep.selecionarComplementoViaCep(exemplo,'R. das Flores','Centro','Jose Bonifacio','SP')
  assert.equal(varios.cep,'','CEP ambíguo não pode ser escolhido automaticamente')
  assert.equal(varios.ambiguo,true)
  assert.equal(varios.opcoes.length,2)
  assert.equal(varios.opcoes[1].trecho,'de 1000 a 1999')
  assert.equal(cep.selecionarComplementoViaCep([exemplo[0]],'Rua das Flores','Centro','José Bonifácio','SP').cep,'15200-101')

  const mapa=carregar('lib/prospeccaoMapa.ts',{'@/lib/geocodificacaoCep':cep})
  const prospeccoes=[
    {id:'A',cliente_id:'CLIENTE-1',obra_id:'OBRA-A',cidade:'José Bonifácio',bairro:'Centro',latitude:-21.05,longitude:-49.68,status:'convertido'},
    {id:'B',cliente_id:'CLIENTE-1',obra_id:'OBRA-B',cidade:'Jose Bonifacio',bairro:'CENTRO',latitude:-21.06,longitude:-49.68,status:'convertido'},
    {id:'C',cliente_id:'CLIENTE-2',obra_id:'OBRA-C',cidade:'José Bonifácio',bairro:'Jardim Novo',latitude:null,longitude:null,status:'convertido'},
    {id:'D',cliente_id:'CLIENTE-3',obra_id:'OBRA-D',cidade:'José Bonifácio',bairro:'Jardim Novo',latitude:-21.07,longitude:-49.68,status:'convertido'},
  ]
  const orcamentos=[
    {id:'a1',obra_id:'OBRA-A',status:'enviado',data_venda:null},
    {id:'b1',obra_id:'OBRA-B',status:'convertido',data_venda:'2026-11-17'},
    {id:'b2',obra_id:'OBRA-B',status:'recusado',data_venda:null},
    {id:'c1',obra_id:'OBRA-C',status:'recusado',data_venda:null},
    {id:'z1',obra_id:'OBRA-SEM-VENDA',status:'convertido',data_venda:'2026-11-17'},
  ]
  const vendas=[
    {id:'v1',obra_id:'OBRA-B',status:'ativa',excluida_em:null},
    {id:'v2',obra_id:'OBRA-C',status:'ativa',excluida_em:'2026-11-18'},
  ]
  const supabase={
    from(nome){
      assert.ok(['orcamentos','vendas_obras'].includes(nome))
      return {select(campos){
        assert.ok(campos.includes('obra_id'))
        return {in(_campo,ids){
          const filtros={}
          const consulta={
            eq(campo,valor){filtros[campo]=valor;return this},
            is(campo,valor){filtros[campo]=valor;return this},
            order(){return this},
            async range(inicio,fim){
              const linhas=nome==='orcamentos'?orcamentos:vendas
              const filtrados=linhas.filter(linha=>ids.includes(linha.obra_id)&&Object.entries(filtros).every(([campo,valor])=>linha[campo]===valor))
              return {data:filtrados.sort((a,b)=>a.id.localeCompare(b.id)).slice(inicio,fim+1),error:null}
            },
          }
          return consulta
        }}
      }}
    },
  }
  const etapasApi=carregar('lib/prospeccaoEtapas.ts',{'@/lib/supabase':{supabase}})
  const dados=await etapasApi.consultarEtapasComerciais(prospeccoes)
  assert.equal(dados.aviso,null)
  assert.equal(dados.etapas.A,'orcamento','Orçamento de uma obra não herda venda da outra obra do mesmo cliente')
  assert.equal(dados.etapas.B,'venda','Venda real tem precedência sobre outros orçamentos')
  assert.equal(dados.etapas.C,'cliente','Somente proposta recusada não é orçamento ativo')
  assert.equal(dados.etapas.D,'cliente','Conversão em cliente não significa venda')
  // A mesma obra pode ter orçamento marcado convertido sem venda operacional:
  // isso não deve transformar o pino em venda por engano.
  const semVenda=await etapasApi.consultarEtapasComerciais([{...prospeccoes[1],obra_id:'OBRA-SEM-VENDA'}])
  assert.equal(semVenda.etapas.B,'orcamento','Orçamento marcado convertido sem venda ativa não vira pino de venda')
  const pontos=mapa.pontosValidos(prospeccoes,dados.etapas)
  assert.equal(pontos.length,3,'Sem GPS não deve virar pino inventado')
  assert.equal(pontos.find(p=>p.registro.id==='B').classificacao,'venda')
  const grupos=mapa.agruparPontosPorBairro(pontos)
  assert.equal(grupos.length,2,'Acentos/maiúsculas no bairro não podem criar contagens separadas')
  assert.equal(grupos.find(g=>g.nome.toLowerCase().includes('centro')).pontos.length,2)

  const rel=carregar('lib/prospeccaoRelatorio.ts',{
    '@/lib/geocodificacaoCep':cep,
    '@/lib/prospeccaoMapa':mapa,
  })
  const resumo=rel.resumoProspeccaoPorBairro(prospeccoes,dados.etapas)
  assert.equal(resumo.length,2)
  const centro=resumo.find(r=>r.bairro.toLowerCase()==='centro')
  assert.equal(centro.total,2)
  assert.equal(centro.pinos,2)
  assert.equal(centro.orcamentos,1)
  assert.equal(centro.vendas,1)
  const jardim=resumo.find(r=>r.bairro==='Jardim Novo')
  assert.equal(jardim.semGps,1)
  assert.equal(jardim.clientes,2)
  assert.equal(rel.nomesUnicosGeograficos(['Centro','CENTRO','Cêntro']).length,1)

  const uploads=[]
  const storage={from(bucket){
    assert.equal(bucket,'prospeccao-fotos')
    return {
      async upload(caminho,arquivo,opts){uploads.push({caminho,arquivo,opts});return {error:null}},
      async list(){return {data:[{name:'imagem.jpg',created_at:'2026-11-17T10:00:00Z'}],error:null}},
      async createSignedUrl(caminho){return {data:{signedUrl:'https://mock.invalid/'+caminho},error:null}},
    }
  }}
  const fotos=carregar('lib/prospeccaoFotos.ts',{'@/lib/supabase':{supabase:{storage}}})
  const id='00000000-0000-4000-8000-000000000001'
  const envio=await fotos.enviarFotosProspeccao(id,[
    {name:'fachada.jpg',type:'image/jpeg',size:1234},
    {name:'documento.pdf',type:'application/pdf',size:100},
  ])
  assert.equal(envio.enviadas,1)
  assert.equal(envio.falhas.length,1)
  assert.ok(uploads[0].caminho.startsWith(id+'/'))
  const galeria=await fotos.listarFotosProspeccao(id)
  assert.equal(galeria.fotos.length,1)
  assert.equal(galeria.erro,null)

  const status=fs.readFileSync('lib/prospeccao.ts','utf8')
  assert.match(status,/novoStatus === 'convertido' && !prospeccao\.cliente_id/)
  assert.match(status,/dados\.status_novo === 'convertido' && !prospeccao\.cliente_id/)
  console.log('PASS: CEP ambíguo, faixa postal, cliente/obra/orçamento/venda, bairros, GPS, fotos privadas e conversão controlada.')
}
main().catch(erro=>{console.error(erro);process.exitCode=1})
