// Testes determinísticos da origem Pedido de Orçamento no mapa.
// Não acessa banco remoto, não grava dados e não altera produção.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function carregar(caminho, dependencias={}) {
  const fonte = fs.readFileSync(caminho,'utf8')
  const compilado = ts.transpileModule(fonte,{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
    reportDiagnostics:true,
  })
  const erros = (compilado.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error)
  assert.equal(erros.length,0,'Sintaxe TS válida em '+caminho)
  const m={exports:{}}
  const fn=vm.runInThisContext('(function(require,module,exports){\n'+compilado.outputText+'\n})',{filename:caminho})
  fn(id=>{
    if (Object.prototype.hasOwnProperty.call(dependencias,id)) return dependencias[id]
    throw Error('Dependência inesperada: '+id)
  },m,m.exports)
  return m.exports
}

async function main(){
  const endereco=carregar('lib/enderecoObra.ts')
  const obs=(lat,lon)=>'Notas livres\nLocalização: '+lat+','+lon+'\nLocalização conferida: Sim'
  const obras=[
    {id:'A',cliente_id:'C-A',nome:'Obra A',endereco:'Rua A, 12',cidade:'José Bonifácio',bairro:'Centro',observacoes:obs('-21.05','-49.68'),criado_por_id:'u1',criado_por_nome:'Vendedor'},
    {id:'B',cliente_id:'C-B',nome:'Obra B',cidade:'José Bonifácio',bairro:'Centro',observacoes:obs('-21.06','-49.68'),criado_por_id:'u1',criado_por_nome:'Vendedor'},
    {id:'C',cliente_id:'C-C',nome:'Obra C',cidade:'José Bonifácio',bairro:'Centro',observacoes:obs('-21.07','-49.68'),criado_por_id:'u1',criado_por_nome:'Vendedor'},
    {id:'D',cliente_id:'C-D',nome:'Obra D',cidade:'José Bonifácio',bairro:'Centro',observacoes:obs('-21.08','-49.68'),criado_por_id:'u1',criado_por_nome:'Vendedor'},
    {id:'E',cliente_id:'C-E',nome:'Obra E',cidade:'José Bonifácio',bairro:'Centro',observacoes:obs('-21.09','-49.68'),criado_por_id:'u1',criado_por_nome:'Vendedor'},
    {id:'F',cliente_id:'C-F',nome:'Obra F',cidade:'José Bonifácio',bairro:'Centro',observacoes:'GPS rejeitado pelo usuário: -21.10,-49.68',criado_por_id:'u1',criado_por_nome:'Vendedor'},
    {id:'G',cliente_id:'C-G',nome:'Obra G',cidade:'José Bonifácio',bairro:'Centro',observacoes:'Localização: -21.11,-49.68',criado_por_id:'u1',criado_por_nome:'Vendedor'},
    {id:'H',cliente_id:'C-H',nome:'Obra H',cidade:'José Bonifácio',bairro:'Centro',observacoes:obs('-21.12','-49.68'),criado_por_id:'u1',criado_por_nome:'Vendedor'},
    {id:'I',cliente_id:'C-A',nome:'Outra obra do cliente A',cidade:'José Bonifácio',bairro:'Centro',observacoes:obs('-21.13','-49.68'),criado_por_id:'u1',criado_por_nome:'Vendedor'},
  ]
  const orcamentos=[
    {id:'orc-A',obra_id:'A',cliente_nome:'Cliente A',status:'enviado',created_at:'2026-11-17',criado_por_id:'u1',criado_por_nome:'Vendedor'},
    {id:'orc-C',obra_id:'C',cliente_nome:'Cliente C',status:'recusado',created_at:'2026-11-17',criado_por_id:'u1',criado_por_nome:'Vendedor'},
    {id:'orc-D',obra_id:'D',cliente_nome:'Cliente D',status:'rascunho',created_at:'2026-11-17',criado_por_id:'u1',criado_por_nome:'Vendedor'},
    {id:'orc-E',obra_id:'E',cliente_nome:'Cliente E',status:'convertido',created_at:'2026-11-17',criado_por_id:'u1',criado_por_nome:'Vendedor'},
    {id:'orc-H',obra_id:'H',cliente_nome:'Cliente H',status:'enviado',created_at:'2026-11-17',criado_por_id:'u1',criado_por_nome:'Vendedor'},
    {id:'orc-I',obra_id:'I',cliente_nome:'Cliente A',status:'rascunho',created_at:'2026-11-17',criado_por_id:'u1',criado_por_nome:'Vendedor'},
  ]
  const vendas=[
    {id:'vA',obra_id:'A',status:'ativa',excluida_em:null},
    {id:'vE',obra_id:'E',orcamento_id:'orc-E',status:'ativa',excluida_em:'2026-11-18'},
    {id:'vH',obra_id:null,orcamento_id:'orc-H',status:'ativa',excluida_em:null},
  ]
  const leituras=[]
  const supabase={from(tabela){
    assert.ok(['obras','orcamentos','vendas_obras'].includes(tabela))
    const filtros={}
    return {
      select(campos){assert.ok(campos.includes('id'));return this},
      ilike(campo,valor){filtros[campo]=valor;return this},
      in(campo,valores){filtros[campo]=valores;return this},
      eq(campo,valor){filtros[campo]=valor;return this},
      is(campo,valor){filtros[campo]=valor;return this},
      order(){return this},
      async range(inicio,fim){
        leituras.push(tabela)
        const lista=tabela==='obras'?obras:tabela==='orcamentos'?orcamentos:vendas
        return {data:lista.filter(x=>Object.entries(filtros).every(([campo,valor])=>{
          if(campo==='observacoes')return (x.observacoes||'').toLowerCase().includes('localização:')
          if(Array.isArray(valor))return valor.includes(x[campo])
          return x[campo]===valor
        })).slice(inicio,fim+1),error:null}
      },
      insert(){throw Error('Nunca gravar a partir do mapa')},
      update(){throw Error('Nunca atualizar a partir do mapa')},
    }
  }}
  const api=carregar('lib/prospeccaoOrcamentosGps.ts',{
    '@/lib/supabase':{supabase},
    '@/lib/enderecoObra':endereco,
  })
  assert.deepEqual(api.gpsConfirmadoDaObra(obs('-21.05','-49.68')),{latitude:-21.05,longitude:-49.68})
  assert.equal(api.gpsConfirmadoDaObra('GPS rejeitado pelo usuário: -21.05,-49.68'),null)
  assert.equal(api.gpsConfirmadoDaObra('Localização: -21.05,-49.68'),null,'GPS sem confirmação não entra')
  assert.equal(api.gpsConfirmadoDaObra('Localização: 999,1000\nLocalização conferida: Sim'),null)
  const mapa=await api.listarOrcamentosGpsParaMapa()
  assert.equal(mapa.aviso,null)
  assert.deepEqual(mapa.registros.map(r=>r.obra_id),['A','D','E','H','I'],'Somente obras com orçamento não recusado e GPS válido')
  assert.equal(mapa.etapas['orcamento-mapa-A'],'venda','Venda ativa confirmada')
  assert.equal(mapa.etapas['orcamento-mapa-D'],'orcamento','Pedido rascunho já aparece como orçamento')
  assert.equal(mapa.etapas['orcamento-mapa-E'],'orcamento','Venda excluída não é venda ativa')
  assert.equal(mapa.etapas['orcamento-mapa-H'],'venda','Venda ativa pelo orcamento_id, mesmo sem obra_id na venda')
  assert.equal(mapa.etapas['orcamento-mapa-I'],'orcamento','Mesmo cliente em outra obra não herda a venda')
  assert.equal(mapa.registros[1].orcamento_id_mapa,'orc-D')
  assert.equal(mapa.registros[1].origem_mapa,'pedido_orcamento')
  assert.ok(leituras.includes('obras') && leituras.includes('orcamentos') && leituras.includes('vendas_obras'))

  const existentes=[
    {id:'prosp-A',obra_id:'A',latitude:-21.05,longitude:-49.68,status:'convertido'},
    {id:'prosp-D',obra_id:'D',latitude:null,longitude:null,status:'convertido'},
  ]
  const unificados=api.consolidarRegistrosMapa(existentes,mapa.registros)
  assert.equal(unificados.filter(x=>x.obra_id==='A').length,1,'Não duplica obra que já tem ponto na Prospecção')
  assert.equal(unificados.filter(x=>x.obra_id==='D').length,2,'GPS do pedido preenche lacuna de prospecção sem GPS')
  assert.equal(unificados.filter(x=>x.obra_id==='E').length,1)
  assert.equal(unificados.filter(x=>x.obra_id==='I').length,1,'Outra obra do mesmo cliente permanece independente')
  const pagina=fs.readFileSync('app/prospeccao/page.tsx','utf8')
  const popup=fs.readFileSync('components/MapaProspeccoes.tsx','utf8')
  assert.match(pagina,/listarOrcamentosGpsParaMapa/)
  assert.match(pagina,/consolidarRegistrosMapa/)
  assert.match(pagina,/document\.visibilityState === 'visible'/,'Atualização sem bloquear abas inativas')
  assert.match(pagina,/90_000/,'Rever a cor do pino enquanto o mapa estiver aberto')
  assert.match(popup,/origem_mapa === 'pedido_orcamento'/)
  assert.match(popup,/Abrir orçamento/)
  console.log('PASS: GPS confirmado/rejeitado, venda por obra ou orçamento, cancelamento, deduplicação e atualização periódica.')
}
main().catch(e=>{console.error(e);process.exitCode=1})
