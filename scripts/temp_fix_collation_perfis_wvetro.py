from pathlib import Path
import hashlib

TARGET = Path('supabase/migrations/20260817170000_reconciliar_proveniencia_perfis_wvetro_v1.sql')
OLD_SHA = '5e7a7973d897b0b977db39eac3fac5ccf08ae9ba3852569e7f47bb5bb5f7186a'
NEW_SHA = 'cc34865fdcd6e7856e13608ba13b065f2630f57c89e6079720027d385bd4a3cf'

raw = TARGET.read_bytes()
actual = hashlib.sha256(raw).hexdigest()
if actual != OLD_SHA:
    raise SystemExit(f'migration de entrada inesperada: {actual}')

text = raw.decode('utf-8')
old1 = 'order by upper(trim(p.codigo))\n'
new1 = 'order by upper(trim(p.codigo)) collate "C"\n'
old2 = 'order by codigo_norm\n'
new2 = 'order by codigo_norm collate "C"\n'

if text.count(old1) != 1:
    raise SystemExit(f'esperava 1 ocorrência do ORDER BY Atlas; encontrou {text.count(old1)}')
if text.count(old2) != 1:
    raise SystemExit(f'esperava 1 ocorrência do ORDER BY fonte; encontrou {text.count(old2)}')

text = text.replace(old1, new1).replace(old2, new2)
out = text.encode('utf-8')
new_actual = hashlib.sha256(out).hexdigest()
if new_actual != NEW_SHA:
    raise SystemExit(f'hash após patch inesperado: {new_actual}')

TARGET.write_bytes(out)
print(f'migration corrigida: {len(out)} bytes sha256={new_actual}')
