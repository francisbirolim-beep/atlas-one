'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart3,
  Boxes,
  Calculator,
  CircleDollarSign,
  History,
  Home,
  LogOut,
  PackageCheck,
  PackageSearch,
  ShoppingCart,
  Users,
  WalletCards,
  Warehouse,
} from 'lucide-react'
import { logout, usuarioAtual } from '@/lib/auth'
import { listarPermissoesUsuario, nivelEfetivo } from '@/lib/setores'
import type { NivelPermissao, Usuario } from '@/lib/tipos'

type Acessos={venda:NivelPermissao;caixa:NivelPermissao;relatorios:NivelPermissao}

export default function BalcaoShell({children}:{children:ReactNode}){
 const path=usePathname(),router=useRouter();const [u,setU]=useState<Usuario|null>(null);const [ac,setAc]=useState<Acessos>({venda:'oculto',caixa:'oculto',relatorios:'oculto'})
 useEffect(()=>{usuarioAtual().then(async x=>{setU(x);if(!x)return;const p=await listarPermissoesUsuario(x.id);setAc({venda:nivelEfetivo(x,'venda-balcao',p),caixa:nivelEfetivo(x,'caixa-balcao',p),relatorios:nivelEfetivo(x,'relatorios-balcao',p)})})},[])
 const item=(href:string,label:string,icon:React.ReactNode,vis=true)=>{const ativo=href==='/balcao'?path==='/balcao':path===href||path.startsWith(href+'/');return vis?<Link href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${ativo?'bg-emerald-600 text-white':'text-slate-300 hover:bg-white/10 hover:text-white'}`}>{icon}{label}</Link>:null}
 const compartilhado=(href:string,label:string,icon:React.ReactNode)=> <Link href={href} title="Abre a gestão compartilhada no Atlas completo" className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"><span className="flex items-center gap-3">{icon}{label}</span><span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">Atlas</span></Link>
 async function sair(){await logout();router.replace('/login')}
 return <div className="min-h-screen bg-slate-50 md:flex"><aside className="hidden w-64 shrink-0 flex-col bg-[#071426] p-4 text-white md:flex"><div className="mb-3"><div className="text-xl font-bold">Atlas One</div><div className="text-xs font-medium text-emerald-400">Modo Venda Balcão</div></div><Link href="/" className="mb-5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"><Home size={17}/>Voltar ao Atlas</Link><nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">{item('/balcao','Venda',<ShoppingCart size={18}/>,ac.venda!=='oculto')}{item('/balcao/orcamentos','Orçamento',<Calculator size={18}/>,ac.venda!=='oculto')}{item('/balcao/consulta-preco','Consulta de preço',<PackageSearch size={18}/>,ac.venda!=='oculto')}{item('/balcao/clientes','Clientes',<Users size={18}/>,ac.venda!=='oculto')}{item('/balcao/atendimentos','Atendimentos',<PackageCheck size={18}/>,ac.venda!=='oculto')}{item('/balcao/historico','Histórico de vendas',<History size={18}/>,ac.venda!=='oculto')}<div className="my-3 border-t border-white/10"/>{item('/balcao/caixa','Caixa',<WalletCards size={18}/>,ac.caixa!=='oculto')}{item('/balcao/contas-receber','Contas a receber',<CircleDollarSign size={18}/>,ac.caixa!=='oculto')}{item('/balcao/relatorios','Relatórios e Gestão',<BarChart3 size={18}/>,ac.relatorios!=='oculto')}<div className="my-3 border-t border-white/10"/><div className="px-3 pb-1 pt-1 text-[9px] font-semibold uppercase tracking-[.16em] text-slate-500">Gestão compartilhada</div>{compartilhado('/cadastros','Produtos / Cadastros',<Boxes size={17}/>)}{compartilhado('/estoque','Estoque',<Warehouse size={17}/>)}{compartilhado('/compras','Compras / NF',<PackageCheck size={17}/>)}</nav><div className="mt-4 border-t border-white/10 pt-4"><div className="mb-3 text-xs text-slate-400"><div className="font-semibold text-white">{u?.nome||'Usuário'}</div>{u?.role==='master'?'MASTER':'OPERADOR BALCÃO'}</div><button onClick={sair} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/10"><LogOut size={17}/>Sair</button></div></aside><div className="min-w-0 flex-1"><div className="sticky top-0 z-30 flex gap-1 overflow-x-auto border-b bg-white p-2 md:hidden"><Link href="/" className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Atlas</Link>{ac.venda!=='oculto'&&<><Link href="/balcao" className="rounded-lg px-3 py-2 text-xs font-semibold">Venda</Link><Link href="/balcao/consulta-preco" className="rounded-lg px-3 py-2 text-xs font-semibold">Preço</Link><Link href="/balcao/clientes" className="rounded-lg px-3 py-2 text-xs font-semibold">Clientes</Link><Link href="/balcao/atendimentos" className="rounded-lg px-3 py-2 text-xs font-semibold">Atendimentos</Link><Link href="/balcao/historico" className="rounded-lg px-3 py-2 text-xs font-semibold">Histórico</Link></>}{ac.caixa!=='oculto'&&<><Link href="/balcao/caixa" className="rounded-lg px-3 py-2 text-xs font-semibold">Caixa</Link><Link href="/balcao/contas-receber" className="rounded-lg px-3 py-2 text-xs font-semibold">Receber</Link></>}{ac.relatorios!=='oculto'&&<Link href="/balcao/relatorios" className="rounded-lg px-3 py-2 text-xs font-semibold">Relatórios</Link>}</div>{children}</div></div>
}
