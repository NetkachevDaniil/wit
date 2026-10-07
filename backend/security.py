from pwdlib import PasswordHash

# Рекомендуемые настройки библиотеки: алгоритм Argon2id
password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Превращает пароль в хэш (соль добавляется автоматически)."""
    return password_hash.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    """Проверяет, что пароль соответствует сохранённому хэшу."""
    return password_hash.verify(password, hashed)
