'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { descricaoFormaRecibo, type ReciboInfo, textoRecibo } from '@/lib/financeiroRecibos'

type AcaoRecibo = 'imprimir' | 'pdf' | null

export default function ReciboImpressao({
  dados, acaoInicial = null,
}: {
  dados: ReciboInfo
  acaoInicial?: AcaoRecibo
}) {
  const r = textoRecibo(dados)
  // Observações legadas podem repetir a anotação automática de desconto.
  // O desconto permanece registrado na linha financeira abaixo, uma única vez.
  const observacoes = dados.tipo === 'receber'
    ? dados.descricao?.replace(/(?:Desconto concedido nesta baixa:\s*R\$\s*[0-9.,]+\s*)+/gi, ' ').trim()
    : dados.descricao
  const moeda = (v:number) => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
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
      const alturaOriginalMm = canvas.height * maxLargura / canvas.width
      if (dados.consolidado && alturaOriginalMm > maxAltura) {
        // Mantém a fonte legível em recibos com muitos pagamentos: uma imagem por página.
        const alturaFatia = Math.floor(maxAltura * canvas.width / maxLargura)
        for (let y = 0, pagina = 0; y < canvas.height; y += alturaFatia, pagina++) {
          if (pagina > 0) pdf.addPage()
          const alturaPx = Math.min(alturaFatia, canvas.height - y)
          const fatia = document.createElement('canvas')
          fatia.width = canvas.width
          fatia.height = alturaPx
          const ctx = fatia.getContext('2d')
          if (!ctx) throw new Error('Não foi possível preparar a página do PDF.')
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, fatia.width, fatia.height)
          ctx.drawImage(canvas, 0, y, canvas.width, alturaPx, 0, 0, canvas.width, alturaPx)
          pdf.addImage(fatia.toDataURL('image/jpeg', 0.96), 'JPEG', 10, 10, maxLargura, alturaPx * maxLargura / canvas.width)
        }
      } else {
        let largura = maxLargura
        let altura = alturaOriginalMm
        if (altura > maxAltura) { largura *= maxAltura / altura; altura = maxAltura }
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.96), 'JPEG', (210 - largura) / 2, 10, largura, altura)
      }
      pdf.save('recibo-esquadrifacio-' + (dados.consolidado ? 'consolidado-' : '') + (dados.consolidado ? dados.id.replace(/^CONSOLIDADO-/, '').slice(0,12) : dados.id.slice(0,8)) + '.pdf')
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
  return <div className="atlas-recibo-documento mx-auto w-full max-w-[190mm] text-slate-900">
    <style jsx global>{`
      @page { size: A4 portrait; margin: 12mm; }
      @media print {
        html, body { width: auto !important; height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
        body { margin: 0 !important; padding: 0 !important; }
        .no-print, .atlas-sidebar-shell, .atlas-topbar, .atlas-mobile-navigation, .atlas-mobile-favorites { display: none !important; }
        .atlas-app-shell, .atlas-app-content, .atlas-app-main {
          display: block !important; width: 100% !important; max-width: none !important;
          height: auto !important; min-height: 0 !important; overflow: visible !important;
          padding: 0 !important; margin: 0 !important; background: #fff !important;
        }
        .atlas-recibo-pagina, .atlas-recibo-documento {
          display: block !important; width: 100% !important; max-width: none !important;
          min-height: 0 !important; padding: 0 !important; margin: 0 !important;
          background: #fff !important; box-shadow: none !important;
        }
        .atlas-recibo-papel {
          width: 100% !important; max-width: none !important; min-height: 0 !important;
          padding: 0 !important; margin: 0 !important; border: 0 !important;
          box-shadow: none !important; background: #fff !important;
          -webkit-print-color-adjust: exact; print-color-adjust: exact;
        }
        .atlas-recibo-papel header, .atlas-recibo-papel .atlas-recibo-item,
        .atlas-recibo-papel .atlas-recibo-resumo { break-inside: avoid-page; page-break-inside: avoid; }
      }
    `}</style>
    <div className="no-print mb-4 flex flex-wrap items-center justify-end gap-2">
      {erroPdf && <span role="alert" className="w-full text-sm text-red-700">{erroPdf}</span>}
      <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800">
        <Printer size={16}/>Imprimir
      </button>
      <button type="button" onClick={() => void gerarPdf()} disabled={gerandoPdf} className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
        <Download size={16}/>{gerandoPdf ? 'Gerando PDF...' : 'Baixar PDF'}
      </button>
    </div>
    <div ref={papelRef} className="atlas-recibo-papel box-border min-h-[660px] w-full bg-white p-8 shadow-sm print:min-h-0 print:p-0">
      <header className="border-b-2 border-slate-900 pb-5">
        <p className="text-xs font-black uppercase tracking-widest text-slate-900">ESQUADRIFÁCIO</p>
        <p className="mt-1 text-xs text-slate-600">Soluções em Alumínio</p>
        <h1 className="mt-5 text-2xl font-black tracking-tight">{dados.tipo === 'pagar' ? 'RECIBO DE PAGAMENTO' : dados.consolidado ? 'RECIBO CONSOLIDADO DE RECEBIMENTOS' : 'RECIBO DE RECEBIMENTO'}</h1>
        {dados.consolidado ? <p className="mt-2 text-xs text-slate-500">Comprovante conjunto de {dados.itens?.length || 0} lançamentos registrados. Referência: {dados.id}. Não gera novo recebimento.</p> : <p className="mt-2 text-xs text-slate-500">Identificador do recebimento: {dados.id}</p>}
        {dados.referencia && <p className="mt-1 text-xs text-slate-500">Referência: {dados.referencia}</p>}
      </header>
      <section className="mt-6 space-y-3 text-sm">
        <p><b>{dados.tipo === 'pagar' ? 'Beneficiário / recebedor' : 'Recebemos de'}:</b> {dados.nome}</p>
        {dados.documento && <p><b>CPF/CNPJ:</b> {dados.documento}</p>}
        {dados.obra && <p><b>Referente à obra:</b> {dados.obra}</p>}
        {observacoes && <p><b>Observações:</b> {observacoes}</p>}
        <p><b>{dados.consolidado ? 'Data do último recebimento' : dados.tipo === 'pagar' ? 'Data do pagamento' : 'Data do recebimento'}:</b> {r.data}</p>
        {!dados.consolidado && <p><b>Forma de pagamento:</b> {descricaoFormaRecibo(dados.forma, dados.itens?.[0]?.cartaoParcelas)}</p>}
      </section>
      {dados.itens && dados.itens.length > 0 && <section className="mt-6">
        <h2 className="mb-3 text-sm font-bold text-slate-800">{dados.consolidado ? 'Recebimentos incluídos neste recibo' : 'Detalhamento do pagamento'}</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          {dados.itens.map((item, indice) => <div key={item.id} className="atlas-recibo-item border-b border-slate-200 p-3 text-xs last:border-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><b>Lançamento {indice + 1} · {item.data.slice(8,10)}/{item.data.slice(5,7)}/{item.data.slice(0,4)}</b>
                {item.obra && <p className="mt-1 text-slate-600">Obra: {item.obra}</p>}
                <p className="mt-1 text-slate-500">ID: {item.id}</p>
                {item.referencia && <p className="mt-1 text-slate-600">Referência: {item.referencia}</p>}
              </div>
              <b>{moeda(item.valor)}</b>
            </div>
            <div className="mt-2 space-y-1 border-t border-dashed pt-2">
              {item.formas?.length ? item.formas.map((forma, i) => <div key={i} className="flex justify-between gap-3"><span>{descricaoFormaRecibo(forma.forma, forma.parcelas)}</span><b>{moeda(forma.valor)}</b></div>) : <p>{descricaoFormaRecibo(item.forma, item.cartaoParcelas)}</p>}
            </div>
            {!!item.desconto && item.desconto > 0 && <p className="mt-2 flex justify-between gap-3 text-amber-800"><span>Desconto concedido</span><b>{moeda(item.desconto)}</b></p>}
          </div>)}
        </div>
      </section>}
      <section className="atlas-recibo-resumo mt-7 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{dados.tipo === 'pagar' ? 'Valor pago' : dados.consolidado ? 'Total efetivamente recebido' : 'Valor recebido neste lançamento'}</span>
          <b className="text-2xl text-slate-900">{r.movimento}</b>
        </div>
        {!dados.consolidado && <><p className="flex justify-between gap-4 text-sm"><span>Valor total dos títulos considerados</span><b>{r.original}</b></p>
        <p className="flex justify-between gap-4 text-sm"><span>Saldo atual em aberto (consulta)</span><b>{r.saldo}</b></p></>}
      </section>
      {dados.consolidado ? <p className="mt-5 text-xs leading-relaxed text-slate-600">Este documento reúne exclusivamente os recebimentos acima, sem criar novos lançamentos. Descontos não integram o valor efetivamente recebido. Não representa quitação integral de uma venda ou obrigação.</p> : <p className="mt-5 text-xs leading-relaxed text-slate-600">
        Este recibo comprova exclusivamente o valor do recebimento identificado acima.
        {dados.saldo > 0 ? ' Não representa quitação integral da obrigação.' : ' O saldo consultado está zerado.'}
        {' '}O saldo apresentado é a posição atual do título e pode ser diferente do saldo na data do pagamento.
      </p>}
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
