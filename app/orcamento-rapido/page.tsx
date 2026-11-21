'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Calculator, Camera, CheckCircle, Keyboard, Check, ClipboardList, FileText, Info, Ruler, Copy, ChevronDown, ChevronUp, Pencil, Plus, Send, Trash2, WifiOff, X, MapPin, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { v4 as uuidv4 } from 'uuid'
import { Acabamento, Cliente, Contramarco, OrigemCliente, TemperaturaLead, TipoEsquadria } from '@/lib/tipos'
import BuscaClientesComGestao, { type ClienteResultadoGestao } from '@/components/clientes/BuscaClientesComGestao'
import { criarOrcamentoNoServidor, DadosOrcamentoForm } from '@/lib/orcamentos'
import { descricaoMedidaPadrao } from '@/lib/orcamentoRapidoProdutoLivre'
import { obterRascunho, removerRascunho, salvarPendente, salvarRascunho } from '@/lib/offlineFila'
import { supabase } from '@/lib/supabase'
import { usuarioAtual, usuarioCacheLocal } from '@/lib/auth'
import { chaveRascunhoOrcamentoValida, PREFIXO_RASCUNHO_ORCAMENTO } from '@/lib/rascunhosOrcamento'
import { formatarEnderecoObra, coordenadasDaObra, coordenadasEmTexto, decomporEnderecoObra, linkRotaObra, localizacaoRegistradaNaObra } from '@/lib/enderecoObra'


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
  larguraBatenteMm: string
  larguraGuarnicaoMm: string
  // Apenas para recuperar rascunhos feitos antes da mudança da unidade.
  larguraBatenteCm?: string
  larguraGuarnicaoCm?: string
  descricao: string
  observacaoGeral: string
  observacaoCliente: string
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
    id: uuidv4(), itemTipo: '', materialCategoria: null, materialUnidade: null, produtoNome: null, contramarcoOverride: null, ambiente: '', tipo: '', tipoOutroTexto: '', folhas: '', largura: '', altura: '', quantidade: '', larguraBatenteMm: '', larguraGuarnicaoMm: '', descricao: '', observacaoGeral: '', observacaoCliente: '', observacaoTempera: '', observacaoProducao: '', cor: '',
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
  if (item.itemTipo === 'kit_porta_pronta') return item.tipoOutroTexto.trim() || item.produtoNome || 'Kit porta pronta'
  if (item.tipo === 'outro' && item.tipoOutroTexto.trim()) return item.tipoOutroTexto.trim()
  const tipo = String(item.tipo || 'Esquadria').replace(/[_-]+/g, ' ').trim()
  return tipo ? tipo.charAt(0).toUpperCase() + tipo.slice(1) : 'Esquadria'
}

function recuperarMedidasKitAnotadas(item: ItemForm): ItemForm {
  if (item.itemTipo !== 'kit_porta_pronta' || !item.descricao) return item
  // Compatibilidade com levantamentos antigos: "800 x 2170 / Batente 20 / Guarnição 6".
  const dimensao = item.descricao.match(/\b(\d{3,4})\s*[x×]\s*(\d{3,4})\b/i)
  const batente = item.descricao.match(/\bbatente\s*[:=-]?\s*(\d+(?:[,.]\d+)?)/i)
  const guarnicao = item.descricao.match(/\bguarni[çc][ãa]o\s*[:=-]?\s*(\d+(?:[,.]\d+)?)/i)
  return {
    ...item,
    largura: item.largura || dimensao?.[1] || '',
    altura: item.altura || dimensao?.[2] || '',
    larguraBatenteMm: item.larguraBatenteMm || item.larguraBatenteCm || batente?.[1] || '',
    larguraGuarnicaoMm: item.larguraGuarnicaoMm || item.larguraGuarnicaoCm || guarnicao?.[1] || '',
  }
}

function resumoMedidas(item: ItemForm) {
  if (item.itemTipo === 'kit_porta_pronta') return `${item.largura || '—'} × ${item.altura || '—'} mm · Batente ${item.larguraBatenteMm || '—'} mm · Guarnição ${item.larguraGuarnicaoMm || '—'} mm`
  if (item.tipoMedida !== 'final') return `${item.largura} × ${item.altura} mm`
  const larguras = item.modoLargura === 'foto' ? 'Larguras por foto' : `L ${item.larguraBaixo} / ${item.larguraMeio} / ${item.larguraCima} mm`
  const alturas = item.modoAltura === 'foto' ? 'Alturas por foto' : `A ${item.alturaDireita} / ${item.alturaMeio} / ${item.alturaEsquerda} mm`
  return `${larguras} • ${alturas}`
}

type ProdutoAtlasBusca = { id:string; codigo?:string|null; nome:string; categoria?:string|null; unidade?:string|null; preco?:number|null; custo?:number|null; descricao?:string|null; foto_url?:string|null }

function nomeNormalizado(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

function CatalogoItemAtlas({item,onChange}:{item:ItemForm;onChange:(patch:Partial<ItemForm>)=>void}) {
  // O texto digitado é parte do item/rascunho, não somente do campo de busca.
  const [busca,setBusca]=useState(item.produtoNome || item.tipoOutroTexto || '')
  const [buscaAberta,setBuscaAberta]=useState(false)
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
    if(!buscaAberta||busca.trim().length<2){setResultados([]);setCarregando(false);return}
    const timer=window.setTimeout(async()=>{
      setCarregando(true)
      const termo=busca.trim().replace(/[,%()]/g,' ')
      let q=supabase.from('produtos').select('id,codigo,nome,categoria,unidade,preco,custo,descricao,foto_url').eq('ativo',true).or(`codigo.ilike.%${termo}%,nome.ilike.%${termo}%,descricao.ilike.%${termo}%`)
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
  },[busca,buscaAberta,item.itemTipo,item.materialCategoria])

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
        .select('id,codigo,nome,categoria,unidade,preco,custo,descricao,foto_url')
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
          .select('id,codigo,nome,categoria,unidade,preco,custo,descricao,foto_url')
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
      setBuscaAberta(false)
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
  const podeOferecerCadastro=buscaAberta&&item.itemTipo==='medida_padrao'&&busca.trim().length>=2&&!carregando&&!resultados.length&&!item.produtoId

  return <div onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))window.setTimeout(()=>setBuscaAberta(false),120)}} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
    {item.itemTipo==='material_avulso'&&<div><label className="mb-1 block text-xs text-slate-500">Categoria</label><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{([['perfil','Perfil'],['acessorio','Acessório'],['vidro','Vidro'],['outros','Outros']] as const).map(([v,l])=><button type="button" key={v} onClick={()=>{setBusca('');setResultados([]);onChange({materialCategoria:v,produtoId:null,produtoNome:null})}} className={`rounded-lg border px-2 py-2 text-xs ${item.materialCategoria===v?'border-brand-navy bg-brand-navy text-white':'bg-white'}`}>{l}</button>)}</div></div>}
    {item.itemTipo==='kit_porta_pronta'&&<p className="text-xs text-blue-800">O catálogo é opcional. Você pode digitar o tipo de porta aqui ou descrevê-lo nas observações para liberar o envio.</p>}
    {item.itemTipo==='medida_padrao'&&<p className="text-xs text-blue-800">Produto não cadastrado? Escreva o nome normalmente e envie o orçamento. O cadastro e a conferência de custo/preço podem ser feitos depois.</p>}
    <div><label className="mb-1 block text-xs text-slate-500">{item.itemTipo==='kit_porta_pronta'?'Tipo de porta / buscar kit cadastrado':rotulo}</label><input value={busca} onFocus={()=>setBuscaAberta(true)} onKeyDown={e=>{if(e.key==="Escape")setBuscaAberta(false)}} onChange={e=>{const texto=e.target.value;setBusca(texto);if(item.itemTipo==='kit_porta_pronta')onChange({tipoOutroTexto:texto,produtoId:null,produtoNome:null,precoUnit:null,modoOrigem:'manual'});else if(item.itemTipo==='medida_padrao')onChange({tipo:'outro',tipoOutroTexto:texto,produtoNome:texto,produtoId:null,precoUnit:null,modoOrigem:'manual'});else if(item.produtoId)onChange({produtoId:null,produtoNome:null,precoUnit:null,modoOrigem:'manual'})}} placeholder={item.itemTipo==='medida_padrao'?'Digite o nome do produto pronto...':item.itemTipo==='kit_porta_pronta'?'Digite o nome do kit...':'Digite código ou nome...'} className="w-full rounded-lg border p-2.5 text-sm"/>{carregando&&<p className="mt-1 text-xs text-slate-400">Buscando...</p>}</div>
    {buscaAberta&&!!resultados.length&&<div className="max-h-64 overflow-y-auto rounded-lg border bg-white">{resultados.map(p=><button type="button" key={p.id} onClick={()=>{onChange({produtoId:p.id,produtoNome:p.nome,materialUnidade:p.unidade||null,precoUnit:p.preco==null?null:Number(p.preco),tipo:'outro',tipoOutroTexto:p.nome,modoOrigem:'produto'});setBusca(p.codigo?`${p.codigo} · ${p.nome}`:p.nome);setResultados([]);setBuscaAberta(false)}} className="flex w-full items-center gap-3 border-b px-3 py-2 text-left last:border-0 hover:bg-blue-50">
          <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-slate-400">
            {p.foto_url && /^https?:\/\//i.test(p.foto_url) ? <img src={p.foto_url} alt={`Foto do produto ${p.nome}`} className="h-full w-full object-contain"/> : <><Camera size={17}/><span className="mt-0.5 text-[9px]">Sem foto</span></>}
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-sm">{p.codigo?`${p.codigo} · `:''}{p.nome}</b>
            <span className="block text-xs text-slate-500">{p.categoria==='porta_janela_padrao'?'Produto pronto':p.categoria==='kit'?'Kit':p.categoria||'Sem categoria'} · {p.unidade||'un.'}{p.preco!=null?` · R$ ${Number(p.preco).toFixed(2)}`:''}</span>
          </span>
        </button>)}</div>}
    {podeOferecerCadastro&&(podeCadastrarProdutoPronto?<div className="rounded-xl border border-blue-200 bg-blue-50 p-3"><p className="text-xs font-semibold text-blue-900">Produto pronto “{busca.trim()}” não encontrado.</p><p className="mt-1 text-[11px] text-blue-700">Pode enviar com este nome, sem cadastrar agora. Cadastro e preço/custo podem ser completados depois.</p><button type="button" onClick={()=>void cadastrarProdutoPronto()} disabled={cadastrandoProdutoPronto} className="mt-2 rounded-lg bg-brand-navy px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{cadastrandoProdutoPronto?'Cadastrando...':'Cadastrar este produto'}</button></div>:<p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">Produto não encontrado no catálogo. O texto será salvo como descrição livre; o cadastro poderá ser feito depois pelo responsável.</p>)}
    {erroCadastro&&<p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{erroCadastro}</p>}
    {item.produtoId&&<div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">Selecionado: {item.produtoNome}</div>}
  </div>
}

type ArquivoRascunho = { nome: string; tipo: string; ultimaModificacao: number; blob: Blob }

type ObraResumida = { id: string; nome: string; endereco?: string | null; numero_endereco?: string | null; bairro?: string | null; cidade?: string | null; cep?: string | null; observacoes?: string | null }

interface RascunhoOrcamentoRapido {
  itens: ItemForm[]
  clienteIdOrigem: string | null
  clienteNome: string
  usuarioCriadorId?: string | null
  fluxoSobMedida?: boolean
  orcamentoIdDestino?: string | null
  clienteWhatsapp: string
  cidade: string
  obraNome?: string
  obraRua?: string
  obraNumero?: string
  obraBairro?: string
  obraCep?: string
  obraLocalizacao?: string
  obraIdSelecionada?: string | null
  obraLocalizacaoConfirmada?: 'sim' | 'nao' | ''
  obraPrecisaoMetros?: number | null
  origem: OrigemCliente
  temperatura: TemperaturaLead | ''
  acabamento: Acabamento | ''
  acabamentoOutroTexto: string
  contramarco: Contramarco | ''
  arquitetoNome: string
  arquitetoContato: string
  arquivos?: ArquivoRascunho[]
}

type TipoColeta = 'sob_medida' | 'medida_padrao' | 'kit_porta_pronta' | 'material_avulso'
type MedidaColeta = 'comum' | 'final'
type ItemTela = {
  id: string
  tipo: TipoColeta | null
  ambiente: string
  medida: MedidaColeta
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
  larguraBaixo: string
  larguraMeio: string
  larguraCima: string
  alturaDireita: string
  alturaMeio: string
  alturaEsquerda: string
  modoLargura: 'digitar' | 'foto'
  modoAltura: 'digitar' | 'foto'
  fotoLarguraPreview?: string
  fotoAlturaPreview?: string
  larguraBatenteMm: string
  larguraGuarnicaoMm: string
}

const tipos: {id: TipoColeta; nome: string; descricao: string}[] = [
  {id: 'sob_medida', nome: 'Sob medida', descricao: 'Esquadrias feitas para a obra'},
  {id: 'medida_padrao', nome: 'Medida padrão', descricao: 'Produto pronto ou padrão'},
  {id: 'kit_porta_pronta', nome: 'Kit porta pronta', descricao: 'Kit com medidas próprias'},
  {id: 'material_avulso', nome: 'Material avulso', descricao: 'Perfis e acessórios'},
]
const tipoNome = (tipo: TipoColeta | null) => tipos.find(t => t.id === tipo)?.nome || 'Escolher tipo'
const campo = 'w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
const rotulo = 'mb-1.5 block text-xs font-semibold text-slate-600'
const painel = 'rounded-2xl border border-slate-200 bg-white shadow-sm'
const secundario = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:border-blue-300 hover:text-blue-700'

export default function OrcamentoRapido() {
  const [itens, setItens] = useState<ItemForm[]>([novoItem()])
  // Estado visual, independente do salvamento e do envio dos itens.
  const [itensAbertos, setItensAbertos] = useState<Record<string, boolean>>({})
  const [resumo, setResumo] = useState(false)
  const [clienteIdOrigem, setClienteIdOrigem] = useState<string | null>(null)
  const [clienteNome, setClienteNome] = useState('')
  const [buscaClienteAberta, setBuscaClienteAberta] = useState(false)
  const [clienteWhatsapp, setClienteWhatsapp] = useState('')
  const [cidade, setCidade] = useState('')
  const [obraNome, setObraNome] = useState('')
  const [obraRua, setObraRua] = useState('')
  const [obraNumero, setObraNumero] = useState('')
  const [obraBairro, setObraBairro] = useState('')
  const [obraCep, setObraCep] = useState('')
  const [consultandoCepObra,setConsultandoCepObra]=useState(false)
  const [obraLocalizacao, setObraLocalizacao] = useState('')
  const [obraLocalizacaoConfirmada, setObraLocalizacaoConfirmada] = useState<'sim'|'nao'|''>('')
  const [obraPrecisaoMetros, setObraPrecisaoMetros] = useState<number | null>(null)
  const [obraIdSelecionada, setObraIdSelecionada] = useState<string | null>(null)
  const [obrasDoCliente, setObrasDoCliente] = useState<ObraResumida[]>([])
  const [capturandoLocalizacao, setCapturandoLocalizacao] = useState(false)
  const [avisoLocalizacao, setAvisoLocalizacao] = useState('')
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
  const [rascunhoIniciado, setRascunhoIniciado] = useState(false)
  const [rascunhoChave, setRascunhoChave] = useState(() => PREFIXO_RASCUNHO_ORCAMENTO + uuidv4())
  const [rascunhoUsuarioId, setRascunhoUsuarioId] = useState<string | null>(() => usuarioCacheLocal()?.id || null)
  const [rascunhoRestaurado, setRascunhoRestaurado] = useState(false)
  const [rascunhoSalvoEm, setRascunhoSalvoEm] = useState<string | null>(null)
  const [erroSalvamentoLocal, setErroSalvamentoLocal] = useState('')
  const [salvandoRascunhoManual, setSalvandoRascunhoManual] = useState(false)
  const [fluxoSobMedida, setFluxoSobMedida] = useState(false)

  function arquivoParaRascunho(file: File): ArquivoRascunho {
    return { nome: file.name, tipo: file.type, ultimaModificacao: file.lastModified, blob: file }
  }

  function arquivoDoRascunho(item: ArquivoRascunho): File {
    return new File([item.blob], item.nome, { type: item.tipo, lastModified: item.ultimaModificacao })
  }

  // "Novo orçamento" nunca lê um rascunho automaticamente. Somente a ação
  // explícita "Continuar rascunho", pelo Cliente 360, autoriza a restauração.
  useEffect(() => {
    let ativo = true
    const params = new URLSearchParams(window.location.search)
    const chaveSolicitada = params.get('rascunho')
    const limparReferenciaInvalida = () => {
      params.delete('rascunho')
      const busca = params.toString()
      window.history.replaceState({}, '', `${window.location.pathname}${busca ? `?${busca}` : ''}`)
    }
    const usuarioPromessa = usuarioAtual().then(u => {
      if (ativo && u?.id) setRascunhoUsuarioId(u.id)
      return u?.id || usuarioCacheLocal()?.id || null
    }).catch(() => usuarioCacheLocal()?.id || null)

    if (!chaveSolicitada) {
      // Preserva cliente/obra informados na URL, mas não reaproveita medições
      // nem dados antigos de outro atendimento.
      if (params.has('novo')) {
        params.delete('novo')
        const busca = params.toString()
        window.history.replaceState({}, '', `${window.location.pathname}${busca ? `?${busca}` : ''}`)
      }
      setRascunhoCarregado(true)
      return () => { ativo = false }
    }
    if (!chaveRascunhoOrcamentoValida(chaveSolicitada)) {
      limparReferenciaInvalida()
      setErro('O link de rascunho não é válido. Um novo orçamento foi aberto em branco.')
      setRascunhoCarregado(true)
      return () => { ativo = false }
    }

    void (async () => {
      try {
        const [usuarioId, rascunho] = await Promise.all([
          usuarioPromessa, obterRascunho<RascunhoOrcamentoRapido>(chaveSolicitada),
        ])
        if (!ativo) return
        if (!rascunho?.dados) {
          limparReferenciaInvalida()
          setErro('Este rascunho não está disponível neste aparelho. O novo orçamento foi aberto em branco.')
          return
        }
        const d = rascunho.dados
        const clienteDaUrl = params.get('cliente')
        if ((d.usuarioCriadorId && (!usuarioId || d.usuarioCriadorId !== usuarioId)) ||
          (clienteDaUrl && d.clienteIdOrigem && clienteDaUrl !== d.clienteIdOrigem)) {
          limparReferenciaInvalida()
          setErro('Este rascunho pertence a outro usuário ou cliente e não foi carregado.')
          return
        }

        if (d.fluxoSobMedida === true) setFluxoSobMedida(true)
        // Preservar a operação "Adicionar ao orçamento existente" quando o
        // atendimento interrompido é retomado pelo Cliente 360.
        if (d.orcamentoIdDestino && !params.get('adicionarAo')) {
          params.set('adicionarAo', d.orcamentoIdDestino)
          window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`)
        }
        if (Array.isArray(d.itens) && d.itens.length) setItens(d.itens.map(item => {
          const fotos = (item.fotos || []).map((foto: any) => foto instanceof File ? foto : arquivoDoRascunho(foto))
          const fotoLargura = item.fotoLargura ? (item.fotoLargura instanceof File ? item.fotoLargura : arquivoDoRascunho(item.fotoLargura as any)) : undefined
          const fotoAltura = item.fotoAltura ? (item.fotoAltura instanceof File ? item.fotoAltura : arquivoDoRascunho(item.fotoAltura as any)) : undefined
          return recuperarMedidasKitAnotadas({ ...item, larguraBatenteMm: item.larguraBatenteMm || item.larguraBatenteCm || '', larguraGuarnicaoMm: item.larguraGuarnicaoMm || item.larguraGuarnicaoCm || '', observacaoGeral: item.observacaoGeral || '', observacaoCliente: item.observacaoCliente || '', observacaoTempera: item.observacaoTempera || '', observacaoProducao: item.observacaoProducao || '', fotos, fotosPreviews: fotos.map((foto: File) => URL.createObjectURL(foto)), fotoLargura, fotoLarguraPreview: fotoLargura ? URL.createObjectURL(fotoLargura) : undefined, fotoAltura, fotoAlturaPreview: fotoAltura ? URL.createObjectURL(fotoAltura) : undefined })
        }))
        setRascunhoChave(chaveSolicitada)
        setClienteIdOrigem(d.clienteIdOrigem || null)
        setClienteNome(d.clienteNome || '')
        setClienteWhatsapp(d.clienteWhatsapp || '')
        setCidade(d.cidade || '')
        setObraNome(d.obraNome || '')
        setObraRua(d.obraRua || '')
        setObraNumero(d.obraNumero || '')
        setObraBairro(d.obraBairro || '')
        setObraCep(d.obraCep || '')
        setObraLocalizacao(d.obraLocalizacao || '')
        setObraIdSelecionada(d.obraIdSelecionada || null)
        setObraLocalizacaoConfirmada(d.obraLocalizacaoConfirmada || '')
        setObraPrecisaoMetros(d.obraPrecisaoMetros ?? null)
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
        setRascunhoIniciado(true)
      } catch {
        if (ativo) {
          limparReferenciaInvalida()
          setErro('Não foi possível recuperar este rascunho no aparelho. Os outros rascunhos foram preservados.')
        }
      } finally {
        if (ativo) setRascunhoCarregado(true)
      }
    })()
    return () => { ativo = false }
  }, [])

  useEffect(() => {
    if (!rascunhoCarregado || typeof window === 'undefined') return
    const modo = new URLSearchParams(window.location.search).get('modo')
    const sobMedida = modo === 'sob-medida' || (rascunhoRestaurado && fluxoSobMedida)
    setFluxoSobMedida(sobMedida)
    if (!sobMedida) return
    setItens(prev => {
      if (prev.length !== 1 || prev[0].itemTipo) return prev
      return [{ ...prev[0], itemTipo: 'sob_medida', tipo: prev[0].tipo || 'outro' }]
    })
  }, [rascunhoCarregado, rascunhoRestaurado])

  function montarRascunhoAtual(): RascunhoOrcamentoRapido {
    return {
      itens: itens.map(item => ({ ...item, fotos: item.fotos.map(arquivoParaRascunho) as any, fotosPreviews: [], fotoLargura: item.fotoLargura ? arquivoParaRascunho(item.fotoLargura) as any : undefined, fotoLarguraPreview: undefined, fotoAltura: item.fotoAltura ? arquivoParaRascunho(item.fotoAltura) as any : undefined, fotoAlturaPreview: undefined })),
      clienteIdOrigem, clienteNome, usuarioCriadorId: rascunhoUsuarioId, fluxoSobMedida, orcamentoIdDestino: new URLSearchParams(window.location.search).get('adicionarAo'), clienteWhatsapp, cidade, obraNome, obraRua, obraNumero, obraBairro, obraCep, obraLocalizacao, obraIdSelecionada, obraLocalizacaoConfirmada, obraPrecisaoMetros, origem, temperatura,
      acabamento, acabamentoOutroTexto, contramarco, arquitetoNome, arquitetoContato,
      arquivos: arquivos.map(arquivoParaRascunho),
    }
  }

  async function salvarRascunhoAgora() {
    if (salvandoRascunhoManual) return
    if (!clienteNome.trim()) {
      setErroSalvamentoLocal('Informe o nome do cliente para salvar o rascunho.')
      return
    }
    setSalvandoRascunhoManual(true)
    try {
      await salvarRascunho(rascunhoChave, montarRascunhoAtual())
      setRascunhoSalvoEm(new Date().toISOString())
      setErroSalvamentoLocal('')
    } catch {
      setErroSalvamentoLocal('Não foi possível salvar a medição neste aparelho. Mantenha a tela aberta e confira o espaço do navegador.')
    } finally {
      setSalvandoRascunhoManual(false)
    }
  }

  useEffect(() => {
    // O primeiro nome preenchido (também por seleção/prefill) deve gerar rascunho.
    // Falhas transitórias ao resolver o perfil não podem impedir a proteção local:
    // quando o ID da sessão chegar, a mesma chave será atualizada com o autor.
    if (!rascunhoCarregado || salvando || salvo || salvoOffline || !clienteNome.trim()) return
    const timer = window.setTimeout(() => {
      salvarRascunho(rascunhoChave, montarRascunhoAtual())
        .then(() => { setRascunhoSalvoEm(new Date().toISOString()); setErroSalvamentoLocal('') })
        .catch(() => setErroSalvamentoLocal('Falha ao salvar localmente. Mantenha esta tela aberta e toque em “Salvar medição agora”.'))
    }, 350)
    return () => window.clearTimeout(timer)
  }, [rascunhoCarregado, rascunhoIniciado, rascunhoChave, rascunhoUsuarioId, itens, clienteIdOrigem, clienteNome, clienteWhatsapp, cidade, obraNome, obraRua, obraNumero, obraBairro, obraCep, obraLocalizacao, obraIdSelecionada, obraLocalizacaoConfirmada, obraPrecisaoMetros, origem, temperatura, acabamento, acabamentoOutroTexto, contramarco, arquitetoNome, arquitetoContato, arquivos, fluxoSobMedida, salvando, salvo, salvoOffline])

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

  function selecionarClienteExistente(c: ClienteResultadoGestao) {
    setClienteIdOrigem(c.id)
    setClienteNome(c.nome)
    setClienteWhatsapp(c.whatsapp || c.telefone || '')
    if (c.cidade) setCidade(c.cidade)
    setObraIdSelecionada(null)
    setObrasDoCliente([])
  }

  // Um cliente pode ter várias obras. O vínculo sempre é com a OBRA escolhida,
  // não com a última localização cadastrada para o cliente.
  useEffect(() => {
    if (!rascunhoCarregado || !clienteIdOrigem || typeof navigator === 'undefined' || !navigator.onLine) return
    let ativo = true
    void supabase.from('obras')
      .select('id,nome,endereco,numero_endereco,bairro,cidade,cep,observacoes')
      .eq('cliente_id', clienteIdOrigem).order('created_at', { ascending: false }).then(({data, error}) => {
        if (!ativo || error) return
        const obras = (data || []) as ObraResumida[]
        setObrasDoCliente(obras)
        const idUrl = rascunhoRestaurado ? null : new URLSearchParams(window.location.search).get('obra')
        if (idUrl && !obraIdSelecionada) {
          const encontrada = obras.find(item => item.id === idUrl)
          if (encontrada) preencherDaObraExistente(encontrada)
        }
      })
    return () => { ativo = false }
  }, [rascunhoCarregado, rascunhoRestaurado, clienteIdOrigem])

  function preencherDaObraExistente(obra: ObraResumida) {
    const endereco = decomporEnderecoObra(obra.endereco, obra.numero_endereco, obra.cep)
    setObraIdSelecionada(obra.id)
    setObraNome(obra.nome)
    setObraRua(endereco.rua)
    setObraNumero(endereco.numero)
    setObraCep(endereco.cep)
    setObraBairro(obra.bairro || '')
    if (obra.cidade) setCidade(obra.cidade)
    const coordenadas = localizacaoRegistradaNaObra(obra.observacoes)
    setObraLocalizacao(coordenadas || '')
    setObraPrecisaoMetros(null) // Precisión anterior não é conhecida nesta consulta.
    setObraLocalizacaoConfirmada(coordenadas && obra.observacoes?.includes('Localização conferida: Sim') ? 'sim' : '')
    setAvisoLocalizacao(coordenadas ? 'Localização recuperada desta obra. Confira no mapa antes de enviar.' : '')
    limparErroValidacaoAoEditar()
  }

  function escolherObraExistente(id: string) {
    const obra = obrasDoCliente.find(item => item.id === id)
    if (obra) return preencherDaObraExistente(obra)
    setObraIdSelecionada(null)
    setObraNome(''); setObraRua(''); setObraNumero(''); setObraBairro(''); setObraCep('')
    setObraLocalizacao(''); setObraLocalizacaoConfirmada(''); setObraPrecisaoMetros(null); setAvisoLocalizacao('')
    limparErroValidacaoAoEditar()
  }

  async function consultarCepDaObra(){
    if(obraCep.replace(/\D/g,'').length!==8){
      setAvisoLocalizacao('Informe um CEP com oito dígitos.')
      return
    }
    setConsultandoCepObra(true)
    setAvisoLocalizacao('Consultando CEP na base postal...')
    try{
      const resp=await fetch('/api/geocodificacao/cep?cep='+encodeURIComponent(obraCep))
      const dados=await resp.json() as {cep?:string;rua?:string;bairro?:string;cidade?:string;error?:string}
      if(!resp.ok) throw new Error(dados.error||'CEP não encontrado.')
      limparErroValidacaoAoEditar()
      setObraCep(dados.cep||obraCep)
      if(dados.rua) setObraRua(dados.rua)
      if(dados.bairro) setObraBairro(dados.bairro)
      if(dados.cidade) setCidade(dados.cidade)
      setAvisoLocalizacao('CEP consultado na base postal. Confira o número do imóvel antes de enviar.')
    }catch(e){
      setAvisoLocalizacao(e instanceof Error?e.message:'Falha na consulta de CEP.')
    }finally{
      setConsultandoCepObra(false)
    }
  }

  function capturarEnderecoDaObra() {
    if (capturandoLocalizacao) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setAvisoLocalizacao('Localização indisponível neste aparelho. Digite o endereço manualmente.')
      return
    }
    if (!window.isSecureContext) {
      setAvisoLocalizacao('O GPS exige conexão segura (HTTPS). Digite o endereço manualmente.')
      return
    }
    setCapturandoLocalizacao(true)
    setAvisoLocalizacao('Buscando sua localização. Aguarde...')
    navigator.geolocation.getCurrentPosition(async pos => {
      const coordenadas = coordenadasDaObra(pos.coords.latitude, pos.coords.longitude)
      if (!coordenadas) {
        setAvisoLocalizacao('Coordenadas inválidas. Digite o endereço manualmente.')
        setCapturandoLocalizacao(false)
        return
      }
      setObraLocalizacao(coordenadas)
      setObraPrecisaoMetros(Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null)
      setObraLocalizacaoConfirmada('')
      limparErroValidacaoAoEditar()
      setAvisoLocalizacao('Localização capturada. Buscando rua e bairro...')
      try {
        // Reutiliza a geocodificação já usada na prospecção, sem expor token de serviço.
        const resp = await fetch('/api/geocodificacao/reversa?lat='
          + encodeURIComponent(pos.coords.latitude) + '&lon='
          + encodeURIComponent(pos.coords.longitude), { cache: 'no-store' })
        if (!resp.ok) throw new Error('Endereço não localizado.')
        const dados = await resp.json() as { rua?: string; bairro?: string; cidade?: string; cep?: string; numero?: string; numeroOrigem?: string | null; cepAviso?: string }
        if (dados.rua) setObraRua(dados.rua)
        if (dados.bairro) setObraBairro(dados.bairro)
        if (dados.cidade) setCidade(dados.cidade)
        setObraCep(dados.cep || '')
        if (dados.numero) setObraNumero(atual => atual.trim() ? atual : dados.numero || '')
        setAvisoLocalizacao(dados.cepAviso || (dados.rua ? 'Endereço sugerido. Confira bairro, número e CEP.' : 'GPS salvo. Complete o endereço manualmente.'))
      } catch {
        setAvisoLocalizacao('GPS salvo, mas não foi possível identificar a rua. Complete o endereço manualmente.')
      } finally {
        setCapturandoLocalizacao(false)
      }
    }, () => {
      setAvisoLocalizacao('Não foi possível obter a localização. Autorize o GPS ou digite o endereço.')
      setCapturandoLocalizacao(false)
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  }

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
    setItens(prev => [...prev, { ...novoItem(), itemTipo: 'sob_medida', tipo: 'outro' }])
  }

  function duplicarItemCompleto(item: ItemForm) {
    const duplicado: ItemForm = { ...item, id: uuidv4(), fotos: [...item.fotos], fotosPreviews: [...item.fotosPreviews] }
    setItens(prev => [...prev, duplicado])
    setItensAbertos(prev => ({ ...prev, [item.id]: false, [duplicado.id]: true }))
  }

  function adicionarEsquadriaColeta() {
    const novo = { ...novoItem(), ...(fluxoSobMedida ? { itemTipo: 'sob_medida' as const, tipo: 'outro' as const } : {}) }
    setItens(prev => [...prev, novo])
    setItensAbertos(prev => ({ ...prev, [novo.id]: true }))
  }

  function adicionarArquivos(files: FileList | null) {
    if (files) setArquivos(prev => [...prev, ...Array.from(files)])
  }

  async function salvarComoPendente(dadosForm: DadosOrcamentoForm, motivo = '') {
    try {
      await salvarPendente({ id: uuidv4(), tipo: 'orcamento', criadoEm: new Date().toISOString(), usuarioCriadorId: rascunhoUsuarioId, dados: dadosForm })
      await removerRascunho(rascunhoChave).catch(() => {})
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
      clienteId: clienteIdOrigem,
      obraId: obraIdSelecionada,
      obraNome: obraNome.trim(),
      obraEndereco: formatarEnderecoObra(obraRua, obraNumero, obraCep),
      obraBairro: obraBairro.trim(), obraCidade: cidade.trim(),
      obraLocalizacao: obraLocalizacaoConfirmada === 'sim' ? coordenadasEmTexto(obraLocalizacao) || '' : '',
      obraGpsRejeitado: obraLocalizacaoConfirmada === 'nao' ? coordenadasEmTexto(obraLocalizacao) || '' : '',
      orcamentoIdDestino: new URLSearchParams(window.location.search).get('adicionarAo'), itens: itens.map(item => ({ ...item, itemTipo: item.itemTipo || 'sob_medida' })), clienteNome, clienteWhatsapp, cidade, origem,
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
        await removerRascunho(rascunhoChave).catch(() => {})
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

      // Não transformar uma falha de upload em pedido "enviado".
      // Mantém as fotos no rascunho local e informa exatamente qual arquivo falhou.
      if (resultado.error?.startsWith('Falha ao enviar ')) {
        setSalvando(false)
        setErroEhValidacao(true)
        setErro(`${resultado.error} As fotos permanecem neste formulário; confira a conexão e tente enviar novamente.`)
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
    if (!obraNome.trim()) return falharValidacao('Informe o nome da obra. Este campo é obrigatório.')
    const gpsConfirmado = obraLocalizacaoConfirmada === 'sim' && !!coordenadasEmTexto(obraLocalizacao)
    const enderecoInformado = !!obraRua.trim() && !!obraNumero.trim()
    if (!gpsConfirmado && !enderecoInformado) return falharValidacao('Informe rua e número (pode ser S/N) ou confirme a localização GPS da obra.')
    if (obraNumero.trim() && !obraRua.trim()) return falharValidacao('Informe a rua ou avenida da obra antes do número.')
    if (obraRua.trim() && !obraNumero.trim() && !gpsConfirmado) return falharValidacao('Informe o número da obra (ou S/N).')
    if (obraCep.trim() && !/^\d{5}-?\d{3}$/.test(obraCep.trim())) return falharValidacao('Confira o CEP da obra: são 8 dígitos.')

    for (let i = 0; i < itens.length; i++) {
      const it = itens[i]
      const referencia = it.ambiente.trim() || `Esquadria ${i + 1}`
      // Kit pode ser identificado por descrição livre, inclusive em rascunhos antigos.
      if (it.itemTipo === 'kit_porta_pronta') {
        if (!it.produtoId && !it.tipoOutroTexto.trim() && !it.descricao.trim()) return falharValidacao(`Informe o tipo de porta ou uma descrição do kit em ${referencia}`)
        continue
      }
      // Medida padrão sem cadastro entra como descrição livre e fica pendente de precificação.
      if (it.itemTipo === 'medida_padrao') {
        if (!it.produtoId && !descricaoMedidaPadrao(it)) return falharValidacao(`Informe o nome ou descrição do produto de medida padrão em ${referencia}`)
        continue
      }
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
    void removerRascunho(rascunhoChave).catch(() => {})
    setRascunhoSalvoEm(null)
    setRascunhoChave(PREFIXO_RASCUNHO_ORCAMENTO + uuidv4())
    // Um novo atendimento não pode herdar cliente, obra ou chave de recuperação
    // da URL usada para continuar o pedido anterior.
    const params = new URLSearchParams(window.location.search)
    for (const chave of ['rascunho','cliente','obra','adicionarAo','novo']) params.delete(chave)
    const busca = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${busca ? `?${busca}` : ''}`)
    setRascunhoRestaurado(false)
    setRascunhoIniciado(false)
    setSalvo(false); setSalvoComPendenciasTecnicas(false); setPedidoEnviadoId(null); setSalvoOffline(false); setMotivoPendente(''); setErro(''); setErroEhValidacao(false); setConferenciaAberta(false)
    setItens([{ ...novoItem(), itemTipo: fluxoSobMedida ? 'sob_medida' : '', tipo: fluxoSobMedida ? 'outro' : '' }]); setItensAbertos({}); setClienteIdOrigem(null); setClienteNome(''); setClienteWhatsapp(''); setCidade(''); setObraNome(''); setObraRua(''); setObraNumero(''); setObraBairro(''); setObraCep(''); setObraLocalizacao(''); setObraLocalizacaoConfirmada(''); setObraPrecisaoMetros(null); setObraIdSelecionada(null); setObrasDoCliente([]); setAvisoLocalizacao(''); setTemperatura('')
    setAcabamento(''); setAcabamentoOutroTexto(''); setContramarco(''); setArquitetoNome(''); setArquitetoContato(''); setArquivos([])
  }

  // Não renderiza campos editáveis antes de concluir a hidratação do rascunho.
  // No iPhone/IndexedDB a leitura pode levar alguns instantes; renderizar antes permitia
  // que uma hidratação atrasada sobrescrevesse texto que o usuário já havia começado a digitar.
  if (!rascunhoCarregado) return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-lg p-6 text-sm text-slate-600">Carregando rascunho salvo neste aparelho...</div></div>

  if (salvoOffline) return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center"><WifiOff size={48} className="text-amber-500 mx-auto mb-4" /><h2 className="text-xl font-bold text-slate-800 mb-2">Orçamento protegido!</h2><p className="text-slate-500">O envio de {clienteNome} não foi concluído agora, mas o orçamento foi guardado neste aparelho e entrou na fila de sincronização automática.</p>{motivoPendente && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Motivo: {motivoPendente}</p>}<p className="mt-3 text-xs font-medium text-emerald-700">Você não precisa refazer o orçamento.</p><button onClick={resetar} className="mt-6 px-4 py-2 bg-brand-navy text-white rounded-lg">Novo pedido</button></div></div>

  if (salvo) return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg w-full text-center"><CheckCircle size={48} className="text-brand-teal mx-auto mb-4" /><h2 className="text-xl font-bold text-slate-800 mb-2">{fluxoSobMedida ? 'Orçamento sob medida salvo!' : 'Pedido enviado!'}</h2><p className="text-slate-500 mb-6">{fluxoSobMedida ? (salvoComPendenciasTecnicas ? `O orçamento de ${clienteNome} foi salvo com segurança. Há tipologias ou variáveis técnicas pendentes, que podem ser completadas depois sem refazer o orçamento.` : `A configuração de ${clienteNome} foi salva. Agora você pode calcular materiais, custo, sobra, margem e preço.`) : `${clienteNome} entrou no painel de orçamentos.`}</p><div className="grid gap-3">{pedidoEnviadoId && fluxoSobMedida && !salvoComPendenciasTecnicas && <Link href={`/orcamento/${pedidoEnviadoId}/composicao`} className="w-full px-4 py-3 bg-emerald-600 text-white rounded-xl flex items-center justify-center gap-2 font-bold"><Calculator size={17} /> Calcular o orçamento</Link>}{pedidoEnviadoId && <Link href={`/kanban?orcamento=${pedidoEnviadoId}`} className="w-full px-4 py-3 border border-brand-teal text-brand-teal rounded-xl flex items-center justify-center gap-2 font-medium"><Pencil size={17} /> {salvoComPendenciasTecnicas ? 'Completar pendências técnicas' : 'Editar este orçamento'}</Link>}<div className="grid grid-cols-2 gap-3"><button onClick={resetar} className="px-4 py-2.5 bg-brand-navy text-white rounded-xl">Novo orçamento</button><Link href="/kanban" className="px-4 py-2.5 border border-slate-300 rounded-xl">Ver painel</Link></div></div></div></div>

  // Estado real do orçamento adaptado aos mesmos campos e estilos da prévia aprovada.
  const corGeral = acabamento === 'outro' ? acabamentoOutroTexto : acabamento || ''
  const contramarcoGeral = contramarco || 'indefinido'
  const itensTela: ItemTela[] = itens.map((it, idx) => ({
    id: it.id,
    tipo: it.itemTipo || null,
    ambiente: it.ambiente,
    medida: it.tipoMedida,
    largura: it.largura,
    altura: it.altura,
    quantidade: it.quantidade,
    descricao: it.itemTipo === 'sob_medida' ? it.tipoOutroTexto : it.descricao,
    contramarco: it.contramarcoOverride || 'herdar',
    cor: it.cor,
    observacaoGeral: it.observacaoGeral || '',
    observacaoCliente: it.itemTipo === 'sob_medida' ? it.descricao : it.observacaoCliente || '',
    observacaoProducao: it.observacaoProducao || '',
    fotos: it.fotosPreviews.map((url, i) => ({ nome: it.fotos[i]?.name || 'Foto da esquadria', url })),
    aberto: itensAbertos[it.id] ?? (idx === itens.length - 1),
    larguraBaixo: it.larguraBaixo,
    larguraMeio: it.larguraMeio,
    larguraCima: it.larguraCima,
    alturaDireita: it.alturaDireita,
    alturaMeio: it.alturaMeio,
    alturaEsquerda: it.alturaEsquerda,
    modoLargura: it.modoLargura,
    modoAltura: it.modoAltura,
    fotoLarguraPreview: it.fotoLarguraPreview,
    fotoAlturaPreview: it.fotoAlturaPreview,
    larguraBatenteMm: it.larguraBatenteMm || '',
    larguraGuarnicaoMm: it.larguraGuarnicaoMm || '',
  }))
  function alterar(id: string, patch: Partial<ItemTela>) {
    const original = itens.find(it => it.id === id)
    if (!original) return
    if (patch.aberto !== undefined) setItensAbertos(prev => ({...prev,[id]:patch.aberto!}))
    const alteracoes: Partial<ItemForm> = {}
    if (patch.tipo !== undefined && patch.tipo !== original.itemTipo) {
      Object.assign(alteracoes, {
        itemTipo: patch.tipo || '', materialCategoria: patch.tipo === 'material_avulso' ? 'perfil' : null,
        tipo: 'outro', tipoOutroTexto: '', descricao: '', produtoId: null, produtoNome: null,
        precoUnit: null, modoOrigem: 'manual', linhaId: null, linhaNome: null, tipologiaId: null,
        configuracaoPresetId: null, configuracaoNome: null, configuracaoValidada: false,
        configuracaoStatus: 'pendente', tipoMedida: 'comum',
      })
    }
    for (const chave of ['ambiente','largura','altura','quantidade','cor','observacaoGeral','observacaoProducao'] as const) {
      if (patch[chave] !== undefined) Object.assign(alteracoes, { [chave]: patch[chave] })
    }
    const tipoAtual = patch.tipo !== undefined ? patch.tipo : original.itemTipo
    if (patch.medida !== undefined && tipoAtual === 'sob_medida') alteracoes.tipoMedida = patch.medida
    if (patch.contramarco !== undefined) alteracoes.contramarcoOverride = patch.contramarco === 'herdar' ? null : patch.contramarco
    if (patch.descricao !== undefined) {
      if (tipoAtual === 'sob_medida') {
        Object.assign(alteracoes, {
          tipo: 'outro', tipoOutroTexto: patch.descricao, modoOrigem: 'manual',
          produtoId: null, precoUnit: null, linhaId: null, linhaNome: null, tipologiaId: null,
          configuracaoPresetId: null, configuracaoNome: null, configuracaoValidada: false,
          configuracaoStatus: 'pendente',
        })
      } else alteracoes.descricao = patch.descricao
    }
    if (patch.observacaoCliente !== undefined) {
      if (tipoAtual === 'sob_medida') alteracoes.descricao = patch.observacaoCliente
      else alteracoes.observacaoCliente = patch.observacaoCliente
    }
    if (Object.keys(alteracoes).length) atualizarItemCampos(id,alteracoes)
  }
  function adicionar() { adicionarEsquadriaColeta() }
  function duplicar(item: ItemTela) {
    const original = itens.find(it => it.id === item.id)
    if (original) duplicarItemCompleto(original)
  }
  function tirar(id: string) { removerItem(id) }

  const totalEsquadrias = itens.reduce((soma, item) => soma + Math.max(1, Number.parseInt(item.quantidade || '1', 10) || 1), 0)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="sticky top-0 z-20 border-b border-blue-900/30 bg-slate-950 text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600"><Ruler size={20}/></div>
            <div>
              <p className="text-sm font-extrabold tracking-wide">ATLAS ONE <span className="font-normal text-blue-300">/ Orçamento</span></p>
              <p className="text-[11px] text-slate-300">Coleta rápida de orçamento na obra</p>
            </div>
          </div>
          <div className="rounded-full border border-amber-300/40 bg-amber-400/15 px-3 py-1.5 text-[11px] font-extrabold text-amber-200">
            COLETA DE ORÇAMENTO
          </div>
        </div>
      </div>

      <main onInput={() => setRascunhoIniciado(true)} onChange={() => setRascunhoIniciado(true)} className="mx-auto max-w-6xl space-y-4 px-3 pb-56 pt-5 sm:px-6 sm:pt-6 md:pb-28">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-blue-600">Etapa de levantamento</p>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">Novo orçamento <span className="font-medium text-slate-400">/ Obra</span></h1>
            <p className="mt-1 text-sm text-slate-500">Preencha só o essencial. Linha e tipologia serão definidas no escritório.</p>
          </div>
          <Link href="/orcamento/novo" className={secundario}><ArrowLeft size={15}/> Voltar ao Atlas</Link>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900">
          <div><span className="mr-1 inline-flex align-middle"><Info size={16}/></span>
            {rascunhoSalvoEm ? 'Rascunho de ' + clienteNome + ' salvo neste aparelho às ' + new Date(rascunhoSalvoEm).toLocaleTimeString('pt-BR') : clienteNome.trim() ? 'O rascunho deste cliente será salvo automaticamente durante o preenchimento.' : 'Novo orçamento em branco. Informe o cliente para começar a salvar o rascunho.'}
          </div>
          <button type="button" onClick={()=>void salvarRascunhoAgora()} disabled={salvandoRascunhoManual || !clienteNome.trim()} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-900 disabled:opacity-50">{salvandoRascunhoManual?'Salvando...':'Salvar medição agora'}</button>
          {erroSalvamentoLocal && <p role="alert" className="w-full text-xs font-semibold text-red-700">{erroSalvamentoLocal}</p>}
        </div>

        <section className={painel + ' overflow-hidden'}>
          <div className="flex items-center gap-3 bg-slate-900 px-4 py-3 text-white sm:px-5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10"><ClipboardList size={19}/></span>
            <div>
              <h2 className="text-base font-extrabold">Cliente e obra</h2>
              <p className="text-xs text-slate-300">Identificação do atendimento</p>
            </div>
          </div>
          <div className="space-y-4 p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="relative" onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))window.setTimeout(()=>setBuscaClienteAberta(false),120)}}>
                <label className={rotulo}>Cliente</label>
                <input className={campo} data-preserve-case="true" value={clienteNome}
                  onFocus={()=>setBuscaClienteAberta(true)}
                  onKeyDown={e=>{if(e.key==='Escape')setBuscaClienteAberta(false)}}
                  onChange={e=>{ limparErroValidacaoAoEditar();setBuscaClienteAberta(true);setClienteNome(e.target.value);setClienteIdOrigem(null);setObraIdSelecionada(null);setObrasDoCliente([]) }}
                  placeholder="Nome do cliente"/>
                {buscaClienteAberta&&<BuscaClientesComGestao busca={clienteNome} selecionadoId={clienteIdOrigem} onSelecionar={cliente=>{selecionarClienteExistente(cliente);setBuscaClienteAberta(false)}}/>}
              </div>
              <div><label className={rotulo}>Nome da obra / local</label><input className={campo} value={obraNome} onChange={e=>{limparErroValidacaoAoEditar();setObraNome(e.target.value)}} disabled={!!obraIdSelecionada} placeholder="Ex.: Residência / reforma"/></div>
              <div><label className={rotulo}>Cidade</label><input className={campo} value={cidade} onChange={e=>{limparErroValidacaoAoEditar();setCidade(e.target.value)}} placeholder="Cidade da obra"/></div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 sm:px-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <label className={rotulo + ' mb-0'}>Temperatura do cliente <span className="font-normal text-slate-400">(CRM · opcional)</span></label>
                <span className="text-[11px] text-slate-500">A classificação aparece no CRM junto ao orçamento.</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(['quente','morno','frio'] as const).map(t => <button key={t} type="button" aria-pressed={temperatura===t} onClick={()=>{limparErroValidacaoAoEditar();setTemperatura(atual=>atual===t?'':t)}} className={'rounded-lg border px-2 py-2.5 text-xs font-semibold transition '+(temperatura===t?'border-blue-700 bg-blue-700 text-white':'border-slate-200 bg-white text-slate-600 hover:border-blue-300')}>{t==='quente'?'🔥 Quente':t==='morno'?'🌤️ Morno':'❄️ Frio'}</button>)}
              </div>
            </div>
            {clienteIdOrigem && obrasDoCliente.length > 0 && (
              <label className="block text-xs font-medium text-slate-600">Obra existente (opcional)
                <select value={obraIdSelecionada || ''} onChange={e=>escolherObraExistente(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">
                  <option value="">Nova obra — cadastrar abaixo</option>
                  {obrasDoCliente.map(obra=><option key={obra.id} value={obra.id}>{obra.nome} · {obra.cidade || 'Cidade não informada'}</option>)}
                </select>
                <span className="mt-1 block text-[11px] text-slate-500">Escolha uma obra para reutilizar seu endereço, GPS e histórico, sem misturar obras distintas.</span>
              </label>
            )}
            <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Endereço da obra</h3>
                  <p className="text-xs text-slate-500">Na obra, use o GPS para sugerir rua, bairro, cidade e CEP. Confira o número.</p>
                </div>
                <button type="button" onClick={capturarEnderecoDaObra} disabled={capturandoLocalizacao} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-60">
                  {capturandoLocalizacao ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                  {capturandoLocalizacao ? 'Localizando...' : 'Usar localização atual'}
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
                <label className="block text-xs font-medium text-slate-600 lg:col-span-5">Rua / avenida da obra
                  <input data-preserve-case="true" value={obraRua} onChange={e=>{limparErroValidacaoAoEditar();setObraRua(e.target.value)}} placeholder="Rua, avenida ou estrada" className={campo + ' mt-1'}/>
                </label>
                <label className="block text-xs font-medium text-slate-600 lg:col-span-2">Número
                  <input data-preserve-case="true" value={obraNumero} onChange={e=>{limparErroValidacaoAoEditar();setObraNumero(e.target.value)}} placeholder="123 / S/N" className={campo + ' mt-1'}/>
                </label>
                <label className="block text-xs font-medium text-slate-600 lg:col-span-3">Bairro
                  <input data-preserve-case="true" value={obraBairro} onChange={e=>setObraBairro(e.target.value)} placeholder="Bairro da obra" className={campo + ' mt-1'}/>
                </label>
                <label className="block text-xs font-medium text-slate-600 lg:col-span-2">CEP
                  <input data-preserve-case="true" value={obraCep} maxLength={9} inputMode="numeric" onChange={e=>{limparErroValidacaoAoEditar();setObraCep(e.target.value)}} placeholder="00000-000" className={campo + ' mt-1'}/>
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-slate-500">Informe rua e número (ou S/N), ou confirme o GPS no mapa.</p>
                <button type="button" disabled={consultandoCepObra||obraCep.replace(/\D/g,'').length!==8} onClick={()=>void consultarCepDaObra()} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 disabled:opacity-40">{consultandoCepObra?'Consultando CEP...':'Consultar CEP e completar endereço'}</button>
              </div>
              {avisoLocalizacao && <p role="status" className="rounded-lg bg-blue-100 px-3 py-2 text-xs text-blue-900">{avisoLocalizacao}</p>}
              <details className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <summary className="cursor-pointer text-xs font-semibold text-blue-800">Informar ou conferir coordenadas GPS (opcional)</summary>
                <label className="mt-2 block text-xs font-medium text-slate-600">Latitude, longitude
                  <input data-preserve-case="true" value={obraLocalizacao} onChange={e=>{limparErroValidacaoAoEditar();setObraLocalizacao(e.target.value);setObraLocalizacaoConfirmada('');setObraPrecisaoMetros(null)}} placeholder="Ex.: -21.052812,-49.690112 (pode colar)" className={campo + ' mt-1'}/>
                </label>
                <p className="mt-2 text-[11px] text-slate-500">O GPS é solicitado apenas ao tocar no botão. Se estiver fora da obra, digite o endereço ou cole as coordenadas recebidas.</p>
                <p className="mt-1 text-[11px] text-slate-500">O mapa só sugere número quando existe uma referência confiável; confira o número do imóvel.</p>
              </details>
              {obraLocalizacao && !coordenadasEmTexto(obraLocalizacao) && <p className="text-xs font-medium text-amber-700">Informe duas coordenadas válidas separadas por vírgula.</p>}
              {obraPrecisaoMetros !== null && <p className={'rounded-lg px-3 py-2 text-xs ' + (obraPrecisaoMetros > 30 ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800')}>Precisão estimada pelo aparelho: raio de aproximadamente {Math.round(obraPrecisaoMetros)} m. {obraPrecisaoMetros > 30 ? 'Sinal impreciso: tente capturar novamente ao ar livre antes de confirmar.' : 'Confira o ponto no mapa antes de validar.'}</p>}
              {coordenadasEmTexto(obraLocalizacao) && <div className="space-y-2 rounded-xl border border-blue-200 bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold text-slate-800">GPS: {obraLocalizacao}. A localização no mapa está correta?</p>
                  <button type="button" onClick={()=>{limparErroValidacaoAoEditar();setObraLocalizacaoConfirmada('sim')}} className={'rounded-lg border px-3 py-1.5 text-xs font-bold ' + (obraLocalizacaoConfirmada==='sim'?'border-emerald-600 bg-emerald-600 text-white':'bg-white')}>Sim, está certa</button>
                  <button type="button" onClick={()=>{limparErroValidacaoAoEditar();setObraLocalizacaoConfirmada('nao')}} className={'rounded-lg border px-3 py-1.5 text-xs font-bold ' + (obraLocalizacaoConfirmada==='nao'?'border-red-600 bg-red-600 text-white':'bg-white')}>Não, corrigir</button>
                  <a href={linkRotaObra({coordenadas:obraLocalizacao})||'#'} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-700 underline">Ver ponto no mapa</a>
                </div>
                {obraLocalizacaoConfirmada==='nao' && <p className="text-xs text-amber-800">Esta coordenada não será usada para navegação. Capture novamente ou informe rua e número; a rejeição será registrada para revisão.</p>}
                {obraLocalizacaoConfirmada==='sim' && <p className="text-xs text-emerald-700">Localização confirmada. Rua e número são opcionais; complete-os se souber.</p>}
              </div>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div><label className={rotulo}>Cor geral (opcional)</label><input className={campo} value={corGeral} onChange={e=>{limparErroValidacaoAoEditar();setAcabamento(e.target.value.trim()?'outro':'');setAcabamentoOutroTexto(e.target.value)}} placeholder="Ex.: Preto fosco"/></div>
              <div className="sm:col-span-2">
                <label className={rotulo}>Contramarco geral</label>
                <div className="grid grid-cols-3 gap-2">
                  {([['indefinido','A definir'],['com','Com'],['sem','Sem']] as const).map(([value,label])=>
                    <button key={value} type="button" onClick={()=>{limparErroValidacaoAoEditar();setContramarco(value === 'indefinido' ? '' : value)}} className={'rounded-xl border px-2 py-2.5 text-xs font-semibold ' + (contramarcoGeral===value?'border-blue-700 bg-blue-700 text-white':'border-slate-200 bg-white text-slate-600')}>{label}</button>)}
                </div>
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
            {itensTela.map((item, index) => (
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
                              <button type="button" key={v} disabled={item.tipo!=='sob_medida' && v==='final'} title={item.tipo!=='sob_medida' && v==='final'?'Medida final disponível em Sob medida':undefined} onClick={()=>alterar(item.id,{medida:v})} className={'rounded-xl border px-3 py-2.5 text-xs font-bold ' + (item.medida===v?'border-emerald-700 bg-emerald-50 text-emerald-800':'border-slate-200 text-slate-600')}>{label}</button>)}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        <div><label className={rotulo}>Largura (mm)</label><input type="number" inputMode="decimal" min="0" className={campo} value={item.largura} onChange={e=>alterar(item.id,{largura:e.target.value})} placeholder="1800"/></div>
                        <div><label className={rotulo}>Altura (mm)</label><input type="number" inputMode="decimal" min="0" className={campo} value={item.altura} onChange={e=>alterar(item.id,{altura:e.target.value})} placeholder="2100"/></div>
                        <div><label className={rotulo}>Qtd.</label><input type="number" inputMode="numeric" min="1" className={campo} value={item.quantidade} onChange={e=>alterar(item.id,{quantidade:e.target.value})} placeholder="1"/></div>
                      </div>
                      {item.tipo==='sob_medida' && item.medida==='final' && <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                        <p className="text-xs font-bold text-emerald-900">Medida final — registre as três larguras e as três alturas, ou fotografe a trena.</p>
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className={rotulo}>Larguras — baixo, meio, cima</label>
                            <div className="flex overflow-hidden rounded-lg border border-emerald-300">
                              <button type="button" onClick={()=>atualizarItem(item.id,'modoLargura','digitar')} className={'flex items-center gap-1 px-2 py-1 text-xs '+(item.modoLargura==='digitar'?'bg-emerald-700 text-white':'bg-white')}><Keyboard size={12}/> Digitar</button>
                              <button type="button" onClick={()=>atualizarItem(item.id,'modoLargura','foto')} className={'flex items-center gap-1 px-2 py-1 text-xs '+(item.modoLargura==='foto'?'bg-emerald-700 text-white':'bg-white')}><Camera size={12}/> Foto</button>
                            </div>
                          </div>
                          {item.modoLargura==='digitar'
                            ? <div className="grid grid-cols-3 gap-2">
                                <input type="number" inputMode="decimal" className={campo} placeholder="Baixo (mm)" value={item.larguraBaixo} onChange={e=>atualizarItem(item.id,'larguraBaixo',e.target.value)}/>
                                <input type="number" inputMode="decimal" className={campo} placeholder="Meio (mm)" value={item.larguraMeio} onChange={e=>atualizarItem(item.id,'larguraMeio',e.target.value)}/>
                                <input type="number" inputMode="decimal" className={campo} placeholder="Cima (mm)" value={item.larguraCima} onChange={e=>atualizarItem(item.id,'larguraCima',e.target.value)}/>
                              </div>
                            : item.fotoLarguraPreview ? <img src={item.fotoLarguraPreview} alt="Foto da trena com larguras" onClick={()=>setFotoAmpliada(item.fotoLarguraPreview!)} className="h-24 w-24 cursor-pointer rounded-lg object-cover"/> : <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-emerald-300 bg-white px-3 py-4 text-xs font-semibold"><Camera size={17}/> Fotografar trena com as larguras<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e=>definirFotoLargura(item.id,e.target.files?.[0])}/></label>}
                        </div>
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className={rotulo}>Alturas — direita, meio, esquerda</label>
                            <div className="flex overflow-hidden rounded-lg border border-emerald-300">
                              <button type="button" onClick={()=>atualizarItem(item.id,'modoAltura','digitar')} className={'flex items-center gap-1 px-2 py-1 text-xs '+(item.modoAltura==='digitar'?'bg-emerald-700 text-white':'bg-white')}><Keyboard size={12}/> Digitar</button>
                              <button type="button" onClick={()=>atualizarItem(item.id,'modoAltura','foto')} className={'flex items-center gap-1 px-2 py-1 text-xs '+(item.modoAltura==='foto'?'bg-emerald-700 text-white':'bg-white')}><Camera size={12}/> Foto</button>
                            </div>
                          </div>
                          {item.modoAltura==='digitar'
                            ? <div className="grid grid-cols-3 gap-2">
                                <input type="number" inputMode="decimal" className={campo} placeholder="Direita (mm)" value={item.alturaDireita} onChange={e=>atualizarItem(item.id,'alturaDireita',e.target.value)}/>
                                <input type="number" inputMode="decimal" className={campo} placeholder="Meio (mm)" value={item.alturaMeio} onChange={e=>atualizarItem(item.id,'alturaMeio',e.target.value)}/>
                                <input type="number" inputMode="decimal" className={campo} placeholder="Esquerda (mm)" value={item.alturaEsquerda} onChange={e=>atualizarItem(item.id,'alturaEsquerda',e.target.value)}/>
                              </div>
                            : item.fotoAlturaPreview ? <img src={item.fotoAlturaPreview} alt="Foto da trena com alturas" onClick={()=>setFotoAmpliada(item.fotoAlturaPreview!)} className="h-24 w-24 cursor-pointer rounded-lg object-cover"/> : <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-emerald-300 bg-white px-3 py-4 text-xs font-semibold"><Camera size={17}/> Fotografar trena com as alturas<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e=>definirFotoAltura(item.id,e.target.files?.[0])}/></label>}
                        </div>
                      </div>}
                      <div>
                        <label className={rotulo}>O que você precisa? <span className="font-normal text-slate-400">(descrição livre)</span></label>
                        <textarea rows={3} className={campo + ' resize-y'} value={item.descricao} onChange={e=>alterar(item.id,{descricao:e.target.value})} placeholder="Ex.: Porta de correr, 3 folhas, com reforço e fechadura..."/>
                        {item.tipo==='sob_medida' && <p className="mt-1.5 text-[11px] text-blue-700">Sem escolher linha ou tipologia nesta visita. O escritório define depois.</p>}
                      </div>
                      {item.tipo==='kit_porta_pronta' && <details className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                        <summary className="cursor-pointer text-xs font-bold text-blue-900">Complementos do kit: batente e guarnição (opcional)</summary>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <label className={rotulo}>Largura do batente (mm)<input type="number" inputMode="decimal" className={campo} value={item.larguraBatenteMm} onChange={e=>atualizarItem(item.id,'larguraBatenteMm',e.target.value)}/></label>
                          <label className={rotulo}>Largura da guarnição (mm)<input type="number" inputMode="decimal" className={campo} value={item.larguraGuarnicaoMm} onChange={e=>atualizarItem(item.id,'larguraGuarnicaoMm',e.target.value)}/></label>
                        </div>
                      </details>}
                      {item.tipo==='material_avulso' && <CatalogoItemAtlas item={itens.find(it=>it.id===item.id)!} onChange={patch=>atualizarItemCampos(item.id,patch)}/>}
                      {(item.tipo==='medida_padrao'||item.tipo==='kit_porta_pronta') && <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <summary className="cursor-pointer text-xs font-bold text-slate-700">Localizar produto cadastrado (opcional)</summary>
                        <div className="mt-3"><CatalogoItemAtlas item={itens.find(it=>it.id===item.id)!} onChange={patch=>atualizarItemCampos(item.id,patch)}/></div>
                      </details>}
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
                            <button type="button" aria-label="Remover foto" onClick={()=>removerFotoItem(item.id,i)} className="absolute right-0 top-0 rounded-bl-md bg-red-600 p-1 text-white"><X size={13}/></button>
                          </div>)}
                          <label className="flex h-20 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-xs font-semibold text-slate-600 hover:border-blue-400">
                            <Camera size={19}/>Adicionar foto
                            <input type="file" accept="image/*" multiple className="hidden" onChange={e=>{adicionarFotoItem(item.id,e.target.files);e.target.value=''}}/>
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
        {erro && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{erro}</p>}
        <div className="flex flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:justify-between">
          <p>Sem bloco de arquivos gerais: as fotos permanecem dentro de cada esquadria.</p>
          <p>Levantamento com rascunho protegido no aparelho</p>
        </div>
      </main>
      {/* No celular, a navegação geral ocupa a base: manter as ações acima dela. */}
      <div className="fixed inset-x-0 bottom-[calc(3.6rem+env(safe-area-inset-bottom))] z-30 border-t border-slate-200 bg-white/95 px-3 py-2 shadow-xl backdrop-blur md:bottom-0 md:z-20 md:p-3">
        <div className="mx-auto grid max-w-6xl grid-cols-2 items-center gap-2 md:flex md:flex-wrap md:justify-between">
          <p className="hidden text-xs font-semibold text-slate-600 lg:block">{itens.length} itens no levantamento · Rascunho individual por cliente</p>
          <button type="button" onClick={adicionar} className={secundario}><Plus size={16}/> Adicionar</button>
          <button type="button" aria-label="Visualizar resumo" onClick={()=>setResumo(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-2 py-2.5 text-xs font-extrabold text-white hover:bg-blue-800 sm:text-sm md:px-5 md:py-3"><FileText size={17}/><span className="sm:hidden">Resumo</span><span className="hidden sm:inline">Visualizar resumo</span></button>
          <button type="button" onClick={() => void salvar()} disabled={salvando} className="col-span-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-teal px-4 py-3 text-sm font-extrabold text-white hover:brightness-95 disabled:opacity-60 md:col-span-1 md:w-auto md:flex-1 lg:flex-none"><Send size={17}/>{salvando ? 'Enviando...' : fluxoSobMedida ? 'Salvar orçamento e continuar' : 'Enviar orçamento'}</button>
        </div>
      </div>
      {resumo && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-2 sm:p-3" role="dialog" aria-modal="true" aria-label="Resumo da coleta">
        <div className="max-h-[calc(100dvh-1rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:max-h-[calc(100dvh-1.5rem)]">
          <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-xl font-extrabold">Resumo da coleta</h2><p className="text-xs text-amber-700">Confira o pedido antes de enviar</p></div><button aria-label="Fechar resumo" type="button" onClick={()=>setResumo(false)} className="rounded-lg p-2 hover:bg-slate-100"><X size={20}/></button></div>
          <div className="rounded-xl bg-blue-50 p-3 text-sm"><b>Cliente:</b> {clienteNome||'Não informado'}<br/><b>Obra:</b> {obraNome||'Não informada'}<br/><b>Cidade:</b> {cidade||'Não informada'}</div>
          <div className="mt-3 space-y-2">
            {itensTela.map((item,index)=><div key={item.id} className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm font-extrabold">{String(index+1).padStart(2,'0')} · {item.ambiente||'Sem ambiente'} · {tipoNome(item.tipo)}</p>
              <p className="mt-1 text-xs text-slate-600">{item.medida==='comum'?'Medida comum':'Medida final'} · {item.largura||'—'} × {item.altura||'—'} mm · {item.quantidade||'—'} un.</p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{item.descricao||'Descrição não informada'}</p>
              {item.observacaoGeral && <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1.5 text-xs"><b>Observação geral:</b> {item.observacaoGeral}</p>}
              {item.fotos.length>0 && <p className="mt-2 text-xs text-blue-700">{item.fotos.length} foto(s) adicionada(s)</p>}
            </div>)}
          </div>
          <div className="sticky bottom-0 z-10 -mx-5 -mb-5 mt-4 grid gap-2 border-t bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:grid-cols-2">
            <button type="button" onClick={()=>setResumo(false)} className="rounded-xl border border-slate-300 bg-white py-3 text-sm font-bold text-slate-900">Voltar à edição</button>
            <button type="button" onClick={()=>{setResumo(false);void salvar()}} className="rounded-xl bg-blue-700 py-3 text-sm font-bold text-white">Conferir e enviar</button>
          </div>
        </div>
      </div>}

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
              {(obraNome || obraRua) && <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
                <b>Obra:</b> {obraNome || 'Não informada'}{(obraRua || obraNumero) && <p className="mt-1"><b>Endereço:</b> {formatarEnderecoObra(obraRua, obraNumero, obraCep)}{obraBairro ? ' · ' + obraBairro : ''}</p>}
                {obraLocalizacaoConfirmada === 'sim' && coordenadasEmTexto(obraLocalizacao) && <p className="mt-1"><b>GPS:</b> confirmado · <a href={linkRotaObra({ coordenadas: obraLocalizacao }) || '#'} target="_blank" rel="noreferrer" className="underline">Abrir rota</a></p>}
              </div>}
              <div className="space-y-3">
                {itens.map((item,idx) => (
                  <div key={item.id} className="rounded-xl border-2 border-slate-200 p-4">
                    <div className="flex justify-between gap-3">
                      <div><p className="text-xs uppercase text-slate-400">Item {idx+1}</p><p className="font-bold">{item.quantidade || '1'}x {nomeTipologia(item)}</p></div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${item.tipoMedida === 'final' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.tipoMedida === 'final' ? 'Medida final' : 'Medida comum'}</span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2"><p><b>Medidas:</b> {resumoMedidas(item)}</p><p><b>Linha:</b> {item.linhaNome || 'Não informada'}</p><p><b>Folhas:</b> {item.folhas || 'Não informado'}</p><p><b>Cor:</b> {item.cor || (acabamento === 'outro' ? acabamentoOutroTexto : acabamento) || 'Não informada'}</p></div>
                    {item.itemTipo === 'kit_porta_pronta' && <p className="mt-2 text-xs"><b>Kit:</b> {item.tipoOutroTexto || item.produtoNome || 'Descrição nas observações'} · {resumoMedidas(item)}</p>}
                    {item.ambiente && <p className="mt-2 text-xs"><b>Ambiente:</b> {item.ambiente}</p>}
                    {item.observacaoGeral && <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs"><b>Observação geral:</b> {item.observacaoGeral}</p>}
                    {item.descricao && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"><b>Obs. para cliente:</b> {item.descricao}</p>}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-2 border-t bg-slate-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:gap-3 sm:px-5 sm:py-4">
              <button type="button" onClick={() => setConferenciaAberta(false)} className="rounded-xl border bg-white px-2 py-3 text-xs font-semibold sm:px-4 sm:text-sm">Voltar e corrigir</button>
              <button type="button" onClick={() => void confirmarEnvio()} disabled={salvando} className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-teal px-2 py-3 text-xs font-semibold text-white disabled:opacity-60 sm:gap-2 sm:px-4 sm:text-sm"><Send size={17}/>{salvando?'Enviando...':'Confirmar e enviar'}</button>
            </div>
          </div>
        </div>
      )}
      {fotoAmpliada && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setFotoAmpliada(null)}><button className="absolute top-4 right-4 text-white" onClick={() => setFotoAmpliada(null)}><X size={20}/></button><img src={fotoAmpliada} alt="Foto ampliada" onClick={e => e.stopPropagation()} className="max-w-full max-h-full object-contain rounded-lg"/></div>}
    </div>
  )
}
