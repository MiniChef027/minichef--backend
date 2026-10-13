//Servir arquivos estáticos (editor, /site/ e servidor do site) e respostas padronizadas
import path from "node:path";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { ErroHttp } from "./caminhos.js";

const TIPOS = {
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".avif": "image/avif",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".pdf": "application/pdf",
};

export function tipoDe(arquivo) {
    return TIPOS[path.extname(arquivo).toLowerCase()] ?? "application/octet-stream";
}

//Cabeçalhos comuns: nada em cache e sem adivinhação de tipo. Nunca Access-Control-Allow-*.
export function cabecalhosBase(extra = {}) {
    return {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...extra,
    };
}

export function responderJson(res, status, dados, extra = {}) {
    const corpo = JSON.stringify(dados);
    res.writeHead(status, cabecalhosBase({
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(corpo),
        ...extra,
    }));
    res.end(corpo);
}

export function responderTexto(res, status, texto, extra = {}) {
    res.writeHead(status, cabecalhosBase({
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Length": Buffer.byteLength(texto),
        ...extra,
    }));
    res.end(texto);
}

//Hosts aceitos para a porta P (proteção contra DNS rebinding)
export function hostsPermitidos(porta) {
    return [`127.0.0.1:${porta}`, `localhost:${porta}`, `[::1]:${porta}`];
}

export function hostPermitido(host, porta) {
    return typeof host === "string" && hostsPermitidos(porta).includes(host.toLowerCase());
}

//Origin, quando presente, precisa ser http://<host permitido>
export function origemPermitida(origem, porta) {
    if (origem === undefined) return true;
    return hostsPermitidos(porta).some((h) => origem.toLowerCase() === `http://${h}`);
}

//Decodifica o trecho de URL depois do prefixo da rota; % malformado vira 400
export function decodificarCaminhoUrl(trecho) {
    try {
        return decodeURIComponent(trecho);
    } catch {
        throw new ErroHttp(400, "Caminho inválido.");
    }
}

//Separa caminho cru e query sem normalizar "..": a guarda de caminho é quem decide
export function dividirUrl(url) {
    const i = url.indexOf("?");
    const caminho = i === -1 ? url : url.slice(0, i);
    const query = new URLSearchParams(i === -1 ? "" : url.slice(i + 1));
    return { caminho, query };
}

//Envia um arquivo já resolvido pela guarda. Diretório ou inexistente → 404.
export async function servirArquivo(req, res, abs, extra = {}) {
    let info;
    try {
        info = await stat(abs);
    } catch {
        throw new ErroHttp(404, "Arquivo não encontrado.");
    }
    if (!info.isFile()) throw new ErroHttp(404, "Arquivo não encontrado.");

    res.writeHead(200, cabecalhosBase({
        "Content-Type": tipoDe(abs),
        "Content-Length": info.size,
        ...extra,
    }));
    if (req.method === "HEAD") return res.end();

    await new Promise((resolve) => {
        const fluxo = createReadStream(abs);
        fluxo.on("error", () => {
            res.destroy();
            resolve();
        });
        fluxo.on("end", resolve);
        fluxo.pipe(res);
    });
}

/*Serve um arquivo do front-end pelo caminho relativo já decodificado.
    "" ou diretório → index.html, sem listagem. Diretório sem "/" final é redirecionado
    para que os links relativos da página funcionem.
    resolver: guarda (caminhos.resolverNoFrontend) · prefixo: "/" ou "/site/"
*/
export async function servirDoFrontend(req, res, { resolver, rel, prefixo, extra = {} }) {
    if (rel === "") {
        const { abs } = await resolver("index.html");
        return servirArquivo(req, res, abs, extra);
    }
    const { abs, rel: limpo } = await resolver(rel);
    let info;
    try {
        info = await stat(abs);
    } catch {
        throw new ErroHttp(404, "Arquivo não encontrado.");
    }
    if (!info.isDirectory()) return servirArquivo(req, res, abs, extra);

    if (!rel.endsWith("/")) {
        //Location montado só com segmentos já validados pela guarda (sem "//", sem host)
        const destino = prefixo + limpo.split("/").map(encodeURIComponent).join("/") + "/";
        res.writeHead(301, cabecalhosBase({ Location: destino, "Content-Length": 0, ...extra }));
        return res.end();
    }
    const { abs: indice } = await resolver(`${limpo}/index.html`);
    return servirArquivo(req, res, indice, extra);
}
