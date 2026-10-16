
class Usuario {
    //Atributos encapsulados (O # é o encapsulamento private)
    #nome;
    #email;
    #dataNascimento;
    #cpf;
    #confirmado;

    //Construtor da classe
    constructor(nome, email, dataNascimento, cpf) {
        this.#nome = nome;
        this.#email = email.trim().toLowerCase();
        this.#dataNascimento = dataNascimento;
        this.#cpf = cpf.replace(/\D/g, "");
        this.tipo = "comum";
    }

    //Gets dos atributos
    getNome(){
        return this.#nome;
    }

    getEmail(){
        return this.#email;
    }

    getDataNascimento(){
        return this.dataNascimento;
    }

    getCpf(){
        return this.#cpf;
    }

    /*Este método valida todos os dados que foram adicionados
        O primeiro if valida se e o nome foi digitado;
        O segundo if valida se o email foi digitado corretamente:
            A linha com a variável emailValido é o controle do que foi digitado,
            ela valida o que foi digitado antes do @, depois do @, e o .com;  
        O terceiro if valida se há 11 dígitos no cpf;
        O quarto if valida se a pessoa nasceu em uma data válida;
        o quinto if valida se foi digitado corretamente a data de nascimento;
    */
    validarDadosInscricao() {
        if (!this.#nome.trim()) {
            throw new Error("O nome é obrigatório.");
        }

        const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailValido.test(this.#email)) {
            throw new Error("E-mail inválido.");
        }

        if (!/^\d{11}$/.test(this.#cpf)) {
            throw new Error("O CPF deve conter 11 dígitos.");
        }

        const data = new Date(
            this.#dataNascimento + "T00:00:00"
        );

        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(this.#dataNascimento) ||
            Number.isNaN(data.getTime()) ||
            data.toISOString().slice(0, 10) !== this.#dataNascimento ||
            data > new Date()
        ) {
            throw new Error("Data de nascimento inválida.");
        }

        return true;
    }

    // Retorna os dados públicos do usuário
    obterDados() {
        return {
            nome: this.#nome,
            email: this.#email,
            dataNascimento: this.#dataNascimento,
            tipo: this.tipo,
            confirmado: this.#confirmado
        };
    }
}

module.exports = Usuario;