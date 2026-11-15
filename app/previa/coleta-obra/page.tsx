'use client'

import { useState } from 'react'
import { ArrowLeft, Camera, Check, ChevronDown, ChevronUp, ClipboardList, Copy, FileText, ImagePlus, Info, LayoutGrid, Plus, Ruler, Trash2, X } from 'lucide-react'

type Tipo = 'sob_medida' | 'medida_padrao' | 'kit_porta_pronta' | 'material_avulso'
type Medida = 'comum' | 'final'
type Item = {
  id: number
  tipo: Tipo | null
  ambiente: string
  medida: Medida
  largura: string
  altura: string
  quantidade: string
  descricao: string
  contramarco: 'herdar' | 'com' | 'sem'
  cor: string
  observacaoGeral: string
  observacaoCliente: string
  observacaoProducao: string
  fotos: { nome: string; url: string }[]
  aberto: boolean
}

const tipos: {id: Tipo; nome: string; descricao: string}[] = [
  {id: 'sob_medida', nome: 'Sob medida', descricao: 'Esquadrias feitas para a obra'},
  {id: 'medida_padrao', nome: 'Medida padrão', descricao: 'Produto pronto ou padrão'},
  {id: 'kit_porta_pronta', nome: 'Kit porta pronta', descricao: 'Kit com medidas próprias'},
  {id: 'material_avulso', nome: 'Material avulso', descricao: 'Perfis e acessórios'},
]
const tipoNome = (tipo: Tipo | null) => tipos.find(t => t.id === tipo)?.nome || 'Escolher tipo'
function novo(id: number): Item {
  return {
    id, tipo: null, ambiente: '', medida: 'comum', largura: '', altura: '',
    quantidade: '1', descricao: '', contramarco: 'herdar', cor: '',
    observacaoGeral: '', observacaoCliente: '', observacaoProducao: '',
    fotos: [], aberto: true,
  }
}
const campo = 'w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
const rotulo = 'mb-1.5 block text-xs font-semibold text-slate-600'
const painel = 'rounded-2xl border border-slate-200 bg-white shadow-sm'
const secundario = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:border-blue-300 hover:text-blue-700'

export default function PreviaColetaObraPage() {
  const [cliente, setCliente] = useState('')
  const [obra, setObra] = useState('')
  const [cidade, setCidade] = useState('')
  const [corGeral, setCorGeral] = useState('')
  const [contramarcoGeral, setContramarcoGeral] = useState<'com' | 'sem' | 'indefinido'>('indefinido')
  const [itens, setItens] = useState<Item[]>([novo(1)])
  const [seq, setSeq] = useState(2)
  const [resumo, setResumo] = useState(false)

  function alterar(id: number, patch: Partial<Item>) {
    setItens(lista => lista.map(item => item.id === id ? {...item, ...patch} : item))
  }
  function adicionar() {
    setItens(lista => [...lista.map(item => ({...item, aberto: false})), novo(seq)])
    setSeq(n => n + 1)
  }
  function duplicar(item: Item) {
    setItens(lista => [...lista.map(i => ({...i, aberto: false})), {...item, id: seq, aberto: true, fotos: [...item.fotos]}])
    setSeq(n => n + 1)
  }
  function tirar(id: number) {
    setItens(lista => lista.filter(item => item.id !== id))
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="sticky top-0 z-20 border-b border-blue-900/30 bg-slate-950 text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600"><Ruler size={20}/></div>
            <div>
              <p className="text-sm font-extrabold tracking-wide">ATLAS ONE <span className="font-normal text-blue-300">/ Prévia</span></p>
              <p className="text-[11px] text-slate-300">Coleta rápida de orçamento na obra</p>
            </div>
          </div>
          <div className="rounded-full border border-amber-300/40 bg-amber-400/15 px-3 py-1.5 text-[11px] font-extrabold text-amber-200">
            DEMONSTRAÇÃO · NÃO SALVA PEDIDOS
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl space-y-4 px-3 pb-28 pt-5 sm:px-6 sm:pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-blue-600">Etapa de levantamento</p>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">Novo orçamento <span className="font-medium text-slate-400">/ Obra</span></h1>
            <p className="mt-1 text-sm text-slate-500">Preencha só o essencial. Linha e tipologia serão definidas no escritório.</p>
          </div>
          <a href="/" className={secundario}><ArrowLeft size={15}/> Voltar ao Atlas</a>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900">
          <span className="mr-1 inline-flex align-middle"><Info size={16}/></span>
          Esta é uma prévia isolada para avaliar a tela. Você pode digitar, anexar fotos, duplicar cartões e visualizar o resumo. Nada é enviado ou gravado no Atlas real.
        </div>

        <section className={painel + ' p-4 sm:p-5'}>
          <div className="mb-4 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-700"><ClipboardList size={19}/></span>
            <div>
              <h2 className="text-base font-extrabold">Cliente e obra</h2>
              <p className="text-xs text-slate-500">Identificação do atendimento</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div><label className={rotulo}>Cliente</label><input className={campo} value={cliente} onChange={e=>setCliente(e.target.value)} placeholder="Nome do cliente"/></div>
            <div><label className={rotulo}>Nome da obra / local</label><input className={campo} value={obra} onChange={e=>setObra(e.target.value)} placeholder="Ex.: Residência / reforma"/></div>
            <div><label className={rotulo}>Cidade</label><input className={campo} value={cidade} onChange={e=>setCidade(e.target.value)} placeholder="Cidade da obra"/></div>
            <div><label className={rotulo}>Cor geral (opcional)</label><input className={campo} value={corGeral} onChange={e=>setCorGeral(e.target.value)} placeholder="Ex.: Preto fosco"/></div>
            <div className="sm:col-span-2">
              <label className={rotulo}>Contramarco geral</label>
              <div className="grid grid-cols-3 gap-2">
                {([['indefinido','A definir'],['com','Com'],['sem','Sem']] as const).map(([value,label])=>
                  <button key={value} type="button" onClick={()=>setContramarcoGeral(value)} className={'rounded-xl border px-2 py-2.5 text-xs font-semibold ' + (contramarcoGeral===value?'border-blue-700 bg-blue-700 text-white':'border-slate-200 bg-white text-slate-600')}>{label}</button>)}
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-extrabold">Esquadrias do orçamento</h2>
              <p className="text-xs text-slate-500">{itens.length} {itens.length === 1 ? 'item' : 'itens'} no levantamento</p>
            </div>
            <button type="button" onClick={adicionar} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-3 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-800"><Plus size={17}/> Adicionar esquadria</button>
          </div>
          <div className="space-y-3">
            {itens.map((item, index) => (
              <article key={item.id} className={painel + ' overflow-hidden'}>
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-white px-3 py-3 sm:px-5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-xs font-extrabold text-white">{String(index + 1).padStart(2,'0')}</span>
                  <button type="button" onClick={()=>alterar(item.id,{aberto:!item.aberto})} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-extrabold">{item.ambiente || 'Nova esquadria'}</span>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">{tipoNome(item.tipo)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{item.descricao || 'Descreva o que será orçado'}{item.largura && item.altura ? ' · ' + item.largura + ' × ' + item.altura + ' mm' : ''}</p>
                  </button>
                  <button type="button" onClick={()=>duplicar(item)} title="Duplicar esquadria" aria-label={'Duplicar esquadria ' + (index+1)} className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700"><Copy size={17}/></button>
                  <button type="button" onClick={()=>tirar(item.id)} title="Remover esquadria" aria-label={'Remover esquadria ' + (index+1)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={17}/></button>
                  <button type="button" onClick={()=>alterar(item.id,{aberto:!item.aberto})} aria-label={item.aberto?'Recolher cartão':'Expandir cartão'} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">{item.aberto ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}</button>
                </div>
                {item.aberto && (
                  <div className="space-y-4 p-3 sm:p-5">
                    <div>
                      <p className={rotulo}>O que vai adicionar?</p>
                      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                        {tipos.map(tipo=><button type="button" key={tipo.id} onClick={()=>alterar(item.id,{tipo:tipo.id})} className={'min-h-16 rounded-xl border px-3 py-2.5 text-left transition ' + (item.tipo===tipo.id?'border-blue-700 bg-blue-50 ring-1 ring-blue-700':'border-slate-200 bg-slate-50 hover:bg-blue-50')}>
                          <span className={'block text-xs font-extrabold ' + (item.tipo===tipo.id?'text-blue-800':'text-slate-800')}>{tipo.nome}</span>
                          <span className="mt-1 block text-[10px] leading-4 text-slate-500">{tipo.descricao}</span>
                        </button>)}
                      </div>
                    </div>
                    {item.tipo && <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className={rotulo}>Ambiente</label>
                          <input className={campo} value={item.ambiente} onChange={e=>alterar(item.id,{ambiente:e.target.value})} placeholder="Ex.: Sala, cozinha, suíte 01"/>
                        </div>
                        <div>
                          <label className={rotulo}>Tipo de medida</label>
                          <div className="grid grid-cols-2 gap-2">
                            {([['comum','Medida comum'],['final','Medida final']] as const).map(([v,label])=>
                              <button type="button" key={v} onClick={()=>alterar(item.id,{medida:v})} className={'rounded-xl border px-3 py-2.5 text-xs font-bold ' + (item.medida===v?'border-emerald-700 bg-emerald-50 text-emerald-800':'border-slate-200 text-slate-600')}>{label}</button>)}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        <div><label className={rotulo}>Largura (mm)</label><input type="number" inputMode="decimal" min="0" className={campo} value={item.largura} onChange={e=>alterar(item.id,{largura:e.target.value})} placeholder="1800"/></div>
                        <div><label className={rotulo}>Altura (mm)</label><input type="number" inputMode="decimal" min="0" className={campo} value={item.altura} onChange={e=>alterar(item.id,{altura:e.target.value})} placeholder="2100"/></div>
                        <div><label className={rotulo}>Qtd.</label><input type="number" inputMode="numeric" min="1" className={campo} value={item.quantidade} onChange={e=>alterar(item.id,{quantidade:e.target.value})} placeholder="1"/></div>
                      </div>
                      {item.medida==='final' && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-900">Medida final selecionada. Na versão oficial, manteremos a coleta já existente de três larguras, três alturas e fotos da trena. Nenhum cálculo será removido.</div>}
                      <div>
                        <label className={rotulo}>O que você precisa? <span className="font-normal text-slate-400">(descrição livre)</span></label>
                        <textarea rows={3} className={campo + ' resize-y'} value={item.descricao} onChange={e=>alterar(item.id,{descricao:e.target.value})} placeholder="Ex.: Porta de correr, 3 folhas, com reforço e fechadura..."/>
                        {item.tipo==='sob_medida' && <p className="mt-1.5 text-[11px] text-blue-700">Sem escolher linha ou tipologia nesta visita. O escritório define depois.</p>}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className={rotulo}>Contramarco desta esquadria</label>
                          <div className="grid grid-cols-3 gap-2">
                            {([['herdar','Usar geral'],['com','Com'],['sem','Sem']] as const).map(([v,label])=>
                              <button type="button" key={v} onClick={()=>alterar(item.id,{contramarco:v})} className={'rounded-xl border px-1 py-2.5 text-[11px] font-bold ' + (item.contramarco===v?'border-blue-700 bg-blue-700 text-white':'border-slate-200 text-slate-600')}>{label}</button>)}
                          </div>
                        </div>
                        <div><label className={rotulo}>Cor desta esquadria <span className="font-normal text-slate-400">(opcional)</span></label><input className={campo} value={item.cor} onChange={e=>alterar(item.id,{cor:e.target.value})} placeholder="Somente se diferente da cor geral"/></div>
                      </div>
                      <div>
                        <label className={rotulo}>Fotos da esquadria</label>
                        <div className="flex flex-wrap gap-2">
                          {item.fotos.map((foto,i)=><div key={i} className="relative h-20 w-20 overflow-hidden rounded-xl border border-slate-200">
                            <img src={foto.url} alt={foto.nome} className="h-full w-full object-cover"/>
                            <button type="button" aria-label="Remover foto" onClick={()=>alterar(item.id,{fotos:item.fotos.filter((_,j)=>i!==j)})} className="absolute right-0 top-0 rounded-bl-md bg-red-600 p-1 text-white"><X size={13}/></button>
                          </div>)}
                          <label className="flex h-20 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-xs font-semibold text-slate-600 hover:border-blue-400">
                            <Camera size={19}/>Adicionar foto
                            <input type="file" accept="image/*" multiple className="hidden" onChange={e=>{
                              const arquivos=Array.from(e.target.files||[]).filter(f=>f.type.startsWith('image/')).slice(0,10)
                              alterar(item.id,{fotos:[...item.fotos,...arquivos.map(f=>({nome:f.name,url:URL.createObjectURL(f)}))]})
                              e.target.value=''
                            }}/>
                          </label>
                        </div>
                      </div>
                      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div><label className={rotulo}>Observação geral da esquadria <span className="font-normal text-blue-700">(novo)</span></label>
                          <textarea rows={2} className={campo + ' resize-y'} value={item.observacaoGeral} onChange={e=>alterar(item.id,{observacaoGeral:e.target.value})} placeholder="Detalhes da obra e orientações gerais para o orçamentista..."/></div>
                        <details>
                          <summary className="cursor-pointer py-1 text-xs font-bold text-slate-600">Observações específicas para cliente e produção (opcionais)</summary>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <div><label className={rotulo}>Para o cliente</label><textarea rows={2} className={campo} value={item.observacaoCliente} onChange={e=>alterar(item.id,{observacaoCliente:e.target.value})}/></div>
                            <div><label className={rotulo}>Para produção</label><textarea rows={2} className={campo} value={item.observacaoProducao} onChange={e=>alterar(item.id,{observacaoProducao:e.target.value})}/></div>
                          </div>
                        </details>
                      </div>
                      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                        <button type="button" onClick={()=>duplicar(item)} className={secundario}><Copy size={15}/> Duplicar esquadria</button>
                        <button type="button" onClick={()=>alterar(item.id,{aberto:false})} className={secundario}><Check size={15}/> Concluir este cartão</button>
                      </div>
                    </>}
                  </div>
                )}
              </article>
            ))}
          </div>
          <button type="button" onClick={adicionar} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 px-3 py-3.5 text-sm font-extrabold text-blue-700 transition hover:bg-blue-100"><Plus size={18}/> Adicionar outra esquadria</button>
        </section>
        <div className="flex flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:justify-between">
          <p>Sem bloco de arquivos gerais: as fotos permanecem dentro de cada esquadria.</p>
          <p>Visualização de teste · sem conexão com clientes reais</p>
        </div>
      </main>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <p className="hidden text-xs font-semibold text-slate-600 sm:block">{itens.length} itens no levantamento · Não salva pedidos reais</p>
          <button type="button" onClick={adicionar} className={secundario}><Plus size={16}/> Adicionar</button>
          <button type="button" onClick={()=>setResumo(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-extrabold text-white hover:bg-blue-800"><FileText size={17}/> Visualizar resumo</button>
        </div>
      </div>
      {resumo && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3" role="dialog" aria-modal="true" aria-label="Resumo da coleta">
        <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
          <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-xl font-extrabold">Resumo da coleta</h2><p className="text-xs text-amber-700">Demonstração — nenhum pedido será enviado</p></div><button aria-label="Fechar resumo" type="button" onClick={()=>setResumo(false)} className="rounded-lg p-2 hover:bg-slate-100"><X size={20}/></button></div>
          <div className="rounded-xl bg-blue-50 p-3 text-sm"><b>Cliente:</b> {cliente||'Não informado'}<br/><b>Obra:</b> {obra||'Não informada'}<br/><b>Cidade:</b> {cidade||'Não informada'}</div>
          <div className="mt-3 space-y-2">
            {itens.map((item,index)=><div key={item.id} className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm font-extrabold">{String(index+1).padStart(2,'0')} · {item.ambiente||'Sem ambiente'} · {tipoNome(item.tipo)}</p>
              <p className="mt-1 text-xs text-slate-600">{item.medida==='comum'?'Medida comum':'Medida final'} · {item.largura||'—'} × {item.altura||'—'} mm · {item.quantidade||'—'} un.</p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{item.descricao||'Descrição não informada'}</p>
              {item.observacaoGeral && <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1.5 text-xs"><b>Observação geral:</b> {item.observacaoGeral}</p>}
              {item.fotos.length>0 && <p className="mt-2 text-xs text-blue-700">{item.fotos.length} foto(s) adicionada(s)</p>}
            </div>)}
          </div>
          <button type="button" onClick={()=>setResumo(false)} className="mt-4 w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white">Voltar à edição</button>
        </div>
      </div>}
    </div>
  )
}
