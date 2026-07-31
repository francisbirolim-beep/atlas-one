'use client'

import { FileText, Camera, ArrowRight, History, BarChart3, Users } from 'lucide-react'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Atlas One</h1>
            <p className="text-sm text-slate-500">Esquadrifácio — Orçamento Inteligente</p>
          </div>
          <div className="flex gap-2">
            <Link href="/clientes" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition">
              <Users size={16} />
              Clientes
            </Link>
            <Link href="/historico" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition">
              <History size={16} />
              Histórico
            </Link>
            <Link href="/dashboard" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition">
              <BarChart3 size={16} />
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-800 mb-3">Como deseja orçar?</h2>
          <p className="text-slate-500 max-w-lg mx-auto">
            Escolha o modo rápido para orçamentos simples ou o modo detalhado
            para medições completas com fotos e cálculos precisos.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <Link href="/orcamento-rapido"
            className="group bg-white rounded-2xl border-2 border-blue-100 hover:border-blue-500
                       p-8 transition-all hover:shadow-lg hover:-translate-y-1">
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-5 group-hover:bg-blue-500 transition-colors">
              <FileText size={28} className="text-blue-600 group-hover:text-white transition-colors" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">Orçamento Rápido</h3>
            <p className="text-slate-500 text-sm mb-4">
              Informe o tipo de esquadria e medidas. Ideal para respostas rápidas
              no WhatsApp ou atendimento presencial.
            </p>
            <ul className="text-sm text-slate-600 space-y-1.5 mb-6">
              <li className="flex items-center gap-2">Tipo + medidas básicas</li>
              <li className="flex items-center gap-2">Acabamento e cor</li>
              <li className="flex items-center gap-2">Cálculo automático</li>
              <li className="flex items-center gap-2">Texto livre para descrever</li>
            </ul>
            <div className="flex items-center text-blue-600 font-medium group-hover:gap-2 transition-all">
              Fazer orçamento rápido <ArrowRight size={16} className="ml-1" />
            </div>
          </Link>

          <Link href="/orcamento-detalhado"
            className="group bg-white rounded-2xl border-2 border-emerald-100 hover:border-emerald-500
                       p-8 transition-all hover:shadow-lg hover:-translate-y-1">
            <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center mb-5 group-hover:bg-emerald-500 transition-colors">
              <Camera size={28} className="text-emerald-600 group-hover:text-white transition-colors" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">Orçamento Detalhado</h3>
            <p className="text-slate-500 text-sm mb-4">
              Com fotos do local, medidas da trena e cálculos completos.
              Perfeito para obras e projetos complexos.
            </p>
            <ul className="text-sm text-slate-600 space-y-1.5 mb-6">
              <li className="flex items-center gap-2">Upload de fotos do local</li>
              <li className="flex items-center gap-2">Múltiplas medidas da trena</li>
              <li className="flex items-center gap-2">Detalhamento de perfis e vidros</li>
              <li className="flex items-center gap-2">Margem de lucro por item</li>
            </ul>
            <div className="flex items-center text-emerald-600 font-medium group-hover:gap-2 transition-all">
              Fazer orçamento detalhado <ArrowRight size={16} className="ml-1" />
            </div>
          </Link>
        </div>
      </main>
    </div>
  )
}
