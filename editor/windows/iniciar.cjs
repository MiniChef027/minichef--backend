// Entrada SEA: carrega os arquivos ao lado do .exe, independente da pasta atual.
const { createRequire } = require('node:module');
try {
    createRequire(process.execPath)('./executor.js');
} catch (erro) {
    console.error('Não foi possível abrir o Editor MiniChef. Mantenha o .exe dentro da pasta editor, junto de executor.js, package.json, server e public.');
    console.error(erro.message);
    process.exitCode = 1;
}
