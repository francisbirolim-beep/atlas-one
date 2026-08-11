'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react'
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

function novoCampo(indice: number): CampoConfiguravel {
  return {
    id: crypto.randomUUID(),
    chave: `campo_${Date.now()}`,
    label: 'Novo campo',
    tipo: 'texto',
    ativo: true,
    ordem: (indice + 1) * 10,
    obrigatorioEm: [],
    mostrarEm: ['confirmacao_venda'],
  }
}

export default function CamposConfiguraveisPage() {
  const [campos, setCampos] = useState<CampoConfiguravel[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [filtro, setFiltro] = useState<ContextoCampoConfiguravel | 'todos'>('todos')

  useEffect(() => {
    usuarioAtual().then((u) => setAutorizado(u?.role === 'master'))
    listarCamposConfiguraveis().then((lista) => {
      setCampos(lista)
      setCarregando(false)
    })
  }, [])

  const camposVisiveis = useMemo(() => {
    if (filtro === 'todos') return campos
    return campos.filter((campo) => campo.mostrarEm.includes(filtro) || campo.obrigatorioEm.includes(filtro))
  }, [campos, filtro])

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

  function alternarContexto(id: string, contexto: ContextoCampoConfiguravel, tipo: 'mostrar' | 'obrigatorio') {
    setCampos((atual) => atual.map((campo) => {
      if (campo.id !== id) return campo
      const chave = tipo === 'mostrar' ? 'mostrarEm' : 'obrigatorioEm'
      const lista = campo[chave]
      const novaLista = lista.includes(contexto) ? lista.filter((x) => x !== contexto) : [...lista, contexto]
      const patch: Partial<CampoConfiguravel> = { [chave]: novaLista }
      if (tipo === 'obrigatorio' && novaLista.includes(contexto) && !campo.mostrarEm.includes(contexto)) {
        patch.mostrarEm = [...campo.mostrarEm, contexto]
      }
      return { ...campo, ...patch }
    }))
  }

  function mover(id: string, direcao: -1 | 1) {
    setCampos((atual) => {
      const indice = atual.findIndex((campo) => campo.id === id)
      const destino = indice + direcao
      if (indice < 0 || destino < 0 || destino >= atual.length) return atual
      const copia = [...atual]
      ;[copia[indice], copia[destino]] = [copia[destino], copia[indice]]
      return copia
    })
  }

  function excluir(campo: CampoConfiguravel) {
    if (campo.protegido) return
    if (!window.confirm(`Excluir o campo "${campo.label}"?`)) return
    setCampos((atual) => atual.filter((item) => item.id !== campo.id))
  }

  async function salvar() {
    setSalvando(true)
    const ok = await salvarCamposConfiguraveis(campos)
    setSalvando(false)
    window.alert(ok ? 'Configuracoes salvas.' : 'Nao foi possivel salvar as configuracoes.')
  }

  if (autorizado === false) {
    return <div className="p-8 text-sm text-slate-500">Somente usuario Master pode alterar os campos do sistema.</div>
  }

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Configuracoes</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Campos e formularios</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Defina quais informacoes aparecem em cada etapa do Atlas, quais sao obrigatorias e quais opcoes o usuario pode escolher.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCampos((atual) => [...atual, novoCampo(atual.length)])}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Plus size={16} /> Novo campo
          </button>
          <button
            type="button"
            disabled={salvando}
            onClick={salvar}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Save size={16} /> {salvando ? 'Salvando...' : 'Salvar alteracoes'}
          </button>
        </div>
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFiltro('todos')}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${filtro === 'todos' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
        >
          Todos
        </button>
        {CONTEXTOS_CAMPO.map((contexto) => (
          <button
            key={contexto.valor}
            onClick={() => setFiltro(contexto.valor)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${filtro === contexto.valor ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
          >
            {contexto.label}
          </button>
        ))}
      </div>

      {carregando ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">Carregando campos...</div>
      ) : (
        <div className="space-y-3">
          {camposVisiveis.map((campo) => {
            const indiceReal = campos.findIndex((item) => item.id === campo.id)
            return (
              <section key={campo.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-4 xl:grid-cols-[minmax(260px,1.2fr)_180px_1fr_auto]">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Nome do campo</label>
                    <input
                      value={campo.label}
                      onChange={(e) => atualizarLabel(campo, e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                    />
                    <div className="mt-1 text-[11px] text-slate-400">Chave: {campo.chave}</div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Tipo</label>
                    <select
                      value={campo.tipo}
                      onChange={(e) => atualizar(campo.id, { tipo: e.target.value as TipoCampoConfiguravel })}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    >
                      {TIPOS_CAMPO.map((tipo) => <option key={tipo.valor} value={tipo.valor}>{tipo.label}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Ajuda / placeholder</label>
                    <input
                      value={campo.placeholder || ''}
                      onChange={(e) => atualizar(campo.id, { placeholder: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Ex.: 50% entrada + 50% instalacao"
                    />
                  </div>

                  <div className="flex items-end gap-1">
                    <button disabled={indiceReal <= 0} onClick={() => mover(campo.id, -1)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-20" title="Mover para cima"><ArrowUp size={16} /></button>
                    <button disabled={indiceReal >= campos.length - 1} onClick={() => mover(campo.id, 1)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-20" title="Mover para baixo"><ArrowDown size={16} /></button>
                    <button disabled={campo.protegido} onClick={() => excluir(campo)} className="rounded-lg p-2 text-red-400 hover:bg-red-50 disabled:opacity-20" title={campo.protegido ? 'Campo estrutural protegido' : 'Excluir campo'}><Trash2 size={16} /></button>
                  </div>
                </div>

                {campo.tipo === 'selecao' && (
                  <div className="mt-4">
                    <label className="mb-1 block text-xs font-medium text-slate-500">Opcoes da lista</label>
                    <input
                      value={(campo.opcoes || []).join(', ')}
                      onChange={(e) => atualizar(campo.id, { opcoes: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Pix, Boleto, Cartao..."
                    />
                  </div>
                )}

                <div className="mt-4 flex items-center gap-4 border-t border-slate-100 pt-4">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    <input type="checkbox" checked={campo.ativo} onChange={(e) => atualizar(campo.id, { ativo: e.target.checked })} /> Ativo
                  </label>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="text-slate-400">
                      <tr>
                        <th className="pb-2 pr-4 font-medium">Onde usar</th>
                        <th className="pb-2 px-3 font-medium">Mostrar</th>
                        <th className="pb-2 px-3 font-medium">Obrigatorio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CONTEXTOS_CAMPO.map((contexto) => (
                        <tr key={contexto.valor} className="border-t border-slate-50">
                          <td className="py-2 pr-4 text-slate-600">{contexto.label}</td>
                          <td className="px-3 py-2">
                            <input type="checkbox" checked={campo.mostrarEm.includes(contexto.valor)} onChange={() => alternarContexto(campo.id, contexto.valor, 'mostrar')} />
                          </td>
                          <td className="px-3 py-2">
                            <input type="checkbox" checked={campo.obrigatorioEm.includes(contexto.valor)} onChange={() => alternarContexto(campo.id, contexto.valor, 'obrigatorio')} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </main>
  )
}
