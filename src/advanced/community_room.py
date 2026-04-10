from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy import select

from src.db.models import (
    CommunityInterpretation,
    CommunityModerationLog,
    CommunityPost,
    CommunityVote,
)
from src.db.session import session_scope


def _post_payload(row: CommunityPost) -> dict:
    try:
        cards = json.loads(row.card_summary_json or "[]")
    except Exception:
        cards = []
    return {
        "id": row.id,
        "question_text": row.question_text,
        "card_summary": cards,
        "status": row.status,
        "anonymous_alias": row.anonymous_alias,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def create_community_post(*, user_id: int, question_text: str, card_summary: list[dict] | None = None) -> dict:
    clean_question = (question_text or "").strip()
    if not clean_question:
        raise ValueError("question_text is required")
    summary = card_summary or []

    with session_scope() as session:
        row = CommunityPost(
            user_id=user_id,
            question_text=clean_question,
            card_summary_json=json.dumps(summary, ensure_ascii=False),
            status="pending",
        )
        session.add(row)
        session.flush()
        row.anonymous_alias = f"Seeker-{row.id:04d}"
        session.flush()
        payload = _post_payload(row)
    return payload


def list_community_feed(page: int = 1, page_size: int = 20) -> dict:
    page = max(1, page)
    page_size = max(1, min(page_size, 50))
    offset = (page - 1) * page_size

    with session_scope() as session:
        posts = session.scalars(
            select(CommunityPost)
            .where(CommunityPost.status == "approved")
            .order_by(CommunityPost.created_at.desc())
            .offset(offset)
            .limit(page_size)
        ).all()

    items: list[dict] = []
    for post in posts:
        post_payload = _post_payload(post)
        with session_scope() as session:
            interpretations = session.scalars(
                select(CommunityInterpretation)
                .where(CommunityInterpretation.post_id == post.id)
                .order_by(CommunityInterpretation.vote_count.desc(), CommunityInterpretation.created_at.asc())
                .limit(20)
            ).all()
        post_payload["interpretations"] = [
            {
                "id": row.id,
                "content": row.content,
                "vote_count": row.vote_count,
                "resonated_by_post_owner": bool(row.resonated_by_post_owner),
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in interpretations
        ]
        items.append(post_payload)
    return {"page": page, "page_size": page_size, "items": items}


def add_interpretation(*, user_id: int, post_id: int, content: str) -> dict:
    clean_content = (content or "").strip()
    if not clean_content:
        raise ValueError("content is required")
    with session_scope() as session:
        post = session.scalar(select(CommunityPost).where(CommunityPost.id == post_id))
        if post is None:
            raise ValueError("post not found")
        if post.status != "approved":
            raise ValueError("post is not publicly available")
        row = CommunityInterpretation(
            post_id=post_id,
            user_id=user_id,
            content=clean_content,
            vote_count=0,
            resonated_by_post_owner=0,
        )
        session.add(row)
        session.flush()
        return {
            "id": row.id,
            "post_id": post_id,
            "content": row.content,
            "vote_count": row.vote_count,
            "resonated_by_post_owner": bool(row.resonated_by_post_owner),
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }


def vote_interpretation(*, user_id: int, interpretation_id: int) -> dict:
    with session_scope() as session:
        interpretation = session.scalar(
            select(CommunityInterpretation).where(CommunityInterpretation.id == interpretation_id)
        )
        if interpretation is None:
            raise ValueError("interpretation not found")
        existing = session.scalar(
            select(CommunityVote).where(
                CommunityVote.interpretation_id == interpretation_id,
                CommunityVote.user_id == user_id,
            )
        )
        created = False
        if existing is None:
            session.add(CommunityVote(interpretation_id=interpretation_id, user_id=user_id))
            interpretation.vote_count = int(interpretation.vote_count or 0) + 1
            created = True
        session.flush()
        return {
            "interpretation_id": interpretation_id,
            "vote_count": interpretation.vote_count,
            "created": created,
        }


def resonate_interpretation(*, user_id: int, interpretation_id: int) -> dict:
    with session_scope() as session:
        interpretation = session.scalar(
            select(CommunityInterpretation).where(CommunityInterpretation.id == interpretation_id)
        )
        if interpretation is None:
            raise ValueError("interpretation not found")
        post = session.scalar(select(CommunityPost).where(CommunityPost.id == interpretation.post_id))
        if post is None:
            raise ValueError("post not found")
        if post.user_id != user_id:
            raise ValueError("only post owner can mark resonance")
        interpretation.resonated_by_post_owner = 1
        session.flush()
        return {
            "interpretation_id": interpretation_id,
            "resonated_by_post_owner": True,
        }


def moderation_queue(limit: int = 50) -> list[dict]:
    with session_scope() as session:
        rows = session.scalars(
            select(CommunityPost)
            .where(CommunityPost.status == "pending")
            .order_by(CommunityPost.created_at.asc())
            .limit(limit)
        ).all()
    return [_post_payload(row) for row in rows]


def moderate_post(*, admin_user_id: int, post_id: int, action: str, reason: str | None = None) -> dict:
    clean_action = (action or "").strip().lower()
    if clean_action not in {"approve", "reject"}:
        raise ValueError("action must be approve or reject")
    now = datetime.now(timezone.utc)

    with session_scope() as session:
        post = session.scalar(select(CommunityPost).where(CommunityPost.id == post_id))
        if post is None:
            raise ValueError("post not found")
        if clean_action == "approve":
            post.status = "approved"
            post.approved_at = now
        else:
            post.status = "rejected"
            post.rejected_at = now
        session.add(
            CommunityModerationLog(
                post_id=post_id,
                admin_user_id=admin_user_id,
                action=clean_action,
                reason=(reason or "").strip() or None,
            )
        )
        session.flush()
        return _post_payload(post)

