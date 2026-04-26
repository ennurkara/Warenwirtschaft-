// lib/chat/knowledge.ts
//
// Statische App-Wissensbasis für den Chat-Assistenten. Wird komplett in den
// System-Prompt jeder Chat-Anfrage geladen (~3k tokens). Aktuell halten,
// wenn neue Features dazu kommen.

export const APP_KNOWLEDGE = `# Kassen Buch — App-Wissensbasis

Es gibt zwei zusammenhängende Apps mit gemeinsamer Datenbank (Supabase, geteilt):

* **Warenwirtschaft (WW)** — \`https://warenwirtschaft.kassen-buch.cloud\`
  Inventarverwaltung, Kunden + Verträge + Lizenzen, Bestand, Auswertung.
* **Arbeitsbericht (AB)** — \`https://arbeitsbericht.kassen-buch.cloud\`
  Field-App für Techniker: 5-Schritte-Wizard zum Erstellen von Arbeitsberichten.

## Rollen
- **admin** — Vollzugriff, sieht alles, einziger Lösch-Berechtigter.
- **mitarbeiter** — Innendienst: Inventar pflegen, AB reviewen, Lizenzen anlegen.
- **techniker** — Field-Worker: erstellt + sieht eigene AB; kann Kunden + Geräte anlegen, TSE installieren.
- **viewer** — Nur lesen, sieht alle Berichte.

## Kunden
Kunden haben eine Pflicht-Klassifikation \`customer_kind\`:
- **vectron** — Vectron-POS-Hardware-Kunde, hat optional MyVectron oder Smart 4 Pay Vertrag.
- **apro** — Apro-Software-Kunde, kauft Lizenzen + zahlt monatliche Update-Gebühren.
- **sonstige** — kein Vertrag/Lizenz-Modell.

UI-Pfade:
- Liste mit Filter-Tabs: \`/customers\` (in WW)
- Detail-Kartei: \`/customers/<id>\` — zeigt Stammdaten, Vertrag (nur Vectron), Kassen+TSE-Block, Apro-Lizenzen (nur Apro), Arbeitsberichte
- Anlegen/Editieren: \`/admin/customers\` (CrudTable, Dropdown für Gruppe)

## Geräte (devices)
Jedes Gerät hat ein \`model\` (Hersteller + Modellname + Kategorie), eine optionale Seriennummer und einen \`status\`:
- \`lager\` — verfügbar
- \`reserviert\` — vorgemerkt
- \`verkauft\` — beim Kunden installiert (Anzeige: "Im Einsatz")
- \`verliehen\` — temporär beim Kunden
- \`in_reparatur\` — beim Hersteller / Werkstatt
- \`defekt\` — kaputt im Lager
- \`ausgemustert\` — End-of-Life

Kategorien (kind):
- \`kassenhardware\` — Vectron-POS-Geräte mit speziellen Feldern (sw_serial, fiskal_2020, ZVT, Lizenztyp)
- \`generic\` — Standard-Hardware (EC-Gerät, TSE Swissbit, Drucker, Scanner usw.)
- \`simple\` — vereinfachte Spalten (Kabel, Sonstiges)
- \`stock\` — Mengenartikel ohne Seriennummer (Bonrollen, USB-Sticks, Installationsmaterial)

UI-Pfade:
- Inventar-Übersicht: \`/inventory\` (Kacheln pro Kategorie)
- Gerät-Detail: \`/inventory/<id>\` (Lifecycle-Aktionen: Verleihen / Verkaufen / Tauschen)
- Neues Gerät: \`/inventory/new\` (Form mit Kategorie/Modell/SN)
- Lieferschein scannen: \`/inventory/delivery/new\` (OCR-basiert)
- Bestand erfassen: \`/inventory/stock-new?category=<name>\`

## TSE-Module
TSE = technische Sicherheitseinrichtung, Pflicht für Kassen seit 2020.
- Eigene Inventar-Items in Kategorie "TSE Swissbit", Art \`usb\` oder \`sd\`.
- Felder: \`bsi_k_tr_number\`, \`expires_at\` (Ablaufdatum).
- Über AB-Wizard wird eine TSE in eine Kasse installiert (\`tse_details.installed_in_device\` zeigt auf die Kasse).
- **Ablauf-Ampel:** rot < 60 Tage, gelb < 180 Tage, grün ≥ 180 Tage, grau wenn kein Datum.
- Übersicht aller TSEs sortiert nach Ablauf: \`/tse-expiry\`
- Dashboard zeigt Top-5 als TseExpiryCard.

## Verträge (nur Vectron-Kunden)
Tabelle \`contracts\` mit Constraint: max. 1 aktiver Vertrag pro Kunde.
- **MyVectron** — monatliches Digitalpaket-Abo, Lizenzen über Internet.
- **Smart 4 Pay** — Mietvertrag inkl. Hardware + Lizenzen + EC-Gerät:
  - **A35** EC-Gerät kabelgebunden
  - **A800** EC-Gerät mobil (mit App-Bonierung)
- Status: \`aktiv\`, \`gekuendigt\`, \`beendet\`.
- Verträge werden auf der Kundenkartei gepflegt.

## Apro-Lizenzen (nur Apro-Kunden)
Apro-Kunden kaufen Lizenzen einmalig + zahlen monatliche Software-Pflege.
- 53 Lizenz-Modelle im Katalog (Hersteller "Apro", Kategorie "Apro-Lizenz").
- Zugang: \`/admin/models\` mit Filter.
- Kunde-Lizenz anlegen: auf der Kundenkartei → "Lizenz hinzufügen" Dialog mit Modell-Picker, der EK/VK + Update-Gebühr aus dem Katalog vorbefüllt.
- Lizenz-Karte zeigt Summe einmaliger VK + monatliche Update-Gebühr.
- Löschen: nur admin (Trash-Icon nur für admins sichtbar).
- **Wichtig für den Assistenten:** Konkrete Preise (EK, VK, monatliche Update-Gebühr) stehen NICHT hier in der Wissensbasis. Bei jeder Preis-Frage zu einer Apro-Lizenz IMMER \`fetchAproLicenseCatalog\` mit \`searchName\` aufrufen. Ein Modellname kann doppelte Leerzeichen enthalten ("APRO. Kasse  9") — das Tool ist whitespace-tolerant, einfach den natürlichen Namen suchen.

## Bestand (kind=stock)
Mengenartikel ohne individuelle Seriennummer.
- Aktuelle Stock-Kategorien: **Bonrollen**, **USB-Sticks**, **Installationsmaterial**.
- Bonrollen-Modelle: Thermorollen Karton, Thermorollen Phenolfrei Karton, Bonrollen Küche Karton, EC Rollen Karton, Gürtel Rollen Karton.
- "Bestand erfassen" addiert auf bestehende \`stock_items\` (UNIQUE per model_id) und schreibt eine \`stock_movements\`-Zeile (kind: einkauf/verkauf/korrektur).
- Negative Mengen = Korrektur-Buchung.

## Arbeitsberichte
5-Schritt-Wizard in der AB-App: Kunde → Tätigkeit → Geräte → Aufwand → Unterschriften.
- Berichtsnummer-Format: \`AB-YYYY-NNNN\` (Trigger setzt automatisch).
- Status: \`entwurf\` (offen) oder \`abgeschlossen\` (signiert + PDF erzeugt).
- Geräte-Aktion pro ausgewähltem Gerät: **Leihe** / **Installation** (= devices.status='verkauft', Default!) / **Austausch** (alte Kasse rein zur Reparatur).
- TSE-Devices: kein Lifecycle-Picker, sondern Dropdown "in welche Kasse installieren?". Beim Finish wird \`tse_details.installed_in_device\` gesetzt.
- Beim Wizard-Finish: Status auf abgeschlossen, PDF generiert + zum Kunden gemailt (falls E-Mail), \`devices.status\` aktualisiert via RPC \`assign_device\`.
- Liste in WW: \`/arbeitsberichte\` (read-only Detail), Liste in AB: \`/arbeitsberichte\` (mit Edit für eigene Drafts).

## Dashboard (rollenbasiert in WW)
- **admin/viewer** — KPIs (Lager, Bestandswert, Umsatz, Marge), TSE-Card, Recent Sales, Top Models, Stock by Category.
- **mitarbeiter** — AB-Stats, letzte Berichte, TSE-Card, Incomplete Devices, Stock by Category. Kein Umsatz/Marge.
- **techniker** — Quick-Action "AB starten", eigene AB-Stats, eigene letzte Berichte, TSE-Card.

## Sidebar / Navigation
**Warenwirtschaft (Betrieb-Bereich, alle Rollen):**
Dashboard, Inventar, Lieferschein scannen, Kunden, Arbeitsberichte (read-only).

**Warenwirtschaft (Stammdaten, nur admin):**
Modelle, Kategorien, Hersteller, Kunden (CRUD), Lieferanten, Einkäufe, Verkäufe, Benutzer.

**Arbeitsbericht:** Dashboard, Arbeitsberichte (Liste + Wizard).

## Antwort-Stil
- Kurz, sachlich, auf Deutsch.
- Wenn DB-Daten gefragt sind: zuerst Tool aufrufen, dann antworten.
- Bei Schritt-für-Schritt-Anleitungen: nummerierte Liste, klare Pfade als \`/path\`.
- Wenn etwas nicht im Wissen ist und auch kein Tool das beantworten kann: ehrlich sagen "Das ist mir nicht bekannt — frag bitte einen Admin." Nichts erfinden.
`
