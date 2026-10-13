import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import postject from 'postject';

const VERSAO = '24.14.1';
if (process.versions.node !== VERSAO || process.arch !== 'x64') {
    throw new Error(`Gere com Node.js ${VERSAO} x64 (a versão do blob precisa coincidir com o executável).`);
}
const editor = fileURLToPath(new URL('../', import.meta.url));
const build = path.join(editor, '.build');
await mkdir(build, { recursive: true });
const base = `https://nodejs.org/dist/v${VERSAO}/`;
async function baixar(nome, origem = base) {
    const resposta = await fetch(origem + nome);
    if (!resposta.ok) throw new Error(`Download de ${nome}: HTTP ${resposta.status}`);
    return Buffer.from(await resposta.arrayBuffer());
}
const somas = (await baixar('SHASUMS256.txt')).toString();
const esperado = somas.split('\n').find(l => l.trim().endsWith(' win-x64/node.exe'))?.trim().split(/\s+/)[0];
if (!esperado) throw new Error('SHA-256 oficial do node.exe não encontrado.');
const cache = path.join(build, 'node.exe');
let binario = await readFile(cache).catch(() => null);
const hash = dados => createHash('sha256').update(dados).digest('hex');
if (!binario || hash(binario) !== esperado) {
    console.log('Baixando Node.js oficial para Windows x64...');
    binario = await baixar('win-x64/node.exe');
    if (hash(binario) !== esperado) throw new Error('SHA-256 do download não confere.');
    await writeFile(cache, binario);
}
// A assinatura original do Node não vale para o programa modificado.
// Limpa a entrada de certificado Authenticode na tabela PE32+ antes da injeção.
const pe = binario.readUInt32LE(0x3c);
if (binario.toString('ascii', pe, pe + 4) !== 'PE\0\0' || binario.readUInt16LE(pe + 24) !== 0x20b) {
    throw new Error('O download não é um executável PE32+ válido.');
}
binario.fill(0, pe + 24 + 112 + 4 * 8, pe + 24 + 112 + 5 * 8);
const blob = path.join(build, 'editor.blob');
const config = path.join(build, 'sea.json');
await writeFile(config, JSON.stringify({
    main: path.join(editor, 'windows', 'iniciar.cjs'), output: blob,
    disableExperimentalSEAWarning: true, useSnapshot: false, useCodeCache: false,
}));
execFileSync(process.execPath, ['--experimental-sea-config', config], { stdio: 'inherit' });
const destino = path.join(editor, 'MiniChef-Editor.exe');
await writeFile(destino, binario);
await postject.inject(destino, 'NODE_SEA_BLOB', await readFile(blob), {
    sentinelFuse: 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
});
await writeFile(path.join(editor, 'NODE-LICENSE.txt'), await baixar('LICENSE', `https://raw.githubusercontent.com/nodejs/node/v${VERSAO}/`));
const soma = hash(await readFile(destino));
await writeFile(path.join(editor, 'MiniChef-Editor.exe.sha256'), `${soma}  MiniChef-Editor.exe\n`);
console.log(`Gerado: ${destino}\nSHA-256: ${soma}`);
