//Executor de verdade (raízes reais, só leitura): argumentos, URL, token no index, sinais e porta ocupada
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ocuparPorta, pedir, portaEfemera } from "./ajuda.js";

const EXECUTOR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "executor.js");
const INDICE_REAL = path.join(path.dirname(EXECUTOR), "public", "index.html");
const tokenDoIndice = (html) => html.match(/<meta name="editor-token" content="([^"]+)">/)?.[1];

//Faixa do executor no contrato: 4310–4319 (4310 fica para testes manuais)
async function portaDaFaixa() {
    for (let p = 4311; p <= 4319; p++) {
        try {
            const o = await ocuparPorta(p);
            await o.fechar();
            return p;
        } catch {
            //ocupada, tenta a próxima
        }
    }
    throw new Error("nenhuma porta livre em 4311–4319");
}

function rodar(args, env = {}) {
    const filho = spawn(process.execPath, [EXECUTOR, ...args], {
        env: { ...process.env, EDITOR_PORTA: "", ...env },
        stdio: ["ignore", "pipe", "pipe"],
    });
    const saida = { out: "", err: "" };
    filho.stdout.on("data", (d) => (saida.out += d));
    filho.stderr.on("data", (d) => (saida.err += d));
    const fim = new Promise((resolve) => filho.on("exit", (codigo, sinal) => resolve({ codigo, sinal })));
    const pronto = new Promise((resolve, reject) => {
        const checar = () => {
            const m = saida.out.match(/rodando em (http:\/\/127\.0\.0\.1:(\d+)\/)/);
            if (m) resolve({ url: m[1], porta: Number(m[2]) });
        };
        filho.stdout.on("data", checar);
        fim.then(() => reject(new Error(`saiu antes de subir: ${saida.err}`)));
    });
    pronto.catch(() => {});
    return { filho, saida, fim, pronto };
}

describe("executor.js", () => {
    test("--porta N --sem-abrir: imprime a URL, injeta o token e encerra com SIGTERM", async () => {
        const porta = await portaDaFaixa();
        const exec = rodar(["--porta", String(porta), "--sem-abrir"]);
        try {
            const { url, porta: impressa } = await exec.pronto;
            assert.equal(impressa, porta);
            assert.equal(url, `http://127.0.0.1:${porta}/`);
            const raiz = await pedir(porta, { caminho: "/" });
            if (existsSync(INDICE_REAL)) {
                assert.equal(raiz.status, 200);
                const token = tokenDoIndice(raiz.texto);
                assert.ok(token, "meta editor-token presente");
                assert.equal(Buffer.from(token, "base64url").length, 24);
                const info = await pedir(porta, { caminho: "/api/info", cabecalhos: { "X-Editor-Token": token } });
                assert.equal(info.status, 200);
                assert.equal(info.json.portaEditor, porta);
            } else {
                assert.equal(raiz.status, 404);
            }
            assert.equal((await pedir(porta, { caminho: "/api/info" })).status, 403);
            assert.equal((await pedir(porta, { caminho: "/", host: "evil.com" })).status, 403);
        } finally {
            exec.filho.kill("SIGTERM");
        }
        const { codigo } = await exec.fim;
        assert.equal(codigo, 0);
        assert.match(exec.saida.out, /Encerrando/);
    });

    test("EDITOR_PORTA e encerramento com SIGINT levando o site junto", async () => {
        const porta = await portaDaFaixa();
        const exec = rodar(["--sem-abrir"], { EDITOR_PORTA: String(porta) });
        let portaSite;
        try {
            assert.equal((await exec.pronto).porta, porta);
            const raiz = await pedir(porta, { caminho: "/" });
            const token = tokenDoIndice(raiz.texto);
            if (token) {
                portaSite = await portaEfemera();
                const r = await pedir(porta, {
                    metodo: "POST",
                    caminho: "/api/site/iniciar",
                    cabecalhos: { "X-Editor-Token": token, "Content-Type": "application/json" },
                    corpo: JSON.stringify({ porta: portaSite }),
                });
                assert.equal(r.status, 200);
            }
        } finally {
            exec.filho.kill("SIGINT");
        }
        assert.equal((await exec.fim).codigo, 0);
        if (portaSite) await assert.rejects(pedir(portaSite, { caminho: "/" }), { code: "ECONNREFUSED" });
    });

    test("porta explícita ocupada → mensagem clara e código 1", async () => {
        const ocupada = await ocuparPorta(await portaDaFaixa());
        try {
            const exec = rodar(["--porta", String(ocupada.porta), "--sem-abrir"]);
            const { codigo } = await exec.fim;
            assert.equal(codigo, 1);
            assert.match(exec.saida.err, new RegExp(`A porta ${ocupada.porta} já está em uso`));
        } finally {
            await ocupada.fechar();
        }
    });

    test("argumentos inválidos → código 1", async () => {
        for (const args of [["--porta", "abc"], ["--porta", "80"], ["--porta"], ["--desconhecida"]]) {
            const exec = rodar([...args, "--sem-abrir"]);
            assert.equal((await exec.fim).codigo, 1, args.join(" "));
            assert.match(exec.saida.err, /Erro:/);
        }
    });
});
