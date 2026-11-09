'use client'

import { useEffect, useMemo, useState } from 'react'
import { Image as ImageIcon, Plus, Printer, RefreshCw, Save, Search, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Produto } from '@/lib/tipos'
import './ClienteRomaneios.css'

type TipoRomaneio = 'pintura' | 'perfis' | 'vidros' | 'acessorios' | 'misto'
type Item = { produto_id: string; quantidade: number; medida: string; observacao: string }
type Registro = {
  id?: string; numero?: number; cliente_id: string; obra_id: string | null
  cliente_nome_impresso: string; obra_nome_impresso: string; endereco_obra: string
  tipo: TipoRomaneio; data_emissao: string; destino: string; cor: string
  codigo_cor: string; acabamento: string; observacoes: string
  entregue_por: string; recebido_por: string
  status: 'rascunho' | 'aguardando_envio' | 'enviado' | 'recebido' | 'concluido'
  itens: Item[]
}
type Obra = { id: string; nome: string; endereco?: string | null; cidade?: string | null }
type Props = { clienteId: string; clienteNome: string; obras: Obra[]; podeEditar: boolean }
const MAX_ITENS_A4 = 10
const TIPOS: {id: TipoRomaneio; nome: string}[] = [
  {id:'pintura',nome:'Pintura'}, {id:'perfis',nome:'Perfis'}, {id:'vidros',nome:'Vidros'},
  {id:'acessorios',nome:'Acessórios'}, {id:'misto',nome:'Misto'},
]
const ESTADOS: {id:Registro['status'];nome:string}[] = [
  {id:'rascunho',nome:'Rascunho'}, {id:'aguardando_envio',nome:'Aguardando envio'},
  {id:'enviado',nome:'Enviado'}, {id:'recebido',nome:'Recebido'}, {id:'concluido',nome:'Concluído'},
]
const hoje = () => new Date().toLocaleDateString('en-CA', {timeZone:'America/Sao_Paulo'})
function vazio(clienteId:string, nome:string): Registro {
  return {cliente_id:clienteId, obra_id:null, cliente_nome_impresso:nome, obra_nome_impresso:'',
    endereco_obra:'', tipo:'pintura', data_emissao:hoje(), destino:'Pintura eletrostática',
    cor:'', codigo_cor:'', acabamento:'', observacoes:'', entregue_por:'', recebido_por:'',
    status:'rascunho', itens:[]}
}
const pad = (n:number) => 'ROM-' + String(n).padStart(6,'0')
const dataBR = (s:string) => s ? s.split('-').reverse().join('/') : '—'
const sanitizarBusca = (v:string) => v.replace(/[^a-zA-ZÀ-ÿ0-9 _-]/g,' ').trim().slice(0,90)

export default function ClienteRomaneios({clienteId,clienteNome,obras,podeEditar}: Props) {
  const [registros,setRegistros] = useState<Registro[]>([])
  const [atual,setAtual] = useState<Registro|null>(null)
  const [catalogo,setCatalogo] = useState<Produto[]>([])
  const [resultados,setResultados] = useState<Produto[]>([])
  const [busca,setBusca] = useState('')
  const [carregando,setCarregando] = useState(true)
  const [buscando,setBuscando] = useState(false)
  const [salvando,setSalvando] = useState(false)
  const [gerandoPdf,setGerandoPdf] = useState(false)
  const [erro,setErro] = useState('')
  const [sucesso,setSucesso] = useState('')
  const produtosPorId = useMemo(() => new Map(catalogo.map(p=>[p.id,p])),[catalogo])
  const titulo = atual?.tipo === 'pintura' ? 'ROMANEIO DE PINTURA' : 'ROMANEIO DE MATERIAIS'
  const numero = atual?.numero ? pad(atual.numero) : 'NOVO · NÃO SALVO'
  const semFoto = atual?.itens.some(i=> !produtosPorId.get(i.produto_id)?.foto_url) ?? false

  async function carregar() {
    setCarregando(true)
    const {data,error} = await supabase.from('romaneios').select('*')
      .eq('cliente_id',clienteId).order('created_at',{ascending:false}).limit(150)
    if(error) {
      setErro(error.code==='42P01' || error.code==='PGRST205'
        ? 'O módulo ainda precisa da migração de banco para funcionar. Nenhum romaneio foi alterado.'
        : 'Não foi possível carregar os romaneios: '+error.message)
      setCarregando(false)
      return
    }
    const linhas = (data||[]) as Registro[]
    setRegistros(linhas)
    const ids = [...new Set(linhas.flatMap(l=>Array.isArray(l.itens)?l.itens.map(i=>i.produto_id):[]))]
    if(ids.length) {
      const {data:produtos} = await supabase.from('produtos').select('*').in('id',ids)
      if(produtos) setCatalogo(anteriores=>{
        const mapa = new Map(anteriores.map(p=>[p.id,p]))
        for(const p of produtos as Produto[]) mapa.set(p.id,p)
        return [...mapa.values()]
      })
    }
    setCarregando(false)
  }
  useEffect(()=>{void carregar()},[clienteId])

  async function buscarMateriais() {
    const termo = sanitizarBusca(busca)
    if(termo.length<2) {setErro('Digite pelo menos 2 letras ou números para buscar o material.');return}
    setErro('');setBuscando(true)
    let q = supabase.from('produtos').select('*').eq('ativo',true)
      .or('nome.ilike.%'+termo+'%,codigo.ilike.%'+termo+'%,descricao.ilike.%'+termo+'%')
      .limit(30)
    if(atual?.tipo==='perfis') q=q.eq('categoria','perfil')
    if(atual?.tipo==='vidros') q=q.eq('categoria','vidro')
    if(atual?.tipo==='acessorios') q=q.eq('categoria','acessorio')
    const {data,error} = await q
    setBuscando(false)
    if(error){setErro('Falha na busca do cadastro: '+error.message);return}
    const produtos=(data||[]) as Produto[]
    setResultados(produtos)
    setCatalogo(anteriores=>{
      const mapa = new Map(anteriores.map(p=>[p.id,p]))
      produtos.forEach(p=>mapa.set(p.id,p))
      return [...mapa.values()]
    })
  }

  function adicionar(p:Produto) {
    if(!atual || !p.foto_url) return
    if(atual.itens.length >= MAX_ITENS_A4) {
      setErro('Limite de '+MAX_ITENS_A4+' itens por romaneio A4. Salve este e crie outro para o próximo lote.')
      return
    }
    if(atual.itens.some(i=>i.produto_id===p.id)) {
      setErro('Material já inserido. Edite a quantidade diretamente na linha.')
      return
    }
    setErro('')
    setAtual({...atual,itens:[...atual.itens,{produto_id:p.id,quantidade:1,
      medida:p.tamanho_barra_mm ? String(p.tamanho_barra_mm) + ' mm' : '',observacao:''}]})
  }
  function itemCampo(index:number, campo:keyof Item, valor:string) {
    if(!atual) return
    setAtual({...atual,itens:atual.itens.map((i,n)=>
      n===index?{...i,[campo]:campo==='quantidade'?Number(valor):valor}:i)})
  }
  function alterar(campo:keyof Registro, valor:string) {
    if(!atual)return
    setAtual({...atual,[campo]:valor})
  }
  function obraEscolhida(id:string) {
    if(!atual)return
    const obra=obras.find(o=>o.id===id)
    setAtual({...atual,obra_id:id||null,
      obra_nome_impresso:obra?.nome||'',endereco_obra:obra?.endereco||obra?.cidade||''})
  }
  async function salvar() {
    if(!atual || !podeEditar)return
    setErro('');setSucesso('')
    if(!atual.cliente_nome_impresso.trim()||!atual.obra_nome_impresso.trim())
      return setErro('Informe o nome do cliente e da obra.')
    if(atual.tipo==='pintura'&&!atual.cor.trim())
      return setErro('Informe a cor exata da pintura antes de salvar.')
    if(!atual.itens.length) return setErro('Inclua pelo menos um material cadastrado.')
    if(atual.itens.length>MAX_ITENS_A4)return setErro('O romaneio ultrapassa uma folha A4.')
    if(semFoto)return setErro('Há material sem foto no cadastro. Atualize a foto antes de salvar.')
    if(atual.observacoes.length>170||atual.cor.length>55||atual.codigo_cor.length>45||atual.obra_nome_impresso.length>100)
      return setErro('Há texto extenso demais para caber na folha A4. Reduza as observações, cor ou nome da obra.')
    if(atual.itens.some(i=>i.medida.length>30||i.observacao.length>75))
      return setErro('Medida ou observação do item muito longa para uma folha A4.')
    if(atual.itens.some(i=>!Number.isFinite(i.quantidade)||i.quantidade<=0||i.quantidade>999999))
      return setErro('Confira as quantidades. Todas devem ser maiores que zero.')
    if(atual.itens.some(i=>!produtosPorId.has(i.produto_id)))
      return setErro('Existe material sem cadastro válido.')
    setSalvando(true)
    const {id,numero,...campos}=atual
    const payload={...campos,
      cliente_nome_impresso:campos.cliente_nome_impresso.trim(),
      obra_nome_impresso:campos.obra_nome_impresso.trim(),
      cor:campos.cor.trim(),codigo_cor:campos.codigo_cor.trim()}
    const resposta=id
      ?await supabase.from('romaneios').update(payload).eq('id',id).eq('cliente_id',clienteId).select('*').single()
      :await supabase.from('romaneios').insert(payload).select('*').single()
    setSalvando(false)
    if(resposta.error){setErro('Não foi possível salvar o romaneio: '+resposta.error.message);return}
    const registro=resposta.data as Registro
    setAtual(registro)
    setSucesso('Romaneio '+pad(registro.numero||0)+' salvo. Pode imprimir em A4.')
    await carregar()
  }

  async function imprimir() {
    if(!atual?.id){setErro('Salve o romaneio antes de gerar o PDF.');return}
    if(semFoto){setErro('Cadastre a foto de todos os materiais antes de gerar o PDF.');return}
    if(!atual.itens.length||atual.itens.length>MAX_ITENS_A4) {
      setErro('O romaneio deve ter de 1 a '+MAX_ITENS_A4+' itens por folha A4.');return
    }
    if(gerandoPdf)return
    // Abre a janela imediatamente ao clique para evitar o bloqueio de pop-ups do Safari.
    const janela = window.open('', '_blank')
    if(janela){
      janela.document.title = 'Preparando romaneio A4'
      janela.document.body.innerHTML = '<p style="font:16px Arial;padding:30px">Gerando PDF A4 da Esquadrifácio...</p>'
    }
    setGerandoPdf(true)
    setErro('')
    try {
      const { gerarRomaneioPdfA4 } = await import('@/lib/romaneioPdfA4')
      const pdf = await gerarRomaneioPdfA4({
        numero,
        tipo: atual.tipo,
        dataEmissao: dataBR(atual.data_emissao),
        cliente: atual.cliente_nome_impresso,
        obra: atual.obra_nome_impresso,
        endereco: atual.endereco_obra,
        destino: atual.destino,
        cor: atual.cor,
        codigoCor: atual.codigo_cor,
        acabamento: atual.acabamento,
        status: ESTADOS.find(s=>s.id===atual.status)?.nome||atual.status,
        observacoes: atual.observacoes,
        entreguePor: atual.entregue_por,
        recebidoPor: atual.recebido_por,
        itens: atual.itens.map(item=>{
          const produto=produtosPorId.get(item.produto_id)
          if(!produto?.foto_url) throw new Error('Foto obrigatória ausente no cadastro do material.')
          return {
            codigo: produto.codigo||'',
            nome: produto.nome||'',
            fotoUrl: produto.foto_url,
            medida: item.medida,
            quantidade: item.quantidade,
            observacao: item.observacao,
          }
        }),
      })
      const url=URL.createObjectURL(pdf)
      if(janela&&!janela.closed) {
        janela.location.replace(url)
      } else {
        const link=document.createElement('a')
        link.href=url
        link.download=numero+'.pdf'
        document.body.appendChild(link)
        link.click()
        link.remove()
        setSucesso('O PDF A4 foi baixado. Abra o arquivo e imprima em tamanho real.')
      }
      // URL permanece acessível para o leitor de PDF do Safari.
      window.setTimeout(()=>URL.revokeObjectURL(url),5*60*1000)
    } catch(e) {
      if(janela&&!janela.closed) janela.close()
      setErro(e instanceof Error?e.message:'Não foi possível gerar o PDF A4.')
    } finally {
      setGerandoPdf(false)
    }
  }

  return <div className="romaneios-container space-y-4">
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-bold text-brand-navy">Romaneios do cliente</h2>
          <p className="text-xs text-slate-500">Materiais vinculados ao cadastro com foto • um romaneio por folha A4</p></div>
        <div className="flex gap-2">
          <button onClick={()=>void carregar()} type="button" className="rounded-lg border px-3 py-2 text-xs font-semibold"><RefreshCw size={14}/></button>
          {podeEditar&&<button onClick={()=>{setAtual(vazio(clienteId,clienteNome));setResultados([]);setErro('');setSucesso('')}} type="button"
            className="inline-flex items-center gap-1 rounded-lg bg-brand-navy px-4 py-2 text-xs font-bold text-white"><Plus size={14}/>Novo romaneio</button>}
        </div>
      </div>
      {carregando?<p className="mt-3 text-sm text-slate-500">Carregando...</p>:
        <div className="mt-3 flex flex-wrap gap-2">
          {registros.map(r=><button key={r.id} type="button" onClick={()=>{setAtual(r);setErro('');setSucesso('')}}
            className={'rounded-xl border px-3 py-2 text-left text-xs '+(atual?.id===r.id?'border-brand-teal bg-teal-50':'border-slate-200 bg-white')}>
            <b>{pad(r.numero||0)}</b><span className="ml-2">{r.tipo==='pintura'?'Pintura':r.tipo}</span>
            <span className="block mt-1 text-slate-500">{r.obra_nome_impresso||'Sem obra'} · {r.status}</span>
          </button>)}
          {!registros.length&&<p className="text-sm text-slate-400">Nenhum romaneio criado ainda.</p>}
        </div>}
    </section>
    {erro&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{erro}</p>}
    {sucesso&&<p role="status" className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">{sucesso}</p>}
    {atual&&<div className="space-y-4">
      <section className="rom-editor rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="font-bold text-slate-800">{atual.id?'Editar '+numero:'Novo romaneio'}</h3>
          <div className="flex gap-2">
            {podeEditar&&<button disabled={salvando} onClick={()=>void salvar()} type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><Save size={14}/>{salvando?'Salvando...':'Salvar'}</button>}
            <button type="button" onClick={()=>void imprimir()} disabled={gerandoPdf} className="inline-flex items-center gap-1 rounded-lg border border-brand-teal px-3 py-2 text-xs font-bold text-brand-teal disabled:opacity-50">
              <Printer size={14}/>{gerandoPdf?'Preparando PDF A4...':'Abrir PDF A4 / Imprimir'}</button>
          </div>
        </div>
        <fieldset disabled={!podeEditar} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 disabled:opacity-80">
          <Campo label="Tipo de romaneio"><select value={atual.tipo} onChange={e=>alterar('tipo',e.target.value)}>{TIPOS.map(t=><option value={t.id} key={t.id}>{t.nome}</option>)}</select></Campo>
          <Campo label="Data de emissão"><input type="date" value={atual.data_emissao} onChange={e=>alterar('data_emissao',e.target.value)}/></Campo>
          <Campo label="Obra vinculada"><select value={atual.obra_id||''} onChange={e=>obraEscolhida(e.target.value)}><option value="">Sem vínculo</option>{obras.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select></Campo>
          <Campo label="Status"><select value={atual.status} onChange={e=>alterar('status',e.target.value)}>{ESTADOS.map(s=><option value={s.id} key={s.id}>{s.nome}</option>)}</select></Campo>
          <Campo label="Nome do cliente na impressão"><input value={atual.cliente_nome_impresso} onChange={e=>alterar('cliente_nome_impresso',e.target.value)}/></Campo>
          <Campo label="Nome da obra na impressão"><input value={atual.obra_nome_impresso} onChange={e=>alterar('obra_nome_impresso',e.target.value)}/></Campo>
          <Campo label="Endereço da obra"><input value={atual.endereco_obra} onChange={e=>alterar('endereco_obra',e.target.value)}/></Campo>
          <Campo label="Destino / Pintura"><input value={atual.destino} onChange={e=>alterar('destino',e.target.value)}/></Campo>
          <Campo label="Cor exata da pintura"><input value={atual.cor} onChange={e=>alterar('cor',e.target.value)} placeholder="Ex.: Branco Fosco"/></Campo>
          <Campo label="Código da cor / RAL"><input value={atual.codigo_cor} onChange={e=>alterar('codigo_cor',e.target.value)} placeholder="Ex.: RAL 9003"/></Campo>
          <Campo label="Acabamento"><input value={atual.acabamento} onChange={e=>alterar('acabamento',e.target.value)} placeholder="Ex.: Microtextura"/></Campo>
          <Campo label="Enviado por"><input value={atual.entregue_por} onChange={e=>alterar('entregue_por',e.target.value)}/></Campo>
          <Campo label="Recebido por"><input value={atual.recebido_por} onChange={e=>alterar('recebido_por',e.target.value)}/></Campo>
          <Campo label="Observações gerais" extra="sm:col-span-2 lg:col-span-3"><textarea rows={2} value={atual.observacoes} onChange={e=>alterar('observacoes',e.target.value)}/></Campo>
        </fieldset>
        {podeEditar&&<div className="mt-4 space-y-2 rounded-xl border bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-bold text-sm text-slate-800">Materiais do cadastro ({atual.itens.length}/{MAX_ITENS_A4})</h4>
            <Link href={'/cadastro/produtos?categoria='+(atual.tipo==='vidros'?'vidro':atual.tipo==='acessorios'?'acessorio':'perfil')+'&novo=1&origem=romaneio'}
              target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-brand-teal underline">+ Cadastrar material com foto (cadastro completo)</Link>
          </div>
          <div className="flex gap-2">
            <input aria-label="Buscar material pelo código ou nome" value={busca} onChange={e=>setBusca(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void buscarMateriais()}}}
              placeholder="Digite código, nome ou descrição do perfil, vidro, acessório..."
              className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"/>
            <button type="button" onClick={()=>void buscarMateriais()} disabled={buscando}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-teal px-3 py-2 text-xs font-bold text-white"><Search size={14}/>{buscando?'Buscando...':'Buscar'}</button>
          </div>
          {!!resultados.length&&<div className="max-h-56 overflow-y-auto rounded-lg border bg-white">
            {resultados.map(p=><div key={p.id} className="flex items-center gap-3 border-b p-2 last:border-b-0">
              {p.foto_url?<img src={p.foto_url} alt={p.nome} className="h-11 w-14 shrink-0 rounded border object-contain"/>:
                <span className="flex h-11 w-14 shrink-0 items-center justify-center rounded border bg-amber-50 text-amber-700"><ImageIcon size={16}/></span>}
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{p.codigo?p.codigo+' · ':''}{p.nome}</p>
                <p className="text-[11px] text-slate-500">{p.categoria}{p.foto_url?'':' · FOTO OBRIGATÓRIA'}</p></div>
              {p.foto_url?<button type="button" onClick={()=>adicionar(p)} disabled={atual.itens.length>=MAX_ITENS_A4}
                className="rounded-lg border border-brand-teal px-2 py-1 text-xs text-brand-teal disabled:opacity-40">Adicionar</button>:
                <Link target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-amber-700 underline"
                  href={"/cadastro/produtos?categoria="+encodeURIComponent(p.categoria)+"&q="+encodeURIComponent(p.codigo||p.nome)}>Incluir foto no cadastro</Link>}
            </div>)}
          </div>}
          {!resultados.length&&busca.trim().length>=2&&!buscando&&<p className="text-xs text-slate-500">Não encontrou? Abra o cadastro completo acima, informe os dados do perfil e adicione a foto. Depois busque novamente.</p>}
          <div className="space-y-2">
            {atual.itens.map((item,i)=>{const p=produtosPorId.get(item.produto_id);return <div key={item.produto_id} className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-2">
              {p?.foto_url?<img src={p.foto_url} alt={p.nome} className="h-12 w-14 rounded border object-contain"/>:
                <span className="text-xs font-bold text-red-700">Sem foto</span>}
              <span className="min-w-[140px] flex-1 text-xs"><b>{p?.codigo||'Material'}</b><span className="block text-slate-600">{p?.nome||'Produto não localizado no banco'}</span></span>
              <label className="text-[10px] text-slate-500">Medida<input value={item.medida} disabled={!podeEditar}
                onChange={e=>itemCampo(i,'medida',e.target.value)} className="block w-28 rounded border px-2 py-1 text-xs"/></label>
              <label className="text-[10px] text-slate-500">Qtd.<input type="number" min="0.01" step="any" value={item.quantidade} disabled={!podeEditar}
                onChange={e=>itemCampo(i,'quantidade',e.target.value)} className="block w-20 rounded border px-2 py-1 text-xs"/></label>
              <label className="text-[10px] text-slate-500">Observação<input value={item.observacao} disabled={!podeEditar}
                onChange={e=>itemCampo(i,'observacao',e.target.value)} className="block w-44 rounded border px-2 py-1 text-xs"/></label>
              <button type="button" aria-label={'Remover '+(p?.nome||'material')} onClick={()=>setAtual({...atual,itens:atual.itens.filter((_,n)=>n!==i)})}
                className="rounded-lg p-2 text-red-600"><Trash2 size={14}/></button>
            </div>})}
          </div>
        </div>}
        <p className="mt-3 text-xs text-slate-500">Regra A4: até {MAX_ITENS_A4} linhas por romaneio. Se precisar de mais linhas, crie outro romaneio para o próximo lote. Fotos e nomes dos produtos nunca são digitados manualmente.</p>
      </section>
      <div className="rom-viewport overflow-x-auto rounded-xl bg-slate-200 p-3">
        <article id="romaneio-documento" className="rom-pagina bg-white text-slate-900 shadow-xl">
          <header className="rom-header">
            <img src="/logo.png" alt="Esquadrifácio — Soluções em Alumínio"/>
            <div className="rom-header-titulo"><strong>{titulo}</strong></div>
          </header>
          <div className="rom-faixa">
            <div><small>CLIENTE</small><b>{atual.cliente_nome_impresso||'—'}</b></div>
            <div><small>OBRA</small><b>{atual.obra_nome_impresso||'—'}</b></div>
            <div><small>ROMANEIO</small><b>{numero}</b></div>
            <div><small>DATA</small><b>{dataBR(atual.data_emissao)}</b></div>
          </div>
          <div className="rom-pintura">
            <div className="rom-pintura-titulo">{atual.tipo==='pintura'?'DADOS DA PINTURA':'DADOS DO ENVIO'}</div>
            <div className="rom-pintura-campo rom-pintura-cor"><small>COR</small><b>{atual.cor||'—'}</b></div>
            <div className="rom-pintura-campo"><small>CÓDIGO</small><b>{atual.codigo_cor||'—'}</b></div>
            <div className="rom-pintura-campo"><small>ACABAMENTO</small><b>{atual.acabamento||'—'}</b></div>
            <div className="rom-pintura-campo"><small>DESTINO</small><b>{atual.destino||'—'}</b></div>
          </div>
          <div className="rom-itens-cabecalho">
            <h4>RELAÇÃO DOS MATERIAIS</h4><b>{atual.itens.length} itens cadastrados</b>
          </div>
          <table className="rom-tabela"><colgroup><col style={{width:'7%'}}/><col style={{width:'16%'}}/><col style={{width:'32%'}}/><col style={{width:'13%'}}/><col style={{width:'9%'}}/><col style={{width:'23%'}}/></colgroup>
            <thead><tr><th>Nº</th><th>Foto</th><th>Perfil / Produto</th><th>Medida</th><th>Qtd.</th><th>Observações</th></tr></thead>
            <tbody>{atual.itens.map((item,i)=>{const p=produtosPorId.get(item.produto_id);const mostrarCodigo=!!p?.codigo&&!p?.nome?.toUpperCase().startsWith(p.codigo.toUpperCase());return <tr key={item.produto_id} style={{height:Math.min(18.5,116/Math.max(1,atual.itens.length))+'mm'}}>
              <td>{i+1}</td><td>{p?.foto_url?<img src={p.foto_url} alt={p.nome}/>:
                <span className="rom-sem-foto">SEM FOTO</span>}</td>
              <td className="rom-descricao">{mostrarCodigo&&<b>{p?.codigo}</b>}<span>{p?.nome||'Material não localizado'}</span></td>
              <td>{item.medida||'—'}</td><td className="rom-qtd">{item.quantidade||'—'}</td>
              <td>{item.observacao||'—'}</td>
            </tr>})}
            {!atual.itens.length&&<tr><td colSpan={6} className="rom-vazio">Adicione materiais do cadastro para gerar o documento.</td></tr>}
            </tbody>
          </table>
          <div className="rom-rodape">
            <div className="rom-resumo">
              <b>TOTAL: {atual.itens.reduce((t,i)=>t+Number(i.quantidade||0),0)} unidades / peças</b>
              <span><strong>COR PARA PINTURA:</strong> {atual.cor||'Não informada'} {atual.codigo_cor?'('+atual.codigo_cor+')':''}</span>
            </div>
            <div className="rom-observacoes"><b>OBSERVAÇÕES GERAIS</b><p>{atual.observacoes||''}</p></div>
            <div className="rom-assinaturas"><div><span>Enviado por: {atual.entregue_por}</span><i/>Assinatura / conferência</div><div><span>Recebido por: {atual.recebido_por}</span><i/>Assinatura / conferência</div></div>
          </div>
          <footer className="rom-footer"><span>ESQUADRIFÁCIO · SOLUÇÕES EM ALUMÍNIO</span><span>Romaneio {numero} · Página 1/1</span></footer>
        </article>
      </div>
    </div>}
  </div>
}
function Campo({label,children,extra=''}:{label:string;children:React.ReactNode;extra?:string}){
  return <label className={'rom-campo text-[11px] font-semibold text-slate-600 '+extra}>{label}{children}</label>
}