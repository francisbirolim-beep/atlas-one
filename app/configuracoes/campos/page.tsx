'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Plus,
  Save,
  Search,
  Settings2,
  Trash2,
} from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import {
  CampoConfiguravel,
  ContextoCampoConfiguravel,
  CONTEXTOS_CAMPO,
  listarCamposConfiguraveis,
  novaChaveCampo,
  salvarCamposConfiguraveis,
  TIPOS_CAMPO,
  TipoCampoConfiguravel,
} from '@/lib/camposConfiguraveis'

function novoCampo(indice: number, contexto: ContextoCampoConfiguravel): CampoConfiguravel {
  return {
    id: crypto.randomUUID(),
    chave: `campo_${Date.now()}`,
    label: 'NOVO CAMPO',
    tipo: 'texto',
    ativo: true,
    ordem: (indice + 1) * 10,
    obrigatorioEm: [],
    mostrarEm: [contexto],
  }
}

function contextoLabel(contexto: ContextoCampoConfiguravel) {
  return CONTEXTOS_CAMPO.find((item) => item.valor === contexto)?.label || contexto
}

type PropsMarcacao = {
  titulo: string
  descricao: string
  marcado: boolean
  aoClicar: () => void
}

// Um botão por flag: o clique de Ativo não pode acionar o controle Obrigatório.
function ControleMarcacao({ titulo, descricao, marcado, aoClicar }: PropsMarcacao) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-label={descricao}
      aria-checked={marcado}
      onClick={aoClicar}
      className="flex w-full items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 md:bg-transparent md:px-0"
    >
      <span>{titulo}</span>
      <span
        aria-hidden="true"
        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border text-[12px] font-bold leading-none ${marcado ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-400 bg-white'}`}
      >
        {marcado ? '✓' : null}
      </span>
    </button>
  )
}

export default function CamposConfiguraveisPage() {
  const [campos, setCampos] = useState<CampoConfiguravel[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [contexto, setContexto] = useState<ContextoCampoConfiguravel>('cliente')
  const [busca, setBusca] = useState('')
  const [campoAberto, setCampoAberto] = useState<string | null>(null)
  // A lista completa precisa permanecer disponível para reativar um campo desmarcado.
  const [somenteDaEtapa, setSomenteDaEtapa] = useState(false)

  useEffect(() => {
    usuarioAtual().then((u) => setAutorizado(u?.role === 'master'))
    listarCamposConfiguraveis().then((lista) => {
      setCampos(lista)
      setCarregando(false)
    })
  }, [])

  const camposDoSetor = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    return campos
      .filter((campo) => !somenteDaEtapa || campo.mostrarEm.includes(contexto) || campo.obrigatorioEm.includes(contexto))
      .filter((campo) => !termo || campo.label.toLocaleLowerCase('pt-BR').includes(termo) || campo.chave.toLocaleLowerCase('pt-BR').includes(termo))
      .sort((a, b) => a.ordem - b.ordem)
  }, [campos, contexto, busca, somenteDaEtapa])

  const resumo = useMemo(() => {
    const doContexto = campos.filter((campo) => campo.mostrarEm.includes(contexto) || campo.obrigatorioEm.includes(contexto))
    return {
      total: doContexto.length,
      visiveis: doContexto.filter((campo) => campo.ativo && campo.mostrarEm.includes(contexto)).length,
      obrigatorios: doContexto.filter((campo) => campo.ativo && campo.obrigatorioEm.includes(contexto)).length,
    }
  }, [campos, contexto])

  function atualizar(id: string, patch: Partial<CampoConfiguravel>) {
    setCampos((atual) => atual.map((campo) => (campo.id === id ? { ...campo, ...patch } : campo)))
  }

  function atualizarLabel(campo: CampoConfiguravel, label: string) {
    const patch: Partial<CampoConfiguravel> = { label }
    if (!campo.protegido && (campo.chave.startsWith('campo_') || !campo.chave)) {
      patch.chave = novaChaveCampo(label) || campo.chave
    }
    atualizar(campo.id, patch)
  }

  function definirNoContexto(id: string, tipo: 'mostrar' | 'obrigatorio', marcado: boolean) {
    setCampos((atual) => atual.map((campo) => {
      if (campo.id !== id) return campo
      const chave = tipo === 'mostrar' ? 'mostrarEm' : 'obrigatorioEm'
      let lista = campo[chave]
      lista = marcado ? Array.from(new Set([...lista, contexto])) : lista.filter((item) => item !== contexto)

      const patch: Partial<CampoConfiguravel> = { [chave]: lista }
      if (tipo === 'obrigatorio' && marcado && !campo.mostrarEm.includes(contexto)) {
        patch.mostrarEm = Array.from(new Set([...campo.mostrarEm, contexto]))
      }
      if (tipo === 'mostrar' && !marcado && campo.obrigatorioEm.includes(contexto)) {
        patch.obrigatorioEm = campo.obrigatorioEm.filter((item) => item !== contexto)
      }
      return { ...campo, ...patch }
    }))
  }

  function mover(id: string, direcao: -1 | 1) {
    setCampos((atual) => {
      // Respeita a lista efetivamente exibida (todos ou somente da etapa, com busca).
      const idsExibidos = camposDoSetor.map((campo) => campo.id)
      const indice = idsExibidos.indexOf(id)
      const destino = indice + direcao
      if (indice < 0 || destino < 0 || destino >= idsExibidos.length) return atual

      const atualId = idsExibidos[indice]
      const destinoId = idsExibidos[destino]
      const ordemAtual = atual.find((campo) => campo.id === atualId)?.ordem || 0
      const ordemDestino = atual.find((campo) => campo.id === destinoId)?.ordem || 0
      return atual.map((campo) => {
        if (campo.id === atualId) return { ...campo, ordem: ordemDestino }
        if (campo.id === destinoId) return { ...campo, ordem: ordemAtual }
        return campo
      })
    })
  }

  function excluir(campo: CampoConfiguravel) {
    if (campo.protegido) return
    if (!window.confirm(`Excluir o campo "${campo.label}"?`)) return
    setCampos((atual) => atual.filter((item) => item.id !== campo.id))
  }

  async function salvar() {
    setSalvando(true)
    const ok = await salvarCamposConfiguraveis([...campos].sort((a, b) => a.ordem - b.ordem))
    setSalvando(false)
    window.alert(ok ? 'CONFIGURAÇÕES SALVAS.' : 'NÃO FOI POSSÍVEL SALVAR AS CONFIGURAÇÕES.')
  }

  if (autorizado === false) {
    return <div className="p-8 text-sm text-slate-500">Somente usuário MASTER pode alterar os campos do sistema.</div>
  }

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">CONFIGURAÇÕES</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Campos por setor</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Escolha uma etapa do Atlas, marque ou desmarque Mostrar, Obrigatório e Ativo, e clique em Salvar alterações.
            Campos desmarcados continuam disponíveis para serem marcados novamente.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCampos((atual) => [...atual, novoCampo(atual.length, contexto)])}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Plus size={16} /> Novo campo neste setor
          </button>
          <button
            type="button"
            disabled={salvando}
            onClick={salvar}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Save size={16} /> {salvando ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CONTEXTOS_CAMPO.map((item) => (
            <button
              key={item.valor}
              onClick={() => { setContexto(item.valor); setCampoAberto(null); setBusca('') }}
              className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition ${
                contexto === item.valor ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-400">SETOR / ETAPA</div>
          <div className="mt-1 font-semibold text-slate-800">{contextoLabel(contexto)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-400">CAMPOS VISÍVEIS</div>
          <div className="mt-1 text-xl font-bold text-slate-800">{resumo.visiveis}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-400">OBRIGATÓRIOS</div>
          <div className="mt-1 text-xl font-bold text-slate-800">{resumo.obrigatorios}</div>
        </div>
      </section>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={`Buscar campo em ${contextoLabel(contexto)}...`}
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-slate-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={somenteDaEtapa}
              onChange={(e) => setSomenteDaEtapa(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-slate-900"
            />
            Somente campos desta etapa
          </label>
          <div className="text-xs text-slate-400">
            {camposDoSetor.length} de {somenteDaEtapa ? resumo.total : campos.length} campo(s)
          </div>
        </div>
      </div>

      {carregando ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">Carregando campos...</div>
      ) : camposDoSetor.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <Settings2 size={30} className="mx-auto text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-600">Nenhum campo encontrado nesta etapa.</p>
          <p className="mt-1 text-xs text-slate-400">Limpe a busca ou crie um novo campo.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {camposDoSetor.map((campo, indice) => {
            const aberto = campoAberto === campo.id
            const mostrar = campo.mostrarEm.includes(contexto)
            const obrigatorio = campo.obrigatorioEm.includes(contexto)
            const vinculado = mostrar || obrigatorio
            return (
              <section key={campo.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="grid gap-3 p-4 md:grid-cols-[minmax(220px,1fr)_150px_150px_120px_auto] md:items-center">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-800">{campo.label}</div>
                    <div className="mt-0.5 truncate text-[11px] text-slate-400">{campo.chave} · {TIPOS_CAMPO.find((tipo) => tipo.valor === campo.tipo)?.label || campo.tipo}</div>
                    {!vinculado && (
                      <div className="mt-1 text-[11px] text-amber-700">Fora desta etapa — marque Mostrar para incluir</div>
                    )}
                  </div>

                  <ControleMarcacao
                    titulo="Mostrar"
                    descricao={`Mostrar ${campo.label} em ${contextoLabel(contexto)}`}
                    marcado={mostrar}
                    aoClicar={() => definirNoContexto(campo.id, 'mostrar', !mostrar)}
                  />

                  <ControleMarcacao
                    titulo="Obrigatório"
                    descricao={`Obrigatório: ${campo.label} em ${contextoLabel(contexto)}`}
                    marcado={obrigatorio}
                    aoClicar={() => definirNoContexto(campo.id, 'obrigatorio', !obrigatorio)}
                  />

                  <ControleMarcacao
                    titulo="Ativo"
                    descricao={`Ativo: ${campo.label}`}
                    marcado={campo.ativo}
                    aoClicar={() => atualizar(campo.id, { ativo: !campo.ativo })}
                  />

                  <div className="flex items-center justify-end gap-1">
                    <button disabled={indice <= 0} onClick={() => mover(campo.id, -1)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-20" title="Mover para cima"><ArrowUp size={16} /></button>
                    <button disabled={indice >= camposDoSetor.length - 1} onClick={() => mover(campo.id, 1)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-20" title="Mover para baixo"><ArrowDown size={16} /></button>
                    <button onClick={() => setCampoAberto(aberto ? null : campo.id)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Configurações avançadas">{aberto ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</button>
                  </div>
                </div>

                {aberto && (
                  <div className="border-t border-slate-100 bg-slate-50/60 p-4">
                    <div className="grid gap-4 lg:grid-cols-[minmax(240px,1fr)_180px_minmax(240px,1fr)_auto]">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Nome do campo</label>
                        <input value={campo.label} onChange={(e) => atualizarLabel(campo, e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Tipo</label>
                        <select value={campo.tipo} onChange={(e) => atualizar(campo.id, { tipo: e.target.value as TipoCampoConfiguravel })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                          {TIPOS_CAMPO.map((tipo) => <option key={tipo.valor} value={tipo.valor}>{tipo.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Ajuda / placeholder</label>
                        <input value={campo.placeholder || ''} onChange={(e) => atualizar(campo.id, { placeholder: e.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="Texto de ajuda para o usuário" />
                      </div>
                      <div className="flex items-end justify-end">
                        <button disabled={campo.protegido} onClick={() => excluir(campo)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-30" title={campo.protegido ? 'Campo estrutural protegido' : 'Excluir campo'}>
                          <Trash2 size={15} /> Excluir
                        </button>
                      </div>
                    </div>

                    {campo.tipo === 'selecao' && (
                      <div className="mt-4">
                        <label className="mb-1 block text-xs font-medium text-slate-500">Opções da lista</label>
                        <input value={(campo.opcoes || []).join(', ')} onChange={(e) => atualizar(campo.id, { opcoes: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="Pix, Boleto, Cartão..." />
                      </div>
                    )}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </main>
  )
}