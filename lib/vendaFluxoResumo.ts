// Projeção somente leitura do andamento; existência de card não significa conclusão.
type Conta={status?:string|null;valor?:number|null;valor_pago?:number|null;valor_desconto?:number|null}
type Compra={status?:string|null;recebido_em?:string|null}
type Ordem={status?:string|null;bloqueada?:boolean|null}
export type InstalacaoResumo={
  id?:string;item_ref?:string|null;status?:string|null;
  quantidade?:number|null;quantidade_instalada?:number|null;
  pendencia?:string|null;checklist?:Record<string,boolean>|null
}
type Entrada={
  valorVenda:number;
  contas:Conta[];
  compras:Compra[];
  ordens:Ordem[];
  instalacoes:InstalacaoResumo[];
  materiaisPlanejados?:number;
  materiaisInteiramenteAtendidosEstoque?:boolean;
}
export type EtapaResumo={
  id:'venda'|'financeiro'|'compras'|'producao'|'instalacao';
  nome:string;detalhe:string;concluida:boolean;
  aba:'visao'|'financeiro'|'compras'|'producao'|'instalacao';
}
const nr=(valor:unknown)=>{const n=Number(valor);return Number.isFinite(n)?n:0}
const dinheiro=(valor:number)=>valor.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const entregue=(c:Compra)=>String(c.status||'').toLowerCase()==='recebido'||(
  Boolean(c.recebido_em)&&String(c.status||'').toLowerCase()!=='cancelado')
const concluida=(o:Ordem)=>['concluido','concluida','concluído','concluída','finalizado','finalizada','produzido','pronto'].includes(String(o.status||'').toLowerCase())&&!o.bloqueada
const checks=['nivelamento','vedacao','acabamento','limpeza'] as const
const instalacaoConcluida=(i:InstalacaoResumo)=>{
  const qtd=nr(i.quantidade),instaladas=nr(i.quantidade_instalada)
  return qtd>0&&instaladas>=qtd&&i.status==='instalado'&&!String(i.pendencia||'').trim()
    &&checks.every(k=>i.checklist?.[k]===true)
}

export function avaliarFluxoVenda(d:Entrada){
  const contas=d.contas.filter(c=>String(c.status||'').toLowerCase()!=='cancelado')
  const totalContas=contas.reduce((s,c)=>s+nr(c.valor),0)
  const saldo=contas.reduce((s,c)=>s+Math.max(0,nr(c.valor)-nr(c.valor_pago)-nr(c.valor_desconto)),0)
  const parcelasCorretas=contas.length>0&&Math.abs(totalContas-nr(d.valorVenda))<=0.02
  const financeiroConcluido=parcelasCorretas&&saldo<=0.01
  const financeiroDetalhe=!contas.length?'Sem contas a receber vinculadas':
    !parcelasCorretas?'Conferir parcelas: '+dinheiro(totalContas)+' de '+dinheiro(nr(d.valorVenda)):
    financeiroConcluido?'Recebimentos e descontos conciliados':dinheiro(saldo)+' ainda a receber'

  const comprasRecebidas=d.compras.filter(entregue).length
  const materiaisEstoque=(d.materiaisPlanejados||0)>0&&d.materiaisInteiramenteAtendidosEstoque===true
  const comprasConcluidas=d.compras.length>0
    ?comprasRecebidas===d.compras.length
    :materiaisEstoque
  const compraDetalhe=d.compras.length>0
    ?comprasRecebidas+' de '+d.compras.length+' necessidade(s) recebida(s)'
    :materiaisEstoque?'Materiais atendidos pelo estoque registrado':
      (d.materiaisPlanejados||0)>0?'Materiais planejados; falta confirmar compras/estoque':'Sem materiais ou compras vinculados'

  const ordensConcluidas=d.ordens.filter(concluida).length
  const producaoConcluida=d.ordens.length>0&&ordensConcluidas===d.ordens.length
  const producaoDetalhe=d.ordens.length>0
    ?ordensConcluidas+' de '+d.ordens.length+' ordem(ns) concluída(s)':'Nenhuma ordem de produção vinculada'

  const totalPecas=d.instalacoes.reduce((s,i)=>s+Math.max(0,nr(i.quantidade)),0)
  const qtdInstalada=d.instalacoes.reduce((s,i)=>s+Math.min(Math.max(0,nr(i.quantidade_instalada)),Math.max(0,nr(i.quantidade))),0)
  const instalacoesValidadas=d.instalacoes.filter(instalacaoConcluida).length
  const quantidadeFinalizada=d.instalacoes.filter(instalacaoConcluida)
    .reduce((sum,i)=>sum+Math.max(0,nr(i.quantidade)),0)
  const instalacaoConcluidaTotal=d.instalacoes.length>0&&instalacoesValidadas===d.instalacoes.length
  const instalacaoDetalhe=!d.instalacoes.length?'Sem peças no checklist de instalação':
    instalacoesValidadas+' de '+d.instalacoes.length+' item(ns) instalado(s) e conferido(s)'
  const etapas:EtapaResumo[]=[
    {id:'venda',nome:'Venda',detalhe:'Orçamento confirmado e venda vinculada ao cliente',concluida:true,aba:'visao'},
    {id:'financeiro',nome:'Financeiro',detalhe:financeiroDetalhe,concluida:financeiroConcluido,aba:'financeiro'},
    {id:'compras',nome:'Compras e materiais',detalhe:compraDetalhe,concluida:comprasConcluidas,aba:'compras'},
    {id:'producao',nome:'Produção',detalhe:producaoDetalhe,concluida:producaoConcluida,aba:'producao'},
    {id:'instalacao',nome:'Instalação',detalhe:instalacaoDetalhe,concluida:instalacaoConcluidaTotal,aba:'instalacao'},
  ]
  const pendencias=etapas.filter(e=>!e.concluida).map(e=>e.nome)
  return {
    etapas,pendencias,
    podeEncerrar:pendencias.length===0,
    // A barra de progresso sinaliza finalização, não só instalação física:
    // uma cantoneira ou arremate pendente impede indicar 100% concluído.
    progressoInstalacao:totalPecas>0?Math.round(quantidadeFinalizada/totalPecas*100):0,
    totalPecas,quantidadeInstalada:qtdInstalada,quantidadeFinalizada,
    parcelasCorretas,saldo,comprasRecebidas,ordensConcluidas,instalacoesValidadas,
  }
}
