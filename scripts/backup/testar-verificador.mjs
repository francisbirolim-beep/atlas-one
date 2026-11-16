#!/usr/bin/env node
/** Exercicios isolados com dados ficticios: nenhum acesso a producao ou nuvem. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { verificarPacote } from './verificar-pacote.mjs'

const dir = await mkdtemp(path.join(tmpdir(), 'atlas-backup-ficticio-'))
const manifest = path.join(dir, 'bundle-manifest.json')
const arquivos = [
  { path: 'database/dump-ficticio.sql', kind: 'database', body: 'DADOS-FICTICIOS' },
  { path: 'storage/foto-ficticia.txt', kind: 'storage', body: 'IMAGEM-FICTICIA' },
]
const m = { format: 'atlas-one-backup-bundle-v1', createdAt: '2026-11-16T12:00:00Z', items: [] }
async function salvar(obj = m) { await writeFile(manifest, JSON.stringify(obj)) }
async function falha(nome) {
  await assert.rejects(verificarPacote(dir), Error, nome)
}
try {
  for (const arq of arquivos) {
    await mkdir(path.dirname(path.join(dir, arq.path)), { recursive: true })
    await writeFile(path.join(dir, arq.path), arq.body)
    m.items.push({
      path: arq.path,
      kind: arq.kind,
      sizeBytes: Buffer.byteLength(arq.body),
      sha256: createHash('sha256').update(arq.body).digest('hex'),
    })
  }
  await salvar()
  assert.equal((await verificarPacote(dir)).itensVerificados, 2)
  await writeFile(path.join(dir, arquivos[1].path), 'CORROMPIDO')
  await falha('alteracao de arquivo')
  await writeFile(path.join(dir, arquivos[1].path), arquivos[1].body)
  await salvar({ ...m, items: [{ ...m.items[0], path: '../fora' }, m.items[1]] })
  await falha('travessia de caminho')
  await salvar({ ...m, items: [m.items[0], { ...m.items[0] }, m.items[1]] })
  await falha('caminho duplicado')
  await salvar({ ...m, items: [m.items[0]] })
  await falha('sem Storage')
  await salvar(m)
  await writeFile(path.join(dir, 'extra.txt'), 'NAO LISTADO')
  await falha('arquivo fora do manifesto')
  await rm(path.join(dir, 'extra.txt'))
  await rm(path.join(dir, arquivos[1].path))
  await falha('arquivo ausente')
  await writeFile(path.join(dir, arquivos[1].path), arquivos[1].body)
  try {
    await symlink(path.join(dir, arquivos[0].path), path.join(dir, 'storage/link.txt'))
    await falha('link simbolico')
    await rm(path.join(dir, 'storage/link.txt'))
  } catch (e) {
    if (!['EPERM', 'EACCES'].includes(e.code)) throw e
  }
  assert.equal((await verificarPacote(dir)).valido, true)
  process.stdout.write('OK: 8 cenarios de verificacao com dados ficticios.\n')
} finally {
  await rm(dir, { recursive: true, force: true })
}
