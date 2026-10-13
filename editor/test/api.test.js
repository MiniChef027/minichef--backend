//Servidor do editor: segurança (token, Host, Origin, CORS), páginas, imagens, /site/ e estáticos
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, symlink, writeFile } from "node:fs/promises";
import { criarCaminhos, RAIZ_PADRAO } from "../server/caminhos.js";
import { criarServidorEditor } from "../server/api.js";
import { criarRaizTemporaria, pedir, retratoDaPasta, semCors } from "./ajuda.js";

const TOKEN = "token-de-teste-0123456789abcdef";
const BACKEND_REAL = path.join(RAIZ_PADRAO, "minichef--backend");

let tmp;
let editor;
let P;
let retratoBackendReal;

const comToken = (extra = {}) => ({ "X-Editor-Token": TOKEN, ...extra });
const json = (dados) => JSON.stringify(dados);
const putPagina = (dados, cabecalhos = {}) => pedir(P, {
    metodo: "PUT",
    caminho: "/api/pagina",
    cabecalhos: comToken({ "Content-Type": "application/json", ...cabecalhos }),
    corpo: json(dados),
});
const getPagina = (consulta) => pedir(P, { caminho: `/api/pagina?caminho=${consulta}`, cabecalhos: comToken() });
const enviarImagem = (nome, bytes, cabecalhos = {}) => pedir(P, {
    metodo: "POST",
    caminho: "/api/imagens",
    cabecalhos: comToken({
        "Content-Type": "application/octet-stream",
        ...(nome === null ? {} : { "X-Nome-Arquivo": encodeURIComponent(nome) }),
        ...cabecalhos,
    }),
    corpo: bytes,
});

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 2)]);
const GIF = Buffer.concat([Buffer.from("GIF89a", "latin1"), Buffer.alloc(16, 3)]);
const WEBP = Buffer.concat([Buffer.from("RIFF", "latin1"), Buffer.alloc(4, 0), Buffer.from("WEBPVP8 ", "latin1"), Buffer.alloc(16)]);
const SVG = Buffer.from('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>');

before(async () => {
    retratoBackendReal = existsSync(BACKEND_REAL) ? await retratoDaPasta(BACKEND_REAL) : null;
    tmp = await criarRaizTemporaria();
    await symlink(tmp.backend, path.join(tmp.frontend, "fuga-dir"));
    await symlink(path.join(tmp.backend, "Usuario.js"), path.join(tmp.frontend, "fuga.html"));
    await symlink(path.join(tmp.backend, "novo.html"), path.join(tmp.frontend, "quebrado.html"));
    editor = await criarServidorEditor({ porta: 0, caminhos: criarCaminhos({ raiz: tmp.raiz }), token: TOKEN });
    P = editor.porta;
});

after(async () => {
    await editor.encerrar();
    //o backend temporário só pode ter o arquivo original; o real não pode ter mudado
    assert.deepEqual(await readdir(tmp.backend), ["Usuario.js"]);
    await tmp.apagar();
    if (retratoBackendReal) assert.deepEqual(await retratoDaPasta(BACKEND_REAL), retratoBackendReal);
});

describe("segurança do editor", () => {
    test("GET / injeta o token no index.html, sem cache", async () => {
        const r = await pedir(P, { caminho: "/" });
        assert.equal(r.status, 200);
        assert.match(r.texto, new RegExp(`<meta name="editor-token" content="${TOKEN}">`));
        assert.ok(!r.texto.includes("__EDITOR_TOKEN__"));
        assert.equal(r.headers["cache-control"], "no-store");
        assert.equal(r.headers["x-frame-options"], "SAMEORIGIN");
    });

    test("token gerado pela fábrica tem 24 bytes aleatórios", async () => {
        const outro = await criarServidorEditor({ porta: 0, caminhos: criarCaminhos({ raiz: tmp.raiz }) });
        try {
            assert.equal(Buffer.from(outro.token, "base64url").length, 24);
            assert.notEqual(outro.token, TOKEN);
        } finally {
            await outro.encerrar();
        }
    });

    test("token ausente ou errado → 403", async () => {
        const sem = await pedir(P, { caminho: "/api/info" });
        assert.equal(sem.status, 403);
        assert.ok(sem.json.erro);
        const errado = await pedir(P, { caminho: "/api/info", cabecalhos: { "X-Editor-Token": TOKEN + "x" } });
        assert.equal(errado.status, 403);
        const curto = await pedir(P, { caminho: "/api/paginas", cabecalhos: { "X-Editor-Token": "a" } });
        assert.equal(curto.status, 403);
        const put = await pedir(P, { metodo: "PUT", caminho: "/api/pagina", corpo: json({ caminho: "x.html", html: "x" }) });
        assert.equal(put.status, 403);
        assert.ok(!existsSync(path.join(tmp.frontend, "x.html")));
    });

    test("GET /api/info com token", async () => {
        const r = await pedir(P, { caminho: "/api/info", cabecalhos: comToken() });
        assert.equal(r.status, 200);
        assert.deepEqual(r.json, {
            pastaFrontend: "minichef--frontend",
            portaEditor: P,
            site: { rodando: false, porta: null, url: null },
        });
    });

    test("Host estranho → 403 (DNS rebinding), hosts locais aceitos", async () => {
        for (const host of ["evil.com", `evil.com:${P}`, "127.0.0.1:1", "localhost", `127.0.0.2:${P}`, `localhost.:${P}`]) {
            const raiz = await pedir(P, { caminho: "/", host });
            assert.equal(raiz.status, 403, host);
            assert.ok(!raiz.texto.includes(TOKEN));
            const api = await pedir(P, { caminho: "/api/info", host, cabecalhos: comToken() });
            assert.equal(api.status, 403, host);
        }
        for (const host of [`127.0.0.1:${P}`, `localhost:${P}`, `LOCALHOST:${P}`, `[::1]:${P}`]) {
            assert.equal((await pedir(P, { caminho: "/", host })).status, 200, host);
        }
    });

    test("Origin estranho em PUT/POST → 403 e nada é gravado; origem local aceita", async () => {
        for (const origem of ["http://evil.com", "null", `http://evil.com:${P}`, `https://127.0.0.1:${P}`]) {
            const r = await putPagina({ caminho: "origem.html", html: "x" }, { Origin: origem });
            assert.equal(r.status, 403, origem);
            const img = await enviarImagem("a.png", PNG, { Origin: origem });
            assert.equal(img.status, 403, origem);
        }
        assert.ok(!existsSync(path.join(tmp.frontend, "origem.html")));
        assert.ok(!existsSync(path.join(tmp.frontend, "imagens")));
        const ok = await putPagina({ caminho: "origem.html", html: "ok" }, { Origin: `http://localhost:${P}` });
        assert.equal(ok.status, 200);
    });

    test("nunca envia cabeçalhos CORS", async () => {
        const respostas = [
            await pedir(P, { caminho: "/" }),
            await pedir(P, { caminho: "/api/info", cabecalhos: comToken({ Origin: "http://evil.com" }) }),
            await pedir(P, { metodo: "OPTIONS", caminho: "/api/pagina", cabecalhos: { Origin: "http://evil.com", "Access-Control-Request-Method": "PUT" } }),
            await pedir(P, { caminho: "/site/index.html" }),
        ];
        for (const r of respostas) assert.ok(semCors(r.headers), JSON.stringify(r.headers));
    });

    test("erros respondem { erro } sem caminho absoluto", async () => {
        const respostas = [
            await getPagina("nao-existe.html"),
            await getPagina("..%2fminichef--backend%2fUsuario.js"),
            await getPagina("fuga.html"),
            await putPagina({ caminho: "fuga-dir/x.html", html: "x" }),
            await pedir(P, { caminho: "/api/nada", cabecalhos: comToken() }),
        ];
        for (const r of respostas) {
            assert.equal(typeof r.json?.erro, "string");
            assert.ok(!r.texto.includes(tmp.raiz) && !r.texto.includes(RAIZ_PADRAO), r.texto);
            assert.ok(!/\bat .+:\d+:\d+/.test(r.texto), "sem stack trace");
        }
    });

    test("rota desconhecida → 404, método errado → 405", async () => {
        assert.equal((await pedir(P, { caminho: "/api/nada", cabecalhos: comToken() })).status, 404);
        assert.equal((await pedir(P, { metodo: "DELETE", caminho: "/api/pagina", cabecalhos: comToken() })).status, 405);
    });
});

describe("páginas", () => {
    test("PUT e GET de página, criando subpastas", async () => {
        const html = "<!doctype html><main data-mc-prancheta>Olá, ção</main>";
        const put = await putPagina({ caminho: "receitas/doces/bolo.html", html });
        assert.equal(put.status, 200);
        assert.deepEqual(put.json, { ok: true, caminho: "receitas/doces/bolo.html" });
        assert.equal(await readFile(path.join(tmp.frontend, "receitas", "doces", "bolo.html"), "utf8"), html);

        const get = await getPagina(encodeURIComponent("receitas/doces/bolo.html"));
        assert.equal(get.status, 200);
        assert.deepEqual(get.json, { caminho: "receitas/doces/bolo.html", html });
    });

    test("PUT sobrescreve sem deixar temporários", async () => {
        await putPagina({ caminho: "sobre.html", html: "v1" });
        const r = await putPagina({ caminho: "sobre.html", html: "v2" });
        assert.equal(r.status, 200);
        assert.equal(await readFile(path.join(tmp.frontend, "sobre.html"), "utf8"), "v2");
        assert.ok((await readdir(tmp.frontend)).every((n) => !n.endsWith(".tmp")));
    });

    test("criar:true em página existente → 409 e o conteúdo fica intacto", async () => {
        const original = await readFile(path.join(tmp.frontend, "index.html"), "utf8");
        const r = await putPagina({ caminho: "index.html", html: "novo", criar: true });
        assert.equal(r.status, 409);
        assert.equal(await readFile(path.join(tmp.frontend, "index.html"), "utf8"), original);
        const nova = await putPagina({ caminho: "contato.html", html: "c", criar: true });
        assert.equal(nova.status, 200);
    });

    test("extensão não permitida → 400 e nada é criado", async () => {
        for (const caminho of ["script.js", "novo.css", "pagina.htm", "semext", "imagem.png"]) {
            const r = await putPagina({ caminho, html: "x" });
            assert.equal(r.status, 400, caminho);
            assert.ok(!existsSync(path.join(tmp.frontend, caminho)), caminho);
        }
        assert.equal((await putPagina({ caminho: "estilo.css", html: "x" })).status, 400);
        assert.match(await readFile(path.join(tmp.frontend, "estilo.css"), "utf8"), /tomato/);
        assert.equal((await getPagina("estilo.css")).status, 400);
    });

    test("GET de página inexistente → 404; sem caminho → 400", async () => {
        assert.equal((await getPagina("nao-existe.html")).status, 404);
        assert.equal((await pedir(P, { caminho: "/api/pagina", cabecalhos: comToken() })).status, 400);
    });

    test("JSON inválido, campos errados e corpo acima de 2 MB", async () => {
        const invalido = await pedir(P, { metodo: "PUT", caminho: "/api/pagina", cabecalhos: comToken(), corpo: "{nao é json" });
        assert.equal(invalido.status, 400);
        assert.equal((await putPagina({ caminho: "a.html" })).status, 400);
        assert.equal((await putPagina({ caminho: "a.html", html: 1 })).status, 400);
        assert.equal((await putPagina({ caminho: "a.html", html: "x", criar: "sim" })).status, 400);
        const grande = await putPagina({ caminho: "grande.html", html: "x".repeat(2 * 1024 * 1024) });
        assert.equal(grande.status, 413);
        assert.ok(!existsSync(path.join(tmp.frontend, "grande.html")));
    });

    test("lista .html recursivo, ordenado, sem node_modules, ocultos e symlinks", async () => {
        await mkdir(path.join(tmp.frontend, "node_modules", "pacote"), { recursive: true });
        await writeFile(path.join(tmp.frontend, "node_modules", "pacote", "x.html"), "x");
        await mkdir(path.join(tmp.frontend, ".oculta"), { recursive: true });
        await writeFile(path.join(tmp.frontend, ".oculta", "y.html"), "y");
        const r = await pedir(P, { caminho: "/api/paginas", cabecalhos: comToken() });
        assert.equal(r.status, 200);
        const { paginas } = r.json;
        assert.deepEqual(paginas, [...paginas].sort());
        for (const p of ["index.html", "receitas/index.html", "receitas/doces/bolo.html"]) assert.ok(paginas.includes(p), p);
        assert.ok(paginas.every((p) => !p.includes("node_modules") && !p.includes(".oculta")));
        assert.ok(!paginas.includes("fuga.html") && paginas.every((p) => !p.startsWith("fuga-dir/")));
    });

    test("travessia pela API é recusada (PUT e GET) e nada sai do front", async () => {
        const antesRaiz = await readdir(tmp.raiz);
        const destinos = [
            "../minichef--backend/hack.html",
            "..%2fminichef--backend%2fhack.html",
            "%2e%2e/minichef--backend/hack.html",
            path.join(tmp.backend, "hack.html"),
            "..\\minichef--backend\\hack.html",
            "hack\u0000.html",
            "fuga-dir/hack.html",
            "quebrado.html",
            "../hack.html",
        ];
        for (const caminho of destinos) {
            const r = await putPagina({ caminho, html: "pwned" });
            assert.ok([400, 403].includes(r.status), `${caminho} → ${r.status}`);
        }
        const consultas = [
            "..%2fminichef--backend%2fUsuario.js",
            "%2e%2e%2fminichef--backend%2fUsuario.js",
            "%252e%252e%252fminichef--backend%252fUsuario.js",
            encodeURIComponent(path.join(tmp.backend, "Usuario.js")),
            "..%5Cminichef--backend%5CUsuario.js",
            "index.html%00.png",
            "fuga.html",
            "fuga-dir%2FUsuario.js",
        ];
        for (const consulta of consultas) {
            const r = await getPagina(consulta);
            assert.ok([400, 403].includes(r.status), `${consulta} → ${r.status}`);
            assert.ok(!r.texto.includes("class Usuario"));
        }
        assert.deepEqual(await readdir(tmp.raiz), antesRaiz);
        assert.deepEqual(await readdir(tmp.backend), ["Usuario.js"]);
    });
});

describe("imagens", () => {
    test("upload de PNG válido com nome higienizado", async () => {
        const r = await enviarImagem("Foto Bonita Ção!!.PNG", PNG);
        assert.equal(r.status, 200);
        assert.match(r.json.caminho, /^imagens\/foto-bonita-cao-[0-9a-f]{6}\.png$/);
        assert.deepEqual(await readFile(path.join(tmp.frontend, r.json.caminho)), PNG);
    });

    test("nome com pastas vira só o nome do arquivo dentro de imagens/", async () => {
        const r = await enviarImagem("../../minichef--backend/Évil File.png", PNG);
        assert.equal(r.status, 200);
        assert.match(r.json.caminho, /^imagens\/evil-file-[0-9a-f]{6}\.png$/);
        const r2 = await enviarImagem("!!!.png", PNG);
        assert.match(r2.json.caminho, /^imagens\/imagem-[0-9a-f]{6}\.png$/);
    });

    test("JPEG, GIF, WEBP e SVG válidos", async () => {
        for (const [nome, bytes] of [["a.jpg", JPEG], ["b.jpeg", JPEG], ["c.gif", GIF], ["d.webp", WEBP], ["e.svg", SVG], ["f.svg", Buffer.from("<svg></svg>")]]) {
            const r = await enviarImagem(nome, bytes);
            assert.equal(r.status, 200, nome);
            assert.ok(r.json.caminho.endsWith(path.extname(nome)), nome);
        }
    });

    test("bytes falsos ou extensão que não bate → 400", async () => {
        const antes = await readdir(path.join(tmp.frontend, "imagens"));
        const casos = [
            ["falso.png", Buffer.from("isto não é um png")],
            ["troca.jpg", PNG],
            ["pagina.svg", Buffer.from("<html><script>alert(1)</script></html>")],
            ["xml.svg", Buffer.from("<?xml version='1.0'?><html/>")],
            ["vazio.png", Buffer.alloc(0)],
            ["programa.exe", PNG],
            ["sem-extensao", PNG],
            ["pagina.html", Buffer.from("<html>")],
        ];
        for (const [nome, bytes] of casos) {
            const r = await enviarImagem(nome, bytes);
            assert.equal(r.status, 400, nome);
        }
        assert.equal((await enviarImagem(null, PNG)).status, 400);
        assert.equal((await enviarImagem("x", PNG, { "X-Nome-Arquivo": "%E0%A4%A.png" })).status, 400);
        assert.deepEqual(await readdir(path.join(tmp.frontend, "imagens")), antes);
    });

    test("acima de 10 MB → 413 (com e sem Content-Length)", async () => {
        const antes = await readdir(path.join(tmp.frontend, "imagens"));
        const grande = Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024)]);
        assert.equal((await enviarImagem("grande.png", grande)).status, 413);
        const fragmentado = await enviarImagem("grande.png", grande, { "Transfer-Encoding": "chunked" });
        assert.equal(fragmentado.status, 413);
        assert.deepEqual(await readdir(path.join(tmp.frontend, "imagens")), antes);
        //exatamente 10 MB ainda passa
        const limite = Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024 - PNG.length)]);
        assert.equal((await enviarImagem("limite.png", limite)).status, 200);
    });
});

describe("/site/ e arquivos do editor", () => {
    test("/site/ serve o arquivo do front, sem cache e sem scripts", async () => {
        const r = await pedir(P, { caminho: "/site/index.html" });
        assert.equal(r.status, 200);
        assert.match(r.texto, /<h1>MiniChef<\/h1>/);
        assert.equal(r.headers["content-type"], "text/html; charset=utf-8");
        assert.equal(r.headers["cache-control"], "no-store");
        assert.equal(r.headers["content-security-policy"], "sandbox allow-same-origin");
        assert.equal((await pedir(P, { caminho: "/site/estilo.css" })).headers["content-type"], "text/css; charset=utf-8");
        assert.match((await pedir(P, { caminho: "/site/" })).texto, /MiniChef/);
        const pasta = await pedir(P, { caminho: "/site/receitas" });
        assert.equal(pasta.status, 301);
        assert.equal(pasta.headers.location, "/site/receitas/");
        assert.match((await pedir(P, { caminho: "/site/receitas/" })).texto, /Receitas/);
        assert.equal((await pedir(P, { caminho: "/site/nao-existe.html" })).status, 404);
    });

    test("/site/ recusa travessia", async () => {
        const ataques = [
            "/site/../minichef--backend/Usuario.js",
            "/site/..%2fminichef--backend%2fUsuario.js",
            "/site/%2e%2e/minichef--backend/Usuario.js",
            "/site/%2E%2E%2Fminichef--backend%2FUsuario.js",
            "/site/%252e%252e/minichef--backend/Usuario.js",
            "/site/..\\minichef--backend\\Usuario.js",
            "/site/index.html%00.png",
            "/site/%2f" + encodeURIComponent(path.join(tmp.backend, "Usuario.js").slice(1)),
            "/site/fuga.html",
            "/site/fuga-dir/Usuario.js",
            "/site/.oculta/y.html",
            "/site/%E0%A4%A",
        ];
        for (const caminho of ataques) {
            const r = await pedir(P, { caminho });
            assert.ok([400, 403, 404].includes(r.status), `${caminho} → ${r.status}`);
            assert.ok(!r.texto.includes("class Usuario"), caminho);
        }
    });

    test("/site/ é somente leitura", async () => {
        const r = await pedir(P, { metodo: "PUT", caminho: "/site/index.html", cabecalhos: comToken(), corpo: "x" });
        assert.equal(r.status, 405);
        assert.match(await readFile(path.join(tmp.frontend, "index.html"), "utf8"), /MiniChef/);
    });

    test("/css e /js da interface; o resto → 404", async () => {
        const js = await pedir(P, { caminho: "/js/main.js" });
        assert.equal(js.status, 200);
        assert.equal(js.headers["content-type"], "text/javascript; charset=utf-8");
        assert.equal((await pedir(P, { caminho: "/css/editor.css" })).status, 200);
        assert.equal((await pedir(P, { caminho: "/js/nao-existe.js" })).status, 404);
        for (const caminho of ["/css/../index.html", "/js/..%2f..%2fminichef--backend%2fUsuario.js", "/js/%2e%2e/%2e%2e/minichef--frontend/index.html"]) {
            const r = await pedir(P, { caminho });
            assert.ok([400, 403].includes(r.status), `${caminho} → ${r.status}`);
        }
        assert.equal((await pedir(P, { caminho: "/index.html" })).status, 404);
        assert.equal((await pedir(P, { caminho: "/minichef--backend/Usuario.js" })).status, 404);
    });
});
