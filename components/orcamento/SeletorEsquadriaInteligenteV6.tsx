'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Info, LockKeyhole } from 'lucide-react'
import { listarTipologias } from '@/lib/tipologias'
import { listarLinhasTecnicas, type LinhaTecnica } from '@/lib/linhasTecnicas'
import type { Tipologia } from '@/lib/tipos'
import type {
  SelecaoEsquadriaOrcamento,
  StatusConfiguracaoOrcamento,
} from './SeletorEsquadriaInteligenteV5'

export type { SelecaoEsquadriaOrcamento, StatusConfiguracaoOrcamento }

type Props = {
  value: SelecaoEsquadriaOrcamento
  onChange: (patch: Partial<SelecaoEsquadriaOrcamento>) => void
}

type Opcao = { valor: string; rotulo: string }

const CATEGORIAS: Opcao[] = [
  { valor: 'porta', rotulo: 'Porta' },
  { valor: 'janela', rotulo: 'Janela' },
  { valor: 'veneziana', rotulo: 'Veneziana' },
  { valor: 'painel_ripado', rotulo: 'Painel ripado' },
  { valor: 'fixo', rotulo: 'Fixo' },
  { valor: 'claraboia', rotulo: 'Claraboia' },
  { valor: 'maxim_ar', rotulo: 'Maxim-ar' },
  { valor: 'outros', rotulo: 'Outros' },
]

const ABERTURAS_PORTA: Opcao[] = [
  { valor: 'correr', rotulo: 'Correr' },
  { valor: 'giro', rotulo: 'Giro' },
  { valor: 'pivotante', rotulo: 'Pivotante' },
]

const FOLHAS_CORRER: Opcao[] = [
  { valor: '2', rotulo: '2 folhas' },
  { valor: '3', rotulo: '3 folhas' },
  { valor: '4', rotulo: '4 folhas' },
  { valor: '5', rotulo: '5 folhas' },
  { valor: '6', rotulo: '6 folhas' },
  { valor: '8', rotulo: '8 folhas' },
]

const EXPOSICOES: Opcao[] = [
  { valor: 'interna', rotulo: 'Interna' },
  { valor: 'externa_protegida', rotulo: 'Externa protegida' },
  { valor: 'externa_exposta', rotulo: 'Externa exposta' },
]

function normalizar(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function ehPortaCorrer2Folhas(t: Tipologia) {
  const texto = normalizar(`${t.label || ''} ${t.chave || ''}`)
  const porta = texto.includes('porta')
  const correr = texto.includes('correr')
  const duasFolhas = /(^|\s|[-_])0?2\s*(f|fol|folha|folhas)\b/.test(texto)
    || texto.includes('2 folhas')
    || texto.includes('02 folhas')
    || texto.includes('02f')
    || texto.includes('2f')
  return porta && correr && duasFolhas
}

function BotaoOpcao({
  ativo,
  onClick,
  children,
  bloqueado = false,
}: {
  ativo: boolean
  onClick: () => void
  children: React.ReactNode
  bloqueado?: boolean
}) {
  return (
    <button
      type="button"
      disabled={bloqueado}
      onClick={onClick}
      className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
        ativo
          ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
          : bloqueado
            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
            : 'border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/40'
      }`}
    >
      {children}
    </button>
  )
}

export default function SeletorEsquadriaInteligenteV6({ value, onChange }: Props) {
  const [tipologias, setTipologias] = useState<Tipologia[]>([])
  const [linhas, setLinhas] = useState<LinhaTecnica[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    Promise.all([listarTipologias(), listarLinhasTecnicas()]).then(([ts, ls]) => {
      if (!ativo) return
      setTipologias(ts.filter((t: any) => t.ativo !== false))
      setLinhas(ls.filter(l => l.ativo))
      setCarregando(false)
    })
    return () => { ativo = false }
  }, [])

  const v = value.variaveis || {}
  const categoria = v.atlas_categoria || ''
  const abertura = v.atlas_abertura || ''
  const folhas = v.atlas_folhas || value.folhas || ''
  const exposicao = v.atlas_exposicao || ''

  const tipologias2F = useMemo(
    () => tipologias.filter(ehPortaCorrer2Folhas),
    [tipologias],
  )

  const linhas2F = useMemo(() => {
    if (!tipologias2F.length) return linhas
    const ids = new Set(tipologias2F.map(t => t.id))
    const filtradas = linhas.filter(l => (l.tipologia_ids || []).some(id => ids.has(id)))
    return filtradas.length ? filtradas : linhas
  }, [linhas, tipologias2F])

  const piloto2F = categoria === 'porta' && abertura === 'correr' && folhas === '2'

  const linhaAtual = useMemo(
    () => linhas2F.find(l => l.id === value.linhaId) || null,
    [linhas2F, value.linhaId],
  )

  function tipologiaDaLinha(linhaId: string | null) {
    if (!linhaId) return null
    const linha = linhas2F.find(l => l.id === linhaId)
    if (!linha) return null
    const ids = new Set(linha.tipologia_ids || [])
    return tipologias2F.find(t => ids.has(t.id)) || null
  }

  function estaCompleta(proximasVariaveis: Record<string, string>, linhaId = value.linhaId) {
    return Boolean(
      Number(String(value.largura || '').replace(',', '.')) > 0
      && Number(String(value.altura || '').replace(',', '.')) > 0
      && proximasVariaveis.atlas_categoria === 'porta'
      && proximasVariaveis.atlas_abertura === 'correr'
      && proximasVariaveis.atlas_folhas === '2'
      && proximasVariaveis.atlas_exposicao
      && linhaId
      && proximasVariaveis.montante_lateral_movel
      && proximasVariaveis.fechadura
      && proximasVariaveis.reforco_aba
      && proximasVariaveis.reforco_interno
      && proximasVariaveis.reforco_externo
    )
  }

  function aplicar(
    novasVariaveis: Record<string, string>,
    extras: Partial<SelecaoEsquadriaOrcamento> = {},
    linhaIdParaValidar: string | null = value.linhaId,
  ) {
    const completa = estaCompleta(novasVariaveis, linhaIdParaValidar)
    const tipologia = tipologiaDaLinha(linhaIdParaValidar)
    onChange({
      variaveis: novasVariaveis,
      configuracaoNome: completa ? 'Piloto — Porta de Correr 2 Folhas' : null,
      configuracaoStatus: completa ? 'preenchida' : 'pendente',
      configuracaoValidada: false,
      modoConfiguracao: 'assistido',
      tipo: completa ? (tipologia?.chave || 'porta_correr') : '',
      tipoOutroTexto: '',
      tipologiaId: completa ? (tipologia?.id || null) : null,
      ...extras,
    })
  }

  function escolherCategoria(valor: string) {
    const novas = {
      atlas_categoria: valor,
    }
    aplicar(novas, {
      folhas: '',
      linhaId: null,
      linhaNome: null,
      tipologiaId: null,
    }, null)
  }

  function escolherAbertura(valor: string) {
    const novas = {
      atlas_categoria: categoria,
      atlas_abertura: valor,
    }
    aplicar(novas, {
      folhas: '',
      linhaId: null,
      linhaNome: null,
      tipologiaId: null,
    }, null)
  }

  function escolherFolhas(valor: string) {
    const novas = {
      atlas_categoria: categoria,
      atlas_abertura: abertura,
      atlas_folhas: valor,
    }
    aplicar(novas, {
      folhas: valor,
      linhaId: null,
      linhaNome: null,
      tipologiaId: null,
    }, null)
  }

  function escolherExposicao(valor: string) {
    const novas = { ...v, atlas_exposicao: valor }
    aplicar(novas)
  }

  function escolherLinha(linha: LinhaTecnica) {
    const novas = { ...v, atlas_linha_id: linha.id }
    aplicar(novas, {
      linhaId: linha.id,
      linhaNome: linha.nome,
      tipologiaId: null,
    }, linha.id)
  }

  function escolherFechadura(valor: 'sim' | 'nao') {
    const novas = {
      ...v,
      fechadura: valor,
      ...(valor === 'sim' ? { montante_lateral_movel: 'largo' } : {}),
    }
    aplicar(novas)
  }

  function escolherMontante(valor: 'estreito' | 'largo') {
    if (v.fechadura === 'sim' && valor !== 'largo') return
    aplicar({ ...v, montante_lateral_movel: valor })
  }

  function escolherSimNao(chave: 'reforco_aba' | 'reforco_interno' | 'reforco_externo', valor: 'sim' | 'nao') {
    aplicar({ ...v, [chave]: valor })
  }

  const obrigatorios = piloto2F
    ? [
        ['Medidas', Boolean(value.largura && value.altura)],
        ['Exposição', Boolean(exposicao)],
        ['Linha', Boolean(value.linhaId)],
        ['Montante lateral móvel', Boolean(v.montante_lateral_movel)],
        ['Fechadura', Boolean(v.fechadura)],
        ['Reforço de aba', Boolean(v.reforco_aba)],
        ['Reforço interno', Boolean(v.reforco_interno)],
        ['Reforço externo', Boolean(v.reforco_externo)],
      ] as const
    : []
  const faltando = obrigatorios.filter(([, ok]) => !ok).map(([nome]) => nome)

  return (
    <div className="atlas-orcamento-selector-v6 space-y-4">
      <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
        <div className="mb-3 flex items-start gap-3">
          <div className="rounded-xl bg-blue-600 p-2 text-white"><CheckCircle2 size={18} /></div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Piloto — configurador guiado</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">Primeiro vamos validar a Porta de Correr 2 Folhas. As outras tipologias ficam visíveis na árvore, mas serão cadastradas depois.</p>
          </div>
        </div>

        <div className="rounded-xl border border-blue-100 bg-white p-3">
          <p className="mb-2 text-xs font-bold text-slate-700">1. Medidas</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-600">
              Largura (mm) *
              <input
                inputMode="decimal"
                value={value.largura}
                onChange={e => onChange({ largura: e.target.value, configuracaoStatus: 'pendente', tipo: '' })}
                placeholder="Ex.: 5000"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              Altura (mm) *
              <input
                inputMode="decimal"
                value={value.altura}
                onChange={e => onChange({ altura: e.target.value, configuracaoStatus: 'pendente', tipo: '' })}
                placeholder="Ex.: 3000"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm"
              />
            </label>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">As medidas já entram no início para futuramente filtrar linha, reforço e demais regras técnicas. Nenhum limite dimensional foi inventado neste piloto.</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-2 text-xs font-bold text-slate-700">2. O que é?</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CATEGORIAS.map(opcao => (
            <BotaoOpcao key={opcao.valor} ativo={categoria === opcao.valor} onClick={() => escolherCategoria(opcao.valor)}>
              {opcao.rotulo}
            </BotaoOpcao>
          ))}
        </div>
      </div>

      {categoria === 'porta' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-xs font-bold text-slate-700">3. Tipo da porta</p>
          <div className="grid grid-cols-3 gap-2">
            {ABERTURAS_PORTA.map(opcao => (
              <BotaoOpcao key={opcao.valor} ativo={abertura === opcao.valor} onClick={() => escolherAbertura(opcao.valor)}>
                {opcao.rotulo}
              </BotaoOpcao>
            ))}
          </div>
        </div>
      )}

      {categoria === 'porta' && abertura === 'correr' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-xs font-bold text-slate-700">4. Quantidade de folhas</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {FOLHAS_CORRER.map(opcao => (
              <BotaoOpcao key={opcao.valor} ativo={folhas === opcao.valor} onClick={() => escolherFolhas(opcao.valor)}>
                {opcao.rotulo}
              </BotaoOpcao>
            ))}
          </div>
          {folhas && folhas !== '2' && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">Nesta primeira versão vamos validar somente Porta de Correr 2 Folhas. A opção escolhida será cadastrada na sequência depois da aprovação do piloto.</p>
          )}
        </div>
      )}

      {piloto2F && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-2 text-xs font-bold text-slate-700">5. Condição de instalação</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {EXPOSICOES.map(opcao => (
                <BotaoOpcao key={opcao.valor} ativo={exposicao === opcao.valor} onClick={() => escolherExposicao(opcao.valor)}>
                  {opcao.rotulo}
                </BotaoOpcao>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">A exposição será usada pelo motor de regras para transformar um reforço em recomendação, alerta ou obrigação. Neste piloto ela é registrada, sem inventar regra automática.</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-1 text-xs font-bold text-slate-700">6. Linha</p>
            <p className="mb-3 text-[11px] text-slate-500">O Atlas mostra as linhas relacionadas às tipologias de Porta de Correr 2 Folhas encontradas no cadastro. A recomendação por medida será ativada quando cadastrarmos os limites técnicos.</p>
            {carregando ? (
              <p className="text-xs text-slate-500">Carregando linhas...</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {linhas2F.map(linha => (
                  <BotaoOpcao key={linha.id} ativo={value.linhaId === linha.id} onClick={() => escolherLinha(linha)}>
                    {linha.nome}
                  </BotaoOpcao>
                ))}
              </div>
            )}
            {!carregando && !linhas2F.length && <p className="text-xs text-amber-700">Nenhuma linha disponível no cadastro técnico.</p>}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-3 text-xs font-bold text-slate-700">7. Configuração técnica — Porta de Correr 2 Folhas</p>

            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-700">Fechadura *</p>
                  {v.fechadura === 'sim' && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700"><LockKeyhole size={11} /> força montante largo</span>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <BotaoOpcao ativo={v.fechadura === 'sim'} onClick={() => escolherFechadura('sim')}>Sim</BotaoOpcao>
                  <BotaoOpcao ativo={v.fechadura === 'nao'} onClick={() => escolherFechadura('nao')}>Não</BotaoOpcao>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-slate-700">Montante lateral móvel *</p>
                <div className="grid grid-cols-2 gap-2">
                  <BotaoOpcao ativo={v.montante_lateral_movel === 'estreito'} bloqueado={v.fechadura === 'sim'} onClick={() => escolherMontante('estreito')}>Estreito</BotaoOpcao>
                  <BotaoOpcao ativo={v.montante_lateral_movel === 'largo'} onClick={() => escolherMontante('largo')}>Largo</BotaoOpcao>
                </div>
                {v.fechadura === 'sim' && <p className="mt-2 text-[11px] font-medium text-blue-700">Fechadura selecionada: montante lateral móvel largo é obrigatório.</p>}
              </div>

              {([
                ['reforco_aba', 'Reforço de aba'],
                ['reforco_interno', 'Reforço interno'],
                ['reforco_externo', 'Reforço externo'],
              ] as const).map(([chave, rotulo]) => (
                <div key={chave}>
                  <p className="mb-2 text-xs font-semibold text-slate-700">{rotulo} *</p>
                  <div className="grid grid-cols-2 gap-2">
                    <BotaoOpcao ativo={v[chave] === 'sim'} onClick={() => escolherSimNao(chave, 'sim')}>Sim</BotaoOpcao>
                    <BotaoOpcao ativo={v[chave] === 'nao'} onClick={() => escolherSimNao(chave, 'nao')}>Não</BotaoOpcao>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`rounded-xl border p-4 ${faltando.length ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
            <div className="flex items-start gap-2">
              <Info size={17} className={faltando.length ? 'mt-0.5 text-amber-700' : 'mt-0.5 text-emerald-700'} />
              <div>
                <p className={`text-xs font-bold ${faltando.length ? 'text-amber-900' : 'text-emerald-900'}`}>
                  {faltando.length ? 'Configuração ainda incompleta' : 'Configuração preenchida para teste'}
                </p>
                {faltando.length ? (
                  <p className="mt-1 text-[11px] leading-relaxed text-amber-800">Falta decidir: {faltando.join(', ')}. Nenhuma opção obrigatória assume “Não” automaticamente.</p>
                ) : (
                  <p className="mt-1 text-[11px] leading-relaxed text-emerald-800">{value.largura} × {value.altura} mm · Porta · Correr · 2 folhas · {linhaAtual?.nome || value.linhaNome} · {exposicao.replace('_', ' ')}. A receita de materiais, custos e plano de corte será conectada depois da validação deste fluxo.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {categoria && categoria !== 'porta' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{CATEGORIAS.find(c => c.valor === categoria)?.rotulo}: categoria reconhecida. As variáveis específicas serão cadastradas depois que validarmos a Porta de Correr 2 Folhas.</div>
      )}

      {categoria === 'porta' && abertura && abertura !== 'correr' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Porta de {abertura === 'giro' ? 'giro' : 'pivotante'}: reconhecida na árvore. O cadastro técnico desta abertura será feito depois da aprovação do piloto 2F de correr.</div>
      )}
    </div>
  )
}
