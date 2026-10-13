//Servidor do editor: checagens de Host/Origin/token, rotas estáticas e rotas /api
import http from "node:http";
import path from "node:path";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open, readFile, readdir, rename, unlink } from "node:fs/promises";
import { criarCaminhos, ErroHttp, validarRelativo } from "./caminhos.js";
import {
    cabecalhosBase,
    decodificarCaminhoUrl,
    dividirUrl,
    hostPermitido,
    origemPermitida,
    responderJson,
    servirArquivo,
    servirDoFrontend,
} from "./estatico.js";
import { criarControleSite, escutar, fecharServidor, HOST } from "./servidorSite.js";

export const LIMITE_JSON = 2 * 1024 * 1024;
export const LIMITE_IMAGEM = 10 * 1024 * 1024;
const METODOS_QUE_ALTERAM = new Set(["POST", "PUT", "DELETE", "PATCH"]);
const SEM_SEGUIR_LINK = constants.O_NOFOLLOW ?? 0;

//Impede que outro site coloque o editor num iframe (clickjacking)
const EXTRA_EDITOR = { "X-Frame-Options": "SAMEORIGIN" };
//Páginas do front abertas pelo editor: mesma origem, mas scripts nunca rodam (nem abrindo a URL direto)
const EXTRA_SITE = { ...EXTRA_EDITOR, "Content-Security-Policy": "sandbox allow-same-origin" };

export function gerarToken() {
    return randomBytes(24).toString("base64url");
}

//Compara pelo hash para os dois lados terem o mesmo tamanho no timingSafeEqual
function tokenConfere(recebido, esperado) {
    if (typeof recebido !== "string") return false;
    const a = createHash("sha256").update(recebido).digest();
    const b = createHash("sha256").update(esperado).digest();
    return timingSafeEqual(a, b);
}

//Lê o corpo até o limite; acima dele → 413 (o restante é descartado pelo Node)
function lerCorpo(req, limite) {
    return new Promise((resolve, reject) => {
        const grande = () => new ErroHttp(413, `Arquivo grande demais. O limite é ${limite / 1024 / 1024} MB.`);
        if (Number(req.headers["content-length"]) > limite) return reject(grande());
        const partes = [];
        let total = 0;
        let estourou = false;
        req.on("data", (parte) => {
            if (estourou) return;
            total += parte.length;
            if (total > limite) {
                estourou = true;
                partes.length = 0;
                return reject(grande());
            }
            partes.push(parte);
        });
        req.on("end", () => {
            if (!estourou) resolve(Buffer.concat(partes, total));
        });
        req.on("error", reject);
    });
}

async function lerJson(req) {
    const bruto = await lerCorpo(req, LIMITE_JSON);
    let dados;
    try {
        dados = JSON.parse(bruto.toString("utf8"));
    } catch {
        throw new ErroHttp(400, "JSON inválido.");
    }
    if (dados === null || typeof dados !== "object" || Array.isArray(dados)) {
        throw new ErroHttp(400, "JSON inválido.");
    }
    return dados;
}

function exigirPagina(rel) {
    if (path.extname(rel).toLowerCase() !== ".html") {
        throw new ErroHttp(400, "Só é possível abrir e gravar páginas .html.");
    }
}

//Cria arquivo novo (O_EXCL) sem seguir symlink no último segmento
async function abrirNovo(abs, mensagemExiste) {
    const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | SEM_SEGUIR_LINK;
    try {
        return await open(abs, flags, 0o644);
    } catch (erro) {
        if (erro.code === "EEXIST") throw new ErroHttp(409, mensagemExiste);
        if (erro.code === "ELOOP") throw new ErroHttp(403, "Acesso negado a esse caminho.");
        if (erro.code === "EISDIR" || erro.code === "ENOTDIR") throw new ErroHttp(400, "Caminho inválido.");
        throw erro;
    }
}

async function escrever(arquivo, dados) {
    try {
        await arquivo.writeFile(dados);
    } finally {
        await arquivo.close();
    }
}

/*Grava a página. criar:true usa O_EXCL (409 atômico se já existir).
    Sobrescrever grava num temporário oculto e troca com rename, para não deixar página pela metade.
*/
async function gravarPagina(abs, html, criar) {
    if (criar) {
        return escrever(await abrirNovo(abs, "Essa página já existe."), html);
    }
    const temporario = path.join(path.dirname(abs), `.${path.basename(abs)}.${randomBytes(4).toString("hex")}.tmp`);
    await escrever(await abrirNovo(temporario, "Tente salvar de novo."), html);
    try {
        await rename(temporario, abs);
    } catch (erro) {
        await unlink(temporario).catch(() => {});
        if (erro.code === "EISDIR" || erro.code === "ENOTDIR") throw new ErroHttp(400, "Caminho inválido.");
        throw erro;
    }
}

//Cria as pastas e revalida a guarda depois (um symlink criado no meio do caminho é barrado)
async function prepararDestino(caminhos, rel) {
    await caminhos.resolverNoFrontend(rel);
    const pasta = path.dirname(rel);
    if (pasta !== ".") {
        const { abs } = await caminhos.resolverNoFrontend(pasta);
        try {
            await mkdir(abs, { recursive: true });
        } catch (erro) {
            if (erro.code === "EEXIST" || erro.code === "ENOTDIR") throw new ErroHttp(400, "Caminho inválido.");
            throw erro;
        }
    }
    return caminhos.resolverNoFrontend(rel);
}

//.html recursivo, "/" como separador, ordenado; ignora node_modules, ocultos e symlinks
async function listarPaginas(raiz) {
    const paginas = [];
    async function andar(dir, prefixo) {
        let itens;
        try {
            itens = await readdir(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const item of itens) {
            if (item.name.startsWith(".") || item.name === "node_modules") continue;
            const rel = prefixo ? `${prefixo}/${item.name}` : item.name;
            try {
                validarRelativo(rel);
            } catch {
                continue;
            }
            if (item.isDirectory()) await andar(path.join(dir, item.name), rel);
            else if (item.isFile() && item.name.toLowerCase().endsWith(".html")) paginas.push(rel);
        }
    }
    await andar(raiz, "");
    return paginas.sort();
}

const EXTENSOES_IMAGEM = { ".png": "png", ".jpg": "jpeg", ".jpeg": "jpeg", ".gif": "gif", ".webp": "webp", ".svg": "svg" };
const ASSINATURA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

//Tipo real do arquivo pelos primeiros bytes
export function tipoPorAssinatura(b) {
    const ascii = (ini, fim) => b.subarray(ini, fim).toString("latin1");
    if (b.length >= 8 && b.subarray(0, 8).equals(ASSINATURA_PNG)) return "png";
    if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
    if (b.length >= 6 && (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a")) return "gif";
    if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
    const inicio = b.subarray(0, 512).toString("utf8").replace(/^﻿/, "").trimStart();
    if (inicio.startsWith("<svg")) return "svg";
    if (inicio.startsWith("<?xml") && b.includes("<svg")) return "svg";
    return null;
}

//Nome higienizado: sem pastas, sem acento, minúsculas e só [a-z0-9-]
export function higienizarNome(nome) {
    const arquivo = nome.split(/[\\/]/).pop();
    const ext = path.extname(arquivo).toLowerCase();
    const base = arquivo.slice(0, arquivo.length - ext.length)
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40)
        .replace(/-+$/, "");
    return { base: base || "imagem", ext };
}

async function salvarImagem(req, caminhos) {
    const bruto = req.headers["x-nome-arquivo"];
    if (typeof bruto !== "string" || bruto.trim() === "") {
        throw new ErroHttp(400, "Informe o nome do arquivo no cabeçalho X-Nome-Arquivo.");
    }
    let nome;
    try {
        nome = decodeURIComponent(bruto);
    } catch {
        throw new ErroHttp(400, "Nome de arquivo inválido.");
    }
    const { base, ext } = higienizarNome(nome);
    const esperado = EXTENSOES_IMAGEM[ext];
    if (!esperado) throw new ErroHttp(400, "Formato não permitido. Use png, jpg, jpeg, gif, webp ou svg.");

    const dados = await lerCorpo(req, LIMITE_IMAGEM);
    if (dados.length === 0) throw new ErroHttp(400, "O arquivo está vazio.");
    if (tipoPorAssinatura(dados) !== esperado) {
        throw new ErroHttp(400, `O conteúdo do arquivo não é uma imagem ${ext.slice(1)} válida.`);
    }

    for (let tentativa = 0; tentativa < 5; tentativa++) {
        const rel = `imagens/${base}-${randomBytes(3).toString("hex")}${ext}`;
        const { abs } = await prepararDestino(caminhos, rel);
        try {
            await escrever(await abrirNovo(abs, "existe"), dados);
            return rel;
        } catch (erro) {
            if (!(erro instanceof ErroHttp && erro.status === 409)) throw erro;
        }
    }
    throw new ErroHttp(500, "Não foi possível gerar um nome para a imagem.");
}

function criarRotasApi(ctx) {
    const { caminhos, site } = ctx;
    return {
        "GET /api/info": async () => ({
            pastaFrontend: path.basename(caminhos.frontend),
            portaEditor: ctx.porta,
            site: site.estado(),
        }),

        "GET /api/paginas": async () => ({ paginas: await listarPaginas(caminhos.frontend) }),

        "GET /api/pagina": async ({ query }) => {
            const caminho = query.get("caminho");
            if (!caminho) throw new ErroHttp(400, "Informe o caminho da página.");
            const { abs, rel } = await caminhos.resolverNoFrontend(caminho);
            exigirPagina(rel);
            try {
                return { caminho: rel, html: await readFile(abs, "utf8") };
            } catch (erro) {
                if (["ENOENT", "EISDIR", "ENOTDIR"].includes(erro.code)) throw new ErroHttp(404, "Página não encontrada.");
                throw erro;
            }
        },

        "PUT /api/pagina": async ({ req }) => {
            const { caminho, html, criar } = await lerJson(req);
            if (typeof caminho !== "string" || typeof html !== "string") {
                throw new ErroHttp(400, "Envie caminho e html como texto.");
            }
            if (criar !== undefined && typeof criar !== "boolean") throw new ErroHttp(400, "O campo criar deve ser true ou false.");
            const { rel } = await caminhos.resolverNoFrontend(caminho);
            exigirPagina(rel);
            const { abs } = await prepararDestino(caminhos, rel);
            await gravarPagina(abs, html, criar === true);
            return { ok: true, caminho: rel };
        },

        "POST /api/imagens": async ({ req }) => ({ caminho: await salvarImagem(req, caminhos) }),

        "GET /api/site": async () => site.estado(),

        "POST /api/site/iniciar": async ({ req }) => site.iniciar((await lerJson(req)).porta),

        "POST /api/site/parar": async () => site.parar(),

        "GET /api/portas": async () => site.sugestoes(),

        "GET /api/portas/verificar": async ({ query }) => site.verificar(query.get("porta") ?? ""),
    };
}

async function atenderApi(req, res, ctx, caminho, query) {
    if (METODOS_QUE_ALTERAM.has(req.method) && !origemPermitida(req.headers.origin, ctx.porta)) {
        throw new ErroHttp(403, "Origem não permitida.");
    }
    if (!tokenConfere(req.headers["x-editor-token"], ctx.token)) {
        throw new ErroHttp(403, "Token do editor ausente ou inválido.");
    }
    const rota = ctx.rotas[`${req.method} ${caminho}`];
    if (!rota) {
        const existe = Object.keys(ctx.rotas).some((r) => r.endsWith(` ${caminho}`));
        throw existe ? new ErroHttp(405, "Método não permitido.") : new ErroHttp(404, "Rota não encontrada.");
    }
    responderJson(res, 200, await rota({ req, query }));
}

async function servirIndice(req, res, ctx) {
    let html;
    try {
        html = await readFile(path.join(ctx.caminhos.publico, "index.html"), "utf8");
    } catch {
        throw new ErroHttp(404, "Interface do editor não encontrada.");
    }
    const corpo = html.replaceAll("__EDITOR_TOKEN__", ctx.token);
    res.writeHead(200, cabecalhosBase({
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": Buffer.byteLength(corpo),
        "Referrer-Policy": "no-referrer",
        ...EXTRA_EDITOR,
    }));
    res.end(req.method === "HEAD" ? undefined : corpo);
}

//GET / (com token), /css/*, /js/* da interface e /site/* do front (somente leitura)
async function atenderEstatico(req, res, ctx, caminho) {
    if (req.method !== "GET" && req.method !== "HEAD") throw new ErroHttp(405, "Método não permitido.");
    if (caminho === "/") return servirIndice(req, res, ctx);
    if (caminho.startsWith("/site/")) {
        const rel = decodificarCaminhoUrl(caminho.slice("/site/".length));
        return servirDoFrontend(req, res, {
            resolver: ctx.caminhos.resolverNoFrontend,
            rel,
            prefixo: "/site/",
            extra: EXTRA_SITE,
        });
    }
    if (caminho.startsWith("/css/") || caminho.startsWith("/js/")) {
        const { abs } = await ctx.caminhos.resolverNoPublico(decodificarCaminhoUrl(caminho.slice(1)));
        return servirArquivo(req, res, abs, EXTRA_EDITOR);
    }
    throw new ErroHttp(404, "Arquivo não encontrado.");
}

function responderErro(res, erro) {
    if (res.headersSent) return res.destroy();
    if (erro instanceof ErroHttp) return responderJson(res, erro.status, { erro: erro.message });
    if (erro?.code === "ENAMETOOLONG") return responderJson(res, 400, { erro: "Caminho longo demais." });
    console.error("[editor]", erro?.message ?? erro);
    responderJson(res, 500, { erro: "Erro interno do editor." });
}

/*Fábrica do servidor do editor. Escuta só em 127.0.0.1; porta 0 = porta livre qualquer (testes).
    Rejeita com o erro original (ex.: EADDRINUSE) se não conseguir escutar.
*/
export async function criarServidorEditor({ porta = 4300, caminhos = criarCaminhos(), token = gerarToken(), host = HOST } = {}) {
    if (typeof token !== "string" || token.length < 16) throw new Error("Token do editor curto demais.");
    const ctx = { caminhos, token, porta: null };
    ctx.site = criarControleSite({ caminhos, host, portaEditor: () => ctx.porta });
    ctx.rotas = criarRotasApi(ctx);

    const servidor = http.createServer(async (req, res) => {
        try {
            if (!hostPermitido(req.headers.host, ctx.porta)) throw new ErroHttp(403, "Host não permitido.");
            const { caminho, query } = dividirUrl(req.url);
            if (!caminho.startsWith("/")) throw new ErroHttp(400, "Caminho inválido.");
            if (caminho === "/api" || caminho.startsWith("/api/")) return await atenderApi(req, res, ctx, caminho, query);
            return await atenderEstatico(req, res, ctx, caminho);
        } catch (erro) {
            responderErro(res, erro);
        }
    });

    ctx.porta = await escutar(servidor, porta, host);
    const url = `http://${host}:${ctx.porta}/`;

    async function encerrar() {
        await ctx.site.parar();
        await fecharServidor(servidor);
    }

    return { porta: ctx.porta, url, token, servidor, site: ctx.site, encerrar };
}
