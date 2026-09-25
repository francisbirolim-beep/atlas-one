'use client'

import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Clock3, Database, ShieldCheck, Sparkles } from 'lucide-react'

const etapas = [
  { titulo: 'Não validado', texto: 'Informação encontrada em conversa, arquivo ou operação. Ainda não é regra da empresa.', icone: Clock3 },
  { titulo: 'Em validação', texto: 'O Atlas encaminha o conhecimento ao responsável pelo assunto para conferência.', icone: ShieldCheck },
  { titulo: 'Validado / oficial', texto: 'Depois da aprovação, passa a compor a base oficial, com fonte, responsável, data e versão.', icone: CheckCircle2 },
  { titulo: 'Obsoleto / substituído', texto: 'Uma regra antiga continua rastreável, mas deixa de ser usada quando uma nova versão é aprovada.', icone: Database },
]

export default function ConhecimentoAtlasIAPage() {
  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4"><Link href="/atlas-ia" className="rounded-lg p-2 hover:bg-slate-100"><ArrowLeft size={20}/></Link><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#182444] text-white"><Sparkles size={20}/></div><div><h1 className="font-semibold">Conhecimento do Atlas IA</h1><p className="text-xs text-slate-500">Aprender com o trabalho sem transformar conversa em regra automaticamente.</p></div></div></header>

    <section className="mx-auto max-w-5xl px-4 py-8">
      <div className="rounded-2xl border bg-white p-5 shadow-sm"><div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700"><ShieldCheck size={18}/> Fluxo de confiança</div><h2 className="text-xl font-semibold">A empresa confirma o que vira verdade oficial.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">O Atlas pode detectar conhecimento novo nas conversas e nas fontes conectadas. Até que um responsável aprove, a informação permanece identificada como não validada e não deve ser tratada como regra técnica oficial.</p></div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">{etapas.map(({ titulo, texto, icone: Icone }) => <div key={titulo} className="rounded-2xl border bg-white p-5 shadow-sm"><Icone className="mb-3 text-[#182444]" size={22}/><h3 className="font-semibold">{titulo}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{texto}</p></div>)}</div>

      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"><b className="text-sm text-amber-900">Próxima camada operacional</b><p className="mt-1 text-sm leading-6 text-amber-800">A fila de validações será ligada aos responsáveis por domínio — por exemplo, engenharia, orçamento, produção e financeiro — e às notificações internas. Aprovar, corrigir ou rejeitar deverá deixar trilha de auditoria.</p></div>
    </section>
  </main>
}