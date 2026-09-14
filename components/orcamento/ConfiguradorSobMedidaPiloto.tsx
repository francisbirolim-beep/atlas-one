'use client'

import { useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { alterarResposta, avaliar, CadastroConfigurador, medidasValidas, perguntasVisiveis, PILOTO, Respostas } from '@/lib/configuradorSobMedida'
import { requisicaoConfigurador } from '@/lib/configuradorSobMedidaClient'
import type { SelecaoEsquadriaOrcamento } from './SeletorEsquadriaInteligente'

type Valor = SelecaoEsquadriaOrcamento & { quantidade: string }
export default function ConfiguradorSobMedidaPiloto({ value, onChange }: { value: Valor; onChange: (patch: Partial<Valor>) => void }) {
  const id = useId()
  const [dados, setDados] = useState<Awaited<ReturnType<typeof requisicaoConfigurador>> | null>(null)
  const [erro, setErro] = useState('')
  const [tentativa, setTentativa] = useState(0)
  useEffect(() => {
    let ativo = true
    setErro('')
    requisicaoConfigurador().then(d => { if (ativo) setDados(d) }).catch(e => { if (ativo) setErro(e.message) })
    return () => { ativo = false }
  }, [tentativa])

  if (erro) return <div role="alert" className="rounded-xl border border-red-200 p-4 text-sm text-red-700">{erro} <button type="button" onClick={() => setTentativa(v => v + 1)} className="underline">Tentar novamente</button></div>
  if (!dados) return <p role="status" className="text-sm text-slate-500">Carregando o piloto…</p>
  const cadastro: CadastroConfigurador = dados.cadastro
  const respostas: Respostas = { ...value.variaveis, largura: value.largura, altura: value.altura, quantidade: value.quantidade, linha: value.linhaId || '' }
  const resultado = avaliar(cadastro, respostas, dados.linhas)
  const perguntas = perguntasVisiveis(cadastro, respostas)
  function mudar(campo: string, valor: string) {
    const novas = alterarResposta(cadastro, respostas, campo, valor)
    const analise = avaliar(cadastro, novas, dados!.linhas)
    const { largura, altura, quantidade, linha, ...variaveis } = novas
    onChange({
      largura, altura, quantidade, variaveis: { ...variaveis, configurador: PILOTO, cadastro_versao: String(cadastro.versao) },
      tipo: novas.produto === 'porta' && novas.abertura === 'correr' && novas.folhas === '2' ? 'outro' : '',
      tipoOutroTexto: novas.produto === 'porta' && novas.abertura === 'correr' && novas.folhas === '2' ? 'Porta de Correr 2 Folhas' : '',
      folhas: novas.folhas || '', linhaId: linha || null, linhaNome: dados!.linhas.find(l => l.id === linha)?.nome || null,
      tipologiaId: null, produtoId: null, precoUnit: null, modoOrigem: 'manual',
      configuracaoPresetId: null, configuracaoNome: 'Piloto Porta de Correr 2 Folhas',
      configuracaoValidada: false, configuracaoStatus: analise.completa ? 'preenchida' : 'pendente', modoConfiguracao: 'assistido',
    })
  }
  const foraPiloto = respostas.produto && respostas.produto !== 'porta' || respostas.abertura && respostas.abertura !== 'correr'
  return <div className="space-y-4">
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
      <p className="text-sm font-semibold text-blue-900">Piloto · Porta de Correr 2 Folhas</p>
      <p className="mt-1 text-xs text-blue-800">Teste a sequência. Receita, custos, preço e plano de corte aguardam os próximos cadastros.</p>
      {dados.master && <Link href="/configuracoes/configurador-sob-medida" target="_blank" className="mt-2 inline-block text-xs underline">Cadastrar categorias e regras</Link>}
    </div>
    <fieldset className="space-y-2"><legend className="text-sm font-semibold">1. Medidas</legend>
      <div className="grid gap-3 sm:grid-cols-3">{[{ chave: 'largura', label: 'Largura (mm)' }, { chave: 'altura', label: 'Altura (mm)' }, { chave: 'quantidade', label: 'Quantidade' }].map(campo => <label key={campo.chave} className="text-xs text-slate-600" htmlFor={`${id}-${campo.chave}`}>{campo.label}<input id={`${id}-${campo.chave}`} inputMode={campo.chave === 'quantidade' ? 'numeric' : 'decimal'} value={respostas[campo.chave] || ''} onChange={e => mudar(campo.chave, e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm" /></label>)}</div>
      {!medidasValidas(respostas) && <p className="text-xs text-slate-500">Preencha as medidas e a quantidade para continuar.</p>}
    </fieldset>
    {medidasValidas(respostas) && <label className="block text-sm font-semibold" htmlFor={`${id}-produto`}>2. O que é?<select id={`${id}-produto`} value={respostas.produto || ''} onChange={e => mudar('produto', e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm font-normal"><option value="">Selecione</option>{cadastro.categorias.map(o => <option key={o.valor} value={o.valor}>{o.label}</option>)}</select></label>}
    {perguntas.map(pergunta => <div key={pergunta.chave}>
      <label className="block text-sm font-medium" htmlFor={`${id}-${pergunta.chave}`}>{pergunta.label}<select id={`${id}-${pergunta.chave}`} value={respostas[pergunta.chave] || ''} onChange={e => mudar(pergunta.chave, e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm"><option value="">Selecione explicitamente</option>{pergunta.opcoes.map(o => <option key={o.valor} value={o.valor} disabled={pergunta.chave === 'montante_lateral_movel' && respostas.fechadura === 'sim' && o.valor === 'estreito'}>{o.label}</option>)}</select></label>
      {pergunta.chave === 'montante_lateral_movel' && respostas.fechadura === 'sim' && <p className="mt-1 text-xs text-amber-800">Obrigatória: fechadura exige montante Largo. Reforço de aba é uma decisão independente.</p>}
      {pergunta.chave === 'exposicao' && respostas.exposicao && <div className="mt-4 rounded-xl border border-slate-200 p-3"><label className="text-sm font-medium" htmlFor={`${id}-linha`}>Linha técnica<select id={`${id}-linha`} value={respostas.linha || ''} onChange={e => mudar('linha', e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm"><option value="">A definir na análise técnica</option>{resultado.linhas.map(l => <option key={l.id} value={l.id} disabled={l.bloqueada}>{l.nome}{l.bloqueada ? ' — Bloqueada' : l.recomendada ? ' — Recomendada' : ''}</option>)}</select></label><p className="mt-2 text-xs text-slate-500">A ausência de regra não confirma adequação dimensional. Linha sem validação permanece para conferência técnica.</p></div>}
    </div>)}
    {foraPiloto && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Esta opção aguarda cadastro. Neste piloto, selecione Porta → Correr → 2 folhas.</p>}
    <div aria-live="polite" className="space-y-2">{resultado.avisos.map(a => <p key={a.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><b>{a.nivel}:</b> {a.mensagem}</p>)}</div>
    {resultado.completa && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">Sequência preenchida. A configuração será registrada como pendente de validação técnica, sem gerar receita ou preço.</p>}
    {respostas.reforco_externo && resultado.pendencias.length > 0 && <ul className="list-disc pl-5 text-sm text-amber-900">{resultado.pendencias.map(p => <li key={p}>{p}</li>)}</ul>}
  </div>
}
