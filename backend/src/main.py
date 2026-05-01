import os
import shutil
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, List

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.db import initialize_database_if_needed, persist_reading_result
from src.pipeline.tarot_pipeline import TarotPipeline


def _allowed_origins_from_env() -> list[str]:
    raw = os.getenv(
        "API_ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    )
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def _as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}


def _normalize_spread_type(spread_type: str | None) -> str:
    if str(spread_type or "").strip().lower() == "three":
        return "three"
    return "three"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    initialize_database_if_needed(seed_reference_data=True)
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins_from_env(),
    allow_methods=["*"],
    allow_headers=["*"],
)

_pipeline: TarotPipeline | None = None


def _get_pipeline() -> TarotPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = TarotPipeline()
    return _pipeline


# =============================
# JSON endpoint (giữ lại)
# =============================

class QuestionRequest(BaseModel):
    question: str
    user_id: int | None = None
    audio_path: str | None = None
    image_paths: list[str] | None = None
    spread_type: str = "three"
    random_draw: bool = False


@app.get("/")
def root():
    return {"status": "api running"}


@app.post("/api/ask")
async def ask(req: QuestionRequest):
    clean_spread = _normalize_spread_type(req.spread_type)
    result = _get_pipeline().run_pipeline(
        question=req.question,
        audio_path=req.audio_path,
        image_paths=req.image_paths,
        spread_type=clean_spread,
        random_draw=req.random_draw,
    )
    session_id = persist_reading_result(
        question=req.question,
        result=result,
        user_id=req.user_id,
    )
    if session_id is not None:
        result["session_id"] = session_id
    return result


# =============================
# Upload file endpoint
# =============================

def _save_upload(upload_dir: Path, file: UploadFile) -> str:
    original_name = file.filename or ""
    ext = Path(original_name).suffix
    unique_name = f"{uuid.uuid4().hex}{ext}"
    save_path = upload_dir / unique_name
    with save_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return str(save_path)


def _cap_images_by_spread(image_paths: list[str], spread_type: str) -> list[str]:
    _ = spread_type
    return list(image_paths)[:3]


def _run_pipeline_from_uploads(
    *,
    question: str,
    user_id: int | None,
    spread_type: str,
    random_draw: bool,
    image_files: list[UploadFile] | None,
    audio_file: UploadFile | None,
) -> dict:
    upload_dir = Path(os.getenv("API_UPLOAD_DIR", "tmp_uploads"))
    upload_dir.mkdir(parents=True, exist_ok=True)
    clean_spread = _normalize_spread_type(spread_type)

    all_saved_paths: list[str] = []
    image_paths: list[str] = []
    audio_path: str | None = None

    try:
        if image_files:
            for file in image_files:
                save_path = _save_upload(upload_dir, file)
                all_saved_paths.append(save_path)
                image_paths.append(save_path)

        if audio_file is not None:
            audio_path = _save_upload(upload_dir, audio_file)
            all_saved_paths.append(audio_path)

        selected_paths = _cap_images_by_spread(image_paths, clean_spread)
        result = _get_pipeline().run_pipeline(
            question=question,
            audio_path=audio_path,
            image_paths=selected_paths,
            spread_type=clean_spread,
            random_draw=random_draw,
        )
        session_id = persist_reading_result(
            question=question,
            result=result,
            user_id=user_id,
        )
        if session_id is not None:
            result["session_id"] = session_id

        return result

    finally:
        # Cleanup file sau khi xử lý
        for path in all_saved_paths:
            if os.path.exists(path):
                os.remove(path)


@app.post("/api/ask_with_media")
async def ask_with_media(
    question: str = Form(...),
    user_id: int | None = Form(None),
    spread_type: str = Form("three"),
    random_draw: str | bool = Form(False),
    image: List[UploadFile] | None = File(default=None),
    audio: UploadFile | None = File(default=None),
):
    return _run_pipeline_from_uploads(
        question=question,
        user_id=user_id,
        spread_type=spread_type,
        random_draw=_as_bool(random_draw),
        image_files=image or [],
        audio_file=audio,
    )


@app.post("/api/ask_with_image")
async def ask_with_image(
    question: str = Form(...),
    user_id: int | None = Form(None),
    spread_type: str = Form("three"),
    image: List[UploadFile] = File(...),
):
    return _run_pipeline_from_uploads(
        question=question,
        user_id=user_id,
        spread_type=spread_type,
        random_draw=False,
        image_files=image,
        audio_file=None,
    )
