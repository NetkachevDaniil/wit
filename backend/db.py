import sqlite3
from pathlib import Path

# Файл базы лежит рядом с этим модулем, независимо от папки запуска
DB_PATH = Path(__file__).parent / "diary.db"


def init_db() -> None:
    """Создаёт таблицу записей, если её ещё нет."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS entries (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                title      TEXT NOT NULL,
                body       TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )


def get_db():
    """Открывает соединение на один запрос и закрывает его в конце."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()
