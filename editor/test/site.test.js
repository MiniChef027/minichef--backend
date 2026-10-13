//Servidor do site: iniciar, servir, trocar de porta, porta ocupada, parar e checagem de portas
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { symlink } from "node:fs/promises";
import { criarCaminhos } from "../server/caminhos.js";
import { criarServidorEditor } from "../server/api.js";
import { SUGESTOES } from "../server/servidorSite.js";
import { criarRaizTemporaria, ocuparPorta, pedir, portaEfemera } from "./ajuda.js";

const TOKEN = "token-de-teste-site-0123456789";
let tmp;
let editor;
let P;

const comToken = { "X-Editor-Token": TOKEN };
const api = (metodo, caminho, corpo) => pedir(P, {
    metodo,
    caminho,
    cabecalhos: { ...comToken, "Content-Type": "application/json" },
    corpo: corpo === undefined ? undefined : JSON.stringify(corpo),
});
const recusaConexao = (porta) => assert.rejects(pedir(porta, { caminho: "/" }), { code: "ECONNREFUSED" });

before(async () => {
    tmp = await criarRaizTemporaria();
    await symlink(path.join(tmp.backend, "Usuario.js"), path.join(tmp.frontend, "fuga.html"));
    editor = await criarServidorEditor({ porta: 0, caminhos: criarCaminhos({ raiz: tmp.raiz }), token: TOKEN });
    P = editor.porta;
});

after(async () => {
    await editor.encerrar();
    await tmp.apagar();
});

describe("servidor do site", () => {
    test("começa parado", async () => {
        const r = await api("GET", "/api/site");
        assert.equal(r.status, 200);
        assert.deepEqual(r.json, { rodando: false, porta: null, url: null });
    });

    test("inicia numa porta, serve / e arquivos, troca de porta e para", async () => {
        const porta = await portaEfemera();
        const r = await api("POST", "/api/site/iniciar", { porta });
        assert.equal(r.status, 200);
        assert.deepEqual(r.json, { rodando: true, porta, url: `http://127.0.0.1:${porta}/` });
        assert.deepEqual((await api("GET", "/api/site")).json, r.json);
        assert.equal((await api("GET", "/api/info")).json.site.porta, porta);

        const raiz = await pedir(porta, { caminho: "/" });
        assert.equal(raiz.status, 200);
        assert.match(raiz.texto, /<h1>MiniChef<\/h1>/);
        assert.equal(raiz.headers["cache-control"], "no-store");
        const css = await pedir(porta, { caminho: "/estilo.css" });
        assert.equal(css.status, 200);
        assert.equal(css.headers["content-type"], "text/css; charset=utf-8");
        assert.match((await pedir(porta, { caminho: "/receitas/" })).texto, /Receitas/);
        assert.equal((await pedir(porta, { caminho: "/receitas" })).headers.location, "/receitas/");
        const nao = await pedir(porta, { caminho: "/nao-existe.html" });
        assert.equal(nao.status, 404);
        assert.equal(nao.texto, "Página não encontrada.");

        //mesma porta de novo: continua rodando
        assert.deepEqual((await api("POST", "/api/site/iniciar", { porta: String(porta) })).json, r.json);

        const nova = await portaEfemera();
        const troca = await api("POST", "/api/site/iniciar", { porta: nova });
        assert.equal(troca.status, 200);
        assert.equal(troca.json.porta, nova);
        await recusaConexao(porta);
        assert.equal((await pedir(nova, { caminho: "/" })).status, 200);

        const parar = await api("POST", "/api/site/parar");
        assert.equal(parar.status, 200);
        assert.equal(parar.json.rodando, false);
        await recusaConexao(nova);
        assert.equal((await api("POST", "/api/site/parar")).json.rodando, false);
    });

    test("site: só GET/HEAD, Host checado e sem travessia", async () => {
        const porta = await portaEfemera();
        await api("POST", "/api/site/iniciar", { porta });
        try {
            assert.equal((await pedir(porta, { caminho: "/", host: "evil.com" })).status, 403);
            assert.equal((await pedir(porta, { metodo: "POST", caminho: "/index.html", corpo: "x" })).status, 405);
            assert.equal((await pedir(porta, { metodo: "HEAD", caminho: "/index.html" })).status, 200);
            const ataques = ["/../minichef--backend/Usuario.js", "/..%2fminichef--backend%2fUsuario.js", "/%2e%2e/minichef--backend/Usuario.js", "/fuga.html", "/%2fetc%2fpasswd"];
            for (const caminho of ataques) {
                const r = await pedir(porta, { caminho });
                assert.ok([400, 403, 404].includes(r.status), `${caminho} → ${r.status}`);
                assert.ok(!r.texto.includes("class Usuario"));
            }
            assert.ok(Object.keys((await pedir(porta, { caminho: "/" })).headers).every((h) => !h.startsWith("access-control-")));
        } finally {
            await api("POST", "/api/site/parar");
        }
    });

    test("porta ocupada → 409 e o site continua na porta anterior", async () => {
        const anterior = await portaEfemera();
        await api("POST", "/api/site/iniciar", { porta: anterior });
        const ocupada = await ocuparPorta();
        try {
            const r = await api("POST", "/api/site/iniciar", { porta: ocupada.porta });
            assert.equal(r.status, 409);
            assert.deepEqual(r.json, { erro: `A porta ${ocupada.porta} já está em uso.` });
            assert.equal((await api("GET", "/api/site")).json.porta, anterior);
            assert.equal((await pedir(anterior, { caminho: "/" })).status, 200);
        } finally {
            await ocupada.fechar();
            await api("POST", "/api/site/parar");
        }
    });

    test("porta inválida ou a do editor → 400", async () => {
        for (const porta of [80, 1023, 65536, "abc", 3000.5, -1, null, "", "3000x", P]) {
            const r = await api("POST", "/api/site/iniciar", { porta });
            assert.equal(r.status, 400, String(porta));
            assert.equal(typeof r.json.erro, "string");
        }
        assert.equal((await api("POST", "/api/site/iniciar", {})).status, 400);
        assert.equal((await api("GET", "/api/site")).json.rodando, false);
    });

    test("iniciar e parar exigem token", async () => {
        const porta = await portaEfemera();
        const r = await pedir(P, { metodo: "POST", caminho: "/api/site/iniciar", corpo: JSON.stringify({ porta }) });
        assert.equal(r.status, 403);
        await recusaConexao(porta);
    });
});

describe("portas", () => {
    test("sugestões na ordem do contrato", async () => {
        const r = await api("GET", "/api/portas");
        assert.equal(r.status, 200);
        assert.deepEqual(r.json.sugestoes.map((s) => s.porta), SUGESTOES);
        assert.ok(r.json.sugestoes.every((s) => typeof s.livre === "boolean"));
    });

    test("verificar: livre, ocupada, do editor, do site e inválida", async () => {
        const livre = await portaEfemera();
        assert.deepEqual((await api("GET", `/api/portas/verificar?porta=${livre}`)).json, { porta: livre, livre: true });

        const ocupada = await ocuparPorta();
        try {
            assert.deepEqual((await api("GET", `/api/portas/verificar?porta=${ocupada.porta}`)).json, { porta: ocupada.porta, livre: false });
        } finally {
            await ocupada.fechar();
        }
        assert.equal((await api("GET", `/api/portas/verificar?porta=${P}`)).json.livre, false);

        const doSite = await portaEfemera();
        await api("POST", "/api/site/iniciar", { porta: doSite });
        assert.equal((await api("GET", `/api/portas/verificar?porta=${doSite}`)).json.livre, false);
        await api("POST", "/api/site/parar");

        for (const q of ["abc", "80", "70000", "", "3000.0"]) {
            assert.equal((await api("GET", `/api/portas/verificar?porta=${q}`)).status, 400, q);
        }
        assert.equal((await api("GET", "/api/portas/verificar")).status, 400);
    });
});
