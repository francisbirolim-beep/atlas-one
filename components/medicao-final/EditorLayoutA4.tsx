'use client'

import { useEffect, useState } from 'react'
import { Check, Eye, RotateCcw, Save, X } from 'lucide-react'
import type { MedicaoFinal, MedicaoItem } from '@/lib/tipos'
import { gerarPdfMedicaoFinal } from '@/lib/medicaoFinalPdf'
import {
  carregarLayoutMedicaoA4, LAYOUT_MEDICAO_A4_PADRAO,
  salvarLayoutMedicaoA4, type LayoutMedicaoA4,
} from '@/lib/medicaoFinalLayoutA4'

type Props = { fechar: () => void; medicao: MedicaoFinal; itens: MedicaoItem[] }

function Faixa({ titulo, valor, unidade, min, max, step = 1, alterar }: {
  titulo: string; valor: number; unidade: string; min: number; max: number; step?: number; alterar: (numero: number) => void
}) {
  return <label className="block space-y-1.5">
    <span className="flex items-center justify-between gap-3 text-sm font-medium text-slate-700">
      <span>{titulo}</span><span className="tabular-nums font-semibold text-brand-navy">{valor} {unidade}</span>
    </span>
    <input className="w-full accent-slate-800" type="range" min={min} max={max} step={step} value={valor}
      onChange={evento => alterar(Number(evento.target.value))} />
  </label>
}

function FolhaA4({ layout }: { layout: LayoutMedicaoA4 }) {
  const resumo = ['Cima 3090', 'Meio 3094', 'Baixo 3090', 'Esq. 2168', 'Meio 2172', 'Dir. 2177']
  const quantidade = layout.itensPorPagina
  return <div className="mx-auto w-full max-w-[370px] bg-white border border-slate-300 shadow-lg text-slate-900 p-[6%] aspect-[210/297] overflow-hidden" aria-label="Prévia de impressão em papel A4">
    <div className="text-[11px] font-bold border-b pb-2">ATLAS ONE — MEDIÇÃO FINAL</div>
    <div className="text-[8px] py-1.5 border-b">Cliente: Exemplo &nbsp; | &nbsp; Obra: Casa &nbsp; | &nbsp; Orçamento: 236</div>
    <div className="space-y-2 pt-2">
      {Array.from({ length: quantidade }).map((_, indice) => <section key={indice} className="border-b pb-1.5">
        <div className="text-[8px] font-bold mb-1">{indice + 1}. PORTA DE CORRER — ÁREA GOURMET</div>
        <div className="flex gap-1.5">
          <div className="w-[47%] shrink-0">
            {layout.exibirCroqui && <div className="flex items-center justify-center mb-1"
              style={{ height: 20 + (layout.larguraCroquiMm - 35) * .16 }}>
              <div className="border-[1.5px] border-slate-700 flex h-full" style={{ width: `${layout.larguraCroquiMm / 60 * 85}%` }}>
                {[0, 1, 2].map(x => <div key={x} className="flex-1 border-r border-slate-600 last:border-r-0" />)}
              </div>
            </div>}
            <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 leading-tight" style={{ fontSize: Math.max(6, layout.fonteMedidasPt * .95) }}>
              {resumo.map((v, i) => <span key={i} className="whitespace-nowrap">{v}</span>)}
            </div>
          </div>
          <div className="flex-1 border border-slate-200 min-w-0 text-[7px]">
            <div className="bg-emerald-50 p-1 font-semibold">MEDIDA DE PRODUÇÃO<br />3090 × 2168 mm</div>
            <div className="p-1 leading-tight" style={{ fontSize: layout.fonteChecklistPt * .9 }}>
              CHECKLIST<br />Contramarco: não<br />Trilho: embutido<br />Pedra: não
            </div>
          </div>
        </div>
        <div className="grid gap-1 mt-1.5" style={{ gridTemplateColumns: `repeat(${layout.fotosPorLinha}, minmax(0,1fr))` }}>
          {['Trena largura', 'Trena altura', 'Foto do vão'].map((foto, i) => <div key={i} className="border border-slate-300 min-w-0">
            <div className="bg-slate-100 flex items-center justify-center text-slate-400" style={{ height: layout.alturaFotoMm * 1.3 }}>
              <span className="text-[8px]">Foto</span>
            </div>
            <div className="text-[6px] text-center truncate">{foto}</div>
          </div>)}
        </div>
      </section>)}
    </div>
    <div className="text-[7px] text-slate-500 mt-2">Prévia ilustrativa — A4 vertical (210 × 297 mm)</div>
  </div>
}

export default function EditorLayoutA4({ fechar, medicao, itens }: Props) {
  const [layout, setLayout] = useState<LayoutMedicaoA4>({ ...LAYOUT_MEDICAO_A4_PADRAO })
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [previaUrl, setPreviaUrl] = useState<string | null>(null)
  const [gerandoPrevia, setGerandoPrevia] = useState(false)

  useEffect(() => {
    carregarLayoutMedicaoA4().then(valor => setLayout(valor)).finally(() => setCarregando(false))
  }, [])

  useEffect(() => () => { if (previaUrl) URL.revokeObjectURL(previaUrl) }, [previaUrl])

  const atualizar = <K extends keyof LayoutMedicaoA4>(chave: K, valor: LayoutMedicaoA4[K]) => {
    setPreviaUrl(null)
    setLayout(anterior => ({ ...anterior, [chave]: valor }))
    setSucesso(false)
    setErro('')
  }

  async function gerarPreviaReal() {
    setGerandoPrevia(true)
    setErro('')
    try {
      // Usa os mesmos itens, fotos, checklist e paginação do PDF que será impresso.
      const pdf = await gerarPdfMedicaoFinal(medicao, itens, false, layout)
      const url = URL.createObjectURL(pdf.output('blob'))
      setPreviaUrl(url)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível gerar a prévia de impressão.')
    } finally {
      setGerandoPrevia(false)
    }
  }

  async function salvar() {
    setSalvando(true)
    setErro('')
    try {
      const novo = await salvarLayoutMedicaoA4(layout)
      setLayout(novo)
      setSucesso(true)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return <div className="fixed inset-0 z-[100] bg-slate-950/60 flex items-start justify-center overflow-y-auto p-3 md:p-6" role="dialog" aria-modal="true" aria-label="Editar layout A4 da medição final">
    <div className="bg-slate-50 w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden">
      <div className="bg-white px-5 py-4 flex justify-between gap-4 border-b">
        <div><h2 className="font-bold text-lg text-slate-900">Editar layout da Medição Final</h2>
          <p className="text-xs text-slate-500">Papel A4 vertical. Ajustes só na impressão, sem alterar as medidas registradas.</p></div>
        <button type="button" onClick={fechar} className="p-2 h-fit hover:bg-slate-100 rounded-full" aria-label="Fechar"><X size={20} /></button>
      </div>
      <div className="grid lg:grid-cols-[330px_1fr] gap-5 p-4 md:p-6">
        <div className="space-y-5">
          <fieldset disabled={carregando || salvando} className="space-y-5">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Medições por folha A4</span>
              <select className="w-full rounded-xl border border-slate-300 bg-white p-2 text-sm" value={layout.itensPorPagina}
                onChange={e => atualizar('itensPorPagina', Number(e.target.value) as 1|2|3)}>
                <option value={1}>1 medição por página</option><option value={2}>2 medições por página</option><option value={3}>Até 3 medições por página</option>
              </select>
            </label>
            <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={layout.exibirCroqui} className="h-4 w-4 accent-slate-800" onChange={e => atualizar('exibirCroqui', e.target.checked)} />
              Mostrar croqui na impressão
            </label>
            {layout.exibirCroqui && <Faixa titulo="Largura do croqui" valor={layout.larguraCroquiMm} unidade="mm" min={35} max={60} alterar={v => atualizar('larguraCroquiMm', v)} />}
            <Faixa titulo="Tamanho dos números da medição" valor={layout.fonteMedidasPt} unidade="pt" min={6} max={12} step={.5} alterar={v => atualizar('fonteMedidasPt', v)} />
            <Faixa titulo="Altura dos quadros de fotos" valor={layout.alturaFotoMm} unidade="mm" min={25} max={58} alterar={v => atualizar('alturaFotoMm', v)} />
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Fotos por linha</span>
              <select className="w-full rounded-xl border border-slate-300 bg-white p-2 text-sm" value={layout.fotosPorLinha}
                onChange={e => atualizar('fotosPorLinha', Number(e.target.value) as 2|3|4)}>
                <option value={2}>2 fotos (maiores)</option><option value={3}>3 fotos</option><option value={4}>4 fotos (menores)</option>
              </select>
            </label>
            <Faixa titulo="Texto do checklist" valor={layout.fonteChecklistPt} unidade="pt" min={6.2} max={9} step={.2} alterar={v => atualizar('fonteChecklistPt', v)} />
          </fieldset>
          <p className="text-xs text-slate-500">Se os elementos não couberem juntos, o PDF abre outra folha A4 em vez de reduzir as fotos ou cortar informações.</p>
          {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
          {sucesso && <p role="status" className="text-sm text-emerald-700 flex gap-2 items-center"><Check size={16} /> Padrão salvo para todos os usuários da empresa.</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={salvando || carregando || gerandoPrevia} onClick={() => void gerarPreviaReal()}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white py-2.5 px-4 disabled:opacity-50 text-sm"><Eye size={16} />{gerandoPrevia ? 'Gerando PDF...' : 'Conferir PDF real'}</button>
            <button type="button" disabled={salvando || carregando} onClick={salvar}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white py-2.5 px-4 disabled:opacity-50 text-sm"><Save size={16} />{salvando ? 'Salvando...' : 'Salvar para todos'}</button>
            <button type="button" disabled={salvando || carregando} onClick={() => { setPreviaUrl(null); setLayout({ ...LAYOUT_MEDICAO_A4_PADRAO }); setSucesso(false) }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white py-2.5 px-4 text-sm"><RotateCcw size={16} />Restaurar original</button>
          </div>
          <p className="text-xs text-slate-400">Restaurar original só altera a prévia. Use “Salvar para todos” para confirmar a mudança.</p>
        </div>
        <div className="bg-slate-200/70 rounded-xl p-3 md:p-5">
          <p className="text-center text-sm text-slate-600 font-medium mb-3">Pré-visualização do papel A4</p>
          {previaUrl ? (
            <iframe title="Prévia real de impressão PDF A4" src={previaUrl} className="w-full h-[620px] bg-white rounded-lg border border-slate-300" />
          ) : (
            <><FolhaA4 layout={layout} />
            <p className="text-xs text-center text-slate-500 mt-3">Visualização ilustrativa. Clique em “Conferir PDF real” para conferir o resultado com as fotos e medidas do cliente.</p></>
          )}
        </div>
      </div>
    </div>
  </div>
}
