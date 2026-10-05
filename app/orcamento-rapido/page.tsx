'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Calculator, Camera, CheckCircle, Keyboard, Paperclip, Pencil, Plus, Send, Trash2, WifiOff, X } from 'lucide-react'
import Link from 'next/link'
import { v4 as uuidv4 } from 'uuid'
import { Acabamento, Cliente, Contramarco, OrigemCliente, TemperaturaLead, TipoEsquadria } from '@/lib/tipos'
import { criarOrcamentoNoServidor, DadosOrcamentoForm } from '@/lib/orcamentos'
import { obterRascunho, removerRascunho, salvarPendente, salvarRascunho } from '@/lib/offlineFila'
import { supabase } from '@/lib/supabase'
import { usuarioAtual } from '@/lib/auth'
import SeletorEsquadriaInteligente from '@/components/orcamento/SeletorEsquadriaInteligente'

const RASCUNHO_ID = 'orcamento-rapido-layout-restaurado-v1'

const acabamentos: { value: Acabamento; label: string }[] = [
  { value: 'preto', label: 'Preto' },
  { value: 'branco', label: 'Branco' },
  { value: 'madeirado', label: 'Amadeirado' },
  { value: 'outro', label: 'Outra cor' },
]

type TipoItemLancamento = 'sob_medida' | 'medida_padrao' | 'kit_porta_pronta' | 'material_avulso'
type CategoriaMaterial = 'perfil' | 'acessorio' | 'vidro' | 'outros'

interface ItemForm {
  id: string
  itemTipo: TipoItemLancamento | ''
  materialCategoria: CategoriaMaterial | null
  materialUnidade: string | null
  produtoNome: string | null
  contramarcoOverride: Contramarco | null
  ambiente: string
  tipo: TipoEsquadria | ''
  tipoOutroTexto: string
  folhas: string
  largura: string
  altura: string
  quantidade: string
  descricao: string
  observacaoTempera: string
  observacaoProducao: string
  cor: string
  fotos: File[]
  fotosPreviews: string[]
  tipoMedida: 'comum' | 'final'
  larguraBaixo: string
  larguraMeio: string
  larguraCima: string
  alturaDireita: string
  alturaMeio: string
  alturaEsquerda: string
  modoLargura: 'digitar' | 'foto'
  modoAltura: 'digitar' | 'foto'
  fotoLargura?: File
  fotoLarguraPreview?: string
  fotoAltura?: File
  fotoAlturaPreview?: string
  modoOrigem: 'manual' | 'produto'
  produtoId: string | null
  precoUnit: number | null
  linhaId: string | null
  linhaNome: string | null
  tipologiaId: string | null
  configuracaoPresetId: string | null
  configuracaoNome: string | null
  configuracaoValidada: boolean
  modoConfiguracao: 'rapido' | 'assistido'
  configuracaoStatus: 'pendente' | 'preenchida' | 'validada'
  variaveis: Record<string, string>
}

function novoItem(): ItemForm {
  return {
    id: uuidv4(), itemTipo: '', materialCategoria: null, materialUnidade: null, produtoNome: null, contramarcoOverride: null, ambiente: '', tipo: '', tipoOutroTexto: '', folhas: '', largura: '', altura: '', quantidade: '', descricao: '', observacaoTempera: '', observacaoProducao: '', cor: '',
    fotos: [], fotosPreviews: [], tipoMedida: 'comum',
    larguraBaixo: '', larguraMeio: '', larguraCima: '', alturaDireita: '', alturaMeio: '', alturaEsquerda: '',
    modoLargura: 'digitar', modoAltura: 'digitar',
    modoOrigem: 'manual', produtoId: null, precoUnit: null,
    linhaId: null, linhaNome: null, tipologiaId: null,
    configuracaoPresetId: null, configuracaoNome: null, configuracaoValidada: false,
    modoConfiguracao: 'rapido', configuracaoStatus: 'pendente', variaveis: {},
  }
}

function nomeTipologia(item: ItemForm) {
  if (item.tipo === 'outro' && item.tipoOutroTexto.trim()) return item.tipoOutroTexto.trim()
  const tipo = String(item.tipo || 'Esquadria').replace(/[_-]+/g, ' ').trim()
  return tipo ? tipo.charAt(0).toUpperCase() + tipo.slice(1) : 'Esquadria'
}

function resumoMedidas(item: ItemForm) {
  if (item.tipoMedida !== 'final') return `${item.largura} × ${item.altura} mm`
  const larguras = item.modoLargura === 'foto' ? 'Larguras por foto' : `L ${item.larguraBaixo} / ${item.larguraMeio} / ${item.larguraCima} mm`
  const alturas = item.modoAltura === 'foto' ? 'Alturas por foto' : `A ${item.alturaDireita} / ${item.alturaMeio} / ${item.alturaEsquerda} mm`
  return `${larguras} • ${alturas}`
}

type ProdutoAtlasBusca = { id:string; codigo?:string|null; nome:string; categoria?:string|null; unidade?:string|null; preco?:number|null; custo?:number|null; descricao?:string|null }

function nomeNormalizado(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

function CatalogoItemAtlas({item,onChange}:{item:ItemForm;onChange:(patch:Partial<ItemForm>)=>void}) {
  const [busca,setBusca]=useState('')
  const [resultados,setResultados]=useState<ProdutoAtlasBusca[]>([])
  const [carregando,setCarregando]=useState(false)
  const [podeCadastrarProdutoPronto,setPodeCadastrarProdutoPronto]=useState(false)
  const [cadastrandoProdutoPronto,setCadastrandoProdutoPronto]=useState(false)
  const [erroCadastro,setErroCadastro]=useState('')

  useEffect(()=>{
    let ativo=true
    void usuarioAtual().then(me=>{
      if(!ativo)return
      const nome=nomeNormalizado(me?.nome||'')
      setPodeCadastrarProdutoPronto(me?.role==='master'||nome==='julio'||nome.startsWith('julio '))
    }).catch(()=>{if(ativo)setPodeCadastrarProdutoPronto(false)})
    return()=>{ativo=false}
  },[])

  useEffect(()=>{
    setErroCadastro('')
    if(busca.trim().length<2){setResultados([]);setCarregando(false);return}
    const timer=window.setTimeout(async()=>{
      setCarregando(true)
      const termo=busca.trim().replace(/[,%()]/g,' ')
      let q=supabase.from('produtos').select('id,codigo,nome,categoria,unidade,preco,custo,descricao').eq('ativo',true).or(`codigo.ilike.%${termo}%,nome.ilike.%${termo}%,descricao.ilike.%${termo}%`)
      if(item.itemTipo==='medida_padrao') q=q.eq('categoria','porta_janela_padrao')
      else if(item.itemTipo==='kit_porta_pronta') q=q.eq('categoria','kit')
      else if(item.itemTipo==='material_avulso'&&item.materialCategoria){
        if(item.materialCategoria==='outros') q=q.not('categoria','in','(porta_janela_padrao,kit,perfil,acessorio,vidro)')
        else q=q.eq('categoria',item.materialCategoria)
      }
      const {data}=await q.limit(20)
      setResultados((data||[]) as ProdutoAtlasBusca[])
      setCarregando(false)
    },250)
    return()=>window.clearTimeout(timer)
  },[busca,item.itemTipo,item.materialCategoria])

  async function cadastrarProdutoPronto(){
    const nome=busca.trim()
    if(nome.length<2||cadastrandoProdutoPronto)return
    setCadastrandoProdutoPronto(true)
    setErroCadastro('')
    try{
      const me=await usuarioAtual()
      const nomeUsuario=nomeNormalizado(me?.nome||'')
      const permitido=me?.role==='master'||nomeUsuario==='julio'||nomeUsuario.startsWith('julio ')
      if(!permitido){
        setPodeCadastrarProdutoPronto(false)
        setErroCadastro('Somente o usuário Master ou Júlio pode cadastrar um produto pronto por aqui.')
        return
      }

      const {data:existente}=await supabase
        .from('produtos')
        .select('id,codigo,nome,categoria,unidade,preco,custo,descricao')
        .eq('ativo',true)
        .eq('categoria','porta_janela_padrao')
        .ilike('nome',nome)
        .limit(1)
        .maybeSingle()

      let produto=(existente||null) as ProdutoAtlasBusca|null
      if(!produto){
        const {data,error}=await supabase
          .from('produtos')
          .insert({
            nome,
            categoria:'porta_janela_padrao',
            preco:0,
            custo:null,
            unidade:'unidade',
            descricao:'Cadastro rápido criado durante o orçamento. Custo e preço de venda pendentes de conferência.',
            criado_por_id:me?.id||null,
            criado_por_nome:me?.nome||null,
            ativo:true,
          })
          .select('id,codigo,nome,categoria,unidade,preco,custo,descricao')
          .single()
        if(error||!data)throw new Error(error?.message||'Não foi possível cadastrar o produto.')
        produto=data as ProdutoAtlasBusca
      }

      onChange({
        produtoId:produto.id,
        produtoNome:produto.nome,
        materialUnidade:produto.unidade||'unidade',
        precoUnit:produto.preco==null?null:Number(produto.preco),
        tipo:'outro',
        tipoOutroTexto:produto.nome,
        modoOrigem:'produto',
      })
      setBusca(produto.codigo?`${produto.codigo} · ${produto.nome}`:produto.nome)
      setResultados([])
    }catch(e){
      setErroCadastro(e instanceof Error?e.message:'Não foi possível cadastrar o produto.')
    }finally{
      setCadastrandoProdutoPronto(false)
    }
  }

  const rotulo=item.itemTipo==='medida_padrao'
    ?'Produto pronto cadastrado'
    :item.itemTipo==='kit_porta_pronta'
      ?'Kit porta pronta cadastrado'
      :item.itemTipo==='material_avulso'
        ?'Produto / material'
        :'Produto cadastrado'
  const podeOferecerCadastro=item.itemTipo==='medida_padrao'&&busca.trim().length>=2&&!carregando&&!resultados.length&&!item.produtoId

  return <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
    {item.itemTipo==='material_avulso'&&<div><label className="mb-1 block text-xs text-slate-500">Categoria</label><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{([['perfil','Perfil'],['acessorio','Acessório'],['vidro','Vidro'],['outros','Outros']] as const).map(([v,l])=><button type="button" key={v} onClick={()=>{setBusca('');setResultados([]);onChange({materialCategoria:v,produtoId:null,produtoNome:null})}} className={`rounded-lg border px-2 py-2 text-xs ${item.materialCategoria===v?'border-brand-navy bg-brand-navy text-white':'bg-white'}`}>{l}</button>)}</div></div>}
    <div><label className="mb-1 block text-xs text-slate-500">{rotulo}</label><input value={busca} onChange={e=>{setBusca(e.target.value);if(item.produtoId)onChange({produtoId:null,produtoNome:null,precoUnit:null})}} placeholder={item.itemTipo==='medida_padrao'?'Digite o nome do produto pronto...':item.itemTipo==='kit_porta_pronta'?'Digite o nome do kit...':'Digite código ou nome...'} className="w-full rounded-lg border p-2.5 text-sm"/>{carregando&&<p className="mt-1 text-xs text-slate-400">Buscando...</p>}</div>
    {!!resultados.length&&<div className="max-h-56 overflow-y-auto rounded-lg border bg-white">{resultados.map(p=><button type="button" key={p.id} onClick={()=>{onChange({produtoId:p.id,produtoNome:p.nome,materialUnidade:p.unidade||null,precoUnit:p.preco==null?null:Number(p.preco),tipo:'outro',tipoOutroTexto:p.nome,modoOrigem:'produto'});setBusca(p.codigo?`${p.codigo} · ${p.nome}`:p.nome);setResultados([])}} className="block w-full border-b px-3 py-2 text-left last:border-0"><b className="text-sm">{p.codigo?`${p.codigo} · `:''}{p.nome}</b><p className="text-xs text-slate-500">{p.categoria==='porta_janela_padrao'?'Produto pronto':p.categoria==='kit'?'Kit':p.categoria||'Sem categoria'} · {p.unidade||'un.'}{p.preco!=null?` · R$ ${Number(p.preco).toFixed(2)}`:''}</p></button>)}</div>}
    {podeOferecerCadastro&&(podeCadastrarProdutoPronto?<div className="rounded-xl border border-blue-200 bg-blue-50 p-3"><p className="text-xs font-semibold text-blue-900">Produto pronto “{busca.trim()}” não encontrado.</p><p className="mt-1 text-[11px] text-blue-700">Deseja cadastrá-lo agora? Custo e preço de venda podem ser completados depois no cadastro de produtos.</p><button type="button" onClick={()=>void cadastrarProdutoPronto()} disabled={cadastrandoProdutoPronto} className="mt-2 rounded-lg bg-brand-navy px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{cadastrandoProdutoPronto?'Cadastrando...':'Cadastrar este produto'}</button></div>:<p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Produto pronto não encontrado. Peça ao Master ou ao Júlio para cadastrá-lo.</p>)}
    {erroCadastro&&<p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{erroCadastro}</p>}
    {item.produtoId&&<div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">Selecionado: {item.produtoNome}</div>}
  </div>
}

type ArquivoRascunho = { nome: string; tipo: string; ultimaModificacao: number; blob: Blob }

interface RascunhoOrcamentoRapido {
  itens: ItemForm[]
  clienteIdOrigem: string | null
  clienteNome: string
  clienteWhatsapp: string
  cidade: string
  origem: OrigemCliente
  temperatura: TemperaturaLead | ''
  acabamento: Acabamento | ''
  acabamentoOutroTexto: string
  contramarco: Contramarco | ''
  arquitetoNome: string
  arquitetoContato: string
  arquivos?: ArquivoRascunho[]
}

export default function OrcamentoRapido() {
  const [itens, setItens] = useState<ItemForm[]>([novoItem()])
  const [clienteIdOrigem, setClienteIdOrigem] = useState<string | null>(null)
  const [clienteNome, setClienteNome] = useState('')
  const [clienteWhatsapp, setClienteWhatsapp] = useState('')
  const [cidade, setCidade] = useState('')
  const [origem, setOrigem] = useState<OrigemCliente>('outros')
  const [temperatura, setTemperatura] = useState<TemperaturaLead | ''>('')
  const [acabamento, setAcabamento] = useState<Acabamento | ''>('')
  const [acabamentoOutroTexto, setAcabamentoOutroTexto] = useState('')
  const [contramarco, setContramarco] = useState<Contramarco | ''>('')
  const [arquitetoNome, setArquitetoNome] = useState('')
  const [arquitetoContato, setArquitetoContato] = useState('')
  const [fotos] = useState<File[]>([])
  const [arquivos, setArquivos] = useState<File[]>([])
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [salvoComPendenciasTecnicas, setSalvoComPendenciasTecnicas] = useState(false)
  const [pedidoEnviadoId, setPedidoEnviadoId] = useState<string | null>(null)
  const [salvoOffline, setSalvoOffline] = useState(false)
  const [motivoPendente, setMotivoPendente] = useState('')
  const [erro, setErro] = useState('')
  const [erroEhValidacao, setErroEhValidacao] = useState(false)
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null)
  const [conferenciaAberta, setConferenciaAberta] = useState(false)
  const [rascunhoCarregado, setRascunhoCarregado] = useState(false)
  const [rascunhoRestaurado, setRascunhoRestaurado] = useState(false)
  const [rascunhoSalvoEm, setRascunhoSalvoEm] = useState<string | null>(null)
  const [fluxoSobMedida, setFluxoSobMedida] = useState(false)

  function arquivoParaRascunho(file: File): ArquivoRascunho {
    return { nome: file.name, tipo: file.type, ultimaModificacao: file.lastModified, blob: file }
  }

  function arquivoDoRascunho(item: ArquivoRascunho): File {
    return new File([item.blob], item.nome, { type: item.tipo, lastModified: item.ultimaModificacao })
  }

  useEffect(() => {
    let ativo = true
    const params = new URLSearchParams(window.location.search)
    const inicioNovoSobMedida = params.get('modo') === 'sob-medida' && params.get('novo') === '1'
    obterRascunho<RascunhoOrcamentoRapido>(RASCUNHO_ID).then(rascunho => {
      if (!ativo) return
      if (rascunho?.dados) {
        const d = rascunho.dados
        if (Array.isArray(d.itens) && d.itens.length) setItens(d.itens.map(item => {
          const fotos = (item.fotos || []).map((foto: any) => foto instanceof File ? foto : arquivoDoRascunho(foto))
          const fotoLargura = item.fotoLargura ? (item.fotoLargura instanceof File ? item.fotoLargura : arquivoDoRascunho(item.fotoLargura as any)) : undefined
          const fotoAltura = item.fotoAltura ? (item.fotoAltura instanceof File ? item.fotoAltura : arquivoDoRascunho(item.fotoAltura as any)) : undefined
          return { ...item, observacaoTempera: item.observacaoTempera || '', observacaoProducao: item.observacaoProducao || '', fotos, fotosPreviews: fotos.map((foto: File) => URL.createObjectURL(foto)), fotoLargura, fotoLarguraPreview: fotoLargura ? URL.createObjectURL(fotoLargura) : undefined, fotoAltura, fotoAlturaPreview: fotoAltura ? URL.createObjectURL(fotoAltura) : undefined }
        }))
        setClienteIdOrigem(d.clienteIdOrigem || null)
        setClienteNome(d.clienteNome || '')
        setClienteWhatsapp(d.clienteWhatsapp || '')
        setCidade(d.cidade || '')
        if (d.origem) setOrigem(d.origem)
        setTemperatura(d.temperatura || '')
        setAcabamento(d.acabamento || '')
        setAcabamentoOutroTexto(d.acabamentoOutroTexto || '')
        setContramarco(d.contramarco || '')
        setArquitetoNome(d.arquitetoNome || '')
        setArquitetoContato(d.arquitetoContato || '')
        if (Array.isArray(d.arquivos)) setArquivos(d.arquivos.map(arquivoDoRascunho))
        setRascunhoSalvoEm(rascunho.atualizadoEm)
        setRascunhoRestaurado(true)

        // Um rascunho existente sempre vence o contexto de uma nova navegação.
        // Assim, abrir outro cliente/obra nunca reaproveita nem apaga o trabalho pendente.
        params.delete('novo')
        params.delete('cliente')
        params.delete('obra')
        params.delete('adicionarAo')
        const busca = params.toString()
        window.history.replaceState({}, '', `${window.location.pathname}${busca ? `?${busca}` : ''}`)
      } else if (inicioNovoSobMedida) {
        params.delete('novo')
        const busca = params.toString()
        window.history.replaceState({}, '', `${window.location.pathname}${busca ? `?${busca}` : ''}`)
      }
      setRascunhoCarregado(true)
    }).catch(() => setRascunhoCarregado(true))
    return () => { ativo = false }
  }, [])

  useEffect(() => {
    if (!rascunhoCarregado || typeof window === 'undefined') return
    const modo = new URLSearchParams(window.location.search).get('modo')
    const sobMedida = modo === 'sob-medida'
    setFluxoSobMedida(sobMedida)
    if (!sobMedida) return
    setItens(prev => {
      if (prev.length !== 1 || prev[0].itemTipo) return prev
      return [{ ...prev[0], itemTipo: 'sob_medida' }]
    })
  }, [rascunhoCarregado])

  useEffect(() => {
    if (!rascunhoCarregado || salvo || salvoOffline) return
    const timer = window.setTimeout(() => {
      const dados: RascunhoOrcamentoRapido = {
        itens: itens.map(item => ({ ...item, fotos: item.fotos.map(arquivoParaRascunho) as any, fotosPreviews: [], fotoLargura: item.fotoLargura ? arquivoParaRascunho(item.fotoLargura) as any : undefined, fotoLarguraPreview: undefined, fotoAltura: item.fotoAltura ? arquivoParaRascunho(item.fotoAltura) as any : undefined, fotoAlturaPreview: undefined })),
        clienteIdOrigem, clienteNome, clienteWhatsapp, cidade, origem, temperatura,
        acabamento, acabamentoOutroTexto, contramarco, arquitetoNome, arquitetoContato,
        arquivos: arquivos.map(arquivoParaRascunho),
      }
      salvarRascunho(RASCUNHO_ID, dados).then(() => setRascunhoSalvoEm(new Date().toISOString())).catch(() => {})
    }, 350)
    return () => window.clearTimeout(timer)
  }, [rascunhoCarregado, itens, clienteIdOrigem, clienteNome, clienteWhatsapp, cidade, origem, temperatura, acabamento, acabamentoOutroTexto, contramarco, arquitetoNome, arquitetoContato, arquivos, salvo, salvoOffline])

  useEffect(() => {
    if (!rascunhoCarregado || rascunhoRestaurado) return
    const clienteId = new URLSearchParams(window.location.search).get('cliente')
    if (!clienteId || !navigator.onLine) return

    void (async () => {
      try {
        const { data } = await supabase.from('clientes').select('*').eq('id', clienteId).maybeSingle()
        if (!data) return
        const cliente = data as Cliente
        setClienteIdOrigem(cliente.id)
        setClienteNome(cliente.nome || '')
        setClienteWhatsapp(cliente.whatsapp || cliente.telefone || '')
        setCidade(cliente.cidade || '')
        if (cliente.origem) setOrigem(cliente.origem)
      } catch {
        // A consulta é apenas conveniência; falha de rede não bloqueia o formulário.
      }
    })()
  }, [rascunhoCarregado, rascunhoRestaurado])

  function limparErroValidacaoAoEditar() {
    // Qualquer edição após um erro de preenchimento precisa liberar uma nova tentativa.
    // Também limpamos um eventual estado de envio preso para o botão não ficar desabilitado.
    if (!erroEhValidacao && !erro) return
    setSalvando(false)
    setErro('')
    setErroEhValidacao(false)
  }

  function atualizarItem(id: string, campo: keyof ItemForm, valor: any) {
    limparErroValidacaoAoEditar()
    setItens(prev => prev.map(it => it.id === id ? { ...it, [campo]: valor } : it))
  }

  function atualizarItemCampos(id: string, patch: Partial<ItemForm>) {
    limparErroValidacaoAoEditar()
    setItens(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it))
  }

  function adicionarFotoItem(id: string, files: FileList | null) {
    if (!files?.length) return
    const novos = Array.from(files)
    setItens(prev => prev.map(it => it.id === id ? { ...it, fotos: [...it.fotos, ...novos], fotosPreviews: [...it.fotosPreviews, ...novos.map(f => URL.createObjectURL(f))] } : it))
  }

  function removerFotoItem(id: string, idx: number) {
    setItens(prev => prev.map(it => it.id === id ? { ...it, fotos: it.fotos.filter((_, i) => i !== idx), fotosPreviews: it.fotosPreviews.filter((_, i) => i !== idx) } : it))
  }

  function definirFotoLargura(id: string, file?: File) {
    if (!file) return
    setItens(prev => prev.map(it => it.id === id ? { ...it, fotoLargura: file, fotoLarguraPreview: URL.createObjectURL(file) } : it))
  }

  function definirFotoAltura(id: string, file?: File) {
    if (!file) return
    setItens(prev => prev.map(it => it.id === id ? { ...it, fotoAltura: file, fotoAlturaPreview: URL.createObjectURL(file) } : it))
  }

  function removerItem(id: string) {
    if (itens.length > 1) setItens(prev => prev.filter(it => it.id !== id))
  }

  function duplicarItemNovaMedida(item: ItemForm) {
    const duplicado: ItemForm = {
      ...item,
      id: uuidv4(),
      ambiente: '',
      largura: '',
      altura: '',
      larguraBaixo: '',
      larguraMeio: '',
      larguraCima: '',
      alturaDireita: '',
      alturaMeio: '',
      alturaEsquerda: '',
      fotos: [],
      fotosPreviews: [],
      fotoLargura: undefined,
      fotoLarguraPreview: undefined,
      fotoAltura: undefined,
      fotoAlturaPreview: undefined,
    }
    setItens(prev => [...prev, duplicado])
  }

  function adicionarOutroProjeto() {
    setItens(prev => [...prev, { ...novoItem(), itemTipo: 'sob_medida' }])
  }

  function adicionarArquivos(files: FileList | null) {
    if (files) setArquivos(prev => [...prev, ...Array.from(files)])
  }

  async function salvarComoPendente(dadosForm: DadosOrcamentoForm, motivo = '') {
    try {
      await salvarPendente({ id: uuidv4(), tipo: 'orcamento', criadoEm: new Date().toISOString(), dados: dadosForm })
      await removerRascunho(RASCUNHO_ID).catch(() => {})
      setRascunhoSalvoEm(null)
      setMotivoPendente(motivo)
      setSalvando(false)
      setSalvoOffline(true)
    } catch (e) {
      setSalvando(false)
      const detalhe = e instanceof Error ? e.message : ''
      setErro(`O envio não foi concluído agora. O rascunho automático continua salvo neste aparelho${detalhe ? ` (${detalhe})` : ''}.`)
    }
  }

  async function confirmarEnvio() {
    if (salvando) return
    setConferenciaAberta(false)
    setErro('')
    setSalvando(true)
    const tipoMedida = itens.every(item => item.tipoMedida === 'final') ? 'final' : 'comum'
    const dadosForm: DadosOrcamentoForm = {
      clienteId: clienteIdOrigem, orcamentoIdDestino: new URLSearchParams(window.location.search).get('adicionarAo'), itens: itens.map(item => ({ ...item, itemTipo: item.itemTipo || 'sob_medida' })), clienteNome, clienteWhatsapp, cidade, origem,
      temperatura, acabamento, acabamentoOutroTexto, contramarco, tipoMedida,
      arquitetoNome, arquitetoContato, fotos, arquivos,
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await salvarComoPendente(dadosForm, 'Sem conexão com a internet')
      return
    }
    try {
      const resultado = await criarOrcamentoNoServidor(dadosForm)
      if (resultado.ok) {
        const temPendenciasTecnicas = itens.some(item => item.itemTipo === 'sob_medida' && (!item.tipologiaId || item.configuracaoStatus === 'pendente'))
        setSalvando(false)
        await removerRascunho(RASCUNHO_ID).catch(() => {})
        setRascunhoSalvoEm(null)
        setPedidoEnviadoId(resultado.id || null)
        setSalvoComPendenciasTecnicas(temPendenciasTecnicas)
        if (fluxoSobMedida && resultado.id && !temPendenciasTecnicas) {
          window.location.assign(`/orcamento/${resultado.id}/composicao`)
          return
        }
        setSalvo(true)
        return
      }

      await salvarComoPendente(
        dadosForm,
        resultado.error ? `Servidor: ${resultado.error}` : 'Servidor não confirmou o salvamento',
      )
    } catch (e) {
      await salvarComoPendente(
        dadosForm,
        e instanceof Error ? e.message : 'Falha de conexão ou envio',
      )
    }
  }

  async function salvar() {
    // Cada toque em salvar começa uma validação nova. Erro anterior nunca pode
    // manter o fluxo travado depois que o usuário corrigiu o preenchimento.
    setSalvando(false)
    setConferenciaAberta(false)
    setErro('')
    setErroEhValidacao(false)

    const falharValidacao = (mensagem: string) => {
      setSalvando(false)
      setConferenciaAberta(false)
      setErroEhValidacao(true)
      setErro(mensagem)
      return false
    }

    if (!clienteNome.trim()) return falharValidacao('Informe o nome do cliente')
    if (!cidade.trim()) return falharValidacao('Informe a cidade da obra')
    if (!temperatura) return falharValidacao('Selecione a temperatura do orçamento (quente, morno ou frio)')
    if (!acabamento) return falharValidacao('Selecione a cor/acabamento')
    if (acabamento === 'outro' && !acabamentoOutroTexto.trim()) return falharValidacao('Escreva qual é a cor')
    if (!contramarco) return falharValidacao('Selecione com ou sem contramarco')

    for (let i = 0; i < itens.length; i++) {
      const it = itens[i]
      const referencia = it.ambiente.trim() || `Esquadria ${i + 1}`
      if (it.itemTipo !== 'sob_medida' && !it.produtoId) return falharValidacao(`Selecione um produto cadastrado em ${referencia}`)
      if (it.itemTipo === 'material_avulso') { if (!it.materialCategoria) return falharValidacao(`Selecione a categoria de ${referencia}`); continue }
      if (it.itemTipo !== 'sob_medida') continue
      if (it.modoOrigem === 'produto' && !it.produtoId) return falharValidacao(`Selecione um produto cadastrado em ${referencia}, ou troque para digitar manualmente`)
      // Tipologia e variáveis técnicas podem ficar pendentes no rascunho.
      // O orçamento precisa ser salvo primeiro; a composição só é liberada quando estiver completo.
      if (!it.tipo && !it.tipoOutroTexto.trim()) return falharValidacao(`Em ${referencia}, preencha o campo “O que você precisa?” da tipologia`)
      if (it.tipo === 'outro' && !it.tipoOutroTexto.trim()) return falharValidacao(`Em ${referencia}, preencha o campo “O que você precisa?” da tipologia`)

      if (it.tipoMedida === 'final') {
        if (it.modoLargura === 'foto') {
          if (!it.fotoLargura) return falharValidacao(`Anexe a foto das larguras de ${referencia}, ou troque para digitar`)
        } else {
          const medidas = [it.larguraBaixo, it.larguraMeio, it.larguraCima]
          if (medidas.some(m => !parseFloat(m.replace(',', '.')) || parseFloat(m.replace(',', '.')) < 100)) return falharValidacao(`Preencha as 3 larguras de ${referencia} (mínimo 100mm)`)
        }
        if (it.modoAltura === 'foto') {
          if (!it.fotoAltura) return falharValidacao(`Anexe a foto das alturas de ${referencia}, ou troque para digitar`)
        } else {
          const medidas = [it.alturaDireita, it.alturaMeio, it.alturaEsquerda]
          if (medidas.some(m => !parseFloat(m.replace(',', '.')) || parseFloat(m.replace(',', '.')) < 100)) return falharValidacao(`Preencha as 3 alturas de ${referencia} (mínimo 100mm)`)
        }
      } else {
        const l = parseFloat(it.largura.replace(',', '.'))
        const a = parseFloat(it.altura.replace(',', '.'))
        if (!l || !a || l < 100 || a < 100) return falharValidacao(`Preencha largura e altura de ${referencia} (mínimo 100mm x 100mm)`)
      }
    }
    setErro('')
    setErroEhValidacao(false)
    setConferenciaAberta(true)
  }

  function resetar() {
    void removerRascunho(RASCUNHO_ID).catch(() => {})
    setRascunhoSalvoEm(null)
    setSalvo(false); setSalvoComPendenciasTecnicas(false); setPedidoEnviadoId(null); setSalvoOffline(false); setMotivoPendente(''); setErro(''); setErroEhValidacao(false); setConferenciaAberta(false)
    setItens([{ ...novoItem(), itemTipo: fluxoSobMedida ? 'sob_medida' : '' }]); setClienteIdOrigem(null); setClienteNome(''); setClienteWhatsapp(''); setCidade(''); setTemperatura('')
    setAcabamento(''); setAcabamentoOutroTexto(''); setContramarco(''); setArquitetoNome(''); setArquitetoContato(''); setArquivos([])
  }

  // Não renderiza campos editáveis antes de concluir a hidratação do rascunho.
  // No iPhone/IndexedDB a leitura pode levar alguns instantes; renderizar antes permitia
  // que uma hidratação atrasada sobrescrevesse texto que o usuário já havia começado a digitar.
  if (!rascunhoCarregado) return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-lg p-6 text-sm text-slate-600">Carregando rascunho salvo neste aparelho...</div></div>

  if (salvoOffline) return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center"><WifiOff size={48} className="text-amber-500 mx-auto mb-4" /><h2 className="text-xl font-bold text-slate-800 mb-2">Orçamento protegido!</h2><p className="text-slate-500">O envio de {clienteNome} não foi concluído agora, mas o orçamento foi guardado neste aparelho e entrou na fila de sincronização automática.</p>{motivoPendente && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Motivo: {motivoPendente}</p>}<p className="mt-3 text-xs font-medium text-emerald-700">Você não precisa refazer o orçamento.</p><button onClick={resetar} className="mt-6 px-4 py-2 bg-brand-navy text-white rounded-lg">Novo pedido</button></div></div>

  if (salvo) return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg w-full text-center"><CheckCircle size={48} className="text-brand-teal mx-auto mb-4" /><h2 className="text-xl font-bold text-slate-800 mb-2">{fluxoSobMedida ? 'Orçamento sob medida salvo!' : 'Pedido enviado!'}</h2><p className="text-slate-500 mb-6">{fluxoSobMedida ? (salvoComPendenciasTecnicas ? `O orçamento de ${clienteNome} foi salvo com segurança. Há tipologias ou variáveis técnicas pendentes, que podem ser completadas depois sem refazer o orçamento.` : `A configuração de ${clienteNome} foi salva. Agora você pode calcular materiais, custo, sobra, margem e preço.`) : `${clienteNome} entrou no painel de orçamentos.`}</p><div className="grid gap-3">{pedidoEnviadoId && fluxoSobMedida && !salvoComPendenciasTecnicas && <Link href={`/orcamento/${pedidoEnviadoId}/composicao`} className="w-full px-4 py-3 bg-emerald-600 text-white rounded-xl flex items-center justify-center gap-2 font-bold"><Calculator size={17} /> Calcular o orçamento</Link>}{pedidoEnviadoId && <Link href={`/kanban?orcamento=${pedidoEnviadoId}`} className="w-full px-4 py-3 border border-brand-teal text-brand-teal rounded-xl flex items-center justify-center gap-2 font-medium"><Pencil size={17} /> {salvoComPendenciasTecnicas ? 'Completar pendências técnicas' : 'Editar este orçamento'}</Link>}<div className="grid grid-cols-2 gap-3"><button onClick={resetar} className="px-4 py-2.5 bg-brand-navy text-white rounded-xl">Novo orçamento</button><Link href="/kanban" className="px-4 py-2.5 border border-slate-300 rounded-xl">Ver painel</Link></div></div></div></div>

  const totalEsquadrias = itens.reduce((soma, item) => soma + Math.max(1, Number.parseInt(item.quantidade || '1', 10) || 1), 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200"><div className={`${fluxoSobMedida ? 'max-w-7xl' : 'max-w-3xl'} mx-auto px-4 py-4 flex items-center gap-4`}><Link href="/orcamento/novo" className="p-2 hover:bg-slate-100 rounded-lg"><ArrowLeft size={20} /></Link><img src="/icons/icon-mark.png" alt="" className="w-8 h-8" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h1 className="text-lg font-bold text-slate-800">{fluxoSobMedida ? 'Orçamento Sob Medida' : 'Orçamento'}</h1>{fluxoSobMedida && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">FLUXO W.VETRO</span>}</div><p className="text-sm text-slate-500">{fluxoSobMedida ? 'Configure a esquadria tecnicamente e siga até composição, custos e impressão' : 'Registre o pedido e mande pro painel'}</p></div></div></header>
      {fluxoSobMedida && <div className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-7xl overflow-x-auto px-4 py-3"><div className="flex min-w-[980px] items-center gap-2">{[['1','Cliente / Obra'],['2','Medidas'],['3','O que precisa'],['4','Linha / Tipologia'],['5','Variáveis'],['6','Acabamento'],['7','Composição'],['8','Custos'],['9','Impressão']].map(([n,label],i)=><div key={n} className="flex flex-1 items-center gap-2"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i<2?'bg-blue-600 text-white':'bg-slate-100 text-slate-500'}`}>{n}</span><span className={`whitespace-nowrap text-xs font-semibold ${i<2?'text-slate-800':'text-slate-500'}`}>{label}</span>{i<8&&<span className="h-px flex-1 bg-slate-200"/>}</div>)}</div></div></div>}
      <main className={`${fluxoSobMedida ? 'max-w-7xl' : 'max-w-3xl'} mx-auto px-4 py-8 space-y-6`}>{rascunhoSalvoEm && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">✓ Levantamento, fotos e arquivos salvos automaticamente neste aparelho. Pode continuar mesmo se a internet cair.</div>}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3"><h3 className="text-sm font-medium text-slate-700">Dados do cliente</h3>{clienteIdOrigem && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Cliente carregado pelo cadastro. Este orçamento ficará vinculado automaticamente ao histórico dele.</p>}<input data-preserve-case="true" value={clienteNome} onChange={e => { limparErroValidacaoAoEditar(); setClienteNome(e.target.value) }} placeholder="Nome do cliente *" className="w-full border border-slate-300 rounded-xl p-3 text-sm" /><input data-preserve-case="true" value={clienteWhatsapp} onChange={e => setClienteWhatsapp(e.target.value)} placeholder="WhatsApp (opcional)" className="w-full border border-slate-300 rounded-xl p-3 text-sm" /><div className="grid grid-cols-2 gap-3"><input data-preserve-case="true" value={cidade} onChange={e => { limparErroValidacaoAoEditar(); setCidade(e.target.value) }} placeholder="Cidade da obra *" className="w-full border border-slate-300 rounded-xl p-3 text-sm" /><select value={origem} onChange={e => setOrigem(e.target.value as OrigemCliente)} className="w-full border border-slate-300 rounded-xl p-3 text-sm"><option value="indicacao">Indicação</option><option value="arquiteto">Arquiteto</option><option value="engenheiro">Engenheiro</option><option value="construtora">Construtora</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="google">Google</option><option value="whatsapp">WhatsApp</option><option value="cliente_antigo">Cliente antigo</option><option value="passou_na_frente">Passou em frente</option><option value="outros">Outros</option></select></div></section>

        <section className="bg-white rounded-2xl border border-slate-200 p-6"><label className="block text-sm font-medium text-slate-700 mb-1">Temperatura do orçamento *</label><p className="text-xs text-slate-400 mb-3">Como está esse cliente: quão perto de fechar ele está?</p><div className="grid grid-cols-3 gap-2">{(['quente','morno','frio'] as const).map(t => <button key={t} onClick={() => { limparErroValidacaoAoEditar(); setTemperatura(t) }} className={`p-3 rounded-xl text-sm border ${temperatura === t ? 'border-brand-navy bg-brand-navyLight font-medium' : 'border-slate-200 text-slate-600'}`}>{t === 'quente' ? '🔥 Quente' : t === 'morno' ? '🌤️ Morno' : '❄️ Frio'}</button>)}</div></section>
        <section className="bg-white rounded-2xl border border-slate-200 p-6"><label className="block text-sm font-medium text-slate-700 mb-3">Cor / Acabamento *</label><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{acabamentos.map(a => <button key={a.value} onClick={() => { limparErroValidacaoAoEditar(); setAcabamento(a.value) }} className={`p-3 rounded-xl text-sm border ${acabamento === a.value ? 'border-brand-navy bg-brand-navyLight font-medium' : 'border-slate-200 text-slate-600'}`}>{a.label}</button>)}</div>{acabamento === 'outro' && <input data-preserve-case="true" value={acabamentoOutroTexto} onChange={e => { limparErroValidacaoAoEditar(); setAcabamentoOutroTexto(e.target.value) }} placeholder="Qual cor?" className="w-full border border-slate-300 rounded-xl p-3 text-sm mt-3" />}</section>
        <section className="bg-white rounded-2xl border border-slate-200 p-6"><label className="block text-sm font-medium text-slate-700 mb-3">Contramarco *</label><div className="grid grid-cols-2 gap-2"><button onClick={() => { limparErroValidacaoAoEditar(); setContramarco('com') }} className={`p-3 rounded-xl text-sm border ${contramarco === 'com' ? 'border-brand-navy bg-brand-navyLight font-medium' : 'border-slate-200'}`}>Com contramarco</button><button onClick={() => { limparErroValidacaoAoEditar(); setContramarco('sem') }} className={`p-3 rounded-xl text-sm border ${contramarco === 'sem' ? 'border-brand-navy bg-brand-navyLight font-medium' : 'border-slate-200'}`}>Sem contramarco</button></div></section>
        <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3"><h3 className="text-sm font-medium text-slate-700">Arquiteto / Engenheiro (opcional)</h3><input data-preserve-case="true" value={arquitetoNome} onChange={e => setArquitetoNome(e.target.value)} placeholder="Nome do arquiteto ou engenheiro" className="w-full border border-slate-300 rounded-xl p-3 text-sm" /><input data-preserve-case="true" value={arquitetoContato} onChange={e => setArquitetoContato(e.target.value)} placeholder="Telefone / WhatsApp de contato" className="w-full border border-slate-300 rounded-xl p-3 text-sm" /></section>
        <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3"><h3 className="text-sm font-medium text-slate-700">Arquivos (opcional)</h3>{arquivos.map((arquivo,i) => <div key={i} className="flex items-center justify-between border rounded-lg px-3 py-2"><span className="truncate text-sm">{arquivo.name}</span><button onClick={() => setArquivos(prev => prev.filter((_,idx) => idx !== i))}><X size={14} /></button></div>)}<label className="flex items-center gap-2 w-fit px-3 py-2 border border-dashed rounded-lg text-xs cursor-pointer"><Paperclip size={14} /> Adicionar arquivo<input type="file" multiple className="hidden" onChange={e => adicionarArquivos(e.target.files)} /></label></section>

        <div className="space-y-4"><h3 className="text-sm font-medium text-slate-700">Esquadrias do orçamento</h3>{itens.map((item,idx) => <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-400">Esquadria {idx + 1}</span>{itens.length > 1 && <button onClick={() => removerItem(item.id)} className="text-red-400"><Trash2 size={16} /></button>}</div>
          {!item.itemTipo ? <div className="space-y-3"><div><p className="text-sm font-semibold text-slate-800">O que você vai adicionar?</p><p className="text-xs text-slate-500">Escolha primeiro o tipo do item.</p></div><div className="grid grid-cols-2 gap-2">{([['sob_medida','Sob medida'],['medida_padrao','Medida padrão'],['kit_porta_pronta','Kit porta pronta'],['material_avulso','Material avulso']] as const).map(([v,l])=><button type="button" key={v} onClick={()=>atualizarItemCampos(item.id,{itemTipo:v,materialCategoria:v==='material_avulso'?'perfil':null,tipo:v==='sob_medida'?'':'outro',tipoOutroTexto:''})} className="min-h-20 rounded-xl border-2 border-slate-200 bg-white p-3 text-left text-sm font-semibold text-slate-800 hover:border-brand-navy"><span className="block">{l}</span><span className="mt-1 block text-[11px] font-normal text-slate-500">{v==='sob_medida'?'Tipologia e variáveis técnicas':v==='medida_padrao'?'Produto com medidas cadastradas':v==='kit_porta_pronta'?'Kit previamente cadastrado':'Perfil, acessório, vidro ou outros'}</span></button>)}</div></div> : <><button type="button" onClick={()=>atualizarItemCampos(item.id,{itemTipo:'',produtoId:null,produtoNome:null,materialCategoria:null,contramarcoOverride:null})} className="text-xs font-semibold text-brand-navy">← Trocar tipo de item</button>
          <div><label className="block text-xs text-slate-500 mb-1">Ambiente (opcional)</label><input data-preserve-case="true" value={item.ambiente} onChange={e => atualizarItem(item.id,'ambiente',e.target.value)} placeholder="Ex: Sala, Quarto 1, Cozinha..." className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" /></div>
          {item.itemTipo==='sob_medida' && <>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between gap-3 mb-2"><div><p className="text-xs font-semibold text-slate-700">Tipo de medida desta esquadria</p><p className="text-[11px] text-slate-500">Padrão: medida comum. Use medida final somente se o vão já estiver pronto.</p></div></div><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => atualizarItem(item.id,'tipoMedida','comum')} className={`rounded-lg border px-3 py-2 text-sm ${item.tipoMedida === 'comum' ? 'border-brand-navy bg-brand-navy text-white font-medium' : 'border-slate-300 bg-white text-slate-600'}`}>Medida comum</button><button type="button" onClick={() => atualizarItem(item.id,'tipoMedida','final')} className={`rounded-lg border px-3 py-2 text-sm ${item.tipoMedida === 'final' ? 'border-emerald-600 bg-emerald-600 text-white font-medium' : 'border-slate-300 bg-white text-slate-600'}`}>Medida final</button></div></div>

          {item.tipoMedida === 'final' ? <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
            <p className="text-xs font-medium text-emerald-800">Medição final — registre 3 larguras e 3 alturas ou fotografe a trena.</p>
            <div className="space-y-2"><div className="flex items-center justify-between gap-2"><label className="text-xs text-slate-500">Larguras — baixo, meio, cima</label><div className="flex rounded-lg border overflow-hidden"><button type="button" onClick={() => atualizarItem(item.id,'modoLargura','digitar')} className={`px-2 py-1 text-xs flex gap-1 items-center ${item.modoLargura === 'digitar' ? 'bg-brand-navy text-white' : 'bg-white'}`}><Keyboard size={12}/>Digitar</button><button type="button" onClick={() => atualizarItem(item.id,'modoLargura','foto')} className={`px-2 py-1 text-xs flex gap-1 items-center ${item.modoLargura === 'foto' ? 'bg-brand-navy text-white' : 'bg-white'}`}><Camera size={12}/>Foto</button></div></div>{item.modoLargura === 'digitar' ? <div className="grid grid-cols-3 gap-2"><input type="number" value={item.larguraBaixo} onChange={e => atualizarItem(item.id,'larguraBaixo',e.target.value)} placeholder="Baixo" className="border rounded-lg p-2.5 text-sm"/><input type="number" value={item.larguraMeio} onChange={e => atualizarItem(item.id,'larguraMeio',e.target.value)} placeholder="Meio" className="border rounded-lg p-2.5 text-sm"/><input type="number" value={item.larguraCima} onChange={e => atualizarItem(item.id,'larguraCima',e.target.value)} placeholder="Cima" className="border rounded-lg p-2.5 text-sm"/></div> : item.fotoLarguraPreview ? <img src={item.fotoLarguraPreview} alt="Larguras" onClick={() => setFotoAmpliada(item.fotoLarguraPreview!)} className="w-24 h-24 object-cover rounded-lg cursor-pointer"/> : <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-xl py-4 text-sm cursor-pointer"><Camera size={16}/> Foto da trena com as 3 larguras<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => definirFotoLargura(item.id,e.target.files?.[0])}/></label>}</div>
            <div className="space-y-2"><div className="flex items-center justify-between gap-2"><label className="text-xs text-slate-500">Alturas — direita, meio, esquerda</label><div className="flex rounded-lg border overflow-hidden"><button type="button" onClick={() => atualizarItem(item.id,'modoAltura','digitar')} className={`px-2 py-1 text-xs flex gap-1 items-center ${item.modoAltura === 'digitar' ? 'bg-brand-navy text-white' : 'bg-white'}`}><Keyboard size={12}/>Digitar</button><button type="button" onClick={() => atualizarItem(item.id,'modoAltura','foto')} className={`px-2 py-1 text-xs flex gap-1 items-center ${item.modoAltura === 'foto' ? 'bg-brand-navy text-white' : 'bg-white'}`}><Camera size={12}/>Foto</button></div></div>{item.modoAltura === 'digitar' ? <div className="grid grid-cols-3 gap-2"><input type="number" value={item.alturaDireita} onChange={e => atualizarItem(item.id,'alturaDireita',e.target.value)} placeholder="Direita" className="border rounded-lg p-2.5 text-sm"/><input type="number" value={item.alturaMeio} onChange={e => atualizarItem(item.id,'alturaMeio',e.target.value)} placeholder="Meio" className="border rounded-lg p-2.5 text-sm"/><input type="number" value={item.alturaEsquerda} onChange={e => atualizarItem(item.id,'alturaEsquerda',e.target.value)} placeholder="Esquerda" className="border rounded-lg p-2.5 text-sm"/></div> : item.fotoAlturaPreview ? <img src={item.fotoAlturaPreview} alt="Alturas" onClick={() => setFotoAmpliada(item.fotoAlturaPreview!)} className="w-24 h-24 object-cover rounded-lg cursor-pointer"/> : <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-xl py-4 text-sm cursor-pointer"><Camera size={16}/> Foto da trena com as 3 alturas<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => definirFotoAltura(item.id,e.target.files?.[0])}/></label>}</div>
            <div><label className="block text-xs text-slate-500 mb-1">Quantidade</label><input type="number" value={item.quantidade} onChange={e => atualizarItem(item.id,'quantidade',e.target.value)} min="1" className="w-full border rounded-lg p-2.5 text-sm"/></div>
          </div> : <div className="grid grid-cols-3 gap-3"><div><label className="block text-xs text-slate-500 mb-1">Largura (mm)</label><input type="number" value={item.largura} onChange={e => atualizarItem(item.id,'largura',e.target.value)} placeholder="1800" className="w-full border rounded-lg p-2.5 text-sm"/></div><div><label className="block text-xs text-slate-500 mb-1">Altura (mm)</label><input type="number" value={item.altura} onChange={e => atualizarItem(item.id,'altura',e.target.value)} placeholder="2100" className="w-full border rounded-lg p-2.5 text-sm"/></div><div><label className="block text-xs text-slate-500 mb-1">Quantidade</label><input type="number" value={item.quantidade} onChange={e => atualizarItem(item.id,'quantidade',e.target.value)} min="1" className="w-full border rounded-lg p-2.5 text-sm"/></div></div>}
          </>}
          {item.itemTipo==='sob_medida' ? <SeletorEsquadriaInteligente value={{ modoOrigem:item.modoOrigem, produtoId:item.produtoId, precoUnit:item.precoUnit, tipo:item.tipo, tipoOutroTexto:item.tipoOutroTexto, folhas:item.folhas, largura:item.largura, altura:item.altura, linhaId:item.linhaId, linhaNome:item.linhaNome, tipologiaId:item.tipologiaId, configuracaoPresetId:item.configuracaoPresetId, configuracaoNome:item.configuracaoNome, configuracaoValidada:item.configuracaoValidada, modoConfiguracao:item.modoConfiguracao, configuracaoStatus:item.configuracaoStatus, variaveis:item.variaveis }} onChange={patch => atualizarItemCampos(item.id, patch)} /> : <CatalogoItemAtlas item={item} onChange={patch=>atualizarItemCampos(item.id,patch)} />}
          {item.itemTipo==='sob_medida' && item.tipo && !item.tipologiaId && <div><label className="block text-xs text-slate-500 mb-1">Quantidade de folhas (opcional / ajuste)</label><input data-preserve-case="true" value={item.folhas} onChange={e => atualizarItem(item.id,'folhas',e.target.value)} placeholder="Ex: 2 ou 2 fixas + 1 móvel" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" /></div>}

          {item.itemTipo==='sob_medida' ? <>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-700">Contramarco na obra</p>
            <p className="mb-2 text-[11px] text-slate-500">{contramarco==='com'?'A obra está com contramarco. Se esta tipologia não tiver contramarco, selecione abaixo.':'A obra está sem contramarco. Se esta tipologia tiver contramarco, selecione abaixo.'}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={()=>atualizarItem(item.id,'contramarcoOverride','com')} className={`rounded-lg border px-2 py-2 text-xs ${(item.contramarcoOverride ?? contramarco)==='com'?'border-brand-navy bg-brand-navy text-white':'bg-white'}`}>Com contramarco</button>
              <button type="button" onClick={()=>atualizarItem(item.id,'contramarcoOverride','sem')} className={`rounded-lg border px-2 py-2 text-xs ${(item.contramarcoOverride ?? contramarco)==='sem'?'border-brand-navy bg-brand-navy text-white':'bg-white'}`}>Sem contramarco</button>
            </div>
          </div>


          </> : <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div><label className="block text-xs text-slate-500 mb-1">Quantidade</label><input type="number" value={item.quantidade} onChange={e => atualizarItem(item.id,'quantidade',e.target.value)} min="1" className="w-full border rounded-lg p-2.5 text-sm"/></div>
            {item.itemTipo!=='material_avulso' && <div><p className="mb-2 text-xs font-semibold text-slate-700">Contramarco na obra</p><p className="mb-2 text-[11px] text-slate-500">{contramarco==='com'?'A obra está com contramarco. Se este item não tiver contramarco, selecione abaixo.':'A obra está sem contramarco. Se este item tiver contramarco, selecione abaixo.'}</p><div className="grid grid-cols-2 gap-2"><button type="button" onClick={()=>atualizarItem(item.id,'contramarcoOverride','com')} className={`rounded-lg border px-2 py-2 text-xs ${(item.contramarcoOverride ?? contramarco)==='com'?'border-brand-navy bg-brand-navy text-white':'bg-white'}`}>Com contramarco</button><button type="button" onClick={()=>atualizarItem(item.id,'contramarcoOverride','sem')} className={`rounded-lg border px-2 py-2 text-xs ${(item.contramarcoOverride ?? contramarco)==='sem'?'border-brand-navy bg-brand-navy text-white':'bg-white'}`}>Sem contramarco</button></div></div>}
          </div>}

          <div><label className="block text-xs text-slate-500 mb-2">Fotos (opcional)</label><div className="flex flex-wrap gap-2">{item.fotosPreviews.map((src,i) => <div key={i} className="relative w-24 h-24"><img src={src} alt="Foto" onClick={() => setFotoAmpliada(src)} className="w-24 h-24 object-cover rounded-lg cursor-pointer"/><button onClick={() => removerFotoItem(item.id,i)} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full"><X size={12}/></button></div>)}<label className="flex flex-col items-center justify-center gap-1 w-24 h-24 border border-dashed rounded-lg text-xs cursor-pointer"><Camera size={16}/>Adicionar<input type="file" accept="image/*" multiple className="hidden" onChange={e => { adicionarFotoItem(item.id,e.target.files); e.target.value='' }}/></label></div></div>
          <div><label className="block text-xs text-slate-500 mb-1">Cor desta esquadria (opcional)</label><input data-preserve-case="true" value={item.cor} onChange={e => atualizarItem(item.id,'cor',e.target.value)} placeholder="Só preencha se for diferente da cor geral" className="w-full border rounded-lg p-2.5 text-sm"/></div>
          {item.itemTipo==='sob_medida' ? <><div className="grid gap-3 sm:grid-cols-2"><div><label className="block text-xs text-slate-500 mb-1">Obs. do projeto para o cliente</label><textarea data-preserve-case="true" value={item.descricao} onChange={e => atualizarItem(item.id,'descricao',e.target.value)} placeholder="Texto que poderá aparecer no orçamento..." className="w-full h-20 border rounded-lg p-2.5 text-sm resize-none"/></div><div><label className="block text-xs text-slate-500 mb-1">Observações para produção</label><textarea data-preserve-case="true" value={item.observacaoProducao} onChange={e => atualizarItem(item.id,'observacaoProducao',e.target.value)} placeholder="Informações que devem acompanhar a medida final e a produção..." className="w-full h-20 border rounded-lg p-2.5 text-sm resize-none"/></div></div><div className="grid gap-2 sm:grid-cols-2"><button type="button" onClick={()=>duplicarItemNovaMedida(item)} className="rounded-xl border border-brand-navy px-3 py-2.5 text-xs font-bold text-brand-navy hover:bg-brand-navyLight">Incluir mesmo item e informar nova medida</button><button type="button" onClick={adicionarOutroProjeto} className="rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50">Escolher outro projeto</button></div></> : <div><label className="block text-xs text-slate-500 mb-1">Observação (opcional)</label><textarea data-preserve-case="true" value={item.descricao} onChange={e => atualizarItem(item.id,'descricao',e.target.value)} placeholder="Alguma observação da obra pro orçamentista saber..." className="w-full h-16 border rounded-lg p-2.5 text-sm resize-none"/></div>}</>}
        </div>)}<button onClick={() => setItens(prev => [...prev, fluxoSobMedida ? { ...novoItem(), itemTipo: 'sob_medida' } : novoItem()])} className="w-full py-3 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-slate-500"><Plus size={16}/>{fluxoSobMedida ? 'Escolher outro projeto' : 'Adicionar outra esquadria'}</button></div>
        {erro && <p className="text-red-500 text-sm text-center">{erro}</p>}<button type="button" onClick={() => void salvar()} disabled={salvando && !erroEhValidacao} className="w-full py-3.5 bg-brand-navy text-white rounded-xl font-medium flex items-center justify-center gap-2"><Send size={18}/>{salvando ? 'Salvando...' : fluxoSobMedida ? 'Salvar orçamento e continuar' : 'Enviar pedido'}</button>
      </main>

      {conferenciaAberta && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-3 sm:p-4">
          <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]">
            <div className="flex shrink-0 items-start justify-between border-b px-4 py-3 sm:px-5 sm:py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Conferência final do orçamento</h2>
                <p className="mt-1 text-sm text-slate-500">Confira cada esquadria e o tipo de medida.</p>
              </div>
              <button
                type="button"
                aria-label="Fechar conferência"
                onClick={() => setConferenciaAberta(false)}
                className="shrink-0 rounded-lg p-1 text-slate-600"
              >
                <X size={18}/>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5 sm:py-4">
              <div className="mb-4 grid gap-3 rounded-xl border bg-slate-50 p-4 sm:grid-cols-3">
                <div><p className="text-[11px] uppercase text-slate-400">Cliente</p><p className="font-semibold">{clienteNome}</p></div>
                <div><p className="text-[11px] uppercase text-slate-400">Cidade</p><p className="font-semibold">{cidade}</p></div>
                <div><p className="text-[11px] uppercase text-slate-400">Resumo</p><p className="font-semibold">{itens.length} {itens.length===1?'item':'itens'} • {totalEsquadrias} esquadria(s)</p></div>
              </div>
              <div className="space-y-3">
                {itens.map((item,idx) => (
                  <div key={item.id} className="rounded-xl border-2 border-slate-200 p-4">
                    <div className="flex justify-between gap-3">
                      <div><p className="text-xs uppercase text-slate-400">Item {idx+1}</p><p className="font-bold">{item.quantidade || '1'}x {nomeTipologia(item)}</p></div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${item.tipoMedida === 'final' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.tipoMedida === 'final' ? 'Medida final' : 'Medida comum'}</span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2"><p><b>Medidas:</b> {resumoMedidas(item)}</p><p><b>Linha:</b> {item.linhaNome || 'Não informada'}</p><p><b>Folhas:</b> {item.folhas || 'Não informado'}</p><p><b>Cor:</b> {item.cor || (acabamento === 'outro' ? acabamentoOutroTexto : acabamento) || 'Não informada'}</p></div>
                    {item.ambiente && <p className="mt-2 text-xs"><b>Ambiente:</b> {item.ambiente}</p>}
                    {item.descricao && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"><b>Observação:</b> {item.descricao}</p>}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid shrink-0 gap-2 border-t bg-slate-50 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:grid-cols-2 sm:gap-3 sm:px-5 sm:py-4">
              <button type="button" onClick={() => setConferenciaAberta(false)} className="rounded-xl border bg-white px-4 py-3 text-sm font-semibold">Voltar e corrigir</button>
              <button type="button" onClick={() => void confirmarEnvio()} disabled={salvando} className="flex items-center justify-center gap-2 rounded-xl bg-brand-teal px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"><Send size={17}/>{salvando?'Enviando...':'Confirmar e enviar'}</button>
            </div>
          </div>
        </div>
      )}
      {fotoAmpliada && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setFotoAmpliada(null)}><button className="absolute top-4 right-4 text-white" onClick={() => setFotoAmpliada(null)}><X size={20}/></button><img src={fotoAmpliada} alt="Foto ampliada" onClick={e => e.stopPropagation()} className="max-w-full max-h-full object-contain rounded-lg"/></div>}
    </div>
  )
}