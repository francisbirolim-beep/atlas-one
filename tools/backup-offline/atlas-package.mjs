/**
 * Atlas One — isolated encrypted-backup package transport.
 * Does NOT export Supabase data, install services or schedule backup jobs.
 * Requires an independently protected 32-byte key file.
 * Node.js 20+ built-in APIs only.
 */
import { createReadStream, createWriteStream, constants as fileConstants } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Transform, Writable } from 'node:stream';

const MAGIC = Buffer.from('ATLASBKP1\n', 'ascii');
const IV_LEN = 12, TAG_LEN = 16;
const HEADER_LEN = MAGIC.length + IV_LEN;

function safeAbsolute(name) {
  if (!name || !path.isAbsolute(name)) throw Error('Use absolute paths');
  return path.resolve(name);
}
async function realFile(name) {
  const p = safeAbsolute(name);
  const s = await fs.lstat(p);
  if (!s.isFile() || s.isSymbolicLink()) throw Error('Only regular non-symlink files allowed');
  return p;
}
async function safeDest(name) {
  const p = safeAbsolute(name);
  const parent = await fs.realpath(path.dirname(p));
  const stat = await fs.lstat(parent);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error('Unsafe destination directory');
  try { await fs.lstat(p); throw Error('Destination already exists; refusing overwrite'); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  return p;
}
async function keyBytes(name) {
  const k = await fs.readFile(await realFile(name));
  if (k.length !== 32) throw Error('Key file must contain exactly 32 random bytes');
  return k;
}
async function shaFile(p) {
  const h = createHash('sha256');
  for await (const chunk of createReadStream(p)) h.update(chunk);
  return h.digest('hex');
}
async function checkPackage(encrypted, key) {
  const p = await realFile(encrypted);
  const st = await fs.stat(p);
  if (st.size <= HEADER_LEN + TAG_LEN) throw Error('Package truncated');
  const handle = await fs.open(p, 'r');
  const header = Buffer.alloc(HEADER_LEN), tag = Buffer.alloc(TAG_LEN);
  try {
    await handle.read(header, 0, header.length, 0);
    await handle.read(tag, 0, TAG_LEN, st.size-TAG_LEN);
  } finally { await handle.close(); }
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw Error('Wrong package format');
  const iv = header.subarray(MAGIC.length);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const digest = createHash('sha256');
  let length = 0;
  const sink = new Writable({
    write(chunk, encoding, cb) { digest.update(chunk); length += chunk.length; cb(); }
  });
  // AES-GCM authentication is checked by final(), including on truncated/tampered input.
  await pipeline(createReadStream(p, {start:HEADER_LEN, end:st.size - TAG_LEN - 1}), decipher, sink);
  return { sourceBytes:length, sourceSha256:digest.digest('hex'), cipherSha256:await shaFile(p) };
}
async function seal(source, localDest, cloudDest, key) {
  source = await realFile(source);
  localDest = await safeDest(localDest);
  cloudDest = await safeDest(cloudDest);
  if (source === localDest || source === cloudDest || localDest === cloudDest) throw Error('Paths must differ');
  const tmp = localDest + '.partial-' + process.pid;
  const iv = randomBytes(IV_LEN);
  let copied = false;
  try {
    const h = await fs.open(tmp, 'wx', 0o600);
    try { await h.writeFile(Buffer.concat([MAGIC,iv])); } finally { await h.close(); }
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const digest = createHash('sha256');
    await pipeline(
      createReadStream(source),
      new Transform({transform(chunk, encoding, cb) { digest.update(chunk); cb(null, chunk); }}),
      cipher, createWriteStream(tmp, {flags:'a'})
    );
    await fs.appendFile(tmp,cipher.getAuthTag());
    await fs.rename(tmp,localDest);
    const verified = await checkPackage(localDest,key);
    if (verified.sourceSha256 !== digest.digest('hex')) throw Error('Source verification failed');
    // The second copy must be an independent named file; never silently overwrite.
    await fs.copyFile(localDest,cloudDest,fileConstants.COPYFILE_EXCL);
    copied = true;
    const remoteVerified = await checkPackage(cloudDest,key);
    if (remoteVerified.cipherSha256 !== verified.cipherSha256) throw Error('Cloud folder copy mismatch');
    return {localEncrypted:true,oneDriveFolderEncrypted:true,
      localVerified:true,oneDriveFolderVerified:true,cloudSyncProven:false,
      sourceBytes:verified.sourceBytes,cipherSha256:verified.cipherSha256};
  } catch (e) {
    await fs.rm(tmp,{force:true}).catch(()=>{});
    if (copied) await fs.rm(cloudDest,{force:true}).catch(()=>{});
    throw e;
  }
}
async function restore(encrypted, output, key) {
  encrypted = await realFile(encrypted);
  output = await safeDest(output);
  const result = await checkPackage(encrypted,key);
  const st = await fs.stat(encrypted);
  const h = await fs.open(encrypted,'r'); const header=Buffer.alloc(HEADER_LEN); const tag=Buffer.alloc(TAG_LEN);
  try { await h.read(header,0,HEADER_LEN,0); await h.read(tag,0,TAG_LEN,st.size-TAG_LEN); }
  finally { await h.close(); }
  const decipher=createDecipheriv('aes-256-gcm',key,header.subarray(MAGIC.length));
  decipher.setAuthTag(tag);
  const tmp=output+'.partial-'+process.pid;
  try {
    await pipeline(
      createReadStream(encrypted,{start:HEADER_LEN,end:st.size-TAG_LEN-1}),
      decipher,createWriteStream(tmp,{flags:'wx',mode:0o600})
    );
    if ((await shaFile(tmp))!==result.sourceSha256) throw Error('Restore hash mismatch');
    await fs.rename(tmp,output);
    return {restored:true,sourceBytes:result.sourceBytes,sourceSha256:result.sourceSha256};
  } catch(e) { await fs.rm(tmp,{force:true}).catch(()=>{}); throw e; }
}
async function main() {
  const [command,...args]=process.argv.slice(2);
  let result;
  if(command==='seal' && args.length===4) {
    const [source,local,onedrive,keyFile]=args;
    result=await seal(source,local,onedrive,await keyBytes(keyFile));
  } else if(command==='verify' && args.length===2) {
    result=await checkPackage(args[0],await keyBytes(args[1]));
  } else if(command==='restore' && args.length===3) {
    result=await restore(args[0],args[1],await keyBytes(args[2]));
  } else throw Error('Usage: node atlas-package.mjs seal SOURCE LOCAL.atlas.enc ONEDRIVE.atlas.enc KEYFILE | verify PACKAGE KEYFILE | restore PACKAGE OUTPUT KEYFILE');
  process.stdout.write(JSON.stringify(result)+'\n');
}
main().catch(e=>{console.error('FAILED: '+e.message);process.exitCode=1;});
