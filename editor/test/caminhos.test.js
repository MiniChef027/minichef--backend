//Guarda de caminho: confinamento em minichef--frontend
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { symlink } from "node:fs/promises";
import { criarCaminhos, ErroHttp } from "../server/caminhos.js";
import { criarRaizTemporaria } from "./ajuda.js";

let tmp;
let caminhos;

before(async () => {
    tmp = await criarRaizTemporaria();
    caminhos = criarCaminhos({ raiz: tmp.raiz });
    //symlinks de dentro do front para fora (pasta, arquivo e link quebrado) e um para dentro
    await symlink(tmp.backend, path.join(tmp.frontend, "fuga-dir"));
    await symlink(path.join(tmp.backend, "Usuario.js"), path.join(tmp.frontend, "fuga.html"));
    await symlink(path.join(tmp.backend, "novo.html"), path.join(tmp.frontend, "quebrado.html"));
    await symlink(path.join(tmp.frontend, "receitas"), path.join(tmp.frontend, "atalho"));
});

after(() => tmp.apagar());

async function recusa(c, rel, status) {
    await assert.rejects(
        c.resolverNoFrontend(rel),
        (e) => e instanceof ErroHttp && (status === undefined || e.status === status),
        `deveria recusar ${JSON.stringify(rel)}`,
    );
}

describe("guarda de caminho", () => {
    test("aceita caminhos dentro do front, existentes ou não", async () => {
        for (const rel of ["index.html", "receitas/bolo.html", "nova/pasta/x.html", "atalho/index.html", "a//b.html"]) {
            const r = await caminhos.resolverNoFrontend(rel);
            assert.ok(r.abs.startsWith(tmp.frontend + path.sep), rel);
        }
        assert.equal((await caminhos.resolverNoFrontend("a//b.html")).rel, "a/b.html");
    });

    test("recusa travessia com ..", async () => {
        for (const rel of ["../minichef--backend/Usuario.js", "receitas/../../minichef--backend/Usuario.js", "..", "../"]) {
            await recusa(caminhos, rel, 400);
        }
    });

    test("recusa ..%2f e %2e%2e/ literais e também depois de decodificar", async () => {
        const codificados = ["..%2fminichef--backend/Usuario.js", "%2e%2e/minichef--backend/Usuario.js", "%252e%252e/x.html"];
        for (const rel of codificados) {
            await recusa(caminhos, rel, 400);
            await recusa(caminhos, decodeURIComponent(rel), 400);
        }
    });

    test("recusa caminho absoluto", async () => {
        for (const rel of ["/etc/passwd", path.join(tmp.backend, "Usuario.js"), "C:\\Windows\\x.html", "C:/x.html", "//servidor/x.html"]) {
            await recusa(caminhos, rel, 400);
        }
    });

    test("recusa barra invertida e byte nulo", async () => {
        for (const rel of ["..\\minichef--backend\\Usuario.js", "receitas\\bolo.html", "index.html\u0000.png", "\u0000"]) {
            await recusa(caminhos, rel, 400);
        }
    });

    test("recusa vazio, ocultos e valores que não são texto", async () => {
        for (const rel of ["", ".git/config", ".env", "receitas/.oculto.html", 42, null, undefined]) {
            await recusa(caminhos, rel, 400);
        }
    });

    test("recusa symlink para fora do front (pasta, arquivo e link quebrado)", async () => {
        for (const rel of ["fuga-dir/Usuario.js", "fuga-dir/novo.html", "fuga.html", "quebrado.html"]) {
            await recusa(caminhos, rel, 403);
        }
    });

    test("defesa extra: front mal configurado na raiz não alcança backend nem editor", async () => {
        const errado = criarCaminhos({ raiz: tmp.raiz, frontend: tmp.raiz });
        await recusa(errado, "minichef--backend/Usuario.js", 403);
        await recusa(errado, "minichef--backend/novo.html", 403);
        await recusa(errado, "editor/public/index.html", 403);
    });

    test("raiz padrão do projeto: backend real fica fora (somente leitura)", async () => {
        const real = criarCaminhos();
        assert.equal(path.basename(real.frontend), "minichef--frontend");
        await recusa(real, "../minichef--backend/Usuario.js", 400);
        await recusa(real, path.join(real.backend, "Usuario.js"), 400);
    });

    test("pública do editor confinada", async () => {
        assert.ok((await caminhos.resolverNoPublico("js/main.js")).abs.startsWith(tmp.publico));
        await assert.rejects(caminhos.resolverNoPublico("../../minichef--frontend/index.html"), ErroHttp);
        await assert.rejects(caminhos.resolverNoPublico("js/../../index.html"), ErroHttp);
    });
});
