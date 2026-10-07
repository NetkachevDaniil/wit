import sqlite3
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field

from db import get_db, init_db
from security import (
    DUMMY_HASH,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Дневник API", lifespan=lifespan)


class EntryCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = ""


class Entry(BaseModel):
    id: int
    title: str
    body: str
    created_at: datetime
    updated_at: datetime


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)


# То, что сервер возвращает о пользователе: хэша пароля здесь нет
class User(BaseModel):
    id: int
    username: str
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


@app.get("/")
def read_root():
    return {"message": "Привет! Сервер дневника работает."}

# Соединение с базой на время одного запроса (открывает и закрывает get_db)
Db = Annotated[sqlite3.Connection, Depends(get_db)]

# Достаёт токен из заголовка Authorization; tokenUrl подсказывает /docs, где входить
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: Db) -> User:
    user_id = decode_access_token(token)
    row = None
    if user_id is not None:
        row = db.execute(
            "SELECT id, username, created_at FROM users WHERE id = ?", (user_id,)
        ).fetchone()
    if row is None:
        raise HTTPException(
            status_code=401,
            detail="Недействительный токен",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return User(**row)


# Подключается к маршруту так же, как Db: user: CurrentUser
CurrentUser = Annotated[User, Depends(get_current_user)]


# Чужая запись и несуществующая неотличимы: в обоих случаях 404
def find_entry(db: sqlite3.Connection, entry_id: int, user_id: int) -> Entry:
    row = db.execute(
        "SELECT * FROM entries WHERE id = ? AND user_id = ?", (entry_id, user_id)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    return Entry(**row)


@app.post("/entries", status_code=201)
def create_entry(data: EntryCreate, db: Db, user: CurrentUser) -> Entry:
    now = datetime.now(UTC).isoformat()
    cursor = db.execute(
        "INSERT INTO entries (user_id, title, body, created_at, updated_at)"
        " VALUES (?, ?, ?, ?, ?)",
        (user.id, data.title, data.body, now, now),
    )
    db.commit()
    return find_entry(db, cursor.lastrowid, user.id)


@app.get("/entries")
def list_entries(db: Db, user: CurrentUser) -> list[Entry]:
    rows = db.execute(
        "SELECT * FROM entries WHERE user_id = ? ORDER BY id", (user.id,)
    ).fetchall()
    return [Entry(**row) for row in rows]


@app.get("/entries/{entry_id}")
def get_entry(entry_id: int, db: Db, user: CurrentUser) -> Entry:
    return find_entry(db, entry_id, user.id)


@app.put("/entries/{entry_id}")
def update_entry(entry_id: int, data: EntryCreate, db: Db, user: CurrentUser) -> Entry:
    now = datetime.now(UTC).isoformat()
    cursor = db.execute(
        "UPDATE entries SET title = ?, body = ?, updated_at = ? WHERE id = ? AND user_id = ?",
        (data.title, data.body, now, entry_id, user.id),
    )
    db.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    return find_entry(db, entry_id, user.id)


@app.delete("/entries/{entry_id}", status_code=204)
def delete_entry(entry_id: int, db: Db, user: CurrentUser) -> None:
    cursor = db.execute(
        "DELETE FROM entries WHERE id = ? AND user_id = ?", (entry_id, user.id)
    )
    db.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Запись не найдена")


@app.post("/auth/register", status_code=201)
def register(data: UserCreate, db: Db) -> User:
    now = datetime.now(UTC)
    try:
        cursor = db.execute(
            "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
            (data.username, hash_password(data.password), now.isoformat()),
        )
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Имя уже занято")
    db.commit()
    return User(id=cursor.lastrowid, username=data.username, created_at=now)


@app.post("/auth/login")
def login(form: Annotated[OAuth2PasswordRequestForm, Depends()], db: Db) -> Token:
    row = db.execute(
        "SELECT id, password_hash FROM users WHERE username = ?", (form.username,)
    ).fetchone()
    # Если имени нет, всё равно проверяем пароль по пустышке: время ответа не выдаст этого
    hashed = row["password_hash"] if row else DUMMY_HASH
    if not verify_password(form.password, hashed) or row is None:
        raise HTTPException(
            status_code=401,
            detail="Неверное имя или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return Token(access_token=create_access_token(row["id"]))


@app.get("/auth/me")
def read_me(user: CurrentUser) -> User:
    return user
