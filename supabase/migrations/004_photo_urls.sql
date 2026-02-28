-- Add photo_urls (array) column to logs table (multiple photos per log entry)
-- Replaces the old photo_url (singular TEXT) from 001_initial.sql
ALTER TABLE logs ADD COLUMN IF NOT EXISTS photo_urls TEXT[];
ALTER TABLE logs DROP COLUMN IF EXISTS photo_url;
