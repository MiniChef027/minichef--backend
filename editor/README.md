# Editor MiniChef

No Windows 10/11 de 64 bits (x64), abra **MiniChef-Editor.exe** com duplo clique.
O navegador abrirá o editor em `http://127.0.0.1:4300/` (ou na próxima porta livre).
O executável inclui Node.js: não é necessário instalar Node.js nem rodar npm.
Mantenha a janela do terminal aberta enquanto usa o editor; encerre com Ctrl+C.

Mantenha o executável junto de `executor.js`, `package.json`, `server/` e `public/`:

```text
minichef/
  editor/
    MiniChef-Editor.exe
    executor.js
    package.json
    server/
    public/
  minichef--frontend/
  minichef--backend/
```

O editor cria `minichef--frontend/` caso ela não exista e só salva páginas e imagens
nessa pasta. Os caminhos são relativos à instalação, mesmo ao abrir por um atalho.

Para escolher a porta, em um terminal na pasta `editor`:

```powershell
.\MiniChef-Editor.exe --porta 4400
.\MiniChef-Editor.exe --sem-abrir
```

Em Linux/macOS, com Node.js 24 ou superior: `node editor/executor.js`.

## Recriar o executável

Com Node.js **24.14.1 x64**, na pasta `editor`:

```sh
npm ci
npm test
npm run build:windows
```

O build funciona em Windows ou Linux x64, baixa o runtime oficial de nodejs.org,
confere SHA-256 e gera o `.exe`, seu checksum e a licença do Node.js.
`postject` é usado apenas na geração; não há dependências npm em execução.
O executável gerado não possui assinatura digital própria.

Referência: [Single executable applications do Node.js](https://nodejs.org/download/release/v24.14.1/docs/api/single-executable-applications.html).
