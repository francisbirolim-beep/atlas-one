'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, FileSpreadsheet, ImageOff, Loader2, LockKeyhole, Save, Search, SlidersHorizontal, Star } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { carregarOrdemProducao, type OrdemProducao } from '@/lib/ordensProducao'
import { descricaoPerfilContramarco, sugerirPerfilContramarco, type CodigoPerfilContramarco } from '@/lib/contramarcoRegrasCorte'
import type { NivelPermissao, Produto, Usuario } from '@/lib/tipos'
import {
  listarComponentesReceita,
  listarProdutosTecnicos,
  listarTipologiasComReceita,
  type ComponenteReceita,
  type TipologiaComReceita,
} from '@/lib/engenhariaReceitas'
import {
  aplicarVarianteAoComponente,
  listarPresets,
  listarTodasOpcoes,
  listarVariaveisDaTipologia,
  listarVariantesComponente,
  resolverVarianteComponente,
  salvarPreset,
  type ComponenteVariante,
  type EngenhariaVariavelOpcao,
  type TipologiaVariavelComVariavel,
  type VariaveisPreset,
} from '@/lib/engenhariaVariaveis'
import { listarPermissoesUsuario, listarSetores, nivelEfetivo } from '@/lib/setores'
import {
  atualizarComponentePlano,
  atualizarPlanoCorte,
  carregarComponentesPlano,
  criarPlanoCorte,
  listarPlanosCorte,
  listarProdutosEsquadria,
  type ComponentePlanoCorte,
  type PlanoCorte,
  type VariaveisPlanoCorte,
} from '@/lib/planoCorte'

function numero(valor: string, fallback = 0) {
  const n = Number((valor || '').replace(',', '.'))
  return Number.isFinite(n) ? n : fallback
}

function nomeNormalizado(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export default function PlanoCortePage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [nivel, setNivel] = useState<NivelPermissao>('oculto')
  const [carregando, setCarregando] = useState(true)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [produtosTecnicos, setProdutosTecnicos] = useState<Produto[]>([])
  const [tipologias, setTipologias] = useState<TipologiaComReceita[]>([])
  const [planos, setPlanos] = useState<PlanoCorte[]>([])
  const [busca, setBusca] = useState('')
  const [produtoId, setProdutoId] = useState('')
  const [tipologiaId, setTipologiaId] = useState('')
  const [componentesReceita, setComponentesReceita] = useState<ComponenteReceita[]>([])
  const [largura, setLargura] = useState('')
  const [altura, setAltura] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [folgaLargura, setFolgaLargura] = useState('4')
  const [folgaAltura, setFolgaAltura] = useState('4')
  const [variaveis, setVariaveis] = useState<VariaveisPlanoCorte>({})
  const [observacoes, setObservacoes] = useState('')
  const [planoAtual, setPlanoAtual] = useState<PlanoCorte | null>(null)
  const [componentesPlano, setComponentesPlano] = useState<ComponentePlanoCorte[]>([])
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [ordemSolicitada, setOrdemSolicitada] = useState(false)
  const [carregandoOrdem, setCarregandoOrdem] = useState(false)
  const [ordemVinculada, setOrdemVinculada] = useState<OrdemProducao | null>(null)
  const [erroOrdem, setErroOrdem] = useState('')

  const [variaveisTipologia, setVariaveisTipologia] = useState<TipologiaVariavelComVariavel[]>([])
  const [opcoesTodas, setOpcoesTodas] = useState<EngenhariaVariavelOpcao[]>([])
  const [variantesPorComponente, setVariantesPorComponente] = useState<Record<string, ComponenteVariante[]>>({})
  const [presets, setPresets] = useState<VariaveisPreset[]>([])
  const [presetId, setPresetId] = useState('')
  const [nomePreset, setNomePreset] = useState('')
  const [presetPadrao, setPresetPadrao] = useState(false)

  useEffect(() => {
    async function carregar() {
      const u = await usuarioAtual()
      setUsuario(u)

      let permissao: NivelPermissao = u?.role === 'master' ? 'edicao' : 'oculto'
      if (u && u.role !== 'master') {
        const [setores, permissoes] = await Promise.all([listarSetores(), listarPermissoesUsuario(u.id)])
        const setorProducao = setores.find(s => s.rota === '/producao' || nomeNormalizado(s.nome) === 'producao')
        if (setorProducao) permissao = nivelEfetivo(u, setorProducao.id, permissoes)
      }
      setNivel(permissao)

      if (permissao !== 'oculto') {
        const [p, pt, t, pl] = await Promise.all([
          listarProdutosEsquadria(),
          listarProdutosTecnicos(),
          listarTipologiasComReceita(),
          listarPlanosCorte(),
        ])
        setProdutos(p)
        setProdutosTecnicos(pt)
        setTipologias(t.filter(item => Boolean(item.receita)))
        setPlanos(pl)
      }
      setCarregando(false)
    }
    void carregar()
  }, [])

  // A OP e a Medição Final são a fonte das medidas aprovadas.
  // Não reaplicamos as folgas: largura_mm/altura_mm da OP já são medidas de fabricação.
  useEffect(() => {
    const ordemId = new URLSearchParams(window.location.search).get('ordem')
    if (!ordemId) return
    setOrdemSolicitada(true)
    setCarregandoOrdem(true)
    let ativo = true
    void carregarOrdemProducao(ordemId).then(ordem => {
      if (!ativo) return
      if (!ordem || ordem.tipo_producao !== 'contramarco') {
        setErroOrdem('A ordem de contramarco informada não foi encontrada ou não está acessível.')
      } else if (ordem.bloqueada || ['aguardando', 'cancelada', 'concluida'].includes(ordem.status)) {
        setErroOrdem('Esta ordem não está liberada para novo plano de corte. Confira o status da Medida Final e da Produção.')
      } else if (!(Number(ordem.largura_mm) > 0) || !(Number(ordem.altura_mm) > 0)) {
        setErroOrdem('A ordem não tem largura e altura de fabricação válidas. Confira a medição aprovada.')
      } else {
        setOrdemVinculada(ordem)
        const codigoAprovado = String(ordem.item_snapshot?.medicao_contramarco?.perfil_codigo || '').trim().replace(/\s+/g, '').toUpperCase()
        setVariaveis(atual => ({ ...atual, contramarco: (codigoAprovado || sugerirPerfilContramarco(ordem.item_snapshot || {})).toLowerCase() }))
        setQuantidade(String(ordem.quantidade || 1))
        setLargura(String(ordem.largura_mm))
        setAltura(String(ordem.altura_mm))
        setFolgaLargura('0')
        setFolgaAltura('0')
      }
      setCarregandoOrdem(false)
    }).catch(() => {
      if (!ativo) return
      setErroOrdem('Não foi possível carregar a ordem de produção.')
      setCarregandoOrdem(false)
    })
    return () => { ativo = false }
  }, [])

  const podeEditar = nivel === 'edicao'
  const produtosFiltrados = useMemo(() => {
    const termo = nomeNormalizado(busca)
    if (!termo) return produtos
    return produtos.filter(p => nomeNormalizado(`${p.nome} ${p.descricao || ''}`).includes(termo))
  }, [produtos, busca])
  const produto = produtos.find(p => p.id === produtoId) || null
  const tipologia = tipologias.find(t => t.id === tipologiaId) || null
  const planosVisiveis = ordemVinculada ? planos.filter(plano => plano.ordem_producao_id === ordemVinculada.id) : planos
  const larguraVinculada = ordemVinculada ? Number(ordemVinculada.largura_mm) : null
  const alturaVinculada = ordemVinculada ? Number(ordemVinculada.altura_mm) : null
  const quantidadeVinculada = ordemVinculada ? Math.max(1, Number(ordemVinculada.quantidade) || 1) : null
  const codigoAprovado = String(ordemVinculada?.item_snapshot?.medicao_contramarco?.perfil_codigo || '').trim().replace(/\s+/g, '').toUpperCase()
  const perfilContramarco: string = String(variaveis.contramarco || codigoAprovado ||
    (ordemVinculada ? sugerirPerfilContramarco(ordemVinculada.item_snapshot || {}) : 'CM060')).trim().toUpperCase()
  const perfilTecnico = produtosTecnicos.find(p => {
    const codigo = nomeNormalizado(String(p.codigo || '')).replace(/[^a-z0-9]/g, '')
    const nome = nomeNormalizado(p.nome || '').replace(/[^a-z0-9]/g, '')
    return p.categoria === 'perfil' && (codigo === perfilContramarco.toLowerCase() || nome.includes(perfilContramarco.toLowerCase()))
  }) || null

  useEffect(() => {
    if (!produto) return
    setLargura(produto.largura_mm ? String(produto.largura_mm) : '')
    setAltura(produto.altura_mm ? String(produto.altura_mm) : '')
  }, [produto])

  useEffect(() => {
    async function carregarReceita() {
      if (!tipologia?.receita) {
        setComponentesReceita([])
        setVariaveisTipologia([])
        setVariantesPorComponente({})
        return
      }
      const [componentes, vt, op] = await Promise.all([
        listarComponentesReceita(tipologia.receita.id),
        listarVariaveisDaTipologia(tipologia.id),
        listarTodasOpcoes(),
      ])
      setComponentesReceita(componentes)
      setVariaveisTipologia(vt)
      setOpcoesTodas(op)
      const mapa: Record<string, ComponenteVariante[]> = {}
      await Promise.all(componentes.map(async c => { mapa[c.id] = await listarVariantesComponente(c.id) }))
      setVariantesPorComponente(mapa)
    }
    void carregarReceita()
  }, [tipologia])

  useEffect(() => {
    async function carregarPresets() {
      if (!tipologiaId) { setPresets([]); return }
      setPresets(await listarPresets(tipologiaId, produtoId || null))
    }
    void carregarPresets()
  }, [tipologiaId, produtoId])

  useEffect(() => {
    if (!planoAtual && presets.length > 0) {
      const padrao = presets.find(p => p.padrao)
      if (padrao) { setVariaveis(padrao.valores); setPresetId(padrao.id) }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presets])

  function alterarVariavel(chave: string, valor: string) {
    setVariaveis(prev => ({ ...prev, [chave]: valor }))
  }

  function aplicarPreset(id: string) {
    setPresetId(id)
    const preset = presets.find(p => p.id === id)
    if (preset) setVariaveis(preset.valores)
  }

  async function salvarComoPreset() {
    if (!tipologiaId || !nomePreset.trim()) return
    setSalvando(true)
    const criado = await salvarPreset({
      tipologia_id: tipologiaId,
      produto_id: produtoId || null,
      nome: nomePreset.trim(),
      valores: variaveis as Record<string, string>,
      padrao: presetPadrao,
      usuario,
    })
    setSalvando(false)
    if (criado) {
      setPresets(prev => presetPadrao ? [...prev.map(p => ({ ...p, padrao: false })), criado] : [...prev, criado])
      setNomePreset(''); setPresetPadrao(false); setPresetId(criado.id)
      setMensagem('Preset de variáveis salvo.')
    }
  }

  async function gerarPlano() {
    if (!podeEditar || !produto || !tipologia?.receita || carregandoOrdem || (ordemSolicitada && !ordemVinculada)) return
    setSalvando(true)
    setMensagem('')
    const componentesResolvidos = componentesReceita.map(c => aplicarVarianteAoComponente(
      c,
      resolverVarianteComponente(variantesPorComponente[c.id] || [], variaveis as Record<string, string | undefined>)
    ))
    const plano = await criarPlanoCorte({
      produto,
      tipologia,
      receita: tipologia.receita,
      componentesReceita: componentesResolvidos,
      largura_mm: larguraVinculada ?? (largura ? numero(largura) : null),
      altura_mm: alturaVinculada ?? (altura ? numero(altura) : null),
      quantidade: quantidadeVinculada ?? Math.max(1, numero(quantidade, 1)),
      folga_largura_mm: ordemVinculada ? 0 : numero(folgaLargura, 4),
      folga_altura_mm: ordemVinculada ? 0 : numero(folgaAltura, 4),
      variaveis,
      observacoes: observacoes || null,
      usuario,
      vinculo: ordemVinculada ? {
        ordem_producao_id: ordemVinculada.id,
        cliente_id: ordemVinculada.cliente_id,
        obra_id: ordemVinculada.obra_id,
        venda_obra_id: ordemVinculada.venda_obra_id,
        orcamento_id: ordemVinculada.orcamento_id,
        item_ref: ordemVinculada.item_ref,
        tipo_producao: 'contramarco',
      } : undefined,
    })
    setSalvando(false)
    if (!plano) {
      setMensagem('Não foi possível gerar o plano de corte.')
      return
    }
    setPlanoAtual(plano)
    setComponentesPlano(await carregarComponentesPlano(plano.id))
    setPlanos(prev => [plano, ...prev])
    setMensagem('Plano criado a partir da receita + variáveis escolhidas. Você pode ajustar sem alterar a receita original.')
  }

  async function abrirPlano(plano: PlanoCorte) {
    if (ordemVinculada && plano.ordem_producao_id !== ordemVinculada.id) return
    setPlanoAtual(plano)
    setComponentesPlano(await carregarComponentesPlano(plano.id))
    setLargura(plano.largura_mm ? String(plano.largura_mm) : '')
    setAltura(plano.altura_mm ? String(plano.altura_mm) : '')
    setQuantidade(String(plano.quantidade))
    setFolgaLargura(String(plano.folga_largura_mm))
    setFolgaAltura(String(plano.folga_altura_mm))
    setVariaveis(plano.variaveis || {})
    setObservacoes(plano.observacoes || '')
  }

  async function salvarCabecalhoPlano() {
    if (!podeEditar || !planoAtual) return
    setSalvando(true)
    const ok = await atualizarPlanoCorte(planoAtual.id, {
      largura_mm: ordemVinculada ? larguraVinculada : (largura ? numero(largura) : null),
      altura_mm: ordemVinculada ? alturaVinculada : (altura ? numero(altura) : null),
      quantidade: quantidadeVinculada ?? Math.max(1, numero(quantidade, 1)),
      folga_largura_mm: ordemVinculada ? 0 : numero(folgaLargura, 4),
      folga_altura_mm: ordemVinculada ? 0 : numero(folgaAltura, 4),
      variaveis,
      observacoes: observacoes || null,
    })
    setSalvando(false)
    setMensagem(ok ? 'Variáveis do plano salvas.' : 'Não foi possível salvar as variáveis.')
  }

  function alterarComponente(id: string, campo: keyof ComponentePlanoCorte, valor: string | number | null) {
    setComponentesPlano(prev => prev.map(c => c.id === id ? { ...c, [campo]: valor } : c))
  }

  async function salvarComponente(componente: ComponentePlanoCorte) {
    if (!podeEditar) return
    setSalvando(true)
    const ok = await atualizarComponentePlano(componente.id, {
      produto_id: componente.produto_id || null,
      nome: componente.nome,
      unidade: componente.unidade,
      quantidade: Number(componente.quantidade) || 0,
      corte_mm: componente.corte_mm == null ? null : Number(componente.corte_mm),
      formula_quantidade: componente.formula_quantidade || null,
      formula_corte: componente.formula_corte || null,
      observacao: componente.observacao || null,
    })
    setSalvando(false)
    setMensagem(ok ? `Componente “${componente.nome}” salvo.` : 'Não foi possível salvar o componente.')
  }

  function trocarProdutoComponente(componente: ComponentePlanoCorte, novoId: string) {
    const p = produtosTecnicos.find(x => x.id === novoId)
    alterarComponente(componente.id, 'produto_id', novoId || null)
    if (p) {
      alterarComponente(componente.id, 'nome', p.nome)
      alterarComponente(componente.id, 'unidade', p.unidade || componente.unidade)
    }
  }

  if (carregando) return <div className="grid min-h-[60vh] place-items-center text-slate-400"><Loader2 className="animate-spin" /></div>

  if (nivel === 'oculto') {
    return <div className="mx-auto max-w-xl px-4 py-12"><div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><LockKeyhole className="mx-auto mb-3 text-slate-400"/><h1 className="font-bold text-slate-900">Sem acesso ao Plano de Corte</h1><p className="mt-2 text-sm text-slate-500">O Master precisa liberar a permissão do setor Produção para este usuário.</p></div></div>
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link href="/producao" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500"><ArrowLeft size={18}/></Link>
          <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-emerald-600">Produção</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-950"><FileSpreadsheet size={22}/> Plano de Corte</h1><p className="mt-1 text-sm text-slate-500">Pesquise um produto cadastrado, escolha a linha/tipologia e as variáveis para esta produção.</p></div>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${podeEditar ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{podeEditar ? 'Edição liberada' : 'Somente consulta'}</span>
      </div>

      {ordemSolicitada && <section className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        {carregandoOrdem ? 'Carregando a ordem de contramarco…' : erroOrdem ? <strong>{erroOrdem}</strong> : ordemVinculada ? <>
          <strong>Plano vinculado à OP #{ordemVinculada.numero} — {ordemVinculada.titulo}</strong>
          <p className="mt-1">{ordemVinculada.cliente_nome || 'Cliente'}{ordemVinculada.obra_nome ? ` · ${ordemVinculada.obra_nome}` : ''} · {larguraVinculada} × {alturaVinculada} mm · {quantidadeVinculada} un.</p>
          <p className="mt-1 text-xs">Medidas de fabricação aprovadas: as folgas já foram descontadas na medição. Selecione o perfil e a receita técnica para montar o plano; confira as fórmulas de corte antes de fabricar.</p>
        </> : null}
      </section>}
      {ordemVinculada && <section className="mb-4 rounded-xl border border-emerald-200 bg-white p-4">
        <div className="flex flex-wrap items-start gap-4">
          <div className="grid h-24 w-32 shrink-0 place-items-center overflow-hidden rounded-lg border border-emerald-200 bg-slate-50">
            {perfilTecnico?.foto_url
              ? <img src={perfilTecnico.foto_url} alt={`Perfil ${perfilContramarco} cadastrado`} className="h-full w-full object-contain" />
              : <span className="px-2 text-center text-xs text-slate-500">Foto técnica não cadastrada</span>}
          </div>
          <div className="min-w-[220px] flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Perfil sugerido para o contramarco</p>
            <label className="mt-2 block text-sm font-semibold text-slate-900">
              <span className="sr-only">Perfil do contramarco</span>
              <select value={perfilContramarco} onChange={e => setVariaveis(atual => ({ ...atual, contramarco: e.target.value.toLowerCase() }))} disabled={!podeEditar || !!ordemVinculada}
                className="w-full max-w-md rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm disabled:bg-emerald-50">
                {perfilContramarco !== 'CM200' && perfilContramarco !== 'CM060' &&
                  <option value={perfilContramarco}>{perfilContramarco} · Perfil aprovado</option>}
                <option value="CM200">{descricaoPerfilContramarco('CM200')}</option>
                <option value="CM060">{descricaoPerfilContramarco('CM060')}</option>
              </select>
            </label>
            <p className="mt-2 text-xs text-slate-600">{ordemVinculada ? 'Perfil aprovado na conferência da Medida Final: alterações exigem nova validação, não podem ser feitas no Plano de Corte.' : 'Padrão: CM 200 para porta de giro, maxim-ar e basculante; CM 060 para os demais. A sugestão pode ser alterada conforme a obra.'}</p>
            <p className="mt-1 text-xs text-slate-500">{perfilTecnico ? `Cadastro encontrado: ${perfilTecnico.nome}` : 'Ainda não foi encontrada foto técnica desse perfil no catálogo. Cadastre a imagem real antes de emitir a ficha técnica.'}</p>
            <p className="mt-1 text-xs text-amber-700">A seleção não modifica automaticamente fórmulas de corte não validadas. Confira a receita técnica antes de liberar para fabricação.</p>
          </div>
        </div>
      </section>}
      <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[.12em] text-slate-400">1. Produto cadastrado</p>
            <div className="relative mt-3"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Ex.: porta de correr 3 folhas" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm"/></div>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">{produtosFiltrados.map(p => <button key={p.id} onClick={() => setProdutoId(p.id)} className={`w-full rounded-xl border p-3 text-left ${produtoId === p.id ? 'border-emerald-300 bg-emerald-50' : 'border-slate-100 hover:bg-slate-50'}`}><p className="text-sm font-semibold text-slate-800">{p.nome}</p><p className="mt-1 text-xs text-slate-400">{p.largura_mm && p.altura_mm ? `${p.largura_mm} × ${p.altura_mm} mm` : 'Medida variável'}</p></button>)}</div>
            {produtos.length === 0 && <p className="mt-3 rounded-xl border border-dashed border-slate-200 p-4 text-xs text-slate-400">Cadastre primeiro a esquadria em Cadastro de Produtos usando a categoria de porta/janela padrão.</p>}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[.12em] text-slate-400">2. Receita técnica</p>
            <select value={tipologiaId} onChange={e => setTipologiaId(e.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">Selecione a tipologia</option>{tipologias.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
            <p className="mt-2 text-xs leading-5 text-slate-500">A receita é a base de perfis, acessórios, reforços e fórmulas. O plano gerado vira um snapshot editável e não altera a receita original.</p>
          </section>

          {planosVisiveis.length > 0 && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[.12em] text-slate-400">Planos recentes</p><div className="mt-3 space-y-2">{planosVisiveis.slice(0, 8).map(pl => <button key={pl.id} onClick={() => void abrirPlano(pl)} className="w-full rounded-xl border border-slate-100 p-3 text-left hover:bg-slate-50"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold text-slate-800">{pl.nome}</p><span className="text-[10px] font-semibold uppercase text-slate-400">{pl.status}</span></div><p className="mt-1 text-xs text-slate-400">{pl.largura_mm || '-'} × {pl.altura_mm || '-'} mm · {pl.quantidade} un.</p></button>)}</div></section>}
        </aside>

        <main className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-slate-400">3. Variáveis do plano</p><h2 className="mt-1 text-lg font-bold text-slate-900">{produto?.nome || planoAtual?.nome || 'Selecione o produto'}</h2></div><SlidersHorizontal size={20} className="text-slate-300"/></div>

            {tipologiaId && presets.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <Star size={14} className="text-amber-500"/>
              <select value={presetId} onChange={e => aplicarPreset(e.target.value)} className="rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-xs">
                <option value="">Carregar preset salvo…</option>
                {presets.map(p => <option key={p.id} value={p.id}>{p.nome}{p.padrao ? ' (padrão)' : ''}</option>)}
              </select>
            </div>}

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs font-medium text-slate-600">Largura (mm)<input value={ordemVinculada ? String(larguraVinculada) : largura} onChange={e => setLargura(e.target.value)} disabled={!podeEditar || !!ordemVinculada} inputMode="numeric" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50"/></label>
              <label className="text-xs font-medium text-slate-600">Altura (mm)<input value={ordemVinculada ? String(alturaVinculada) : altura} onChange={e => setAltura(e.target.value)} disabled={!podeEditar || !!ordemVinculada} inputMode="numeric" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50"/></label>
              <label className="text-xs font-medium text-slate-600">Quantidade<input value={ordemVinculada ? String(quantidadeVinculada) : quantidade} onChange={e => setQuantidade(e.target.value)} disabled={!podeEditar || !!ordemVinculada} inputMode="numeric" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50"/></label>
              <label className="text-xs font-medium text-slate-600">Folga largura (mm)<input value={ordemVinculada ? '0' : folgaLargura} onChange={e => setFolgaLargura(e.target.value)} disabled={!podeEditar || !!ordemVinculada} inputMode="decimal" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50"/></label>
              <label className="text-xs font-medium text-slate-600">Folga altura (mm)<input value={ordemVinculada ? '0' : folgaAltura} onChange={e => setFolgaAltura(e.target.value)} disabled={!podeEditar || !!ordemVinculada} inputMode="decimal" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50"/></label>
              {variaveisTipologia.map(vt => <label key={vt.id} className="text-xs font-medium text-slate-600">{vt.variavel.label}{vt.obrigatorio && <span className="text-red-500"> *</span>}
                <select value={String(variaveis[vt.variavel.chave] || '')} onChange={e => alterarVariavel(vt.variavel.chave, e.target.value)} disabled={!podeEditar} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50">
                  <option value="">Selecione…</option>
                  {opcoesTodas.filter(o => o.variavel_id === vt.variavel_id).map(o => <option key={o.id} value={o.chave}>{o.label}</option>)}
                </select>
              </label>)}
            </div>
            {tipologiaId && variaveisTipologia.length === 0 && <p className="mt-3 rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-400">Nenhuma variável configurada pra esta tipologia ainda. Configure em Engenharia → Receitas técnicas.</p>}

            <label className="mt-3 block text-xs font-medium text-slate-600">Observações<textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} disabled={!podeEditar} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50"/></label>

            {tipologiaId && podeEditar && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <input value={nomePreset} onChange={e => setNomePreset(e.target.value)} placeholder="Nome do preset (ex.: Padrão Suprema 3F)" className="rounded-xl border border-slate-200 px-3 py-2 text-xs"/>
              <label className="flex items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" checked={presetPadrao} onChange={e => setPresetPadrao(e.target.checked)}/> Definir como padrão</label>
              <button onClick={() => void salvarComoPreset()} disabled={!nomePreset.trim() || salvando} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40">Salvar variáveis como preset</button>
            </div>}

            <div className="mt-4 flex flex-wrap justify-end gap-2">{planoAtual && <button onClick={() => void salvarCabecalhoPlano()} disabled={!podeEditar || salvando} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-40"><Save size={16}/>Salvar variáveis</button>}<button onClick={() => void gerarPlano()} disabled={!podeEditar || salvando || !produto || !tipologia?.receita || carregandoOrdem || (ordemSolicitada && !ordemVinculada)} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{salvando ? <Loader2 size={16} className="animate-spin"/> : <FileSpreadsheet size={16}/>}Gerar plano</button></div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-slate-400">4. Perfis, acessórios e cortes</p><h2 className="mt-1 font-bold text-slate-900">{planoAtual ? `Plano · ${planoAtual.nome}` : 'Aguardando geração'}</h2></div>{planoAtual && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"><Check size={13}/>Snapshot editável</span>}</div>
            {!planoAtual ? <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">Selecione produto + receita e clique em Gerar plano.</div> : componentesPlano.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-amber-200 bg-amber-50 p-5 text-sm text-amber-700">A receita selecionada não possui componentes. Cadastre os perfis e acessórios em Engenharia → Receitas técnicas.</div> : <div className="mt-4 space-y-3">{componentesPlano.map(componente => {
              const produtosCompativeis = produtosTecnicos.filter(p => componente.tipo === 'perfil' ? p.categoria === 'perfil' : componente.tipo === 'acessorio' ? p.categoria === 'acessorio' : true)
              const produtoVinculado = produtosTecnicos.find(p => p.id === componente.produto_id)
              return <article key={componente.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div className="flex items-center gap-3"><div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">{produtoVinculado?.foto_url ? <img src={produtoVinculado.foto_url} alt={`Foto do produto ${produtoVinculado.nome}`} className="h-full w-full object-contain"/> : <div className="flex flex-col items-center text-center text-[9px] text-slate-400"><ImageOff size={18}/><span>Sem foto</span></div>}</div><div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-600">{componente.tipo}</span><p className="mt-2 text-sm font-semibold text-slate-800">{componente.nome}</p>{!produtoVinculado?.foto_url && <p className="mt-1 text-[10px] text-amber-700">Cadastre a imagem deste perfil/acessório.</p>}</div></div><button onClick={() => void salvarComponente(componente)} disabled={!podeEditar || salvando} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><Save size={13}/>Salvar</button></div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-[11px] font-medium text-slate-500">Trocar perfil/acessório<select value={componente.produto_id || ''} onChange={e => trocarProdutoComponente(componente, e.target.value)} disabled={!podeEditar} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs disabled:bg-slate-50"><option value="">Manual / manter descrição</option>{produtosCompativeis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label><label className="text-[11px] font-medium text-slate-500">Quantidade<input value={componente.quantidade} onChange={e => alterarComponente(componente.id, 'quantidade', numero(e.target.value))} disabled={!podeEditar} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs disabled:bg-slate-50"/></label><label className="text-[11px] font-medium text-slate-500">Corte final (mm)<input value={componente.corte_mm ?? ''} onChange={e => alterarComponente(componente.id, 'corte_mm', e.target.value === '' ? null : numero(e.target.value))} disabled={!podeEditar} placeholder="Preencher/ajustar" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs disabled:bg-slate-50"/></label><label className="text-[11px] font-medium text-slate-500">Unidade<input value={componente.unidade} onChange={e => alterarComponente(componente.id, 'unidade', e.target.value)} disabled={!podeEditar} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs disabled:bg-slate-50"/></label></div>
              {(componente.formula_quantidade || componente.formula_corte) && <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">{componente.formula_quantidade && <p>Fórmula quantidade: <code>{componente.formula_quantidade}</code></p>}{componente.formula_corte && <p className="mt-1">Fórmula corte: <code>{componente.formula_corte}</code></p>}<p className="mt-2 text-[11px] text-amber-700">Enquanto a fórmula desta tipologia não estiver validada, o sistema não inventa o resultado: o corte final fica editável para conferência.</p></div>}
              </article>
            })}</div>}
          </section>

          {mensagem && <div className={`rounded-xl border px-4 py-3 text-sm ${mensagem.includes('Não') ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{mensagem}</div>}
        </main>
      </div>
    </div>
  )
}
