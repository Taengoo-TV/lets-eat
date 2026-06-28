-- ============================================================
-- Enums
-- ============================================================
CREATE TYPE time_label AS ENUM ('morning', 'noon', 'evening', 'night');

-- ============================================================
-- Tables
-- ============================================================
CREATE TABLE events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  created_by      TEXT NOT NULL,
  creator_token   UUID NOT NULL DEFAULT gen_random_uuid(), -- returned once on create, kept in localStorage
  location_text   TEXT,
  restaurant_types TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE event_slots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  time_label  time_label NOT NULL,
  UNIQUE (event_id, date, time_label)
);

CREATE TABLE responses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  friend_name  TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE response_slots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  slot_id     UUID NOT NULL REFERENCES event_slots(id) ON DELETE CASCADE,
  UNIQUE (response_id, slot_id)
);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_slots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_slots ENABLE ROW LEVEL SECURITY;

-- events: anyone can read and create; no direct delete (use delete_event())
CREATE POLICY "events_select" ON events FOR SELECT USING (true);
CREATE POLICY "events_insert" ON events FOR INSERT WITH CHECK (true);

-- event_slots: anyone with the event link can read; only insert alongside event creation
CREATE POLICY "event_slots_select" ON event_slots FOR SELECT USING (true);
CREATE POLICY "event_slots_insert" ON event_slots FOR INSERT WITH CHECK (true);

-- responses: anyone can read and submit
CREATE POLICY "responses_select" ON responses FOR SELECT USING (true);
CREATE POLICY "responses_insert" ON responses FOR INSERT WITH CHECK (true);

-- response_slots: anyone can read and submit
CREATE POLICY "response_slots_select" ON response_slots FOR SELECT USING (true);
CREATE POLICY "response_slots_insert" ON response_slots FOR INSERT WITH CHECK (true);

-- ============================================================
-- Delete function (creator-only, bypasses RLS via SECURITY DEFINER)
-- ============================================================
-- creator_token is never exposed in SELECT queries; the client
-- stores it in localStorage after creating the event and passes
-- it here to prove ownership.
CREATE OR REPLACE FUNCTION delete_event(p_event_id UUID, p_creator_token UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM events
  WHERE id = p_event_id AND creator_token = p_creator_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized or event not found';
  END IF;
END;
$$;

-- Revoke direct delete from anon/authenticated roles; they must go through the function
REVOKE DELETE ON events         FROM anon, authenticated;
REVOKE DELETE ON event_slots    FROM anon, authenticated;
REVOKE DELETE ON responses      FROM anon, authenticated;
REVOKE DELETE ON response_slots FROM anon, authenticated;
