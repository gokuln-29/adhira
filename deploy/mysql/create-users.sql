-- Run ONCE as MySQL root on the VPS:  sudo mysql < create-users.sql
-- Replace the three CHANGE_ME values with long random passwords (e.g. openssl rand -base64 32)
-- and put them in /etc/adhira/env (app, migrate) and /etc/adhira/backup.cnf (backup).
CREATE DATABASE IF NOT EXISTS adhira CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- Runtime user: data access only. No DDL, no FILE, no GRANT, localhost only.
CREATE USER IF NOT EXISTS 'adhira_app'@'localhost' IDENTIFIED BY 'CHANGE_ME_APP';
GRANT SELECT, INSERT, UPDATE, DELETE ON adhira.* TO 'adhira_app'@'localhost';

-- Schema owner: used only by deploy/scripts/deploy.sh to run migrations.
CREATE USER IF NOT EXISTS 'adhira_migrate'@'localhost' IDENTIFIED BY 'CHANGE_ME_MIGRATE';
GRANT ALL PRIVILEGES ON adhira.* TO 'adhira_migrate'@'localhost';
-- The last-owner protection triggers are created by migrations.

-- Backup user: read-only dump privileges.
CREATE USER IF NOT EXISTS 'adhira_backup'@'localhost' IDENTIFIED BY 'CHANGE_ME_BACKUP';
GRANT SELECT, SHOW VIEW, TRIGGER, EVENT ON adhira.* TO 'adhira_backup'@'localhost';

FLUSH PRIVILEGES;
