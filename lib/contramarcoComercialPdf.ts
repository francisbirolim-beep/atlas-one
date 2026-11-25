import {jsPDF} from 'jspdf'
import type {OrcamentoCM} from './contramarcoComercial'
const moeda=(c:number)=>(c/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
export function gerarPdfComercialCM(cliente:string,o:OrcamentoCM){
  if(o.status!=='proposta'&&o.status!=='vendido')throw new Error('Emita a proposta antes de gerar o PDF.')
  const doc=new jsPDF({format:'a4',unit:'mm'})
  let y=0
  function cabecalho(){
    y=15;doc.setTextColor(19,35,74);doc.setFont('helvetica','bold');doc.setFontSize(14);doc.text('ESQUADRIFÁCIO | CONTRAMARCOS',14,y);y+=8
    doc.setFontSize(11);doc.text((o.status==='vendido'?'VENDA EXCLUSIVA':'PROPOSTA COMERCIAL')+' CM #'+o.numero,14,y);y+=8
  }
  function linha(s:string,size=10,bold=false){
    doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size)
    const partes=doc.splitTextToSize(s,182) as string[]
    for(const l of partes){if(y>275) {doc.addPage();cabecalho();doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size)}doc.text(l,14,y);y+=size*.48}
  }
  cabecalho();linha('Cliente: '+cliente);linha('Obra: '+o.nome_obra);linha('Local: '+[o.endereco,o.cidade].filter(Boolean).join(' - '));linha('Data: '+new Date(o.created_at).toLocaleDateString('pt-BR'));linha('Medidas em milímetros. Proposta exclusiva de contramarcos, sem fornecimento de esquadrias.');y+=4
  for(const [index,i] of o.itens.entries()){
    if(y>245){doc.addPage();cabecalho()}
    doc.setDrawColor(190);doc.line(14,y,196,y);y+=5
    linha((index+1)+'. '+[i.ambiente,i.tipologia].filter(Boolean).join(' · '),11,true)
    linha('Vão: '+i.largura_mm+' × '+i.altura_mm+' | Folgas totais: '+i.folga_l_mm+' × '+i.folga_a_mm)
    linha('Dimensão de fabricação: '+i.fabricacao_l_mm+' × '+i.fabricacao_a_mm+' | '+(i.confirmada?'Medida conferida':'Medida preliminar'))
    linha('Quantidade: '+i.quantidade+' | Unitário: '+moeda(i.preco_unit_centavos||0)+' | Subtotal: '+moeda(i.total_centavos),10,true);y+=3
  }
  if(y>260){doc.addPage();cabecalho()}linha('TOTAL: '+moeda(o.valor_centavos),14,true);y+=4
  linha('Condições comerciais:',11,true);linha(o.condicoes);y+=4
  linha('Documento comercial. Não é plano de corte nem autorização de fabricação.',9)
  doc.save('contramarcos-CM-'+o.numero+'.pdf')
}
