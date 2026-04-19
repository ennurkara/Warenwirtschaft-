-- RLS aktivieren
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_movements ENABLE ROW LEVEL SECURITY;

-- Hilfsfunktion: Rolle des aktuellen Nutzers
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- profiles: Jeder sieht alle Profile, nur Admin kann Rollen ändern
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_self" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (role = (SELECT role FROM profiles WHERE id = auth.uid()));
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE TO authenticated USING (get_my_role() = 'admin');

-- categories: Alle dürfen lesen, nur Admin darf schreiben
CREATE POLICY "categories_select" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories_insert" ON categories FOR INSERT TO authenticated WITH CHECK (get_my_role() = 'admin');
CREATE POLICY "categories_update" ON categories FOR UPDATE TO authenticated USING (get_my_role() = 'admin');
CREATE POLICY "categories_delete" ON categories FOR DELETE TO authenticated USING (get_my_role() = 'admin');

-- devices: Alle dürfen lesen, Admin+Mitarbeiter dürfen einfügen, nur Admin darf bearbeiten/löschen
CREATE POLICY "devices_select" ON devices FOR SELECT TO authenticated USING (true);
CREATE POLICY "devices_insert" ON devices FOR INSERT TO authenticated WITH CHECK (get_my_role() IN ('admin', 'mitarbeiter'));
CREATE POLICY "devices_update" ON devices FOR UPDATE TO authenticated USING (get_my_role() = 'admin');
CREATE POLICY "devices_delete" ON devices FOR DELETE TO authenticated USING (get_my_role() = 'admin');

-- device_movements: Alle dürfen lesen, Admin+Mitarbeiter dürfen einfügen
CREATE POLICY "movements_select" ON device_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "movements_insert" ON device_movements FOR INSERT TO authenticated WITH CHECK (get_my_role() IN ('admin', 'mitarbeiter'));

-- Storage: Alle authentifizierten Nutzer können Fotos hochladen und lesen
CREATE POLICY "photos_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'device-photos');
CREATE POLICY "photos_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'device-photos' AND get_my_role() IN ('admin', 'mitarbeiter'));
CREATE POLICY "photos_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'device-photos' AND get_my_role() = 'admin');