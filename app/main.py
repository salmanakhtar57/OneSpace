from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database.connection import engine
from app.models.base import Base
import app.models  # registers all models with Base
from app.routers.journal import router as journal_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="OneSpace")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(journal_router)

app.mount("static", StaticFiles(directory="app/static"), name="static")

