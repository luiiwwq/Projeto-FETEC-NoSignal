-- =========================================================
--  No Signal — Database Schema
--  Banco: nosignal_db
-- =========================================================

CREATE DATABASE IF NOT EXISTS nosignal_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE nosignal_db;

-- ---------------------------------------------------------
-- Tabela: players
-- Armazena o registro de cada astronauta
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS players (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    name            VARCHAR(50)     NOT NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_name (name),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Perfis de astronautas registrados pelos jogadores';
