-- =====================================================
-- Tarot LLM Database Schema
-- DDL Initialization
-- =====================================================

DROP TABLE IF EXISTS rag_logs CASCADE;
DROP TABLE IF EXISTS recognized_cards CASCADE;
DROP TABLE IF EXISTS card_meanings CASCADE;
DROP TABLE IF EXISTS media_files CASCADE;
DROP TABLE IF EXISTS feedback CASCADE;
DROP TABLE IF EXISTS generated_readings CASCADE;
DROP TABLE IF EXISTS reading_sessions CASCADE;
DROP TABLE IF EXISTS prompt_templates CASCADE;
DROP TABLE IF EXISTS tarot_cards CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE reading_sessions (
    id SERIAL PRIMARY KEY,

    user_id INT NOT NULL,
    question_text TEXT,
    audio_transcript TEXT,

    status VARCHAR(50),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,

    CONSTRAINT fk_session_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE tarot_cards (
    id SERIAL PRIMARY KEY,

    name VARCHAR(100) NOT NULL,
    arcana_type VARCHAR(50),
    suit VARCHAR(50),
    number INT,

    image_ref VARCHAR(255),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE card_meanings (
    id SERIAL PRIMARY KEY,

    card_id INT NOT NULL,
    orientation VARCHAR(20) NOT NULL,
    context_tag VARCHAR(100),

    meaning_text TEXT,
    source_label VARCHAR(100),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_meaning_card
        FOREIGN KEY (card_id)
        REFERENCES tarot_cards(id)
        ON DELETE CASCADE
);

CREATE TABLE recognized_cards (
    id SERIAL PRIMARY KEY,

    session_id INT NOT NULL,
    card_id INT NOT NULL,

    orientation VARCHAR(20),

    confidence FLOAT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_recognized_session
        FOREIGN KEY (session_id)
        REFERENCES reading_sessions(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_recognized_card
        FOREIGN KEY (card_id)
        REFERENCES tarot_cards(id)
);

CREATE TABLE generated_readings (
    id SERIAL PRIMARY KEY,

    session_id INT NOT NULL,

    model_name VARCHAR(100),

    prompt_template_id INT,

    generated_text TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_reading_session
        FOREIGN KEY (session_id)
        REFERENCES reading_sessions(id)
        ON DELETE CASCADE
);

CREATE TABLE prompt_templates (
    id SERIAL PRIMARY KEY,

    name VARCHAR(100),
    content TEXT,

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE feedback (
    id SERIAL PRIMARY KEY,

    session_id INT NOT NULL,
    user_id INT,

    feedback_type VARCHAR(50),

    content TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_feedback_session
        FOREIGN KEY (session_id)
        REFERENCES reading_sessions(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_feedback_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
);

CREATE TABLE media_files (
    id SERIAL PRIMARY KEY,

    session_id INT NOT NULL,

    file_type VARCHAR(50),
    file_path VARCHAR(255),

    deleted_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_media_session
        FOREIGN KEY (session_id)
        REFERENCES reading_sessions(id)
        ON DELETE CASCADE
);

CREATE TABLE rag_logs (
    id SERIAL PRIMARY KEY,

    session_id INT NOT NULL,
    card_id INT,

    retrieved_snippet TEXT,

    similarity_score FLOAT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_rag_session
        FOREIGN KEY (session_id)
        REFERENCES reading_sessions(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_rag_card
        FOREIGN KEY (card_id)
        REFERENCES tarot_cards(id)
);