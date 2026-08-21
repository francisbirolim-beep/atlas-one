'use client'

import Link from 'next/link'
import {
  ArrowRight,
  Boxes,
  Building2,
  Calculator,
  FileText,
  KeyRound,
  LayoutGrid,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react'

type Atalho = {
  href: string
  titulo: string
  descricao: string
  icon: typeof Settings
}

const GRUPOS: { titulo: string; descricao: string; itens: Atalho[] }[] = [
  {
    titulo: 'Empresa e equipe',
    descricao: 'Identidade da empresa, usuários e organização interna.',
    itens: [
      { href: '/configuracoes/empresa', titulo: 'Empresa e Identidade', descricao: 'Nome, logo, cor principal e personalização white-label.', icon: Building2 },
      { href: '/configuracoes/usuarios', titulo: 'Usuários e Acesso', descricao: 'Criar usuários, definir acesso e montar a Home de cada pessoa.', icon: KeyRound },
      { href: '/setores', titulo: 'Setores e Permissões', descricao: 'Organizar setores, responsabilidades e níveis de acesso.', icon: LayoutGrid },
    ],
  },
  {
    titulo: 'Comercial',
    descricao: 'Ajustes que afetam propostas e rotina comercial.',
    itens: [
      { href: '/configuracoes/orcamento', titulo: 'Padrão do Orçamento', descricao: 'Configurar regras e apresentação dos orçamentos.', icon: FileText },
    ],
  },
  {
    titulo: 'Engenharia e cadastros',
    descricao: 'Base técnica usada por orçamento, engenharia e produção.',
    itens: [
      { href: '/cadastros', titulo: 'Central de Cadastros', descricao: 'Produtos, linhas, materiais, fornecedores, precificação e bases técnicas.', icon: Boxes },
      { href: '/engenharia/formulas-corte', titulo: 'Fórmulas de Corte', descricao: 'Regras técnicas e fórmulas utilizadas na produção.', icon: Calculator },
    ],
  },
  {
    titulo: 'Sistema',
    descricao: 'Ferramentas de administração que não fazem parte da rotina diária.',
    itens: [
      { href: '/configuracoes/campos', titulo: 'Campos adicionais', descricao: 'Campos personalizados usados nas rotinas do Atlas.', icon: SlidersHorizontal },
      { href: '/configuracoes', titulo: 'Configurações Avançadas', descricao: 'Automações, metas, backup, Kanban, SLA, IA e outros ajustes.', icon: Settings },
    ],
  },
]

export default function AdministracaoPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <ShieldCheck size={14} /> Área do Master
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Central de Administração</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Aqui ficam os cadastros e configurações do Atlas. A operação do dia a dia continua no menu lateral; esta área concentra apenas o que é administrativo.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {GRUPOS.map(grupo => (
          <section key={grupo.titulo}>
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-slate-900">{grupo.titulo}</h2>
              <p className="mt-0.5 text-xs text-slate-400">{grupo.descricao}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {grupo.itens.map(item => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex min-h-32 items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                      <Icon size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-sm font-semibold text-slate-900">{item.titulo}</strong>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">{item.descricao}</span>
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        Abrir <ArrowRight size={13} className="transition group-hover:translate-x-0.5" />
                      </span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
