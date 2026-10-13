//Servidor do site (minichef--frontend como site estático) na porta escolhida, e checagem de portas
import http from "node:http";
import net from "node:net";
import { ErroHttp } from "./caminhos.js";
import {
    decodificarCaminhoUrl,
    dividirUrl,
    hostPermitido,
    responderTexto,
    servirDoFrontend,
} from "./estatico.js";

export const HOST = "127.0.0.1";
export const SUGESTOES = [3000, 5500, 8080, 5173, 8000];

//Aceita número inteiro ou texto só com dígitos; fora de 1024–65535 → 400
export function lerPorta(valor) {
    const n = typeof valor === "string" && /^\d{1,5}$/.test(valor) ? Number(valor) : valor;
    if (!Number.isInteger(n) || n < 1024 || n > 65535) {
        throw new ErroHttp(400, "Informe uma porta inteira entre 1024 e 65535.");
    }
    return n;
}

//Testa a porta tentando escutar nela por um instante
export function portaLivre(porta, host = HOST) {
    return new Promise((resolve) => {
        const teste = net.createServer();
        teste.unref();
        teste.once("error", () => resolve(false));
        teste.listen({ port: porta, host, exclusive: true }, () => teste.close(() => resolve(true)));
    });
}

export function escutar(servidor, porta, host = HOST) {
    return new Promise((resolve, reject) => {
        const falhou = (erro) => reject(erro);
        servidor.once("error", falhou);
        servidor.listen({ port: porta, host, exclusive: true }, () => {
            servidor.off("error", falhou);
            resolve(servidor.address().port);
        });
    });
}

export function fecharServidor(servidor) {
    return new Promise((resolve) => {
        servidor.close(() => resolve());
        servidor.closeAllConnections();
    });
}

//Atende o site: só GET/HEAD, Host checado, "/" e diretórios entregam index.html, 404 simples
function criarAtendente(caminhos, porta) {
    return async (req, res) => {
        try {
            if (!hostPermitido(req.headers.host, porta)) {
                return responderTexto(res, 403, "Host não permitido.");
            }
            if (req.method !== "GET" && req.method !== "HEAD") {
                return responderTexto(res, 405, "Método não permitido.", { Allow: "GET, HEAD" });
            }
            const { caminho } = dividirUrl(req.url);
            if (!caminho.startsWith("/")) throw new ErroHttp(400, "Caminho inválido.");
            const rel = decodificarCaminhoUrl(caminho.slice(1));
            await servirDoFrontend(req, res, { resolver: caminhos.resolverNoFrontend, rel, prefixo: "/" });
        } catch (erro) {
            if (res.headersSent) return res.destroy();
            if (!(erro instanceof ErroHttp)) console.error("[site]", erro.message);
            const status = erro instanceof ErroHttp ? erro.status : 500;
            const texto = status === 404 ? "Página não encontrada." : status === 500 ? "Erro interno." : erro.message;
            responderTexto(res, status, texto);
        }
    };
}

/*Controle do servidor do site. Operações em fila para evitar corrida entre iniciar/parar.
    portaEditor: função que devolve a porta do editor (proibida para o site)
*/
export function criarControleSite({ caminhos, host = HOST, portaEditor = () => null }) {
    let atual = null;
    let fila = Promise.resolve();
    const emFila = (tarefa) => {
        const resultado = fila.then(tarefa, tarefa);
        fila = resultado.catch(() => {});
        return resultado;
    };

    function estado() {
        if (!atual) return { rodando: false, porta: null, url: null };
        return { rodando: true, porta: atual.porta, url: `http://${host}:${atual.porta}/` };
    }

    async function subir(porta) {
        const servidor = http.createServer(criarAtendente(caminhos, porta));
        try {
            await escutar(servidor, porta, host);
        } catch (erro) {
            if (erro.code === "EADDRINUSE") throw new ErroHttp(409, `A porta ${porta} já está em uso.`);
            if (erro.code === "EACCES") throw new ErroHttp(409, `Sem permissão para usar a porta ${porta}.`);
            throw erro;
        }
        return servidor;
    }

    //Se já roda em outra porta, sobe a nova primeiro e só então para a antiga (falha não derruba o site)
    async function iniciar(valor) {
        const porta = lerPorta(valor);
        return emFila(async () => {
            if (porta === portaEditor()) throw new ErroHttp(400, `A porta ${porta} é a do editor. Escolha outra.`);
            if (atual?.porta === porta) return estado();
            const servidor = await subir(porta);
            const antigo = atual;
            atual = { servidor, porta };
            if (antigo) await fecharServidor(antigo.servidor);
            return estado();
        });
    }

    function parar() {
        return emFila(async () => {
            if (atual) {
                const antigo = atual;
                atual = null;
                await fecharServidor(antigo.servidor);
            }
            return estado();
        });
    }

    async function verificar(valor) {
        const porta = lerPorta(valor);
        if (porta === portaEditor() || porta === atual?.porta) return { porta, livre: false };
        return { porta, livre: await portaLivre(porta, host) };
    }

    async function sugestoes() {
        const lista = await Promise.all(SUGESTOES.map((porta) => verificar(porta)));
        return { sugestoes: lista };
    }

    return { estado, iniciar, parar, verificar, sugestoes };
}
