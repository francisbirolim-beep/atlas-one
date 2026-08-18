from pathlib import Path

p = Path('components/system/AppTopbar.tsx')
text = p.read_text(encoding='utf-8')

import_marker = "import type { Usuario } from '@/lib/tipos'\n"
if "HomeNotificationBell" not in text:
    if import_marker not in text:
        raise SystemExit('import marker not found')
    text = text.replace(import_marker, import_marker + "import HomeNotificationBell from '@/components/system/HomeNotificationBell'\n", 1)

link_marker = '            <Link href="/orcamento-rapido" className="hidden h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3.5 text-sm font-semibold text-white shadow-sm shadow-emerald-600/15 transition hover:bg-emerald-700 sm:inline-flex" title="Criar novo orçamento rápido"><Plus size={16} /> Novo</Link>'
if '<HomeNotificationBell />' not in text:
    if link_marker not in text:
        raise SystemExit('new button marker not found')
    text = text.replace(link_marker, '            <HomeNotificationBell />\n' + link_marker, 1)

p.write_text(text, encoding='utf-8')
