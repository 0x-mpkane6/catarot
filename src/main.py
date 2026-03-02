from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import shutil
import os
import uuid

from src.pipeline.tarot_pipeline import TarotPipeline


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

pipeline = TarotPipeline()


# =============================
# JSON endpoint (giữ lại)
# =============================

class QuestionRequest(BaseModel):
    question: str
    audio_path: str | None = None
    image_paths: list[str] | None = None
    spread_type: str = "single"


@app.get("/")
def root():
    return {"status": "api running"}


@app.post("/api/ask")
async def ask(req: QuestionRequest):
    result = pipeline.run_pipeline(
        question=req.question,
        audio_path=req.audio_path,
        image_paths=req.image_paths,
        spread_type=req.spread_type,
    )
    return result


# =============================
# Upload file endpoint
# =============================

@app.post("/api/ask_with_image")
async def ask_with_image(
    question: str = Form(...),
    spread_type: str = Form("single"),
    image: List[UploadFile] = File(...)
):
    os.makedirs("tmp_uploads", exist_ok=True)

    saved_paths = []

    try:
        for file in image:
            # random filename để tránh trùng
            ext = file.filename.split(".")[-1]
            unique_name = f"{uuid.uuid4().hex}.{ext}"
            save_path = os.path.join("tmp_uploads", unique_name)

            with open(save_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            saved_paths.append(save_path)

        # Giới hạn theo spread
        if spread_type == "single":
            saved_paths = saved_paths[:1]
        elif spread_type == "three":
            saved_paths = saved_paths[:3]

        result = pipeline.run_pipeline(
            question=question,
            audio_path=None,
            image_paths=saved_paths,
            spread_type=spread_type,
        )

        return result

    finally:
        # Cleanup file sau khi xử lý
        for path in saved_paths:
            if os.path.exists(path):
                os.remove(path)