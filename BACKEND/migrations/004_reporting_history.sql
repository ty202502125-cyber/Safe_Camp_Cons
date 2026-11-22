-- Reporting foundation: immutable event history, creation timestamps and
-- soft-delete awareness. Existing rows get a starting snapshot; transitions
-- that happened before this migration cannot be reconstructed.

ALTER TABLE app_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
UPDATE app_records
   SET created_at = COALESCE(created_at, updated_at, NOW())
 WHERE created_at IS NULL;
ALTER TABLE app_records ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE app_records ALTER COLUMN created_at SET NOT NULL;

CREATE TABLE IF NOT EXISTS record_events (
  id            BIGSERIAL PRIMARY KEY,
  collection    TEXT NOT NULL,
  record_id     TEXT NOT NULL,
  event_type    TEXT NOT NULL,
  data          JSONB NOT NULL,
  previous_data JSONB,
  actor_id      INTEGER,
  actor_role    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS record_events_lookup_idx
  ON record_events (collection, record_id, created_at);
CREATE INDEX IF NOT EXISTS record_events_created_idx
  ON record_events (created_at);

CREATE OR REPLACE FUNCTION log_app_record_event() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_collection  TEXT;
  v_record_id   TEXT;
  v_event_type  TEXT;
  v_data        JSONB;
  v_previous    JSONB;
  v_actor_id    INTEGER;
  v_actor_role  TEXT;
BEGIN
  v_actor_id := NULLIF(current_setting('app.actor_id', true), '')::integer;
  v_actor_role := NULLIF(current_setting('app.actor_role', true), '');

  IF TG_OP = 'INSERT' THEN
    v_collection := NEW.collection;
    v_record_id := NEW.record_id;
    v_event_type := 'created';
    v_data := NEW.data;
  ELSIF TG_OP = 'DELETE' THEN
    v_collection := OLD.collection;
    v_record_id := OLD.record_id;
    v_event_type := 'deleted';
    v_data := OLD.data;
  ELSE
    v_collection := NEW.collection;
    v_record_id := NEW.record_id;
    IF OLD.data IS DISTINCT FROM NEW.data THEN
      IF OLD.data->>'status' IS DISTINCT FROM NEW.data->>'status' THEN
        v_event_type := 'status_changed';
      ELSIF (OLD.data->>'attended') IS DISTINCT FROM (NEW.data->>'attended')
         OR (OLD.data->>'hours') IS DISTINCT FROM (NEW.data->>'hours')
         OR (OLD.data->>'verified') IS DISTINCT FROM (NEW.data->>'verified') THEN
        v_event_type := 'attendance_changed';
      ELSE
        v_event_type := 'updated';
      END IF;
      v_data := NEW.data;
      v_previous := OLD.data;
    ELSE
      RETURN NULL;
    END IF;
  END IF;

  INSERT INTO record_events
    (collection, record_id, event_type, data, previous_data, actor_id, actor_role)
  VALUES
    (v_collection, v_record_id, v_event_type, v_data, v_previous, v_actor_id, v_actor_role);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS app_records_report_events ON app_records;
CREATE TRIGGER app_records_report_events
  AFTER INSERT OR UPDATE OR DELETE ON app_records
  FOR EACH ROW EXECUTE FUNCTION log_app_record_event();

CREATE OR REPLACE FUNCTION log_portal_user_event() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_event_type TEXT;
  v_data       JSONB;
  v_previous   JSONB;
  v_actor_id   INTEGER;
  v_actor_role TEXT;
BEGIN
  v_actor_id := NULLIF(current_setting('app.actor_id', true), '')::integer;
  v_actor_role := NULLIF(current_setting('app.actor_role', true), '');

  IF TG_OP = 'INSERT' THEN
    v_event_type := 'created';
    v_data := jsonb_build_object(
      'id', NEW.id, 'role', NEW.role, 'first', NEW.first, 'last', NEW.last,
      'email', NEW.email, 'college', NEW.college, 'status', NEW.status
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_event_type := 'deleted';
    v_data := jsonb_build_object(
      'id', OLD.id, 'role', OLD.role, 'first', OLD.first, 'last', OLD.last,
      'email', OLD.email, 'college', OLD.college, 'status', OLD.status
    );
  ELSE
    v_data := jsonb_build_object(
      'id', NEW.id, 'role', NEW.role, 'first', NEW.first, 'last', NEW.last,
      'email', NEW.email, 'college', NEW.college, 'status', NEW.status
    );
    v_previous := jsonb_build_object(
      'id', OLD.id, 'role', OLD.role, 'first', OLD.first, 'last', OLD.last,
      'email', OLD.email, 'college', OLD.college, 'status', OLD.status
    );
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_event_type := 'status_changed';
    ELSIF OLD.college IS DISTINCT FROM NEW.college THEN
      v_event_type := 'college_changed';
    ELSIF OLD.role IS DISTINCT FROM NEW.role THEN
      v_event_type := 'role_changed';
    ELSE
      RETURN NULL;
    END IF;
  END IF;

  INSERT INTO record_events
    (collection, record_id, event_type, data, previous_data, actor_id, actor_role)
  VALUES
    ('users', COALESCE(NEW.id, OLD.id)::text, v_event_type,
     v_data, v_previous, v_actor_id, v_actor_role);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS portal_users_report_events ON portal_users;
CREATE TRIGGER portal_users_report_events
  AFTER INSERT OR UPDATE OR DELETE ON portal_users
  FOR EACH ROW EXECUTE FUNCTION log_portal_user_event();

-- Starting snapshot. This is the earliest point reports can reconstruct.
INSERT INTO record_events (collection, record_id, event_type, data, created_at)
SELECT collection, record_id, 'initial_snapshot', data, created_at
  FROM app_records;

INSERT INTO record_events (collection, record_id, event_type, data, created_at)
SELECT 'users', id::text, 'initial_snapshot',
       jsonb_build_object(
         'id', id, 'role', role, 'first', first, 'last', last,
         'email', email, 'college', college, 'status', status
       ),
       COALESCE(updated_at, NOW())
  FROM portal_users;
