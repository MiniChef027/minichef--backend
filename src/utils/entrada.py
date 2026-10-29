"""Funções de leitura do teclado, com validação, usadas por todos os menus."""
from datetime import date
from decimal import Decimal, InvalidOperation


def ler_texto(mensagem: str, obrigatorio: bool = True) -> str:
    while True:
        valor = input(mensagem).strip()
        if valor or not obrigatorio:
            return valor
        print("  Este campo é obrigatório.")


def ler_inteiro(mensagem: str, obrigatorio: bool = True, minimo: int = 1):
    while True:
        valor = input(mensagem).strip()
        if not valor and not obrigatorio:
            return None
        if valor.isdigit() and int(valor) >= minimo:
            return int(valor)
        print(f"  Digite um número inteiro a partir de {minimo}.")


def ler_decimal(mensagem: str, obrigatorio: bool = True):
    while True:
        valor = input(mensagem).strip().replace(",", ".")
        if not valor and not obrigatorio:
            return None
        try:
            numero = Decimal(valor)
            if numero > 0:
                return numero
        except InvalidOperation:
            pass
        print("  Digite um valor maior que zero (ex.: 2,5).")


def ler_data(mensagem: str, obrigatorio: bool = True):
    while True:
        valor = input(mensagem).strip()
        if not valor and not obrigatorio:
            return None
        try:
            return date.fromisoformat(valor)
        except ValueError:
            print("  Data inválida. Use o formato AAAA-MM-DD.")


def ler_opcao(mensagem: str, opcoes: list):
    """Mostra as opções numeradas e devolve a escolhida."""
    for i, opcao in enumerate(opcoes, start=1):
        print(f"  [{i}] {opcao}")
    numero = ler_inteiro(mensagem)
    while numero > len(opcoes):
        print("  Opção inexistente.")
        numero = ler_inteiro(mensagem)
    return opcoes[numero - 1]


def confirmar(mensagem: str) -> bool:
    while True:
        resposta = input(f"{mensagem} (S/N): ").strip().upper()
        if resposta in ("S", "N"):
            return resposta == "S"
        print("  Responda S ou N.")


def escolher_registro(db, titulo: str, sql: str, params=None):
    """Lista os registros (id + descrição) e devolve o id escolhido, ou None."""
    df = db.sqlToDataFrame(sql, params)
    if df.empty:
        print(f"\nNenhum registro encontrado em {titulo}.")
        return None
    print(f"\n--- {titulo} ---")
    print(df.to_string(index=False))
    ids = [int(i) for i in df["id"]]
    while True:
        id_escolhido = ler_inteiro("Informe o ID desejado (0 para cancelar): ", minimo=0)
        if id_escolhido == 0:
            return None
        if id_escolhido in ids:
            return id_escolhido
        print("  Esse ID não está na lista.")
