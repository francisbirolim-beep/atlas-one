#!/usr/bin/env node
/**
 * Validador offline e somente leitura de pacote Atlas One.
 * NAO faz backup, NAO restaura, NAO conecta a nuvem, NAO prova cobertura da origem.
 * Uso: node scripts/backup/verificar-pacote.mjs <diretorio>
 * O diretorio deve ser uma copia CONGELADA, nunca um diretorio operacional ativo.
 */
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { lstat, readFile, readdir, realpath } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const NOME = 'bundle-manifest.json'
const TIPOS = new Set(['database', 'storage', 'metadata'])
function garantir(ok, msg) { if (!ok) throw new Error(msg) }

function validarRelativo(relativo, n) {
  garantir(typeof relativo === 'string' && relativo.length > 0 && relativo.length <= 1024, 'Caminho invalido no item ' + n)
  garantir(!relativo.startsWith('/') && !relativo.includes('\\') && !relativo.includes(':') &&
    !/[\x00-\x1f\x7f]/.test(relativo), 'Caminho inseguro no item ' + n)
  const partes = relativo.split('/')
  garantir(partes.every(p => p && p !== '.' && p !== '..' && !p.endsWith(' ') && !p.endsWith('.')),
    'Caminho nao canonico no item ' + n)
  garantir(relativo !== NOME, 'Manifesto incluso indevidamente no item ' + n)
  return partes
}

async function arquivoRegular(raiz, partes, n) {
  let atual = raiz
  for (let i = 0; i < partes.length; i++) {
    atual = path.join(atual, partes[i])
    const info = await lstat(atual)
    garantir(!info.isSymbolicLink(), 'Link simbolico proibido no item ' + n)
    garantir(i === partes.length - 1 ? info.isFile() : info.isDirectory(),
      'Tipo inesperado no item ' + n)
    if (i === partes.length - 1) return { caminho: atual, info }
  }
  throw new Error('Item sem caminho: ' + n)
}

async function sha256(caminho) {
  const hash = createHash('sha256')
  for await (const bloco of createReadStream(caminho)) hash.update(bloco)
  return hash.digest('hex')
}

async function catalogar(raiz, relativo = '') {
  const nomes = []
  for (const entry of await readdir(path.join(raiz, relativo), { withFileTypes: true })) {
    const rel = relativo ? relativo + '/' + entry.name : entry.name
    garantir(!entry.isSymbolicLink(), 'Link simbolico inesperado no pacote')
    if (entry.isDirectory()) nomes.push(...await catalogar(raiz, rel))
    else {
      garantir(entry.isFile(), 'Arquivo irregular no pacote')
      if (rel !== NOME) nomes.push(rel)
    }
  }
  return nomes
}

export async function verificarPacote(pasta) {
  const raiz = await realpath(pasta)
  garantir((await lstat(raiz)).isDirectory(), 'Raiz deve ser pasta')
  const info = await lstat(path.join(raiz, NOME))
  garantir(info.isFile() && !info.isSymbolicLink(), 'Manifesto invalido')
  garantir(info.size <= 16 * 1024 * 1024, 'Manifesto acima de 16 MiB')
  const m = JSON.parse(await readFile(path.join(raiz, NOME), 'utf8'))
  garantir(m && !Array.isArray(m) && m.format === 'atlas-one-backup-bundle-v1',
    'Formato invalido')
  garantir(typeof m.createdAt === 'string' && !Number.isNaN(Date.parse(m.createdAt)),
    'Data invalida')
  garantir(Array.isArray(m.items) && m.items.length > 0 && m.items.length <= 100000,
    'Itens ausentes ou excessivos')
  const caminhos = new Set()
  const tipos = new Set()
  for (let n = 0; n < m.items.length; n++) {
    const item = m.items[n]
    garantir(item && typeof item === 'object' && !Array.isArray(item), 'Item invalido: ' + n)
    const partes = validarRelativo(item.path, n)
    const chave = item.path.toLocaleLowerCase('en-US')
    garantir(!caminhos.has(chave), 'Caminho duplicado no item ' + n)
    caminhos.add(chave)
    garantir(TIPOS.has(item.kind), 'Tipo invalido no item ' + n)
    garantir(Number.isSafeInteger(item.sizeBytes) && item.sizeBytes >= 0,
      'Tamanho invalido no item ' + n)
    garantir(typeof item.sha256 === 'string' && /^[a-f0-9]{64}$/.test(item.sha256),
      'SHA-256 invalido no item ' + n)
    const { caminho, info } = await arquivoRegular(raiz, partes, n)
    garantir(info.size === item.sizeBytes, 'Tamanho divergente no item ' + n)
    garantir(await sha256(caminho) === item.sha256, 'Hash divergente no item ' + n)
    tipos.add(item.kind)
  }
  garantir(tipos.has('database'), 'Sem arquivo de banco de dados')
  garantir(tipos.has('storage'), 'Sem arquivo de Storage')
  const extras = (await catalogar(raiz)).filter(p => !caminhos.has(p.toLocaleLowerCase('en-US')))
  garantir(extras.length === 0, 'Arquivos fora do manifesto: ' + extras.length)
  return { valido: true, itensVerificados: m.items.length }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2] || process.argv.length !== 3) {
    process.stderr.write('Uso: node scripts/backup/verificar-pacote.mjs <diretorio>\n')
    process.exitCode = 2
  } else {
    try {
      const r = await verificarPacote(process.argv[2])
      process.stdout.write('OK: ' + r.itensVerificados + ' arquivos com integridade verificada; nao prova cobertura ou restauracao.\n')
    } catch (e) {
      process.stderr.write('FALHOU: ' + e.message + '\n')
      process.exitCode = 1
    }
  }
}
