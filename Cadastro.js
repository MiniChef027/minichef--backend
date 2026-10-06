const crypto = require("node:crypto"); //Biblioteca de geração de números aleatórios;
const { promisify } = require("node:util"); //Instancia da biblioteca abaixo;
const scrypt = promisify(crypto.scrypt); //Biblioteca para criar a senha hash;

class Cadastro {
    #senhaHash;
    #codigoConfirmacao;
    #expiracaoCodigo;
    #confirmado;

    //Construtor da classe
    constructor() {
        this.#senhaHash = null;
        this.#codigoConfirmacao = null;
        this.#expiracaoCodigo = null;
        this.#confirmado = false;

        this.tipo = "comum";
    }

    /* Cadastra a senha utilizando hash 
        O async no cabeçalho garante que operações que levam tempo para terminar finalizem corretamente;
        O primeiro if verifica que as senhas coecidem;
        O segundo if verifica se a senha é maior que 8 dígitos;
            A constante salt é um valor aleatório que é combinado com a senha durante o cálculo do hash,
        e garante que caso duas contas tenham a mesma senha o código hash será difente;
            A constante hash é o resultado do cálculo da senha com o salt gerando um código hash seguro,
        é usado o scrypt na linha 3 para tornar a operação de quebra mais custosa;
            O this.saltHash é uma variável que armazena os valores de salt e hash juntos, mas sendo possível
        recuperar os dois valores isoladamente se necessário;
        */
    async cadastrarSenha(senha, confirmacaoSenha) {
        if (senha !== confirmacaoSenha) {
            throw new Error("As senhas não coincidem.");
        }

        if (senha.length < 8) {
            throw new Error(
                "A senha deve ter pelo menos 8 caracteres."
            );
        }

        const salt = crypto.randomBytes(16).toString("hex");

        const hash = await scrypt(senha, salt, 64);

        // Salt e hash ficam armazenados juntos
        this.#senhaHash = `${salt}:${hash.toString("hex")}`;

        return true;
    }

    /* Gera o código de confirmação do cadastro;
       Cria o atributo privado do código de confirmação dando a ele um valor aleatório tranformado em string;
       Cria o atributo privado do tempo de expiração dando a ele um cronometro de 10 minutos;

    */
    gerarCodigoConfirmacao() {
        this.#codigoConfirmacao =
            crypto.randomInt(100000, 1000000).toString();

        // Código válido por 10 minutos
        this.#expiracaoCodigo = Date.now() + 10 * 60 * 1000;

        return this.#codigoConfirmacao;
    }

    /* Confirma o cadastro utilizando o código recebido;
       Entra no primeiro if caso o cadastro já tenha sido confirmado antes;
       Entra no segundo if caso o tempo de confirmação tenha expirado, ou o código de confirmação esteja errado;
       Seta o atributo confirmado como true, e o código e tempo de confirmação como null para operações futuras;
    */
    confirmarCadastro(codigo) {
        if (this.#confirmado) {
            throw new Error("O cadastro já foi confirmado.");
        }

        if (
            !this.#codigoConfirmacao ||
            Date.now() > this.#expiracaoCodigo ||
            codigo !== this.#codigoConfirmacao
        ) {
            throw new Error(
                "Código inválido ou expirado."
            );
        }

        this.#confirmado = true;
        this.#codigoConfirmacao = null;
        this.#expiracaoCodigo = null;

        return true;
    }

    /* Realiza o login verificando a senha 
       Entra no primeiro if se o cadastro não foi confirmado
       Entre no segundo if se a senha não foi cadastrada;
       Cria um vetor com as informações de hash separados entre salt e hash e;
       Cria uma variável que recebe a senha e o salt com o máximo de números de caracteres sendo 64;
       Entra no terceiro if caso o hash digitado não tiver o tamanho similar ao original, ou se eles não forem iguais;

       */

    async login(senha) {
        if (!this.#confirmado) {
            throw new Error(
                "Confirme seu cadastro antes de entrar."
            );
        }

        if (!this.#senhaHash) {
            throw new Error("Senha não cadastrada.");
        }

        const [salt, hashArmazenado] =
            this.#senhaHash.split(":");

        const hashInformado = await scrypt(
            senha,
            salt,
            64
        );

        const hashOriginal = Buffer.from(
            hashArmazenado,
            "hex"
        );

        if (
            hashInformado.length !== hashOriginal.length ||
            !crypto.timingSafeEqual(
                hashInformado,
                hashOriginal
            )
        ) {
            throw new Error("E-mail ou senha incorretos.");
        }

        return true;
    }
}

module.exports = Usuario;