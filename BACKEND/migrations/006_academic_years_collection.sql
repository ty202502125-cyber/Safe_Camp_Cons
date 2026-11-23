-- Older databases were created before academicYears existed. Replace the
-- whitelist so Super Admin can save the school year and semester.
DO $$
DECLARE
  constraint_name name;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'app_records'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%collection%'
  LOOP
    EXECUTE format('ALTER TABLE app_records DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE app_records
  ADD CONSTRAINT app_records_collection_check
  CHECK (collection IN ('users', 'activities', 'enrollments', 'organizations', 'academicYears'));
