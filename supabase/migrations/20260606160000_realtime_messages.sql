-- Enable Supabase Realtime for live patient <-> caregiver interaction.
-- The frontend subscribes to INSERTs on these tables so both sides update
-- without a refresh (messages now; check-ins next).
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table checkin_responses;
