-- Add photo_urls column to logs table (multiple photos per log entry)
ALTER TABLE logs ADD COLUMN IF NOT EXISTS photo_urls TEXT[];
