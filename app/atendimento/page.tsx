import Link from 'next/link'

export default function AtendimentoPage() {
  return (
    <main className="min-h-screen bg-slate-100 p-3 md:p-6">
      <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Central de Conversas</h1>
            <p className="mt-1 text-sm text-slate-500">Diagnóstico mobile seguro</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Atlas One</span>
        </div>

        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="font-semibold text-emerald-900">Tela base carregada corretamente.</p>
          <p className="mt-1 text-sm text-emerald-800">
            Esta versão não carrega Supabase, realtime, useSearchParams, ícones ou lógica de atendimento.
          </p>
        </div>

        <p className="mt-5 text-sm text-slate-600">
          Se esta tela abrir no iPhone, o problema está em uma dependência ou efeito da Central anterior — não na rota /atendimento nem no deploy.
        </p>

        <Link href="/" className="mt-6 inline-flex rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700">
          Voltar ao Atlas
        </Link>
      </div>
    </main>
  )
}
