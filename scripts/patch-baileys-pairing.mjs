import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const pkgRoot = path.join(root, 'node_modules', '@whiskeysockets', 'baileys', 'lib')
const utilFile = path.join(pkgRoot, 'Utils', 'companion-reg-client-utils.js')
const socketFile = path.join(pkgRoot, 'Socket', 'socket.js')
const recvFile = path.join(pkgRoot, 'Socket', 'messages-recv.js')

function replaceOnce(file, from, to, label) {
  let text = fs.readFileSync(file, 'utf8')
  if (text.includes(to)) return false
  if (!text.includes(from)) {
    throw new Error(`Patch Baileys falhou em ${label}: trecho esperado nao encontrado.`)
  }
  text = text.replace(from, to)
  fs.writeFileSync(file, text)
  return true
}

function appendBeforeSourceMap(file, block, marker) {
  let text = fs.readFileSync(file, 'utf8')
  if (text.includes(marker)) return false
  const mapLine = '//# sourceMappingURL='
  const pos = text.lastIndexOf(mapLine)
  if (pos < 0) throw new Error('Source map marker nao encontrado em ' + file)
  text = text.slice(0, pos) + block.trimEnd() + '\n' + text.slice(pos)
  fs.writeFileSync(file, text)
  return true
}

// 1) companion_reg_refresh helpers
replaceOnce(
  utilFile,
  'export var CompanionWebClientType;',
  "import { randomBytes } from 'crypto';\nimport { getBinaryNodeChild } from '../WABinary/index.js';\nexport var CompanionWebClientType;",
  'imports companion-reg',
)

appendBeforeSourceMap(
  utilFile,
  `
export const makePairingQRRenderer = (refs, render) => {
    let index = 0;
    let current;
    return {
        next() {
            const ref = refs[index];
            if (ref === undefined) {
                return false;
            }
            index += 1;
            current = ref;
            render(ref);
            return true;
        },
        refresh() {
            if (current === undefined) {
                return false;
            }
            render(current);
            return true;
        }
    };
};

const COMPANION_REG_REFRESH_CHILDREN = ['companion_reg_refresh', 'pair-device-rotate-qr'];

export const handleCompanionRegRefresh = (node, { creds, emitCredsUpdate, refreshQR, logger }) => {
    if (!COMPANION_REG_REFRESH_CHILDREN.some(tag => getBinaryNodeChild(node, tag))) {
        logger.warn({ node }, 'companion_reg_refresh sem child esperado; ignorando');
        return 'ignored_malformed';
    }
    if (creds.me) {
        logger.debug({ id: node.attrs.id }, 'companion_reg_refresh em sessao registrada; mantendo adv secret');
        return 'ignored_registered';
    }
    creds.advSecretKey = randomBytes(32).toString('base64');
    emitCredsUpdate({ advSecretKey: creds.advSecretKey });
    logger.info({ id: node.attrs.id }, 'adv secret renovado; renderizando QR novamente');
    refreshQR();
    return 'rotated';
};
`,
  'export const handleCompanionRegRefresh =',
)

// 2) socket imports
replaceOnce(
  socketFile,
  'getNextPreKeysNode, makeEventBuffer, makeNoiseHandler',
  'getNextPreKeysNode, handleCompanionRegRefresh, makeEventBuffer, makeNoiseHandler, makePairingQRRenderer',
  'socket imports',
)

// 3) QR generation flow
const oldQrBlock = `    // QR gen
    ws.on('CB:iq,type:set,pair-device', async (stanza) => {
        const iq = {
            tag: 'iq',
            attrs: {
                to: S_WHATSAPP_NET,
                type: 'result',
                id: stanza.attrs.id
            }
        };
        await sendNode(iq);
        const pairDeviceNode = getBinaryNodeChild(stanza, 'pair-device');
        const refNodes = getBinaryNodeChildren(pairDeviceNode, 'ref');
        const noiseKeyB64 = Buffer.from(creds.noiseKey.public).toString('base64');
        const identityKeyB64 = Buffer.from(creds.signedIdentityKey.public).toString('base64');
        const advB64 = creds.advSecretKey;
        let qrMs = qrTimeout || 60000; // time to let a QR live
        const genPairQR = () => {
            if (!ws.isOpen) {
                return;
            }
            const refNode = refNodes.shift();
            if (!refNode) {
                void end(new Boom('QR refs attempts ended', { statusCode: DisconnectReason.timedOut }));
                return;
            }
            const ref = refNode.content.toString('utf-8');
            const qr = buildPairingQRData(ref, noiseKeyB64, identityKeyB64, advB64, browser);
            ev.emit('connection.update', { qr });
            qrTimer = setTimeout(genPairQR, qrMs);
            qrMs = qrTimeout || 20000; // shorter subsequent qrs
        };
        genPairQR();
    });
`;

const newQrBlock = `    // Re-renderiza o QR atual quando o servidor aposenta o material de registro.
    let refreshPairingQR;
    // QR gen
    ws.on('CB:iq,type:set,pair-device', async (stanza) => {
        const iq = {
            tag: 'iq',
            attrs: {
                to: S_WHATSAPP_NET,
                type: 'result',
                id: stanza.attrs.id
            }
        };
        await sendNode(iq);
        const pairDeviceNode = getBinaryNodeChild(stanza, 'pair-device');
        const refNodes = getBinaryNodeChildren(pairDeviceNode, 'ref');
        const noiseKeyB64 = Buffer.from(creds.noiseKey.public).toString('base64');
        const identityKeyB64 = Buffer.from(creds.signedIdentityKey.public).toString('base64');
        const renderer = makePairingQRRenderer(
            refNodes.map(refNode => refNode.content.toString('utf-8')),
            ref => ev.emit('connection.update', {
                qr: buildPairingQRData(ref, noiseKeyB64, identityKeyB64, creds.advSecretKey, browser)
            })
        );
        refreshPairingQR = () => void renderer.refresh();
        let qrMs = qrTimeout || 60000; // time to let a QR live
        const genPairQR = () => {
            if (!ws.isOpen) {
                return;
            }
            if (!renderer.next()) {
                void end(new Boom('QR refs attempts ended', { statusCode: DisconnectReason.timedOut }));
                return;
            }
            qrTimer = setTimeout(genPairQR, qrMs);
            qrMs = qrTimeout || 20000; // shorter subsequent qrs
        };
        genPairQR();
    });
    ws.on('CB:notification,type:companion_reg_refresh', (node) => {
        handleCompanionRegRefresh(node, {
            creds,
            emitCredsUpdate: update => ev.emit('creds.update', update),
            refreshQR: () => refreshPairingQR?.(),
            logger
        });
    });
`;

replaceOnce(socketFile, oldQrBlock, newQrBlock, 'QR pairing flow')

// 4) ack pre-login
replaceOnce(
  recvFile,
  'const stanza = buildAckStanza(node, errorCode, authState.creds.me.id);',
  'const stanza = buildAckStanza(node, errorCode, authState.creds.me?.id);',
  'pre-login ack',
)

console.log('Baileys pairing patch aplicado com sucesso.')