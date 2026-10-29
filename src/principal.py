import os
import sys

import psycopg2

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from conexion.pg_queries import PtgreSQLQueries
from controller.controller_ingrediente import ControllerIngrediente
from controller.controller_lista_compras import ControllerListaCompras
from controller.controller_planner import ControllerPlanner
from controller.controller_receita import ControllerReceita
from controller.controller_usuario import ControllerUsuario
from reports.relatorio_juncao import Relatorios as RelatoriosJuncao
from reports.relatorio_sumerizacao import Relatorios as RelatoriosSumarizacao
from utils import splash_screen
from utils.entrada import ler_inteiro

MENU_PRINCIPAL = """
========== MENU PRINCIPAL ==========
  [1] Relatórios
  [2] Inserir registros
  [3] Remover registros
  [4] Atualizar registros
  [0] Sair
===================================="""

MENU_ENTIDADES = """
---------- ENTIDADES ----------
  [1] Usuário
  [2] Ingrediente
  [3] Receita
  [4] Planner semanal
  [5] Lista de compras
  [0] Voltar
-------------------------------"""

MENU_RELATORIOS = """
---------- RELATÓRIOS ----------
  Com sumarização (agrupamento):
  [1] Produtividade dos autores
  [2] Popularidade dos ingredientes
  [3] Planejamento por tipo de refeição
  [4] Tempo médio de preparo por nacionalidade
  [5] Progresso das listas de compras
  Com junção de tabelas:
  [6] Cardápio semanal detalhado
  [7] Composição das receitas
  [8] Catálogo de receitas e autores
  [9] Lista de compras completa
  [10] Histórico de planejamento
  [0] Voltar
--------------------------------"""


def escolher(menu: str, maximo: int):
    """Mostra o menu e devolve a opção (0 = voltar/sair)."""
    while True:
        print(menu)
        opcao = ler_inteiro("Opção: ", minimo=0)
        if opcao <= maximo:
            return opcao
        print("Opção inválida.")


def menu_relatorios(db):
    sumarizacao = RelatoriosSumarizacao(db)
    juncao = RelatoriosJuncao(db)
    acoes = {
        1: sumarizacao.relatorio_produtividade_autores,
        2: sumarizacao.relatorio_popularidade_ingredientes,
        3: sumarizacao.relatorio_planeamento_por_refeicao,
        4: sumarizacao.relatorio_tempo_medio_por_nacionalidade,
        5: sumarizacao.relatorio_progresso_listas_compras,
        6: juncao.relatorio_cardapio_semanal,
        7: juncao.relatorio_composicao_receitas,
        8: juncao.relatorio_catalogo_receitas,
        9: juncao.relatorio_lista_compras_completa,
        10: juncao.relatorio_historico_planeamento,
    }
    while True:
        opcao = escolher(MENU_RELATORIOS, 10)
        if opcao == 0:
            return
        acoes[opcao]()
        input("Pressione ENTER para continuar...")


def menu_operacao(db, controllers, nome_metodo: str, verbo: str):
    """Fluxo de inserir/remover/atualizar: escolhe a entidade e repete enquanto o usuário quiser."""
    entidades = [controllers["usuario"], controllers["ingrediente"], controllers["receita"],
                 controllers["planner"], controllers["lista"]]
    while True:
        opcao = escolher(MENU_ENTIDADES, len(entidades))
        if opcao == 0:
            return
        controller = entidades[opcao - 1]
        while True:
            try:
                getattr(controller, nome_metodo)()
            except psycopg2.Error as erro:
                print(f"\nO banco recusou a operação: {erro.diag.message_primary or erro}")
            if input(f"\nDeseja {verbo} mais algum registro desta entidade? (S/N): ").strip().upper() != "S":
                break


def main():
    try:
        db = PtgreSQLQueries(can_write=True)
    except psycopg2.Error as erro:
        print(f"Não foi possível conectar ao banco: {erro}")
        print("Confira as variáveis PGHOST, PGPORT, PGDATABASE, PGUSER e PGPASSWORD (veja o README).")
        return 1

    controllers = {
        "usuario": ControllerUsuario(db),
        "ingrediente": ControllerIngrediente(db),
        "receita": ControllerReceita(db),
        "planner": ControllerPlanner(db),
        "lista": ControllerListaCompras(db),
    }

    splash_screen.mostrar(db)
    while True:
        opcao = escolher(MENU_PRINCIPAL, 4)
        if opcao == 1:
            menu_relatorios(db)
        elif opcao == 2:
            menu_operacao(db, controllers, "inserir", "inserir")
        elif opcao == 3:
            menu_operacao(db, controllers, "remover", "remover")
        elif opcao == 4:
            menu_operacao(db, controllers, "atualizar", "atualizar")
        else:
            break
    db.close()
    print("Até a próxima receita!")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (KeyboardInterrupt, EOFError):
        print("\nEncerrado.")
