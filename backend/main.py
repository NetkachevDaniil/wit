from fastapi import FastAPI

app = FastAPI(title="Дневник API")

@app.get("/")
def read_root():
    return {"message": "Привет! Сервер дневника работает."}

@app.get("/entries/{entry_id}")
def read_entry(entry_id: int):
    return {"entry_id": entry_id, "title": f"Запись номер {entry_id}"}