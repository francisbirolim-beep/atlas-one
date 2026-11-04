'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { type ReciboInfo, textoRecibo } from '@/lib/financeiroRecibos'
import { rotuloFormaRecebimento, descricaoFormaRecebimento } from '@/lib/recebimentoFormas'

type AcaoRecibo = 'imprimir' | 'pdf' | null

export default function ReciboImpressao({
  dados, acaoInicial = null,
}: {
  dados: ReciboInfo
  acaoInicial?: AcaoRecibo
}) {
  const r = textoRecibo(dados)
  const papelRef = useRef<HTMLDivElement>(null)
  const acaoExecutada = useRef(false)
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const [erroPdf, setErroPdf] = useState('')

  const gerarPdf = useCallback(async () => {
    if (!papelRef.current || gerandoPdf) return
    setGerandoPdf(true)
    setErroPdf('')
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'), import('jspdf'),
      ])
      const imagens = Array.from(papelRef.current.querySelectorAll('img'))
      await Promise.all(imagens.map(img => img.decode().catch(() => undefined)))
      const canvas = await html2canvas(papelRef.current, {
        scale: 2, backgroundColor: '#ffffff', useCORS: false, logging: false,
      })
      const pdf = new jsPDF({ format: 'a4', orientation: 'portrait', unit: 'mm', compress: true })
      const maxLargura = 190
      const maxAltura = 277
      let largura = maxLargura
      let altura = canvas.height * largura / canvas.width
      if (altura > maxAltura) { largura *= maxAltura / altura; altura = maxAltura }
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.96), 'JPEG', (210 - largura) / 2, 10, largura, altura)
      pdf.save('recibo-esquadrifacio-' + dados.id.slice(0, 8) + '.pdf')
    } catch (erro) {
      console.error('Falha ao gerar PDF de recibo', erro)
      setErroPdf('Não foi possível baixar o PDF. Use a opção Imprimir e selecione Salvar como PDF.')
    } finally {
      setGerandoPdf(false)
    }
  }, [dados.id, gerandoPdf])

  useEffect(() => {
    if (!acaoInicial || acaoExecutada.current || dados.id === 'SIMULACAO') return
    acaoExecutada.current = true
    const id = window.setTimeout(() => {
      if (acaoInicial === 'pdf') void gerarPdf()
      else window.print()
    }, 550)
    return () => window.clearTimeout(id)
  }, [acaoInicial, dados.id, gerarPdf])

  const assinatura = dados.tipo === 'receber' && dados.id !== 'SIMULACAO' && dados.assinaturaDataUri
  return <div className="mx-auto max-w-[820px] text-slate-900">
    <style jsx global>{'@media print{@page{size:A4;margin:16mm}.no-print{display:none!important}body{background:white!important}.atlas-recibo-papel{box-shadow:none!important;border:0!important;padding:0!important}}'}</style>
    <div className="no-print mb-4 flex flex-wrap items-center justify-end gap-2">
      {erroPdf && <span role="alert" className="w-full text-sm text-red-700">{erroPdf}</span>}
      <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800">
        <Printer size={16}/>Imprimir
      </button>
      <button type="button" onClick={() => void gerarPdf()} disabled={gerandoPdf} className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
        <Download size={16}/>{gerandoPdf ? 'Gerando PDF...' : 'Baixar PDF'}
      </button>
    </div>
    <div ref={papelRef} className="atlas-recibo-papel min-h-[660px] bg-white p-8 shadow-sm print:min-h-0 print:p-0">
      <header className="border-b-2 border-slate-900 pb-5">
        <p className="text-xs font-black uppercase tracking-widest text-slate-900">ESQUADRIFÁCIO</p>
        <p className="mt-1 text-xs text-slate-600">Soluções em Alumínio</p>
        <h1 className="mt-5 text-2xl font-black tracking-tight">{dados.tipo === 'pagar' ? 'RECIBO DE PAGAMENTO' : 'RECIBO DE RECEBIMENTO'}</h1>
        <p className="mt-2 text-xs text-slate-500">Identificador do recebimento: {dados.id}</p>
        {dados.referencia && <p className="mt-1 text-xs text-slate-500">Referência: {dados.referencia}</p>}
      </header>
      <section className="mt-6 space-y-3 text-sm">
        <p><b>{dados.tipo === 'pagar' ? 'Beneficiário / recebedor' : 'Recebemos de'}:</b> {dados.nome}</p>
        {dados.documento && <p><b>CPF/CNPJ:</b> {dados.documento}</p>}
        {dados.obra && <p><b>Referente à obra:</b> {dados.obra}</p>}
        {dados.descricao && <p><b>Observações:</b> {dados.descricao}</p>}
        <p><b>Data do pagamento:</b> {r.data}</p>
        <p><b>Forma de pagamento:</b> {dados.tipo==='receber'?rotuloFormaRecebimento(dados.forma):dados.forma||'Não informada'}</p>
        {!!dados.formas?.length&&<div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><b className="text-xs">Composição deste recebimento</b>{dados.formas.map((f,i)=><div key={i} className="mt-2 flex items-center justify-between gap-3 text-sm"><span>{descricaoFormaRecebimento(f)}</span><b>{Number(f.valor).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</b></div>)}</div>}
      </section>
      <section className="mt-7 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{dados.tipo === 'pagar' ? 'Valor pago' : 'Valor recebido neste lançamento'}</span>
          <b className="text-2xl text-slate-900">{r.movimento}</b>
        </div>
        {dados.tipo==='receber'&&Number(dados.desconto||0)>0&&<p className="flex justify-between gap-4 text-sm"><span>Desconto / abatimento (não recebido em dinheiro)</span><b>{Number(dados.desconto).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</b></p>}
        <p className="flex justify-between gap-4 text-sm"><span>Valor total dos títulos considerados</span><b>{r.original}</b></p>
        <p className="flex justify-between gap-4 text-sm"><span>Saldo atual em aberto (consulta)</span><b>{r.saldo}</b></p>
      </section>
      <p className="mt-5 text-xs leading-relaxed text-slate-600">
        Este recibo comprova exclusivamente o valor do recebimento identificado acima.
        {dados.saldo > 0 ? ' Não representa quitação integral da obrigação.' : ' O saldo consultado está zerado.'}
        {' '}O saldo apresentado é a posição atual do título e pode ser diferente do saldo na data do pagamento.
      </p>
      {assinatura ? <section className="mt-11 flex flex-col items-center text-center">
        <img src={dados.assinaturaDataUri!} width={310} height={180} alt="Assinatura manuscrita autorizada da Esquadrifácio" className="h-[138px] w-[310px] object-contain" />
        <div className="w-[280px] border-t border-slate-500 pt-2">
          <p className="text-sm font-bold">Esquadrifácio — responsável autorizado</p>
          <p className="mt-1 text-[10px] text-slate-500">Reprodução da assinatura manuscrita autorizada pela empresa</p>
        </div>
      </section> : <div className="mt-24 grid grid-cols-2 gap-8 text-center text-xs">
        <div className="border-t border-slate-500 pt-2">Esquadrifácio</div>
        <div className="border-t border-slate-500 pt-2">{dados.tipo === 'pagar' ? dados.nome : 'Responsável / cliente'}</div>
      </div>}
      <p className="mt-10 border-t border-slate-100 pt-3 text-center text-[10px] text-slate-400">
        Documento emitido pelo Atlas One com base no recebimento registrado. Segunda via disponível no histórico do cliente.
      </p>
    </div>
  </div>
}
