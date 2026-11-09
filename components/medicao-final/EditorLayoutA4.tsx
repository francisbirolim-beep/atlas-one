'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ExternalLink, Eye, Loader2, RotateCcw, Save, X } from 'lucide-react'
import type { MedicaoFinal, MedicaoItem } from '@/lib/tipos'
import { gerarPdfMedicaoFinal } from '@/lib/medicaoFinalPdf'
import {
  consultarConfiguracaoLayoutMedicaoA4, LAYOUT_MEDICAO_A4_PADRAO,
  restaurarLayoutGeralDaObra, salvarLayoutMedicaoA4, type LayoutMedicaoA4,
} from '@/lib/medicaoFinalLayoutA4'

type Props = { fechar: () => void; medicao: MedicaoFinal; itens: MedicaoItem[]; obraId?: string | null; podeEditar?: boolean }

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

export default function EditorLayoutA4({ fechar, medicao, itens, obraId, podeEditar = false }: Props) {
  const [layout, setLayout] = useState<LayoutMedicaoA4>({ ...LAYOUT_MEDICAO_A4_PADRAO })
  const [origem, setOrigem] = useState<'obra' | 'geral'>('geral')
  const [carregando, setCarregando] = useState(true)
  const [configuracaoDisponivel, setConfiguracaoDisponivel] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [previaUrl, setPreviaUrl] = useState<string | null>(null)
  const [gerandoPrevia, setGerandoPrevia] = useState(false)
  const geracaoAtual = useRef(0)

  const recarregarConfiguracao = useCallback(async () => {
    const configuracao = await consultarConfiguracaoLayoutMedicaoA4({
      ...(obraId ? { obraId } : {}), medicaoId: medicao.id,
    })
    setOrigem(configuracao.origem)
    setLayout(configuracao.layout)
    return configuracao
  }, [obraId, medicao.id])

  useEffect(() => {
    let montado = true
    setCarregando(true)
    setConfiguracaoDisponivel(false)
    recarregarConfiguracao()
      .then(() => { if (montado) setConfiguracaoDisponivel(true) })
      .catch(e => { if (montado) setErro(e instanceof Error ? e.message : 'Falha ao carregar layout da obra.') })
      .finally(() => { if (montado) setCarregando(false) })
    return () => { montado = false }
  }, [recarregarConfiguracao])

  // Um único PDF real: o mesmo renderizador usado na emissão final.
  // Alterações do controle têm debounce para não travar a tela ao arrastar os sliders.
  const atualizarPreviaReal = useCallback(async (layoutAtual: LayoutMedicaoA4, numeroGeracao: number) => {
    setGerandoPrevia(true)
    try {
      const pdf = await gerarPdfMedicaoFinal(medicao, itens, false, layoutAtual)
      const url = URL.createObjectURL(pdf.output('blob'))
      if (numeroGeracao !== geracaoAtual.current) {
        URL.revokeObjectURL(url)
        return
      }
      setPreviaUrl(url)
      setErro('')
    } catch (e) {
      if (numeroGeracao === geracaoAtual.current) {
        setErro(e instanceof Error ? e.message : 'Não foi possível gerar a prévia A4.')
      }
    } finally {
      if (numeroGeracao === geracaoAtual.current) setGerandoPrevia(false)
    }
  }, [medicao, itens])

  useEffect(() => {
    if (carregando || !configuracaoDisponivel) return
    const numero = ++geracaoAtual.current
    const tempo = setTimeout(() => { void atualizarPreviaReal(layout, numero) }, 400)
    return () => clearTimeout(tempo)
  }, [layout, carregando, configuracaoDisponivel, atualizarPreviaReal])

  useEffect(() => () => { if (previaUrl) URL.revokeObjectURL(previaUrl) }, [previaUrl])
  useEffect(() => () => { geracaoAtual.current++ }, [])

  const atualizar = <K extends keyof LayoutMedicaoA4>(chave: K, valor: LayoutMedicaoA4[K]) => {
    setLayout(anterior => ({ ...anterior, [chave]: valor }))
    setSucesso('')
  }

  async function salvar(escopo: 'obra' | 'geral') {
    if (escopo === 'obra' && !obraId) return
    setSalvando(true)
    setErro('')
    setSucesso('')
    try {
      await salvarLayoutMedicaoA4(layout, escopo === 'obra' ? { obraId } : undefined)
      const configuracao = await recarregarConfiguracao()
      setSucesso(escopo === 'obra'
        ? 'Layout exclusivo desta obra salvo. As demais obras não foram alteradas.'
        : configuracao.origem === 'obra'
          ? 'Padrão geral salvo para todos. Esta obra continua com seu layout exclusivo até você restaurar o padrão geral.'
          : 'Padrão de impressão salvo para todas as obras e usuários da empresa.')
      window.dispatchEvent(new Event('atlas-medicao-layout-atualizado'))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar o layout.')
    } finally {
      setSalvando(false)
    }
  }

  async function restaurarPadraoDaObra() {
    if (!obraId) return
    setSalvando(true)
    setErro('')
    setSucesso('')
    try {
      await restaurarLayoutGeralDaObra(obraId)
      await recarregarConfiguracao()
      setSucesso('Personalização desta obra removida. Ela voltou a utilizar o padrão geral da empresa.')
      window.dispatchEvent(new Event('atlas-medicao-layout-atualizado'))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível restaurar o padrão da obra.')
    } finally {
      setSalvando(false)
    }
  }

  return <div className="fixed inset-0 z-[100] bg-slate-950/60 flex items-start justify-center overflow-y-auto p-3 md:p-6" role="dialog" aria-modal="true" aria-label="Prévia e edição do PDF A4 da medição final">
    <div className="bg-slate-50 w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden">
      <div className="bg-white px-5 py-4 flex justify-between gap-4 border-b">
        <div>
          <h2 className="font-bold text-lg text-slate-900">Prévia e edição do PDF — Medida Final</h2>
          <p className="text-xs text-slate-500">A4 vertical · visualize o boletim verdadeiro e ajuste os espaços sem alterar as medidas.</p>
          {obraId && <p className="mt-1 text-xs font-semibold text-blue-700">{origem === 'obra' ? 'Layout exclusivo desta obra' : 'Esta obra utiliza o layout padrão da empresa'}</p>}
        </div>
        <button type="button" onClick={fechar} className="p-2 h-fit hover:bg-slate-100 rounded-full" aria-label="Fechar"><X size={20} /></button>
      </div>
      <div className="grid lg:grid-cols-[325px_1fr] gap-5 p-4 md:p-6">
        <div className="space-y-5">
          <fieldset disabled={!podeEditar || carregando || salvando || !configuracaoDisponivel} className="space-y-5">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Medições por folha A4</span>
              <select className="w-full rounded-xl border border-slate-300 bg-white p-2 text-sm" value={layout.itensPorPagina}
                onChange={e => atualizar('itensPorPagina', Number(e.target.value) as 1|2|3)}>
                <option value={1}>1 medição por página</option><option value={2}>2 medições por página</option><option value={3}>Até 3 medições por página</option>
              </select>
            </label>
            <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={layout.exibirCroqui} className="h-4 w-4 accent-slate-800" onChange={e => atualizar('exibirCroqui', e.target.checked)} /> Mostrar croqui na impressão
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
          <p className="text-xs text-slate-500">A prévia real atualiza automaticamente depois de cada ajuste. Se não couber em uma página A4, o PDF continua na próxima folha sem cortar fotos ou checklist.</p>
          {erro && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{erro}</p>}
          {sucesso && <p role="status" className="text-sm text-emerald-700 flex gap-2 items-start"><Check size={17} className="shrink-0 mt-0.5" /> {sucesso}</p>}
          {!podeEditar && <p className="text-xs font-semibold text-blue-800">Prévia disponível para consulta. Somente o usuário Master pode editar e salvar o layout.</p>}
          {podeEditar && <div className="flex flex-wrap gap-2">
            {obraId && <button type="button" disabled={salvando || carregando || !configuracaoDisponivel} onClick={() => void salvar('obra')}
              className="inline-flex items-center gap-2 rounded-full bg-blue-700 text-white py-2.5 px-4 disabled:opacity-50 text-sm"><Save size={16} />{salvando ? 'Salvando...' : 'Salvar somente nesta obra'}</button>}
            <button type="button" disabled={salvando || carregando || !configuracaoDisponivel} onClick={() => void salvar('geral')}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white py-2.5 px-4 disabled:opacity-50 text-sm"><Save size={16} />{salvando ? 'Salvando...' : 'Salvar padrão para todos'}</button>
            <button type="button" disabled={carregando || salvando || !configuracaoDisponivel} onClick={() => { setLayout({ ...LAYOUT_MEDICAO_A4_PADRAO }); setSucesso('') }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white py-2.5 px-4 text-sm"><RotateCcw size={16} />Voltar ao desenho original</button>
            {obraId && origem === 'obra' && <button type="button" disabled={salvando || carregando} onClick={() => void restaurarPadraoDaObra()}
              className="inline-flex items-center gap-2 rounded-full border border-blue-300 bg-blue-50 text-blue-800 py-2.5 px-4 text-sm"><RotateCcw size={16} />Usar o padrão geral nesta obra</button>}
          </div>}
          <p className="text-xs text-slate-400">Voltar ao desenho original só altera a prévia até você clicar em um dos botões de salvar. O padrão geral não substitui layouts exclusivos já salvos em outras obras.</p>
        </div>
        <div className="bg-slate-200/70 rounded-xl p-3 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <p className="inline-flex items-center gap-2 text-sm text-slate-700 font-semibold"><Eye size={16} /> Prévia real · papel A4 (210 × 297 mm)</p>
            {previaUrl && <a href={previaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700"><ExternalLink size={13} />Abrir PDF / imprimir</a>}
          </div>
          {carregando || gerandoPrevia ? <p role="status" className="mb-2 flex items-center gap-2 text-sm text-slate-600"><Loader2 size={15} className="animate-spin" />{carregando ? 'Carregando configuração...' : 'Atualizando PDF com as medidas e fotos...'}</p> : null}
          {previaUrl ? <iframe title="Prévia real do PDF de Medida Final em folha A4" src={previaUrl} className="w-full h-[650px] bg-white rounded-lg border border-slate-300" /> :
            <><FolhaA4 layout={layout} />
            <p className="text-xs text-center text-slate-500 mt-3">{configuracaoDisponivel ? 'Gerando a prévia real da medição...' : 'Prévia ilustrativa até carregar o layout salvo.'}</p></>}
        </div>
      </div>
    </div>
  </div>
}
