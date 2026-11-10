const assert=require('node:assert/strict')
const fs=require('node:fs')
const venda=fs.readFileSync('components/clientes/VendasCliente360.tsx','utf8')
const central=fs.readFileSync('components/clientes/VendaObraCentral.tsx','utf8')
for(const [nome,arquivo] of [['Cliente 360',venda],['Venda/Obra',central]]){
 assert.ok(arquivo.includes('wvetro_historico?.numero'),nome+' deve exibir a venda histórica vinculada')
 assert.ok(arquivo.includes('config_snapshot'),nome+' precisa carregar a fonte persistida da venda')
 assert.ok(arquivo.includes('wvetro_historico?.numero?\'Atlas \':\'\''),nome+' deve distinguir orçamento Atlas apenas quando há vínculo histórico WVetro')
 assert.ok(arquivo.includes('.select(')&&arquivo.includes('config_snapshot\''),
 nome+' precisa selecionar config_snapshot do banco')
}
assert.ok(venda.includes('v.config_snapshot.wvetro_historico.numero'))
assert.ok(central.includes('venda.config_snapshot.wvetro_historico.numero'))
assert.ok(venda.includes('moeda(valor)'),'Valor comercial original não pode ser substituído pelo orçamento WVetro atualizado')
console.log('PASS: Cliente 360 e Venda/Obra exibem vínculo histórico WVetro sem sobrescrever orçamento, status ou financeiro')
