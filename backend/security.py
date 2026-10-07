import os
from datetime import UTC, datetime, timedelta

import jwt
from dotenv import load_dotenv
from pwdlib import PasswordHash

# Читаем переменные из backend/.env (файл в Git не попадает)
load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("Не задан SECRET_KEY: создайте backend/.env по образцу .env.example")

ALGORITHM = "HS256"
TOKEN_LIFETIME = timedelta(days=7)

# Рекомендуемые настройки библиотеки: алгоритм Argon2id
password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Превращает пароль в хэш (соль добавляется автоматически)."""
    return password_hash.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    """Проверяет, что пароль соответствует сохранённому хэшу."""
    return password_hash.verify(password, hashed)


# Хэш-пустышка: нужен, чтобы вход с несуществующим именем занимал столько же времени
DUMMY_HASH = hash_password("пустышка")


def create_access_token(user_id: int) -> str:
    """Выпускает подписанный токен: номер пользователя и срок действия."""
    payload = {"sub": str(user_id), "exp": datetime.now(UTC) + TOKEN_LIFETIME}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
