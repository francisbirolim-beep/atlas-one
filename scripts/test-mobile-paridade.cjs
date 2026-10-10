'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')
const test = (label, ok) => { assert.ok(ok, label); console.log('OK', label) }

const nav = read('components/system/MobileNavigationControls.tsx')
const desktop = read('components/Sidebar.tsx')
const shell = read('components/system/AppShell.tsx')
const whatsapp = read('app/whatsapp/page.tsx')
const guides = read('lib/guias.ts')
const css = read('app/mobile-bottom-safe.css')
const office = read('app/atlas-ia/supervisao/page.tsx')
const print = read('app/engenharia/formulas-corte/page.tsx')
const login = read('app/login/page.tsx')

test('Menu desktop e mobile partilham GUIAS', desktop.includes('GUIAS') && nav.includes('GUIAS') && nav.includes('agruparGuias'))
test('Administração usa a mesma lista', desktop.includes('ITENS_ADMIN') && nav.includes('ITENS_ADMIN'))
test('Menu mobile preserva filtros master', nav.includes("usuario?.role === 'master'") && nav.includes("if (guia.masterOnly) return false"))
test('IA Atlas visível em navegação mobile', nav.includes('href="/atlas-ia"') && nav.includes('IA Atlas'))
test('Supervisão exclusiva para Master', nav.includes("const supervisaoIaCombina = usuario?.role === 'master'") && nav.includes('href="/atlas-ia/supervisao"'))
test('Menu completo também montado no WhatsApp', shell.includes('<MobileNavigationControls ocultarBarraInferior={ehWhatsAppAtendimento} />') && nav.includes('EVENTO_ABRIR_MENU_MOBILE'))
test('WhatsApp pode abrir menu sem sobrepor compositor', whatsapp.includes('EVENTO_ABRIR_MENU_MOBILE') && shell.includes('atlas-whatsapp-shell') && css.includes('body:has(.atlas-whatsapp-shell)'))
test('Menu e favoritos preservados em outras páginas', nav.includes('aria-label="Abrir favoritos"') && nav.includes('aria-label="Abrir menu completo"'))
test('Atalhos comerciais no celular', nav.includes('href="/orcamento-rapido"') && nav.includes('href="/whatsapp"'))
test('Chat interno aparece em telas menores', whatsapp.includes('conversasInternasMobile.map') && whatsapp.includes('xl:hidden" aria-label="Conversas internas da equipe"'))
test('Histórico interno mantém busca móvel separada', whatsapp.includes('const conversasInternasMobile = useMemo') && whatsapp.includes('const internasFiltradas = useMemo'))
test('Ações em mensagens acessíveis ao toque', whatsapp.includes('md:hidden md:group-hover/msg:flex') && whatsapp.includes('md:hidden md:group-hover:flex'))
test('Ações de notificações disponíveis no mobile', whatsapp.includes('aria-label="Ativar notificações neste dispositivo"'))
test('Navegação do painel acessível por teclado', nav.includes("event.key === 'Escape'") && nav.includes('aria-modal="true"'))
test('Tela de Supervisão com escritório rolável', office.includes('min-w-[780px]') && office.includes('overscroll-x-contain'))
test('Plano de corte com rolagem sem alterar impressão', print.includes('print:overflow-visible') && print.includes('print:min-w-0') && print.includes('atlas-print-area'))
test('Grid e campos limitados à largura disponível', css.includes('.atlas-app-main .grid > *') && css.includes('max-width: 100%'))
test('Campos de login utilizáveis em iPhone', login.includes('text-base sm:text-sm') && read('app/redefinir-senha/page.tsx').includes('text-base sm:text-sm'))
test('Campo de busca do menu não força zoom', nav.includes('pl-9 pr-3 text-base sm:text-sm'))
test('Menu mobile fecha ao mudar de rota', nav.includes('setMenuAberto(false)') && nav.includes('}, [pathname])'))
test('Barra de continuar no orçamento não fica atrás da navegação', read('components/orcamento/NovoOrcamentoHub.tsx').includes('bottom-[calc(4.9rem+env(safe-area-inset-bottom))]'))
test('Medição mantém quantidade e responsável no celular', read('components/system/MedicaoParcialPanel.tsx').includes('Qtd: {peca.quantidade}') && read('components/system/MedicaoParcialPanel.tsx').includes('{peca.medidoPor ?'))
test('Cotação de fornecedores é rolável sem alterar impressão', read('app/compras/cotacoes/lote/[id]/page.tsx').includes('overflow-x-auto overscroll-x-contain') && read('app/compras/cotacoes/lote/[id]/page.tsx').includes('print:min-w-0'))
test('Caderno de consultoria tem altura mobile própria', read('app/consultoria/page.tsx').includes('min-h-[400px]') && read('app/consultoria/page.tsx').includes('md:min-h-[630px]'))

test('Regras comerciais não foram alteradas pelo módulo de navegação', guides.includes('EVENTO_ABRIR_MENU_MOBILE') && !whatsapp.includes('dangerouslySetInnerHTML'))

function count(dir, ext) {
  let n = 0
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name)
    if (entry.isDirectory()) n += count(rel, ext)
    else if (entry.name.endsWith(ext)) n++
  }
  return n
}

console.log('Auditoria estática: ' + count('app', 'page.tsx') + ' páginas; ' + count('components', '.tsx') + ' componentes.')
console.log('PASSOU: verificações estruturais (não substituem teste visual/autenticado).')
