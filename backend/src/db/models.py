"""Định nghĩa 24 bảng ORM (SQLAlchemy 2.0) của toàn hệ thống.

Gồm: lõi đọc bài (users, tarot_cards, reading_sessions, recognized_cards, readings,
conversation_turns, rating_reminders), phân tích (archetype, oracle, analytics), đọc
bài đôi (duo_*), cộng đồng (community_*), và tính năng khác (dream_entries,
daily_cards, daily_deep_readings, time_capsules, notifications…). Toàn vẹn dữ liệu nhờ
CheckConstraint (enum trạng thái), UniqueConstraint (chống trùng) và ForeignKey với
ondelete CASCADE (xoá kèm) hoặc SET NULL (giữ lịch sử khi user/khách bị xoá).
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    username: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="member", server_default="member")
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    reset_token: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    reset_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    reading_sessions: Mapped[list["ReadingSession"]] = relationship(
        back_populates="user",
        passive_deletes=True,
    )
    rating_reminders: Mapped[list["RatingReminder"]] = relationship(
        back_populates="user",
        passive_deletes=True,
    )
    archetype_profile: Mapped["UserArchetypeProfile | None"] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )
    oracle_reports: Mapped[list["OracleReport"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    duo_sessions_owned: Mapped[list["DuoSession"]] = relationship(
        back_populates="owner_user",
        passive_deletes=True,
    )
    duo_participations: Mapped[list["DuoParticipant"]] = relationship(
        back_populates="user",
        passive_deletes=True,
    )
    community_posts: Mapped[list["CommunityPost"]] = relationship(
        back_populates="user",
        passive_deletes=True,
    )
    community_interpretations: Mapped[list["CommunityInterpretation"]] = relationship(
        back_populates="user",
        passive_deletes=True,
    )
    community_votes: Mapped[list["CommunityVote"]] = relationship(
        back_populates="user",
        passive_deletes=True,
    )
    moderation_actions: Mapped[list["CommunityModerationLog"]] = relationship(
        back_populates="admin_user",
        passive_deletes=True,
    )
    dream_entries: Mapped[list["DreamEntry"]] = relationship(
        back_populates="user",
        passive_deletes=True,
    )
    daily_cards: Mapped[list["DailyCard"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    time_capsules: Mapped[list["TimeCapsule"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class TarotCard(Base):
    __tablename__ = "tarot_cards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    arcana_type: Mapped[str] = mapped_column(String(32), nullable=False)
    suit: Mapped[str | None] = mapped_column(String(32), nullable=True)
    number: Mapped[int | None] = mapped_column(Integer, nullable=True)

    recognized_cards: Mapped[list["RecognizedCard"]] = relationship(back_populates="card")


class ReadingSession(Base):
    __tablename__ = "reading_sessions"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'processing', 'completed', 'failed')",
            name="ck_reading_sessions_status",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    audio_transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    emotion_state: Mapped[str | None] = mapped_column(String(32), nullable=True)
    emotion_signal_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="completed", server_default="completed")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user: Mapped[User | None] = relationship(back_populates="reading_sessions")
    recognized_cards: Mapped[list["RecognizedCard"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    conversation_turns: Mapped[list["ConversationTurn"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ConversationTurn.turn_index",
    )
    rating_reminders: Mapped[list["RatingReminder"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    reading: Mapped["Reading | None"] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )


class RecognizedCard(Base):
    __tablename__ = "recognized_cards"
    __table_args__ = (
        CheckConstraint(
            "orientation IN ('upright', 'reversed')",
            name="ck_recognized_cards_orientation",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("reading_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    card_id: Mapped[int] = mapped_column(ForeignKey("tarot_cards.id"), nullable=False, index=True)
    orientation: Mapped[str] = mapped_column(String(16), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    position_label: Mapped[str | None] = mapped_column(String(64), nullable=True)
    order_index: Mapped[int | None] = mapped_column(Integer, nullable=True)

    session: Mapped[ReadingSession] = relationship(back_populates="recognized_cards")
    card: Mapped[TarotCard] = relationship(back_populates="recognized_cards")


class Reading(Base):
    __tablename__ = "readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("reading_sessions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    generated_text: Mapped[str] = mapped_column(Text, nullable=False)
    llm_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    accuracy_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    accuracy_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    rated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    session: Mapped[ReadingSession] = relationship(back_populates="reading")


class ConversationTurn(Base):
    __tablename__ = "conversation_turns"
    __table_args__ = (
        CheckConstraint(
            "role IN ('user', 'assistant', 'system')",
            name="ck_conversation_turns_role",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("reading_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    turn_index: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    session: Mapped[ReadingSession] = relationship(back_populates="conversation_turns")


class RatingReminder(Base):
    __tablename__ = "rating_reminders"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'sent', 'failed', 'rated', 'skipped')",
            name="ck_rating_reminders_status",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("reading_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    remind_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending", server_default="pending")
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    session: Mapped[ReadingSession] = relationship(back_populates="rating_reminders")
    user: Mapped[User | None] = relationship(back_populates="rating_reminders")


class UserArchetypeProfile(Base):
    __tablename__ = "user_archetype_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    soul_card: Mapped[str] = mapped_column(String(120), nullable=False)
    top_keywords_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]", server_default="[]")
    pattern_summary: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user: Mapped[User] = relationship(back_populates="archetype_profile")


class OracleReport(Base):
    __tablename__ = "oracle_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    summary_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}", server_default="{}")
    narrative_text: Mapped[str] = mapped_column(Text, nullable=False)
    delivered_email_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user: Mapped[User] = relationship(back_populates="oracle_reports")


class DuoSession(Base):
    __tablename__ = "duo_sessions"
    __table_args__ = (
        CheckConstraint(
            "status IN ('waiting_partner', 'waiting_cards', 'both_ready', 'generating', 'completed', 'failed')",
            name="ck_duo_sessions_status",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    invite_code: Mapped[str] = mapped_column(String(32), nullable=False, unique=True, index=True)
    owner_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="waiting_partner",
        server_default="waiting_partner",
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    owner_user: Mapped[User] = relationship(back_populates="duo_sessions_owned")
    participants: Mapped[list["DuoParticipant"]] = relationship(
        back_populates="duo_session",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    cards: Mapped[list["DuoCard"]] = relationship(
        back_populates="duo_session",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    reading: Mapped["DuoReading | None"] = relationship(
        back_populates="duo_session",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )


class DuoParticipant(Base):
    __tablename__ = "duo_participants"
    __table_args__ = (
        UniqueConstraint("duo_session_id", "slot_label", name="uq_duo_participants_session_slot"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    duo_session_id: Mapped[int] = mapped_column(
        ForeignKey("duo_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    slot_label: Mapped[str] = mapped_column(String(8), nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    duo_session: Mapped[DuoSession] = relationship(back_populates="participants")
    user: Mapped[User | None] = relationship(back_populates="duo_participations")
    cards: Mapped[list["DuoCard"]] = relationship(back_populates="participant")


class DuoCard(Base):
    __tablename__ = "duo_cards"
    __table_args__ = (
        # Mỗi người chơi chỉ được nộp 1 lá trong 1 phiên — chặn double-click ở tầng DB
        # (trước đây chỉ chặn ở tầng ứng dụng nên đua/đúp request có thể chèn 2 lá).
        UniqueConstraint(
            "duo_session_id", "participant_id", name="uq_duo_card_session_participant"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    duo_session_id: Mapped[int] = mapped_column(
        ForeignKey("duo_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    participant_id: Mapped[int] = mapped_column(
        ForeignKey("duo_participants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    card_name: Mapped[str] = mapped_column(String(120), nullable=False)
    orientation: Mapped[str] = mapped_column(String(16), nullable=False, default="upright", server_default="upright")
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0, server_default="0")
    image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    duo_session: Mapped[DuoSession] = relationship(back_populates="cards")
    participant: Mapped[DuoParticipant] = relationship(back_populates="cards")


class DuoReading(Base):
    __tablename__ = "duo_readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    duo_session_id: Mapped[int] = mapped_column(
        ForeignKey("duo_sessions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    generated_text: Mapped[str] = mapped_column(Text, nullable=False)
    llm_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    duo_session: Mapped[DuoSession] = relationship(back_populates="reading")


class CommunityPost(Base):
    __tablename__ = "community_posts"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'approved', 'rejected')",
            name="ck_community_posts_status",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    card_summary_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]", server_default="[]")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending", server_default="pending")
    anonymous_alias: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[User | None] = relationship(back_populates="community_posts")
    interpretations: Mapped[list["CommunityInterpretation"]] = relationship(
        back_populates="post",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    moderation_logs: Mapped[list["CommunityModerationLog"]] = relationship(
        back_populates="post",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class CommunityInterpretation(Base):
    __tablename__ = "community_interpretations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(
        ForeignKey("community_posts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    vote_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    resonated_by_post_owner: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    post: Mapped[CommunityPost] = relationship(back_populates="interpretations")
    user: Mapped[User | None] = relationship(back_populates="community_interpretations")
    votes: Mapped[list["CommunityVote"]] = relationship(
        back_populates="interpretation",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class CommunityVote(Base):
    __tablename__ = "community_votes"
    __table_args__ = (
        UniqueConstraint("interpretation_id", "user_id", name="uq_community_votes_interp_user"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    interpretation_id: Mapped[int] = mapped_column(
        ForeignKey("community_interpretations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    interpretation: Mapped[CommunityInterpretation] = relationship(back_populates="votes")
    user: Mapped[User] = relationship(back_populates="community_votes")


class CommunityModerationLog(Base):
    __tablename__ = "community_moderation_logs"
    __table_args__ = (
        CheckConstraint(
            "action IN ('approve', 'reject')",
            name="ck_community_moderation_logs_action",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(
        ForeignKey("community_posts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    admin_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action: Mapped[str] = mapped_column(String(16), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    post: Mapped[CommunityPost] = relationship(back_populates="moderation_logs")
    admin_user: Mapped[User | None] = relationship(back_populates="moderation_actions")


class DreamEntry(Base):
    __tablename__ = "dream_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    symbols_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]", server_default="[]")
    mapped_arcana_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]", server_default="[]")
    matches_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]", server_default="[]")
    # Diễn giải tổng hợp (RAG/LLM + fallback) cho giấc mơ: object JSON gồm
    # summary_interpretation, main_theme, emotional_tone, reflection_questions,
    # suggested_action, recent_reading_connections, llm_model, source, warnings.
    # Nullable: giấc mơ cũ chưa có field này -> null, frontend xử lý an toàn.
    interpretation_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user: Mapped[User | None] = relationship(back_populates="dream_entries")


class DailyCard(Base):
    """One card per user per local day, with streak tracking."""

    __tablename__ = "daily_cards"
    __table_args__ = (
        UniqueConstraint("user_id", "draw_date", name="uq_daily_cards_user_date"),
        CheckConstraint(
            "orientation IN ('upright', 'reversed')",
            name="ck_daily_cards_orientation",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    draw_date: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    card_id: Mapped[int] = mapped_column(ForeignKey("tarot_cards.id"), nullable=False, index=True)
    card_name: Mapped[str] = mapped_column(String(120), nullable=False)
    orientation: Mapped[str] = mapped_column(String(16), nullable=False, default="upright", server_default="upright")
    keywords_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]", server_default="[]")
    mood_pre: Mapped[str | None] = mapped_column(String(32), nullable=True)
    mood_post: Mapped[str | None] = mapped_column(String(32), nullable=True)
    reflection: Mapped[str | None] = mapped_column(Text, nullable=True)
    streak_at_draw: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    affirmation: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user: Mapped[User] = relationship(back_populates="daily_cards")


class DailyDeepReading(Base):
    """Luận giải sâu (RAG + LLM) cho lá Daily Card, theo (user, ngày, chủ đề).

    CHỈ sinh khi user bấm nút; được cache theo (user_id, draw_date, topic) để bấm
    lại cùng chủ đề trong ngày KHÔNG gọi lại LLM. Quan hệ một chiều (không thêm
    back_populates lên User/DailyCard) để giữ thay đổi tối thiểu, đồng nhất với các
    bảng phase-1 phía dưới.
    """

    __tablename__ = "daily_deep_readings"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "draw_date", "topic", name="uq_daily_deep_readings_user_date_topic"
        ),
        CheckConstraint(
            "orientation IN ('upright', 'reversed')",
            name="ck_daily_deep_readings_orientation",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    daily_card_id: Mapped[int] = mapped_column(
        ForeignKey("daily_cards.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    draw_date: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    # Chủ đề tự do người dùng nhập (không còn giới hạn enum); đủ dài cho một cụm câu ngắn.
    topic: Mapped[str] = mapped_column(String(64), nullable=False)
    card_name: Mapped[str] = mapped_column(String(120), nullable=False)
    orientation: Mapped[str] = mapped_column(
        String(16), nullable=False, default="upright", server_default="upright"
    )
    deep_reading: Mapped[str] = mapped_column(Text, nullable=False)
    llm_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    warnings_json: Mapped[str] = mapped_column(
        Text, nullable=False, default="[]", server_default="[]"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class TimeCapsule(Base):
    """A user-locked prediction that reveals on a future date."""

    __tablename__ = "time_capsules"
    __table_args__ = (
        CheckConstraint(
            "status IN ('sealed', 'revealed', 'verified')",
            name="ck_time_capsules_status",
        ),
        CheckConstraint(
            "accuracy_score IS NULL OR (accuracy_score >= 1 AND accuracy_score <= 5)",
            name="ck_time_capsules_accuracy_score",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    session_id: Mapped[int | None] = mapped_column(
        ForeignKey("reading_sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    prediction_text: Mapped[str] = mapped_column(Text, nullable=False)
    cards_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]", server_default="[]")
    reveal_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="sealed", server_default="sealed")
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    accuracy_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    accuracy_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    notify_email_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user: Mapped[User] = relationship(back_populates="time_capsules")


# =============================
# Phase-1 retention + đo lường (notifications + analytics)
# Các bảng dưới đây độc lập, FK trỏ tới users; KHÔNG thêm back_populates lên User để
# giữ thay đổi tối thiểu (quan hệ một chiều là đủ cho nhu cầu hiện tại).
# =============================


class NotificationPreference(Base):
    """Cấu hình thông báo cho mỗi user (mỗi user tối đa 1 dòng)."""

    __tablename__ = "notification_preferences"
    __table_args__ = (
        CheckConstraint(
            "daily_card_hour >= 0 AND daily_card_hour <= 23",
            name="ck_notification_preferences_hour",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    daily_card_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    daily_card_hour: Mapped[int] = mapped_column(Integer, nullable=False, default=8, server_default="8")
    email_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    # timezone override; null = dùng APP_TIMEZONE toàn cục.
    timezone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class Notification(Base):
    """Thông báo in-app + đồng thời là sổ ghi (audit) cho lần gửi email tương ứng."""

    __tablename__ = "notifications"
    __table_args__ = (
        CheckConstraint(
            "type IN ('daily_card', 'oracle', 'archetype', 'rating', 'custom')",
            name="ck_notifications_type",
        ),
        CheckConstraint(
            "status IN ('pending', 'sent', 'failed', 'skipped', 'read')",
            name="ck_notifications_status",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending", server_default="pending")
    scheduled_for: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )


class AnalyticsEvent(Base):
    """Sự kiện funnel tối thiểu để đo loop. Best-effort, không bao giờ chặn luồng chính."""

    __tablename__ = "analytics_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    event: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    props_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
