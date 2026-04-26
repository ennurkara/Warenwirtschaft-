-- supabase/migrations/039_rls_grant_techniker.sql
--
-- Erweitert alle public-Policies, die heute admin+mitarbeiter erlauben,
-- um die neue Rolle 'techniker' (Migration 038). Pattern: jede Policy,
-- deren USING- oder WITH-CHECK-Ausdruck den String "'mitarbeiter'::user_role])"
-- enthält (= mitarbeiter ist letztes Element im ARRAY[...]), wird neu
-- erzeugt mit "'mitarbeiter'::user_role, 'techniker'::user_role])".
--
-- DELETE-Policies, die nur admin erlauben (z.B. licenses_delete), werden
-- nicht angefasst. SELECT-Policies, die niemandem die Schreibrechte
-- gewähren, ebenfalls nicht (kein Match auf das Pattern).
--
-- Idempotent: bei Re-Run findet das Pattern keine Treffer mehr, weil die
-- bereits umgeschriebenen Policies "'techniker'::user_role])" am Ende stehen.

DO $$
DECLARE
  rec       RECORD;
  new_qual  TEXT;
  new_check TEXT;
  cmd_text  TEXT;
  sql       TEXT;
  touched   INT := 0;
BEGIN
  FOR rec IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      p.polname,
      p.polcmd,
      pg_get_expr(p.polqual, p.polrelid)      AS qual_expr,
      pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr
    FROM pg_policy p
    JOIN pg_class c     ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND (
        coalesce(pg_get_expr(p.polqual,      p.polrelid), '') LIKE '%''mitarbeiter''::user_role])%'
     OR coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') LIKE '%''mitarbeiter''::user_role])%'
      )
  LOOP
    new_qual  := replace(rec.qual_expr,  '''mitarbeiter''::user_role])', '''mitarbeiter''::user_role, ''techniker''::user_role])');
    new_check := replace(rec.check_expr, '''mitarbeiter''::user_role])', '''mitarbeiter''::user_role, ''techniker''::user_role])');

    cmd_text := CASE rec.polcmd
      WHEN 'r' THEN 'SELECT'
      WHEN 'a' THEN 'INSERT'
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      WHEN '*' THEN 'ALL'
    END;

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', rec.polname, rec.schema_name, rec.table_name);

    sql := format('CREATE POLICY %I ON %I.%I FOR %s TO authenticated',
                  rec.polname, rec.schema_name, rec.table_name, cmd_text);
    IF new_qual IS NOT NULL AND new_qual <> '' THEN
      sql := sql || ' USING (' || new_qual || ')';
    END IF;
    IF new_check IS NOT NULL AND new_check <> '' THEN
      sql := sql || ' WITH CHECK (' || new_check || ')';
    END IF;

    EXECUTE sql;
    touched := touched + 1;
    RAISE NOTICE 'Granted techniker on %.% policy %', rec.schema_name, rec.table_name, rec.polname;
  END LOOP;

  RAISE NOTICE 'Total policies updated: %', touched;
END $$;

NOTIFY pgrst, 'reload schema';
