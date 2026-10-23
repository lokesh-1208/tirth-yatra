from contextlib import asynccontextmanager

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .database import Base, SessionLocal, add_missing_columns, backfill_defaults, engine
from .otp import ensure_test_user
from .routers import admin, auth, places, tiles
from .seed import seed_places

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    add_missing_columns()
    backfill_defaults()
    with SessionLocal() as db:
        seed_places(db)
        ensure_test_user(db)
    yield


app = FastAPI(title="Tirth Yatra API", version="0.1.0", lifespan=lifespan)

origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(places.router)
app.include_router(admin.router)
app.include_router(tiles.router)

# Uploaded place photos. Served from disk in dev; use object storage + CDN in production.
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}
