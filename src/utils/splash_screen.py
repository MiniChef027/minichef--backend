from conexion.pg_queries import PtgreSQLQueries

NOME_APLICACAO = "MINICHEF"
SUBTITULO = "Receitas, planner semanal e lista de compras"
INTEGRANTES = [
    "Carlos Henrique",
    "Nathã",
    "Gabriel Bitti Gonçalves",
    "César Augusto",
    "João Felipe Lopes",
]
DISCIPLINA = "Banco de Dados - Prof. Howard Roatti"

# Tabelas que aparecem na contagem inicial
ENTIDADES = [
    "usuario", "ingrediente", "receita", "receita_ingrediente",
    "planner_semanal", "item_planner", "lista_compras", "item_lista_compras",
]


def contar_registros(db: PtgreSQLQueries) -> str:
    linhas = []
    for entidade in ENTIDADES:
        df = db.sqlToDataFrame(f"select count(1) as total_{entidade} from {entidade}")
        linhas.append(f"  {'total_' + entidade:<30}{int(df.iloc[0, 0]):>5}")
    return "\n".join(linhas)


def mostrar(db: PtgreSQLQueries):
    print("=" * 56)
    print(f"{NOME_APLICACAO:^56}")
    print(f"{SUBTITULO:^56}")
    print("=" * 56)
    print(f"{DISCIPLINA:^56}")
    print("\n  Integrantes do grupo:")
    for nome in INTEGRANTES:
        print(f"    - {nome}")
    print("\n  Registros existentes nas tabelas:")
    print(contar_registros(db))
    print("=" * 56)
