'use client'
import {tokenAtual} from '@/lib/auth'
const moeda=(v:number)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const data=(v:string|null|undefined)=>v&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v.slice(8)+'/'+v.slice(5,7)+'/'+v.slice(0,4):'—'
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))
function html(titulo:string,campos:[string,string][],assinatura:boolean){
 return '<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><title>'+esc(titulo)+'</title><style>body{font:15px Arial,sans-serif;max-width:780px;margin:55px auto;color:#172033}h1{font-size:25px;border-bottom:2px solid #164e63;padding-bottom:20px}p{margin:15px 0}.rot{font-weight:bold}.ass{margin-top:80px;border-top:1px solid #333;width:70%;padding-top:9px;text-align:center}.obs{font-size:11px;color:#64748b;margin-top:30px}@page{size:A4;margin:16mm}</style></head><body><p>ESQUADRIFÁCIO — SOLUÇÕES EM ALUMÍNIO</p><h1>'+esc(titulo)+'</h1>'+campos.map(([k,v])=>'<p><span class="rot">'+esc(k)+':</span> '+esc(v)+'</p>').join('')+(assinatura?'<div class="ass">Assinatura do beneficiário</div>':'')+'<p class="obs">Emitido pelo Atlas One. Os saldos apresentados refletem os títulos atualmente registrados, e não necessariamente o saldo histórico da data do pagamento. Este documento comprova somente o valor descrito acima.</p></body></html>'
}
export async function imprimirReciboRecebimento(id:string){
 const j=window.open('','_blank','width=950,height=850');if(!j){alert('Permita janelas pop-up para o recibo.');return}
 j.document.write('<p style="font-family:Arial">Carregando recibo...</p>')
 try{
  const t=await tokenAtual();if(!t)throw new Error('Sessão expirada.')
  const r=await fetch('/api/financeiro/recibo?id='+encodeURIComponent(id),{headers:{Authorization:'Bearer '+t},cache:'no-store'})
  const json=await r.json();if(!r.ok)throw new Error(json.error||'Erro no recibo')
  const x=json.recibo,saldo=Number(x.saldoAtual||0),obras=x.obras?.length?x.obras.join('; '):'Não vinculada a uma obra específica'
  const campos:[string,string][]=[['Cliente',x.cliente_nome||'—'],['Obra(s) relacionada(s)',obras],['Recebido em',data(x.data_recebimento)],['Valor recebido',moeda(Number(x.valor))],['Forma',x.forma||'—'],['Referência',x.referencia||'—'],['Saldo devedor atual '+(x.escopo==='obra'?'da obra':'do cliente'),moeda(saldo)],['Situação',saldo>0.009?'Pagamento parcial — não representa quitação total':'Sem saldo pendente nos títulos deste escopo']]
  j.document.open();j.document.write(html('Recibo de recebimento',campos,false));j.document.close();j.focus();setTimeout(()=>j.print(),350)
 }catch(e){j.document.open();j.document.write('<p style="font-family:Arial">Não foi possível emitir o recibo: '+esc(e instanceof Error?e.message:'Erro')+'</p>');j.document.close()}
}
export function imprimirReciboPagamento(x:{fornecedor_nome:string|null;documento:string|null;descricao:string|null;data_pagamento:string|null;valor_pago:number|null;valor:number;forma_pagamento:string|null}){
 if(!x.data_pagamento){alert('Confirme o pagamento antes de emitir recibo de quitação.');return}
 const j=window.open('','_blank','width=950,height=850');if(!j){alert('Permita pop-ups para imprimir.');return}
 const v=Number(x.valor_pago??x.valor),total=Number(x.valor)
 const campos:[string,string][]=[['Beneficiário',x.fornecedor_nome||'—'],['Documento',x.documento||'—'],['Descrição',x.descricao||'—'],['Pago em',data(x.data_pagamento)],['Valor pago',moeda(v)],['Forma de pagamento',x.forma_pagamento||'Não informada'],['Saldo deste título (estimado)',moeda(Math.max(0,total-v))],['Situação',v+0.009>=total?'Quitado integralmente':'Pagamento parcial — sem quitação total']]
 j.document.write(html('Recibo para assinatura do beneficiário',campos,true));j.document.close();j.focus();setTimeout(()=>j.print(),350)
}
