'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
    ArrowLeft,
    CheckCircle2,
    Image as ImageIcon,
    Layers3,
    Loader2,
    Pencil,
    Plus,
    RotateCcw,
    Save,
    Search,
    ShieldCheck,
    Trash2,
    Upload,
    XCircle,
} from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { listarProdutos } from '@/lib/produtos'
import { listarTipologias } from '@/lib/tipologias'
import { listarLinhasTecnicas, type LinhaTecnica } from '@/lib/linhasTecnicas'
import { uploadImagemConfiguracao } from '@/lib/upload'
import {
    listarTodasOpcoes,
    listarVariaveisDaTipologia,
    type EngenhariaVariavelOpcao,
    type TipologiaVariavelComVariavel,
} from '@/lib/engenhariaVariaveis'
import {
    alternarConfiguracaoOrcamento,
    atualizarConfiguracaoValidadaOrcamento,
    criarConfiguracaoValidadaOrcamento,
    listarConfiguracoesOrcamentoAdministracao,
    type ConfiguracaoOrcamento,
} from '@/lib/orcamentoConfiguracoes'
import type { Produto, Tipologia, Usuario } from '@/lib/tipos'

function normalizar(valor: string) {
    return valor.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').toLowerCase().trim()
}

type CampoCorteLinha = { chave: string; valor: string }

export default function ConfiguracoesOrcamentoPage() {
    const [usuario, setUsuario] = useState<Usuario | null>(null)
    const [carregando, setCarregando] = useState(true)
    const [linhas, setLinhas] = useState<LinhaTecnica[]>([])
    const [tipologias, setTipologias] = useState<Tipologia[]>([])
    const [produtos, setProdutos] = useState<Produto[]>([])
    const [configuracoes, setConfiguracoes] = useState<ConfiguracaoOrcamento[]>([])
    const [linhaId, setLinhaId] = useState('')
    const [tipologiaId, setTipologiaId] = useState('')
    const [produtoId, setProdutoId] = useState('')
    const [nome, setNome] = useState('')
    const [evidencia, setEvidencia] = useState('')
    const [imagemArquivo, setImagemArquivo] = useState<File | null>(null)
    const [imagemPreview, setImagemPreview] = useState('')
    const [imagemExistenteUrl, setImagemExistenteUrl] = useState('')
    const [variaveis, setVariaveis] = useState<TipologiaVariavelComVariavel[]>([])
    const [opcoes, setOpcoes] = useState<EngenhariaVariavelOpcao[]>([])
    const [valores, setValores] = useState<Record<string, string>>({})
    const [camposCorte, setCamposCorte] = useState<CampoCorteLinha[]>([])
    const [busca, setBusca] = useState('')
    const [salvando, setSalvando] = useState(false)
    const [editandoId, setEditandoId] = useState<string | null>(null)
    const [erro, setErro] = useState('')
    const [sucesso, setSucesso] = useState('')

  async function carregar() {
        setCarregando(true)
        const [me, ls, ts, ps, os, cs] = await Promise.all([
                usuarioAtual(),
                listarLinhasTecnicas(),
                listarTipologias(),
                listarProdutos(true),
                listarTodasOpcoes(),
                listarConfiguracoesOrcamentoAdministracao(),
              ])

      setUsuario(me)
        const linhasAtivas = ls.filter(l => l.ativo)
        setLinhas(linhasAtivas)
        setTipologias(ts)
        setProdutos(ps.filter(p => p.categoria === 'porta_janela_padrao' || p.categoria === 'produto'))
        setOpcoes(os)
        setConfiguracoes(cs)

      if (typeof window !== 'undefined') {
              const params = new URLSearchParams(window.location.search)
              const linhaUrl = params.get('linha') || ''
              const tipologiaUrl = params.get('tipologia') || ''
              if (linhaUrl && linhasAtivas.some(l => l.id === linhaUrl)) setLinhaId(linhaUrl)
              if (tipologiaUrl && ts.some(t => t.id === tipologiaUrl)) setTipologiaId(tipologiaUrl)
      }

      setCarregando(false)
  }

  useEffect(() => { void carregar() }, [])

  useEffect(() => {
        async function carregarVariaveis() {
                if (!tipologiaId) {
                          setVariaveis([])
                          setValores({})
                          return
                }
                setVariaveis(await listarVariaveisDaTipologia(tipologiaId))
                if (!editandoId) setValores({})
        }
        void carregarVariaveis()
  }, [tipologiaId])

  useEffect(() => {
        if (!imagemArquivo) {
                setImagemPreview('')
                return
        }
        const url = URL.createObjectURL(imagemArquivo)
        setImagemPreview(url)
        return () => URL.revokeObjectURL(url)
  }, [imagemArquivo])

  const linha = linhas.find(l => l.id === linhaId) || null
    const tipologiasFiltradas = useMemo(() => {
          if (!linha) return tipologias
          return tipologias.filter(t => Boolean(linha.tipologia_ids?.includes(t.id)))
    }, [linha, tipologias])

  const produtosFiltrados = useMemo(() => {
        if (!linha) return produtos
        return produtos.filter(p => Boolean(linha.produto_ids?.includes(p.id)))
  }, [linha, produtos])

  const configuracoesFiltradas = useMemo(() => {
        const q = normalizar(busca)
        return configuracoes.filter(c => {
                if (!c.usar_no_orcamento) return false
                const tipologia = tipologias.find(t => t.id === c.tipologia_id)
                const produto = produtos.find(p => p.id === c.produto_id)
                if (linha) {
                          const compativel = c.produto_id
                            ? Boolean(linha.produto_ids?.includes(c.produto_id))
                                      : Boolean(linha.tipologia_ids?.includes(c.tipologia_id))
                          if (!compativel) return false
                }
                if (!q) return true
                const variaveisTexto = Object.entries(c.valores || {}).map(([chave, valor]) => `${chave} ${valor}`).join(' ')
                return normalizar(`${c.nome} ${tipologia?.label || ''} ${produto?.nome || ''} ${variaveisTexto}`).includes(q)
        })
  }, [busca, configuracoes, linha, produtos, tipologias])

  function opcoesDaVariavel(variavelId: string) {
        return opcoes.filter(o => o.variavel_id === variavelId)
  }

  function adicionarLinhaCorte() {
        setCamposCorte(prev => [...prev, { chave: '', valor: '' }])
  }

  function removerLinhaCorte(indice: number) {
        setCamposCorte(prev => prev.filter((_, i) => i !== indice))
  }

  function atualizarLinhaCorte(indice: number, campo: 'chave' | 'valor', valor: string) {
        setCamposCorte(prev => prev.map((linhaAtual, i) => (i === indice ? { ...linhaAtual, [campo]: valor } : linhaAtual)))
  }

  function limparCampos() {
        setProdutoId('')
        setNome('')
        setEvidencia('')
        setValores({})
        setCamposCorte([])
        setImagemArquivo(null)
        setImagemExistenteUrl('')
        setEditandoId(null)
  }

  function iniciarEdicao(item: ConfiguracaoOrcamento) {
        const linhaDoItem = linhas.find(l => l.tipologia_ids?.includes(item.tipologia_id)) || null
        setLinhaId(linhaDoItem?.id || '')
        setTipologiaId(item.tipologia_id)
        setProdutoId(item.produto_id || '')
        setNome(item.nome)
        setEvidencia(item.evidencia_validacao || '')
        setValores({ ...(item.valores || {}) })
        setCamposCorte(Object.entries(item.campos_corte || {}).map(([chave, valor]) => ({ chave, valor: String(valor) })))
        setImagemArquivo(null)
        setImagemExistenteUrl(item.imagem_url || '')
        setEditandoId(item.id)
        setErro('')
        setSucesso('')
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelarEdicao() {
        limparCampos()
        setErro('')
        setSucesso('Edicao cancelada. Nenhuma alteracao foi salva.')
  }

  async function salvar() {
        setErro('')
        setSucesso('')
        if (!tipologiaId) { setErro('Selecione a tipologia.'); return }
        if (!nome.trim()) { setErro('De um nome para a configuracao.'); return }
        if (!evidencia.trim()) { setErro('Registre a evidencia tecnica usada para validar essa combinacao.'); return }

      for (const vinculo of variaveis) {
              if (vinculo.obrigatorio && !valores[vinculo.variavel.chave]) {
                        setErro(`Preencha a variavel obrigatoria "${vinculo.variavel.label}".`)
                        return
              }
      }

      setSalvando(true)
        let imagemUrl: string | null = imagemExistenteUrl || null
        if (imagemArquivo) {
                imagemUrl = await uploadImagemConfiguracao(imagemArquivo)
                if (!imagemUrl) {
                          setSalvando(false)
                          setErro('Nao foi possivel enviar a imagem da configuracao. Tente novamente.')
                          return
                }
        }

      const camposCorteObj: Record<string, string> = {}
            for (const linhaCorte of camposCorte) {
                    const chave = linhaCorte.chave.trim()
                    const valor = linhaCorte.valor.trim()
                    if (chave && valor) camposCorteObj[chave] = valor
            }

      const dados = {
              tipologiaId,
              produtoId: produtoId || null,
              nome: nome.trim(),
              valores,
              camposCorte: camposCorteObj,
              evidencia: evidencia.trim(),
              imagemUrl,
      }

      const resultado = editandoId
          ? await atualizarConfiguracaoValidadaOrcamento(editandoId, dados)
              : await criarConfiguracaoValidadaOrcamento(dados)

      setSalvando(false)
        if (!resultado.ok) {
                setErro(resultado.error || 'Nao foi possivel salvar.')
                return
        }

      const estavaEditando = Boolean(editandoId)
        limparCampos()
        setConfiguracoes(await listarConfiguracoesOrcamentoAdministracao())
        setSucesso(estavaEditando ? 'Configuracao atualizada sem criar duplicata.' : 'Configuracao validada e publicada para o orcamento.')
  }

  async function alternar(item: ConfiguracaoOrcamento) {
        setErro('')
        setSucesso('')
        const resultado = await alternarConfiguracaoOrcamento(item.id, item.ativo === false)
        if (!resultado.ok) {
                setErro(resultado.error || 'Nao foi possivel alterar a configuracao.')
                return
        }
        setConfiguracoes(await listarConfiguracoesOrcamentoAdministracao())
  }

  if (carregando) {
        return <div className="min-h-screen grid place-items-center text-slate-400"><Loader2 className="animate-spin" /></div>div>
          }
          
            if (usuario?.role !== 'master') {
                  return (
                          <div className="min-h-screen grid place-items-center px-4">
                                  <div className="max-w-md text-center">
                                            <ShieldCheck className="mx-auto text-slate-300 mb-3" size={42}/>
                                            <p className="text-slate-600">Somente o Master pode publicar configuracoes validadas para o orcamento.</p>p>
                                            <Link href="/engenharia" className="text-brand-navy text-sm hover:underline">Voltar a Engenharia</Link>Link>
                                  </div>div>
                          </div>div>
                        )
            }
  
    const imagemExibida = imagemPreview || imagemExistenteUrl
      
        return <div data-placeholder-jsx="1">PLACEHOLDER_JSX_A_SUBSTITUIR</div>div>
          }
          </div>
