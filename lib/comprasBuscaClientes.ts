// Filtra caracteres estruturais do PostgREST antes de montar uma busca parcial.
export function prepararBuscaCliente(valor:unknown){
 const termo=String(valor??'').replace(/[%_*(),"';\\]/g,' ')
  .replace(/[\r\n\t]/g,' ').replace(/\s+/g,' ').trim().slice(0,80)
 const numeros=termo.replace(/\D/g,'')
 return {termo,numeros,apto:termo.length>=2&&(numeros.length>=3||/[^\d\s.+()-]/.test(termo))}
}
export function filtrosBuscaCliente(valor:unknown){
 const {termo,numeros,apto}=prepararBuscaCliente(valor)
 if(!apto)return null
 const textual='%'+termo+'%'
 const campos=['nome','apelido','email'].map(c=>c+'.ilike.'+textual)
 if(numeros.length>=3){
  // Compatível com telefone e CPF salvos com pontuação ou somente dígitos.
  const flexivel='%'+numeros.split('').join('%')+'%'
  for(const coluna of ['telefone','whatsapp','cpf_cnpj'])campos.push(coluna+'.ilike.'+flexivel)
 }
 return campos.join(',')
}
export const finalDocumento=(v:string|null)=>v?'•••• '+v.replace(/\D/g,'').slice(-4):null
