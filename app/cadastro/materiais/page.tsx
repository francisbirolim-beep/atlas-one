'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Plus, Layers, Palette, Weight, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import { usuarioAtual } from '@/lib/auth'
import {
  listarLinhas,
  criarLinha,
  alternarAtivoLinha,
  excluirLinha,
} from '@/lib/linhas'
import {
  listarCores,
  criarCor,
  atualizarCor,
  alternarAtivoCor,
  excluirCor,
} from '@/lib/cores'
import {
  lerPrecoKgAluminio,
  salvarPrecoKgAluminio,
} from '@/lib/configuracoesPrecificacao'
import { Linha, Cor } from '@/lib/tipos'

export default function Materiais() {
  const [carregando, setCarregando] = useState(true)
  const [euSouMaster, setEuSouMaster] = useState<boolean | null>(null)

  const [linhas, setLinhas] = useState<Linha[]>([])
  const [novaLinha, setNovaLinha] = useState('')
  const [salvandoLinha, setSalvandoLinha] = useState(false)

  const [cores, setCores] = useState<Cor[]>([])
  const [novaCor, setNovaCor] = useState('')
  const [novaCorPeso, setNovaCorPeso] = useState('')
  const [novaCorAdicional, setNovaCorAdicional] = useState('')
  const [salvandoCor, setSalvandoCor] = useState(false)

  const [precoKg, setPrecoKg] = useState('')
  const [salvandoPreco, setSalvandoPreco] = useState(false)
  const [precoSalvo, setPrecoSalvo] = useState(false)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const me = await usuarioAtual()
    setEuSouMaster(me?.role === 'master')
    if (me?.role === 'master') {
      setLinhas(await listarLinhas())
      setCores(await listarCores())
      const preco = await lerPrecoKgAluminio()
      setPrecoKg(String(preco || ''))
    }
    setCarregando(false)
  }

  async function adicionarLinha(e: React.FormEvent) {
    e.preventDefault()
    if (!novaLinha.trim()) return
    setSalvandoLinha(true)
    await criarLinha(novaLinha.trim())
    setNovaLinha('')
    setLinhas(await listarLinhas())
    setSalvandoLinha(false)
  }

  async function alternarLinha(l: Linha) {
    await alternarAtivoLinha(l.id, !l.ativo)
    setLinhas(await listarLinhas())
  }

  async function removerLinha(l: Linha) {
    const ok = window.confirm('Excluir a linha "' + l.nome + '"?')
    if (!ok) return
    await excluirLinha(l.id)
    setLinhas(await listarLinhas())
  }

  async function adicionarCor(e: React.FormEvent) {
    e.preventDefault()
    if (!novaCor.trim()) return
    setSalvandoCor(true)
    const peso = novaCorPeso.trim() ? parseFloat(novaCorPeso.replace(',', '.')) : null
    const adicional = novaCorAdicional.trim() ? parseFloat(novaCorAdicional.replace(',', '.')) : 0
    await criarCor(novaCor.trim(), peso, adicional)
    setNovaCor('')
    setNovaCorPeso('')
    setNovaCorAdicional('')
    setCores(await listarCores())
    setSalvandoCor(false)
  }

  async function alternarCor(c: Cor) {
    await alternarAtivoCor(c.id, !c.ativo)
    setCores(await listarCores())
  }

  async function editarAdicionalCor(c: Cor) {
    const atual = c.adicional_kg ? String(c.adicional_kg).replace('.', ',') : '0'
    const resp = window.prompt('Adicional (R$/Kg) sobre o natural para "' + c.nome + '":', atual)
    if (resp === null) return
    const valor = parseFloat(resp.replace(',', '.'))
    if (isNaN(valor) || valor < 0) return
    await atualizarCor(c.id, { adicional_kg: valor, pintura: valor > 0 })
    setCores(await listarCores())
  }

  async function removerCor(c: Cor) {
    const ok = window.confirm('Excluir a cor "' + c.nome + '"?')
    if (!ok) return
    await excluirCor(c.id)
    setCores(await listarCores())
  }

  async function salvarPreco(e: React.FormEvent) {
    e.preventDefault()
    const valor = parseFloat(precoKg.replace(',', '.'))
    if (isNaN(valor) || valor < 0) return
    setSalvandoPreco(true)
    await salvarPrecoKgAluminio(valor)
    setSalvandoPreco(false)
    setPrecoSalvo(true)
    setTimeout(() => setPrecoSalvo(false), 2500)
  }

  const precoKgNum = parseFloat(precoKg.replace(',', '.')) || 0

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  }

  if (!euSouMaster) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 gap-3">
        <ShieldAlert size={40} className="text-slate-300" />
        <p className="text-slate-500">Só o usuário master pode acessar Materiais.</p>
        <Link href="/cadastro" className="text-brand-navy text-sm hover:underline">Voltar ao Cadastro</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/cadastro" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          <Layers size={22} className="text-brand-navy" />
          <div>
            <h1 className="text-lg font-bold text-slate-800">Materiais</h1>
            <p className="text-sm text-slate-500">Linhas, cores e preço do Kg do alumínio</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-4">
            <Weight size={16} /> Preço do Kg do alumínio natural
          </h2>
          <form onSubmit={salvarPreco} className="flex gap-2 items-center">
            <span className="text-slate-500 text-sm">R$</span>
            <input
              type="text"
              inputMode="decimal"
              value={precoKg}
              onChange={e => setPrecoKg(e.target.value)}
              placeholder="0,00"
              className="w-32 border border-slate-300 rounded-xl p-2.5 text-sm"
            />
            <button
              type="submit"
              disabled={salvandoPreco}
              className="px-4 py-2.5 bg-brand-navy text-white rounded-xl text-sm font-medium hover:bg-brand-navyDark transition disabled:opacity-50"
            >
              {salvandoPreco ? 'Salvando...' : 'Salvar'}
            </button>
            {precoSalvo && <span className="text-brand-teal text-xs">Preço salvo.</span>}
          </form>
          <p className="text-xs text-slate-400 mt-2">Cada cor abaixo soma um adicional sobre esse valor para formar o custo final do Kg naquela cor.</p>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-4">
            <Layers size={16} /> Linhas de produto
          </h2>
          <form onSubmit={adicionarLinha} className="flex gap-2 mb-4">
            <input
              type="text"
              value={novaLinha}
              onChange={e => setNovaLinha(e.target.value)}
              placeholder="Nome da linha"
              className="flex-1 border border-slate-300 rounded-xl p-2.5 text-sm"
            />
            <button
              type="submit"
              disabled={salvandoLinha}
              className="px-4 py-2.5 bg-brand-navy text-white rounded-xl text-sm font-medium hover:bg-brand-navyDark transition disabled:opacity-50 flex items-center gap-1"
            >
              <Plus size={14} /> Adicionar
            </button>
          </form>
          {linhas.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma linha cadastrada ainda.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {linhas.map(l => (
                <div
                  key={l.id}
                  className={
                    'flex items-center gap-2 border rounded-full pl-3 pr-2 py-1 text-xs ' +
                    (l.ativo ? 'border-slate-200 text-slate-700' : 'border-slate-100 text-slate-400 line-through')
                  }
                >
                  <span>{l.nome}</span>
                  <button onClick={() => alternarLinha(l)} className="text-slate-400 hover:text-slate-600" title={l.ativo ? 'Desativar' : 'Ativar'}>
                    {l.ativo ? '⏸' : '▶'}
                  </button>
                  <button onClick={() => removerLinha(l)} className="text-red-400 hover:text-red-600" title="Excluir">
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-4">
            <Palette size={16} /> Cores
          </h2>
          <form onSubmit={adicionarCor} className="flex flex-wrap gap-2 mb-4 items-center">
            <input
              type="text"
              value={novaCor}
              onChange={e => setNovaCor(e.target.value)}
              placeholder="Nome da cor"
              className="flex-1 border border-slate-300 rounded-xl p-2.5 text-sm"
            />
            <input
              type="text"
              inputMode="decimal"
              value={novaCorPeso}
              onChange={e => setNovaCorPeso(e.target.value)}
              placeholder="Kg/metro — opcional"
              className="w-36 border border-slate-300 rounded-xl p-2.5 text-sm"
            />
            <input
              type="text"
              inputMode="decimal"
              value={novaCorAdicional}
              onChange={e => setNovaCorAdicional(e.target.value)}
              placeholder="Adicional R$/Kg — opcional"
              className="w-40 border border-slate-300 rounded-xl p-2.5 text-sm"
            />
            <button
              type="submit"
              disabled={salvandoCor}
              className="px-4 py-2.5 bg-brand-navy text-white rounded-xl text-sm font-medium hover:bg-brand-navyDark transition disabled:opacity-50 flex items-center gap-1"
            >
              <Plus size={14} /> Adicionar
            </button>
          </form>
          {cores.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma cor cadastrada ainda.</p>
          ) : (
            <div className="space-y-2">
              {cores.map(c => {
                const adicional = c.adicional_kg || 0
                const total = precoKgNum + adicional
                return (
                  <div key={c.id} className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className={c.ativo ? 'font-medium text-slate-800' : 'font-medium text-slate-400 line-through'}>
                        {c.nome}
                        {adicional > 0 && (
                          <span className="ml-2 text-[10px] font-normal bg-brand-navyLight text-brand-navy px-2 py-0.5 rounded-full align-middle">
                            Pintura
                          </span>
                        )}
                      </p>
                      <p className="text-slate-400 text-xs">
                        {c.peso_kg_metro ? c.peso_kg_metro + ' kg/metro · ' : ''}
                        natural R$ {precoKgNum.toFixed(2)} + adicional R$ {adicional.toFixed(2)} = R$ {total.toFixed(2)}/Kg
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button onClick={() => editarAdicionalCor(c)} className="text-xs text-slate-500 hover:underline">
                        Editar adicional
                      </button>
                      <button onClick={() => alternarCor(c)} className="text-xs text-slate-500 hover:underline">
                        {c.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                      <button onClick={() => removerCor(c)} className="text-xs text-red-500 hover:underline">
                        Excluir
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
