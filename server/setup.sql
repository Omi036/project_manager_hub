-- Compatible with MySQL 8.0+.

CREATE TABLE IF NOT EXISTS users (
    username       VARCHAR(50) PRIMARY KEY,
    nick           VARCHAR(100) NOT NULL,
    role           VARCHAR(20) NOT NULL DEFAULT 'member'
                   CHECK (role IN ('member', 'admin')),
    discord_id     VARCHAR(100) UNIQUE,
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
    owner_name     VARCHAR(100) NOT NULL,
    owner_username VARCHAR(50) REFERENCES users(username) ON DELETE SET NULL,
    created_by     VARCHAR(50) REFERENCES users(username) ON DELETE SET NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_collaborators (
    project_id       VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    collaborator_name VARCHAR(100) NOT NULL,
    collaborator_username VARCHAR(50) REFERENCES users(username) ON DELETE SET NULL,
    PRIMARY KEY (project_id, collaborator_name)
);

CREATE TABLE IF NOT EXISTS project_tags (
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tag        VARCHAR(50) NOT NULL,
    PRIMARY KEY (project_id, tag)
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

CREATE INDEX idx_news_created_at
    ON news (created_at DESC);