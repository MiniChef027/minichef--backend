//Raízes do projeto e guarda de caminho: o editor só grava dentro de minichef--frontend
import path from "node:path";
import { lstat, realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ_PADRAO = path.resolve(AQUI, "..", "..");

//Erro com status HTTP e mensagem segura para o usuário (sem caminho absoluto)
export class ErroHttp extends Error {
    constructor(status, mensagem) {
        super(mensagem);
        this.status = status;
    }
}

/*Monta as raízes. Tudo é injetável para os testes usarem pastas temporárias:
    raiz      pasta do projeto (contém minichef--frontend, minichef--backend e editor)
    frontend  única pasta onde o editor grava
    publico   interface do editor (index.html, css, js)
*/
export function criarCaminhos({ raiz = RAIZ_PADRAO, frontend, publico } = {}) {
    const raizAbs = path.resolve(raiz);
    const editor = path.join(raizAbs, "editor");
    const caminhos = {
        raiz: raizAbs,
        frontend: path.resolve(frontend ?? path.join(raizAbs, "minichef--frontend")),
        backend: path.join(raizAbs, "minichef--backend"),
        editor,
        publico: path.resolve(publico ?? path.join(editor, "public")),
    };
    caminhos.resolverNoFrontend = (rel) => resolverNoFrontend(caminhos, rel);
    caminhos.resolverNoPublico = (rel) => resolverDentro(caminhos.publico, rel);
    return caminhos;
}

const invalido = () => new ErroHttp(400, "Caminho inválido.");
const negado = () => new ErroHttp(403, "Acesso negado a esse caminho.");

/*Checagem sintática, feita sobre o caminho JÁ decodificado:
    recusa vazio, byte nulo e caracteres de controle, barra invertida, "%" (codificação dupla),
    ":" (unidade/fluxo no Windows), caminho absoluto e segmento iniciado por "." (inclui ".." e ocultos)
*/
export function validarRelativo(rel) {
    if (typeof rel !== "string" || rel.length === 0 || rel.length > 1024) throw invalido();
    if (/[\u0000-\u001f\u007f\\%:]/.test(rel)) throw invalido();
    if (path.isAbsolute(rel) || path.posix.isAbsolute(rel) || path.win32.isAbsolute(rel)) throw invalido();
    const segmentos = rel.split("/");
    if (segmentos.some((s) => s.startsWith("."))) throw invalido();
    return segmentos.filter(Boolean).join("/");
}

function dentroDe(base, alvo) {
    return alvo === base || alvo.startsWith(base + path.sep);
}

//realpath do próprio alvo ou do pai existente mais próximo; symlink quebrado gera erro (recusado)
async function realDoExistente(alvo) {
    let atual = alvo;
    for (;;) {
        let existe = true;
        try {
            await lstat(atual);
        } catch (erro) {
            if (erro.code !== "ENOENT" && erro.code !== "ENOTDIR") throw erro;
            existe = false;
        }
        if (existe) return realpath(atual);
        const pai = path.dirname(atual);
        if (pai === atual) throw new Error("sem pai existente");
        atual = pai;
    }
}

async function realOuLexico(p) {
    try {
        return await realpath(p);
    } catch {
        return p;
    }
}

//Resolve rel dentro de base (lexicamente e pelo realpath, o que barra symlinks para fora)
export async function resolverDentro(base, rel) {
    const limpo = validarRelativo(rel);
    const alvo = path.resolve(base, limpo);
    if (!alvo.startsWith(base + path.sep)) throw invalido();

    let baseReal;
    try {
        baseReal = await realpath(base);
    } catch {
        throw new ErroHttp(500, "Pasta base não encontrada.");
    }
    let real;
    try {
        real = await realDoExistente(alvo);
    } catch {
        throw negado();
    }
    if (!dentroDe(baseReal, real)) throw negado();
    return { abs: alvo, real, rel: limpo };
}

/*Guarda principal de gravação/leitura do front-end.
    Defesa extra: mesmo que a raiz do front seja mal configurada,
    nunca devolve nada dentro de minichef--backend ou de editor.
*/
export async function resolverNoFrontend(caminhos, rel) {
    const resolvido = await resolverDentro(caminhos.frontend, rel);
    const proibidos = [caminhos.backend, caminhos.editor];
    for (const p of [...proibidos]) proibidos.push(await realOuLexico(p));
    for (const p of proibidos) {
        if (dentroDe(p, resolvido.abs) || dentroDe(p, resolvido.real)) throw negado();
    }
    return resolvido;
}
