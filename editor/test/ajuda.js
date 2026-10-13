//Utilitários dos testes do servidor: raiz temporária, requisição crua e portas
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";

//Raiz temporária com o mesmo layout do projeto (nunca toca no minichef--frontend real)
export async function criarRaizTemporaria() {
    const raiz = await mkdtemp(path.join(os.tmpdir(), "minichef-editor-"));
    const frontend = path.join(raiz, "minichef--frontend");
    const backend = path.join(raiz, "minichef--backend");
    const publico = path.join(raiz, "editor", "public");
    await mkdir(path.join(frontend, "receitas"), { recursive: true });
    await mkdir(backend, { recursive: true });
    await mkdir(path.join(publico, "js"), { recursive: true });
    await mkdir(path.join(publico, "css"), { recursive: true });
    await writeFile(path.join(backend, "Usuario.js"), "class Usuario {}\n");
    await writeFile(path.join(frontend, "index.html"), "<!doctype html><title>Início</title><h1>MiniChef</h1>\n");
    await writeFile(path.join(frontend, "estilo.css"), "body { color: tomato; }\n");
    await writeFile(path.join(frontend, "receitas", "index.html"), "<!doctype html><h1>Receitas</h1>\n");
    await writeFile(
        path.join(publico, "index.html"),
        '<!doctype html><meta name="editor-token" content="__EDITOR_TOKEN__"><title>Editor</title>\n',
    );
    await writeFile(path.join(publico, "js", "main.js"), "console.log('editor');\n");
    await writeFile(path.join(publico, "css", "editor.css"), "body { margin: 0; }\n");
    return { raiz, frontend, backend, publico, apagar: () => rm(raiz, { recursive: true, force: true }) };
}

/*Requisição HTTP crua: o caminho vai exatamente como escrito (sem normalizar "..")
    e o Host é controlado pelo teste.
*/
export function pedir(porta, { metodo = "GET", caminho = "/", cabecalhos = {}, corpo, host } = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            host: "127.0.0.1",
            port: porta,
            method: metodo,
            path: caminho,
            agent: false,
            headers: { Host: host ?? `127.0.0.1:${porta}`, ...cabecalhos },
        }, (res) => {
            const partes = [];
            res.on("data", (p) => partes.push(p));
            res.on("end", () => {
                const buffer = Buffer.concat(partes);
                const texto = buffer.toString("utf8");
                let json = null;
                try {
                    json = JSON.parse(texto);
                } catch {
                    json = null;
                }
                resolve({ status: res.statusCode, headers: res.headers, buffer, texto, json });
            });
        });
        req.on("error", reject);
        req.end(corpo);
    });
}

export function portaEfemera() {
    return new Promise((resolve) => {
        const s = net.createServer();
        s.listen(0, "127.0.0.1", () => {
            const { port } = s.address();
            s.close(() => resolve(port));
        });
    });
}

//Ocupa uma porta de verdade para testar o 409
export function ocuparPorta(porta = 0) {
    return new Promise((resolve, reject) => {
        const s = net.createServer((sock) => sock.destroy());
        s.once("error", reject);
        s.listen(porta, "127.0.0.1", () => {
            resolve({ porta: s.address().port, fechar: () => new Promise((r) => s.close(() => r())) });
        });
    });
}

//Retrato (somente leitura) de uma pasta: caminho relativo → sha256
export async function retratoDaPasta(dir) {
    const retrato = {};
    async function andar(atual) {
        for (const item of await readdir(atual, { withFileTypes: true })) {
            const abs = path.join(atual, item.name);
            const rel = path.relative(dir, abs);
            if (item.isDirectory()) {
                retrato[rel + "/"] = "dir";
                await andar(abs);
            } else {
                retrato[rel] = item.isFile()
                    ? createHash("sha256").update(await readFile(abs)).digest("hex")
                    : "outro";
            }
        }
    }
    await andar(dir);
    return retrato;
}

export const semCors = (headers) => Object.keys(headers).every((h) => !h.startsWith("access-control-"));
