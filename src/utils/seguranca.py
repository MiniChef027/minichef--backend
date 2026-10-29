import hashlib
import os


def gerar_hash_senha(senha: str) -> str:
    """Guarda a senha com scrypt + sal aleatório (biblioteca padrão do Python)."""
    sal = os.urandom(16)
    resumo = hashlib.scrypt(senha.encode(), salt=sal, n=2**14, r=8, p=1)
    return f"scrypt${sal.hex()}${resumo.hex()}"
