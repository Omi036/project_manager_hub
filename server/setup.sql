-- Compatible with MySQL 8.0+.

CREATE TABLE IF NOT EXISTS users (
    username       VARCHAR(50) PRIMARY KEY,
    nick           VARCHAR(100) NOT NULL,
    role           VARCHAR(20) NOT NULL DEFAULT 'member'
                   CHECK (role IN ('member', 'admin')),
    discord_id     VARCHAR(100) UNIQUE,
    avatar_url     VARCHAR(255),
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash  CHAR(64) PRIMARY KEY,
    username    VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    expires_at  TIMESTAMP NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sessions_expires_at (expires_at),
    INDEX idx_sessions_username (username)
);

CREATE TABLE IF NOT EXISTS projects (
    id             VARCHAR(64) PRIMARY KEY,
    title          VARCHAR(200) NOT NULL,
    icon           VARCHAR(100) NOT NULL DEFAULT 'tabler:rocket',
    icon_color     CHAR(7) NOT NULL DEFAULT '#2d4ca3'
                   CHECK (icon_color REGEXP '^#[0-9A-Fa-f]{6}$'),
    status         VARCHAR(20) NOT NULL DEFAULT 'Ideado'
                   CHECK (status IN ('Ideado', 'En progreso', 'Finalizado', 'Abortado')),
    description    TEXT NOT NULL,
    tags           TEXT NOT NULL DEFAULT '',
    owner_name     VARCHAR(100) NOT NULL,
    owner_username VARCHAR(50) REFERENCES users(username) ON DELETE SET NULL,
    created_by     VARCHAR(50) REFERENCES users(username) ON DELETE SET NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_relation (
    project_id       VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    comment          TEXT,
    type             VARCHAR(20) NOT NULL CHECK (type IN ('discussion', 'form', 'contract', 'link')),
    related_id       VARCHAR(64) NOT NULL,
    PRIMARY KEY (project_id, type, related_id)
);

CREATE TABLE IF NOT EXISTS project_collaborators (
    project_id       VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    collaborator_name VARCHAR(100) NOT NULL,
    collaborator_username VARCHAR(50) REFERENCES users(username) ON DELETE SET NULL,
    PRIMARY KEY (project_id, collaborator_name)
);

CREATE TABLE IF NOT EXISTS project_funding (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contributor VARCHAR(100) NOT NULL DEFAULT '',
    contribution TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_updates (
    id         VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title      VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS discussions (
    id         VARCHAR(64) PRIMARY KEY,
    title      VARCHAR(200) NOT NULL,
    owner      VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE RESTRICT,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS discussion_messages (
    id            VARCHAR(64) PRIMARY KEY,
    discussion_id VARCHAR(64) NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
    author        VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE RESTRICT,
    text          TEXT NOT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS news (
    id         VARCHAR(64) PRIMARY KEY,
    title      VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    banner     TEXT NOT NULL,
    created_by  VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE RESTRICT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS news_comments (
    id         VARCHAR(64) PRIMARY KEY,
    news_id    VARCHAR(64) NOT NULL REFERENCES news(id) ON DELETE CASCADE,
    author     VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE RESTRICT,
    text       TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS forms (
    id         VARCHAR(64) PRIMARY KEY,
    title      VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    anonymous  BOOLEAN NOT NULL DEFAULT FALSE,
    max_responses INT NOT NULL DEFAULT 1,
    created_by  VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE RESTRICT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS forms_questions (
    id         VARCHAR(64) PRIMARY KEY,
    form_id    VARCHAR(64) NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    position   INT NOT NULL,
    question   JSON NOT NULL,
    type       VARCHAR(20) NOT NULL DEFAULT 'text'
               CHECK (type IN ('short_text', 'long_text', 'multiple_choice', 'single_choice', 'rating_5', 'rating_10', 'checkbox', 'date', 'availability', 'number')),
    options    JSON,
    required   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS forms_responses (
    id         VARCHAR(64) PRIMARY KEY,
    form_id    VARCHAR(64) NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    responder  VARCHAR(50) REFERENCES users(username) ON DELETE SET NULL,
    response   JSON NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contract (
    id         VARCHAR(64) PRIMARY KEY,
    title      VARCHAR(200) NOT NULL,
    content    TEXT NOT NULL,
    issuer     VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE RESTRICT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contract_signatures (
    id          VARCHAR(64) PRIMARY KEY,
    contract_id VARCHAR(64) NOT NULL REFERENCES contract(id) ON DELETE CASCADE,
    signer      VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE RESTRICT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_contract_signer (contract_id, signer)
);

CREATE INDEX idx_contracts_created_at
    ON contract (created_at DESC);

CREATE INDEX idx_projects_created_at
    ON projects (created_at DESC);

CREATE INDEX idx_projects_owner_username
    ON projects (owner_username);

CREATE INDEX idx_project_updates_project_created
    ON project_updates (project_id, created_at DESC);

CREATE INDEX idx_discussions_created_at
    ON discussions (created_at DESC);

CREATE INDEX idx_discussion_messages_discussion_created
    ON discussion_messages (discussion_id, created_at ASC);

CREATE INDEX idx_forms_created_at
    ON forms (created_at DESC);

CREATE INDEX idx_news_created_at
    ON news (created_at DESC);