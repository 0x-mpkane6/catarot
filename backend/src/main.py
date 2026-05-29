import logging
import os
import shutil
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, List

import sqlalchemy as sa
from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from src.advanced.affirmations import generate_affirmation
from src.advanced.analytics_scheduler import start_analytics_scheduler, stop_analytics_scheduler
from src.advanced.archetype_profiler import get_user_archetype_profile
from src.advanced.community_room import (
    add_interpretation,
    create_community_post,
    list_community_feed,
    moderate_post,
    moderation_queue,
    resonate_interpretation,
    vote_interpretation,
)
from src.advanced.conversation import add_followup_turn, get_conversation_turns
from src.advanced.daily_card import (
    add_reflection,
    draw_today_card,
    get_streak,
    get_today_card,
    list_history as list_daily_history,
)
from src.advanced.dream_journal import create_dream_entry, get_dream_entry, list_dream_entries
from src.advanced.duo_reading import (
    DUO_WS_MANAGER,
    create_duo_session,
    get_duo_session,
    join_duo_by_invite,
    join_duo_session,
    submit_duo_card,
)
from src.advanced.oracle_reports import latest_oracle_report, list_oracle_reports
from src.advanced.question_suggestions import generate_question_suggestions
from src.advanced.rating_reminders import (
    list_pending_ratings,
    save_rating,
    start_rating_scheduler,
    stop_rating_scheduler,
)
from src.advanced.spread_recommender import recommend_spread
from src.advanced.time_capsule import (
    create_capsule,
    get_capsule,
    list_capsules,
    open_capsule,
    submit_verdict,
)
from src.auth.deps import (
    CurrentUser,
    get_current_admin,
    get_current_user,
    get_websocket_user,
    resolve_optional_user_id,
)
from src.auth.service import (
    ProfileUpdatePayload,
    authenticate_user_by_identifier,
    authenticate_with_google,
    register_user,
    request_password_reset,
    reset_password_with_token,
    update_user_profile,
)
from src.db import initialize_database_if_needed, persist_reading_result
from src.pipeline.tarot_pipeline import TarotPipeline
from src.utils.logging import get_logger
from src.utils.rate_limit import enforce_rate_limit

LOGGER = get_logger("tarot.api")
APP_VERSION = "0.2.0"


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


def _normalize_rating_reminder_days(value: Any) -> int:
    try:
        days = int(value)
    except (TypeError, ValueError):
        return 7
    if days not in {7, 14, 30}:
        return 7
    return days


@asynccontextmanager
async def lifespan(_app: FastAPI):
    initialize_database_if_needed(seed_reference_data=True)
    if (os.getenv("JWT_SECRET_KEY", "") or "").strip().startswith("change_me"):
        LOGGER.warning(
            "JWT_SECRET_KEY is using the default placeholder. Set a strong secret in production."
        )
    start_rating_scheduler()
    start_analytics_scheduler()
    try:
        yield
    finally:
        stop_analytics_scheduler()
        stop_rating_scheduler()


app = FastAPI(
    lifespan=lifespan,
    title="Tarot Multimodal API",
    version=APP_VERSION,
    description="Tarot reading API with multimodal input and gamified daily features.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins_from_env(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:16]
    request.state.request_id = request_id
    try:
        response = await call_next(request)
    except Exception:
        LOGGER.exception("unhandled error in request %s %s id=%s", request.method, request.url.path, request_id)
        raise
    response.headers["x-request-id"] = request_id
    return response


@app.exception_handler(Exception)
async def _generic_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        # Let FastAPI's default handler take it.
        raise exc
    request_id = getattr(request.state, "request_id", "-")
    LOGGER.exception("unhandled exception id=%s path=%s", request_id, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "internal server error",
            "request_id": request_id,
        },
    )

_pipeline: TarotPipeline | None = None


def _get_pipeline() -> TarotPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = TarotPipeline()
    return _pipeline


def _ensure_self_or_admin(current_user: CurrentUser, target_user_id: int) -> None:
    if current_user.role == "admin":
        return
    if current_user.id != target_user_id:
        raise HTTPException(status_code=403, detail="access denied")


def _ensure_session_owner_or_admin(current_user: CurrentUser, session_id: int) -> int | None:
    from src.db.models import ReadingSession
    from src.db.session import session_scope

    with session_scope() as session:
        owner_id = session.scalar(sa.select(ReadingSession.user_id).where(ReadingSession.id == session_id))

    if owner_id is None:
        raise HTTPException(status_code=404, detail="session not found")
    if current_user.role != "admin" and owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="session not found")
    return owner_id


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
    rating_reminder_days: int = 7


class FollowupRequest(BaseModel):
    user_id: int | None = None
    message: str = Field(min_length=1)


class SpreadRecommendationRequest(BaseModel):
    question: str
    user_id: int | None = None


class RatingRequest(BaseModel):
    score: int = Field(ge=1, le=5)
    note: str | None = None


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=6)
    username: str | None = Field(default=None, min_length=3, max_length=64)
    display_name: str | None = Field(default=None, max_length=120)


class LoginRequest(BaseModel):
    # Accept either email hoặc username trong cùng 1 field. `email` giữ lại
    # cho backward-compat với client cũ; `identifier` ưu tiên hơn.
    identifier: str | None = Field(default=None, min_length=1, max_length=255)
    email: str | None = Field(default=None)
    password: str = Field(min_length=1)


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=8, max_length=255)
    new_password: str = Field(min_length=6, max_length=128)


class GoogleLoginRequest(BaseModel):
    id_token: str = Field(min_length=10)


class ProfileUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, max_length=120)
    avatar_url: str | None = Field(default=None, max_length=512)
    bio: str | None = Field(default=None, max_length=2000)
    username: str | None = Field(default=None, min_length=3, max_length=64)


class CommunityPostRequest(BaseModel):
    question_text: str = Field(min_length=1)
    card_summary: list[dict] = Field(default_factory=list)


class InterpretationRequest(BaseModel):
    content: str = Field(min_length=1)


class ModerationRequest(BaseModel):
    reason: str | None = None


class JoinByInviteRequest(BaseModel):
    invite_code: str = Field(min_length=1)


class DailyCardDrawRequest(BaseModel):
    mood_pre: str | None = None


class DailyCardReflectionRequest(BaseModel):
    reflection: str | None = None
    mood_post: str | None = None


class TimeCapsuleCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    reveal_at: str = Field(description="ISO-8601 datetime when capsule unlocks")
    session_id: int | None = None
    question_text: str | None = None
    prediction_text: str | None = None
    cards: list[dict] | None = None


class TimeCapsuleVerdictRequest(BaseModel):
    accuracy_score: int = Field(ge=1, le=5)
    accuracy_note: str | None = None


@app.get("/")
def root():
    return {"status": "api running"}


@app.get("/api/health")
def health_check():
    """Operator-friendly health probe with version + db connectivity."""
    db_ok = True
    db_error: str | None = None
    try:
        from sqlalchemy import text
        from src.db.session import get_engine

        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:  # pragma: no cover - defensive
        db_ok = False
        db_error = str(exc)[:200]

    return {
        "status": "ok" if db_ok else "degraded",
        "version": APP_VERSION,
        "db": "ok" if db_ok else "error",
        "db_error": db_error,
        "timezone": os.getenv("APP_TIMEZONE", "Asia/Ho_Chi_Minh"),
        "now": datetime.now().isoformat(),
    }


def _user_response(user) -> dict:
    """Standard shape cho /api/auth/* và /api/profile/* response."""
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "username": getattr(user, "username", None),
        "display_name": getattr(user, "display_name", None),
        "avatar_url": getattr(user, "avatar_url", None),
        "bio": getattr(user, "bio", None),
    }


@app.post("/api/auth/register")
async def auth_register(req: RegisterRequest, request: Request):
    enforce_rate_limit(request=request, scope="auth_register", max_hits=5, window_seconds=60)
    # Bảo mật: KHÔNG cho client tự chọn role. Đăng ký công khai LUÔN là 'member';
    # tài khoản admin chỉ được tạo qua seeding/DB, không qua API công khai.
    try:
        user = register_user(
            email=req.email,
            password=req.password,
            username=req.username,
            display_name=req.display_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _user_response(user)


@app.post("/api/auth/login")
async def auth_login(req: LoginRequest, request: Request):
    enforce_rate_limit(request=request, scope="auth_login", max_hits=10, window_seconds=60)
    raw_identifier = (req.identifier or req.email or "").strip()
    if not raw_identifier:
        raise HTTPException(status_code=400, detail="missing username/email")
    try:
        user, token = authenticate_user_by_identifier(
            identifier=raw_identifier,
            password=req.password,
        )
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _user_response(user),
    }


@app.get("/api/auth/me")
async def auth_me(current_user: CurrentUser = Depends(get_current_user)):
    return _user_response(current_user)


@app.post("/api/auth/forgot-password")
async def auth_forgot_password(req: ForgotPasswordRequest, request: Request):
    enforce_rate_limit(
        request=request,
        scope="auth_forgot_password",
        max_hits=5,
        window_seconds=60,
    )
    try:
        found, dev_token, expires_at = request_password_reset(email=req.email)
    except Exception as exc:  # pragma: no cover - defensive
        LOGGER.warning("forgot-password failed: %s", exc)
        found = False
        dev_token = None
        expires_at = None

    # Response giống nhau dù email tồn tại hay không để chống enumeration.
    response: dict = {
        "message": "Nếu email tồn tại, hệ thống đã gửi hướng dẫn đặt lại mật khẩu.",
    }
    if dev_token:
        response["dev_only_token"] = dev_token
        response["expires_at"] = expires_at.isoformat() if expires_at else None
    return response


@app.post("/api/auth/reset-password")
async def auth_reset_password(req: ResetPasswordRequest, request: Request):
    enforce_rate_limit(
        request=request,
        scope="auth_reset_password",
        max_hits=5,
        window_seconds=60,
    )
    try:
        reset_password_with_token(token=req.token, new_password=req.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"message": "Mật khẩu đã được đặt lại thành công."}


@app.post("/api/auth/google")
async def auth_google(req: GoogleLoginRequest, request: Request):
    enforce_rate_limit(request=request, scope="auth_google", max_hits=10, window_seconds=60)
    try:
        user, token = authenticate_with_google(id_token_str=req.id_token)
    except RuntimeError as exc:
        # Config / library lỗi → 503 để client biết phía server thiếu thiết lập.
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _user_response(user),
    }


@app.get("/api/profile/me")
async def profile_me(current_user: CurrentUser = Depends(get_current_user)):
    return _user_response(current_user)


@app.patch("/api/profile/me")
@app.post("/api/profile/me")
async def profile_update(
    req: ProfileUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        updated = update_user_profile(
            user_id=current_user.id,
            payload=ProfileUpdatePayload(
                display_name=req.display_name,
                avatar_url=req.avatar_url,
                bio=req.bio,
                username=req.username,
            ),
        )
    except ValueError as exc:
        # username conflict → 409, lỗi khác → 400
        message = str(exc)
        status = 409 if "username already" in message else 400
        raise HTTPException(status_code=status, detail=message) from exc
    return _user_response(updated)


def _ask_rate_limit_config() -> tuple[int, int]:
    """Per-IP budget for the LLM-backed /api/ask* endpoints.

    Defaults: 20 lượt mỗi 60 giây. Có thể override bằng env var.
    """
    try:
        max_hits = int(os.getenv("ASK_RATE_LIMIT_MAX", "20"))
    except ValueError:
        max_hits = 20
    try:
        window_seconds = int(os.getenv("ASK_RATE_LIMIT_WINDOW", "60"))
    except ValueError:
        window_seconds = 60
    return max_hits, window_seconds


def _enforce_ask_rate_limit(request: Request, scope: str = "ask") -> None:
    # Hỗ trợ unit test gọi hàm trực tiếp với request=None.
    if request is None:
        return
    max_hits, window_seconds = _ask_rate_limit_config()
    enforce_rate_limit(
        request=request,
        scope=scope,
        max_hits=max_hits,
        window_seconds=window_seconds,
    )


@app.post("/api/ask")
async def ask(req: QuestionRequest, request: Request):
    _enforce_ask_rate_limit(request, scope="ask")
    clean_spread = _normalize_spread_type(req.spread_type)
    reminder_days = _normalize_rating_reminder_days(req.rating_reminder_days)
    result = _get_pipeline().run_pipeline(
        question=req.question,
        audio_path=req.audio_path,
        image_paths=req.image_paths,
        spread_type=clean_spread,
        random_draw=req.random_draw,
    )
    # Bảo mật: lấy user_id từ JWT (nếu có), KHÔNG tin req.user_id do client tự khai.
    session_id = persist_reading_result(
        question=req.question,
        result=result,
        user_id=resolve_optional_user_id(request),
        rating_reminder_days=reminder_days,
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
    rating_reminder_days: int,
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
            rating_reminder_days=_normalize_rating_reminder_days(rating_reminder_days),
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
    request: Request,
    question: str = Form(...),
    spread_type: str = Form("three"),
    random_draw: str | bool = Form(False),
    rating_reminder_days: int = Form(7),
    image: List[UploadFile] | None = File(default=None),
    audio: UploadFile | None = File(default=None),
):
    _enforce_ask_rate_limit(request, scope="ask_with_media")
    return _run_pipeline_from_uploads(
        question=question,
        # Bảo mật: user_id lấy từ JWT, KHÔNG nhận từ form do client tự khai.
        user_id=resolve_optional_user_id(request),
        spread_type=spread_type,
        random_draw=_as_bool(random_draw),
        rating_reminder_days=rating_reminder_days,
        image_files=image or [],
        audio_file=audio,
    )


@app.post("/api/ask_with_image")
async def ask_with_image(
    request: Request,
    question: str = Form(...),
    spread_type: str = Form("three"),
    rating_reminder_days: int = Form(7),
    image: List[UploadFile] = File(...),
):
    _enforce_ask_rate_limit(request, scope="ask_with_image")
    return _run_pipeline_from_uploads(
        question=question,
        # Bảo mật: user_id lấy từ JWT, KHÔNG nhận từ form do client tự khai.
        user_id=resolve_optional_user_id(request),
        spread_type=spread_type,
        random_draw=False,
        rating_reminder_days=rating_reminder_days,
        image_files=image,
        audio_file=None,
    )


@app.get("/api/sessions")
async def list_sessions(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Danh sách session của user hiện tại — newest first.

    Trả id + question_text + created_at + status + số lá rút để FE hiển thị
    sidebar history mà không cần cache thủ công.
    """
    from sqlalchemy import func as sa_func
    from src.db.models import ReadingSession, RecognizedCard
    from src.db.session import session_scope

    with session_scope() as session:
        total = (
            session.scalar(
                sa.select(sa_func.count())
                .select_from(ReadingSession)
                .where(ReadingSession.user_id == current_user.id)
            )
            or 0
        )

        rows = (
            session.scalars(
                sa.select(ReadingSession)
                .where(ReadingSession.user_id == current_user.id)
                .order_by(ReadingSession.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
            .all()
        )

        items: list[dict] = []
        for row in rows:
            card_count = (
                session.scalar(
                    sa.select(sa_func.count())
                    .select_from(RecognizedCard)
                    .where(RecognizedCard.session_id == row.id)
                )
                or 0
            )
            items.append(
                {
                    "id": row.id,
                    "question_text": row.question_text,
                    "status": row.status,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                    "card_count": int(card_count),
                }
            )

    return {"items": items, "total": int(total), "limit": limit, "offset": offset}


@app.get("/api/sessions/{session_id}")
async def get_session_detail(
    session_id: int,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Detail 1 session: card đã rút + final answer."""
    from src.db.models import ReadingSession, RecognizedCard, TarotCard, Reading
    from src.db.session import session_scope

    with session_scope() as session:
        row = session.get(ReadingSession, session_id)
        if row is None or row.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="session not found")

        card_rows = session.execute(
            sa.select(RecognizedCard, TarotCard)
            .join(TarotCard, RecognizedCard.card_id == TarotCard.id)
            .where(RecognizedCard.session_id == row.id)
            .order_by(RecognizedCard.order_index.nullslast(), RecognizedCard.id)
        ).all()

        cards = [
            {
                "name": card.name,
                "orientation": rec.orientation,
                "position": rec.position_label,
                "confidence": rec.confidence,
            }
            for rec, card in card_rows
        ]

        reading = session.scalar(sa.select(Reading).where(Reading.session_id == row.id))

        return {
            "id": row.id,
            "question_text": row.question_text,
            "audio_transcript": row.audio_transcript,
            "status": row.status,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "cards": cards,
            "final_answer": reading.generated_text if reading else None,
            "llm_model": reading.llm_model if reading else None,
        }


@app.post("/api/sessions/{session_id}/followup")
async def followup(
    session_id: int,
    req: FollowupRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    owner_id = _ensure_session_owner_or_admin(current_user, session_id)
    try:
        return add_followup_turn(
            session_id=session_id,
            user_id=owner_id,
            message=req.message,
        )
    except ValueError as exc:
        message = str(exc)
        if "empty" in message:
            raise HTTPException(status_code=400, detail=message) from exc
        raise HTTPException(status_code=404, detail=message) from exc


@app.get("/api/sessions/{session_id}/conversation")
async def conversation(
    session_id: int,
    limit: int = Query(default=20, ge=1, le=200),
    current_user: CurrentUser = Depends(get_current_user),
):
    _ensure_session_owner_or_admin(current_user, session_id)
    return {
        "session_id": session_id,
        "turns": get_conversation_turns(session_id=session_id, limit=limit),
    }


@app.get("/api/question_suggestions")
async def question_suggestions(user_id: int | None = Query(default=None), limit: int = Query(default=3, ge=1, le=10)):
    suggestions = generate_question_suggestions(user_id=user_id, limit=limit)
    return {"suggestions": suggestions}


@app.post("/api/spread/recommend")
async def spread_recommend(req: SpreadRecommendationRequest):
    return recommend_spread(req.question)


@app.post("/api/readings/{session_id}/rating")
async def submit_rating(
    session_id: int,
    req: RatingRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    _ensure_session_owner_or_admin(current_user, session_id)
    try:
        return save_rating(session_id=session_id, score=req.score, note=req.note)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/users/{user_id}/pending_ratings")
async def pending_ratings(
    user_id: int,
    limit: int = Query(default=20, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
):
    _ensure_self_or_admin(current_user, user_id)
    rows = list_pending_ratings(user_id=user_id, limit=limit)
    return {"user_id": user_id, "items": rows}


@app.get("/api/users/{user_id}/archetype_profile")
async def archetype_profile(user_id: int, current_user: CurrentUser = Depends(get_current_user)):
    _ensure_self_or_admin(current_user, user_id)
    profile = get_user_archetype_profile(user_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="archetype profile not found")
    return profile


@app.get("/api/users/{user_id}/oracle_reports")
async def oracle_reports(
    user_id: int,
    limit: int = Query(default=12, ge=1, le=50),
    current_user: CurrentUser = Depends(get_current_user),
):
    _ensure_self_or_admin(current_user, user_id)
    return {"items": list_oracle_reports(user_id=user_id, limit=limit)}


@app.get("/api/users/{user_id}/oracle_reports/latest")
async def oracle_report_latest(user_id: int, current_user: CurrentUser = Depends(get_current_user)):
    _ensure_self_or_admin(current_user, user_id)
    row = latest_oracle_report(user_id=user_id)
    if row is None:
        raise HTTPException(status_code=404, detail="oracle report not found")
    return row


@app.post("/api/duo/sessions")
async def duo_create(current_user: CurrentUser = Depends(get_current_user)):
    payload = create_duo_session(current_user.id)
    await DUO_WS_MANAGER.broadcast(payload["id"], {"type": "duo_created", "data": payload})
    return payload


@app.post("/api/duo/sessions/{duo_session_id}/join")
async def duo_join(duo_session_id: int, current_user: CurrentUser = Depends(get_current_user)):
    try:
        payload = join_duo_session(duo_session_id=duo_session_id, user_id=current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await DUO_WS_MANAGER.broadcast(duo_session_id, {"type": "duo_joined", "data": payload})
    return payload


@app.post("/api/duo/sessions/join_by_invite")
async def duo_join_by_invite(req: JoinByInviteRequest, current_user: CurrentUser = Depends(get_current_user)):
    try:
        payload = join_duo_by_invite(invite_code=req.invite_code, user_id=current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await DUO_WS_MANAGER.broadcast(payload["id"], {"type": "duo_joined", "data": payload})
    return payload


@app.post("/api/duo/sessions/{duo_session_id}/card")
async def duo_submit_card(
    duo_session_id: int,
    image: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
):
    upload_dir = Path(os.getenv("API_UPLOAD_DIR", "tmp_uploads"))
    upload_dir.mkdir(parents=True, exist_ok=True)
    save_path = _save_upload(upload_dir, image)
    try:
        payload = submit_duo_card(
            duo_session_id=duo_session_id,
            user_id=current_user.id,
            image_path=save_path,
            predictor=_get_pipeline().card_predictor,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        if os.path.exists(save_path):
            os.remove(save_path)
    await DUO_WS_MANAGER.broadcast(duo_session_id, {"type": "duo_updated", "data": payload})
    return payload


@app.get("/api/duo/sessions/{duo_session_id}")
async def duo_get(duo_session_id: int, current_user: CurrentUser = Depends(get_current_user)):
    try:
        return get_duo_session(duo_session_id=duo_session_id, user_id=current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.websocket("/ws/duo/{duo_session_id}")
async def duo_ws(duo_session_id: int, websocket: WebSocket):
    try:
        current_user = get_websocket_user(websocket)
        snapshot = get_duo_session(duo_session_id=duo_session_id, user_id=current_user.id)
    except HTTPException:
        await websocket.close(code=4401)
        return
    except ValueError:
        await websocket.close(code=4403)
        return

    await DUO_WS_MANAGER.connect(duo_session_id, websocket)
    try:
        await websocket.send_json({"type": "snapshot", "data": snapshot, "server_time": datetime.now().isoformat()})
        while True:
            message = await websocket.receive_text()
            if message.strip().lower() == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        await DUO_WS_MANAGER.disconnect(duo_session_id, websocket)


@app.post("/api/community/posts")
async def community_create(req: CommunityPostRequest, current_user: CurrentUser = Depends(get_current_user)):
    try:
        return create_community_post(
            user_id=current_user.id,
            question_text=req.question_text,
            card_summary=req.card_summary,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/community/feed")
async def community_feed(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
):
    return list_community_feed(page=page, page_size=page_size)


@app.post("/api/community/posts/{post_id}/interpretations")
async def community_add_interpretation(
    post_id: int,
    req: InterpretationRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        return add_interpretation(user_id=current_user.id, post_id=post_id, content=req.content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/community/interpretations/{interpretation_id}/vote")
async def community_vote(interpretation_id: int, current_user: CurrentUser = Depends(get_current_user)):
    try:
        return vote_interpretation(user_id=current_user.id, interpretation_id=interpretation_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/community/interpretations/{interpretation_id}/resonate")
async def community_resonate(interpretation_id: int, current_user: CurrentUser = Depends(get_current_user)):
    try:
        return resonate_interpretation(user_id=current_user.id, interpretation_id=interpretation_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/admin/community/moderation_queue")
async def admin_moderation_queue(
    limit: int = Query(default=50, ge=1, le=200),
    _admin: CurrentUser = Depends(get_current_admin),
):
    return {"items": moderation_queue(limit=limit)}


@app.post("/api/admin/community/posts/{post_id}/approve")
async def admin_approve_post(
    post_id: int,
    req: ModerationRequest,
    admin: CurrentUser = Depends(get_current_admin),
):
    try:
        return moderate_post(
            admin_user_id=admin.id,
            post_id=post_id,
            action="approve",
            reason=req.reason,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/admin/community/posts/{post_id}/reject")
async def admin_reject_post(
    post_id: int,
    req: ModerationRequest,
    admin: CurrentUser = Depends(get_current_admin),
):
    try:
        return moderate_post(
            admin_user_id=admin.id,
            post_id=post_id,
            action="reject",
            reason=req.reason,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/dreams")
async def dreams_create(
    raw_text: str | None = Form(default=None),
    audio: UploadFile | None = File(default=None),
    current_user: CurrentUser = Depends(get_current_user),
):
    if not (raw_text and raw_text.strip()) and audio is None:
        raise HTTPException(status_code=400, detail="raw_text or audio is required")
    upload_dir = Path(os.getenv("API_UPLOAD_DIR", "tmp_uploads"))
    upload_dir.mkdir(parents=True, exist_ok=True)
    audio_path: str | None = None
    try:
        if audio is not None:
            audio_path = _save_upload(upload_dir, audio)
        return create_dream_entry(
            user_id=current_user.id,
            raw_text=raw_text,
            audio_path=audio_path,
        )
    finally:
        if audio_path and os.path.exists(audio_path):
            os.remove(audio_path)


@app.get("/api/dreams")
async def dreams_list(
    limit: int = Query(default=20, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
):
    return {"items": list_dream_entries(user_id=current_user.id, limit=limit)}


@app.get("/api/dreams/{dream_id}")
async def dreams_detail(dream_id: int, current_user: CurrentUser = Depends(get_current_user)):
    row = get_dream_entry(user_id=current_user.id, dream_id=dream_id)
    if row is None:
        raise HTTPException(status_code=404, detail="dream entry not found")
    return row


# =============================
# Daily Card + Streak (gamified daily engagement)
# =============================


@app.get("/api/daily-card/today")
async def daily_card_today(current_user: CurrentUser = Depends(get_current_user)):
    record = get_today_card(user_id=current_user.id)
    return {"item": record}


@app.post("/api/daily-card/draw")
async def daily_card_draw(
    req: DailyCardDrawRequest | None = None,
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        record = draw_today_card(
            user_id=current_user.id,
            mood_pre=(req.mood_pre if req else None),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return record


@app.post("/api/daily-card/{daily_card_id}/reflect")
async def daily_card_reflect(
    daily_card_id: int,
    req: DailyCardReflectionRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        return add_reflection(
            user_id=current_user.id,
            daily_card_id=daily_card_id,
            reflection=req.reflection,
            mood_post=req.mood_post,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/daily-card/streak")
async def daily_card_streak(current_user: CurrentUser = Depends(get_current_user)):
    return get_streak(user_id=current_user.id)


@app.get("/api/daily-card/history")
async def daily_card_history(
    limit: int = Query(default=30, ge=1, le=180),
    current_user: CurrentUser = Depends(get_current_user),
):
    return {"items": list_daily_history(user_id=current_user.id, limit=limit)}


# =============================
# Time Capsule (long-horizon prediction)
# =============================


@app.post("/api/time-capsules")
async def time_capsule_create(
    req: TimeCapsuleCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        return create_capsule(
            user_id=current_user.id,
            title=req.title,
            question_text=req.question_text,
            prediction_text=req.prediction_text,
            reveal_at_iso=req.reveal_at,
            cards=req.cards,
            session_id=req.session_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/time-capsules")
async def time_capsule_list(
    revealed_only: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    current_user: CurrentUser = Depends(get_current_user),
):
    return {
        "items": list_capsules(
            user_id=current_user.id,
            include_revealed_only=revealed_only,
            limit=limit,
        )
    }


@app.get("/api/time-capsules/{capsule_id}")
async def time_capsule_detail(
    capsule_id: int,
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        return get_capsule(user_id=current_user.id, capsule_id=capsule_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/time-capsules/{capsule_id}/reveal")
async def time_capsule_reveal(
    capsule_id: int,
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        return open_capsule(user_id=current_user.id, capsule_id=capsule_id)
    except ValueError as exc:
        message = str(exc)
        status = 400 if "sealed" in message else 404
        raise HTTPException(status_code=status, detail=message) from exc


@app.post("/api/time-capsules/{capsule_id}/verdict")
async def time_capsule_verdict(
    capsule_id: int,
    req: TimeCapsuleVerdictRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        return submit_verdict(
            user_id=current_user.id,
            capsule_id=capsule_id,
            accuracy_score=req.accuracy_score,
            accuracy_note=req.accuracy_note,
        )
    except ValueError as exc:
        message = str(exc)
        status = 400 if "sealed" in message or "between" in message else 404
        raise HTTPException(status_code=status, detail=message) from exc


# =============================
# Affirmations (no auth required - widget-friendly)
# =============================


@app.get("/api/affirmations/{card_name}")
async def affirmations_for_card(card_name: str, orientation: str = Query(default="upright")):
    return generate_affirmation(card_name=card_name, orientation=orientation)
