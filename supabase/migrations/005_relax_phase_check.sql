-- Remove hardcoded phase constraint from route_steps
-- The previous constraint only allowed phases for the Audierne→Nice route.
-- Phase should be free text since routes are AI-generated for any departure/arrival.
ALTER TABLE route_steps DROP CONSTRAINT IF EXISTS route_steps_phase_check;
