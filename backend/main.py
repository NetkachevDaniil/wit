from datetime import UTC, datetime

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Дневник API")


class EntryCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = ""


class Entry(BaseModel):
    id: int
    title: str
    body: str
    created_at: datetime
    updated_at: datetime


@app.get("/")
def read_root():
    return {"message": "Привет! Сервер дневника работает."}

entries: dict[int, Entry] = {}
next_id = 1


@app.post("/entries", status_code=201)
def create_entry(data: EntryCreate) -> Entry:
    global next_id

    now = datetime.now(UTC)
    entry = Entry(
        id=next_id,
        title=data.title,
        body=data.body,
        created_at=now,
        updated_at=now,
    )
    entries[next_id] = entry
    next_id += 1
    return entry

@app.get("/entries")
def list_entries() -> list[Entry]:
    return list(entries.values())

def find_entry(entry_id: int) -> Entry:
    entry = entries.get(entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    return entry

@app.get("/entries/{entry_id}")
def get_entry(entry_id: int) -> Entry:
    return find_entry(entry_id)

@app.put("/entries/{entry_id}")
def update_entry(entry_id: int, data: EntryCreate) -> Entry:
    entry = find_entry(entry_id)
    updated = entry.model_copy(
        update={
            "title": data.title,
            "body": data.body,
            "updated_at": datetime.now(UTC),
        }
    )
    entries[entry_id] = updated
    return updated

@app.delete("/entries/{entry_id}", status_code=204)
def delete_entry(entry_id: int) -> None:
    find_entry(entry_id)
    del entries[entry_id]