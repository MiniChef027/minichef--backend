//Executor do Editor MiniChef — uso: node editor/executor.js [--porta N] [--sem-abrir]
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { criarCaminhos } from "./server/caminhos.js";
import { criarServidorEditor } from "./server/api.js";
import { lerPorta } from "./server/servidorSite.js";

const PRIMEIRA_PORTA = 4300;
const ULTIMA_PORTA = 4310;
const USO = "Uso: node editor/executor.js [--porta N] [--sem-abrir]  (ou EDITOR_PORTA=N)";

//--porta tem prioridade sobre EDITOR_PORTA
function lerArgumentos(argv, env) {
    let porta = null;
    let abrir = true;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--sem-abrir") abrir = false;
        else if (arg === "--porta") porta = argv[++i] ?? "";
        else if (arg.startsWith("--porta=")) porta = arg.slice("--porta=".length);
        else throw new Error(`Opção desconhecida: ${arg}`);
    }
    if (porta === null && env.EDITOR_PORTA) porta = env.EDITOR_PORTA;
    return { porta: porta === null ? null : lerPorta(String(porta).trim()), abrir };
}

//Só a URL fixa do editor vai para o comando, sem shell
function abrirNavegador(url) {
    const [comando, args] =
        process.platform === "darwin" ? ["open", [url]]
        : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
    const avisar = () => console.log(`Abra no navegador: ${url}`);
    try {
        const filho = spawn(comando, args, { stdio: "ignore", detached: true, shell: false });
        filho.on("error", avisar);
        filho.unref();
    } catch {
        avisar();
    }
}

function falhar(mensagem) {
    console.error(`Erro: ${mensagem}`);
    process.exit(1);
}

async function subirEditor(porta, caminhos) {
    if (porta !== null) {
        try {
            return await criarServidorEditor({ porta, caminhos });
        } catch (erro) {
            if (erro.code === "EADDRINUSE") falhar(`A porta ${porta} já está em uso. Escolha outra com --porta N.`);
            if (erro.code === "EACCES") falhar(`Sem permissão para usar a porta ${porta}.`);
            throw erro;
        }
    }
    for (let p = PRIMEIRA_PORTA; p <= ULTIMA_PORTA; p++) {
        try {
            return await criarServidorEditor({ porta: p, caminhos });
        } catch (erro) {
            if (erro.code !== "EADDRINUSE") throw erro;
        }
    }
    falhar(`Nenhuma porta livre entre ${PRIMEIRA_PORTA} e ${ULTIMA_PORTA}. Use --porta N.`);
}

async function principal() {
    let args;
    try {
        args = lerArgumentos(process.argv.slice(2), process.env);
    } catch (erro) {
        console.error(USO);
        falhar(erro.message);
    }

    const caminhos = criarCaminhos();
    //Pasta vazia não vai para o git; garante que o front exista antes de servir
    await mkdir(caminhos.frontend, { recursive: true });

    const editor = await subirEditor(args.porta, caminhos);
    console.log(`Editor MiniChef rodando em ${editor.url}`);
    console.log("Ctrl+C para encerrar.");
    if (args.abrir) abrirNavegador(editor.url);

    let encerrando = false;
    const encerrar = async () => {
        if (encerrando) return;
        encerrando = true;
        console.log("\nEncerrando o editor e o site...");
        setTimeout(() => process.exit(0), 3000).unref();
        await editor.encerrar().catch(() => {});
        process.exit(0);
    };
    process.on("SIGINT", encerrar);
    process.on("SIGTERM", encerrar);
}

principal().catch((erro) => falhar(erro.message));
