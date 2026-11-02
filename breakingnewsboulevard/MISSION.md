# MISSION: Sechs kurze Weltnachrichten pro Tag

Breaking News Boulevard fasst täglich sechs aktuelle Meldungen in eigenständigen deutschen Kurzartikeln zusammen. RSS dient nur zur Auswahl der Meldung; die Faktenbasis ist der verlinkte Volltext. Jeder Artikel wird vor Veröffentlichung automatisch gegen Quelle und Format geprüft.

## Quellen
- Tägliche Quellen: Tagesschau, DW und The Guardian. Kein Al Jazeera, kein BBC.
- Zusätzlich bleiben die geprüften Primärquellen NASA, CISA/US-Regierung, UK Government, Wikinews, Europäische Kommission, Destatis und Bundesgerichtshof in der Registry.
- UN News, WHO, ESA und Bundesregierung sind wegen unklarer bzw. restriktiver Nutzungsrechte gesperrt; die WHO ist wegen der nicht-kommerziellen Lizenz CC BY-NC-SA 3.0 IGO deaktiviert.
- Nur Quellen aus der aktiven Registry in `scripts/lib/news.mjs` verwenden.
- RSS nur zur Auswahl der Meldung nutzen; den verlinkten Volltext als Recherchegrundlage laden. Keine Sätze, Formulierungen oder Fotos übernehmen; eigene Zusammenfassung.
- Quellenlink immer auf den tatsächlich verwendeten Artikel, nicht auf eine Übersichtsseite.
- Nutzungsrechte, Quellenangabe und Änderungshinweis aus der Quellen-Registry übernehmen.

## Artikel
- Pro Tag maximal sechs Kurzartikel; `generate:daily` erzeugt bis zu sechs Entwürfe und respektiert das Tageslimit.
- 45–80 Wörter Fließtext; Ziel sind 55–75 Wörter und niemals mehr als 80.
- Erster Absatz: genau ein Satz mit Was, Wo und Wer. Zweiter Absatz: ein bis zwei Sätze dazu, warum die Meldung wichtig ist, ausschließlich mit Fakten aus der Quelle.
- Jeder Satz muss durch den vollständigen Quelltext gedeckt sein; keine eigene Einordnung, keine Prognosen, kein Ausblick, kein Fazit, keine Empfehlungen.
- Durchgehend Deutsch, eigene Formulierungen, keine wörtliche Übersetzung und keine enge Umformulierung.
- Nie mehr als sechs aufeinanderfolgende Wörter aus der Quelle übernehmen; keine Zitate.
- Keine erfundenen Fakten, Namen, Funktionen, Zahlen, Orte oder Zusammenhänge.
- Zahlen, Einheiten, Zeitangaben und Amtsbezeichnungen exakt aus der Quelle übernehmen.
- Bei dünner Quellenlage wird die Meldung übersprungen.
- Jeder Artikel zeigt sichtbar „Quelle: Name“ mit Link und den Hinweis „Symbolbild“.
- Bilder: pro Artikel eine redaktionelle Illustration über die kostenlose Pollinations-Classic-API (`image.pollinations.ai`, Modell `flux`); kein API-Key nötig, das Anbieter-Wasserzeichen wird abgeschnitten. Das Motiv muss konkret zu Ort, Hauptmotiv und Stimmung der Meldung passen; keine generischen Themen. Keine echten Personen, Politiker, Gesichter, Logos oder Text im Bild. Die Bilder sind Symbolbilder, keine Beweisfotos.
- Unter jedem Bild steht „Symbolbild: Breaking News Boulevard“. Die Erstellung mit generativer Bildsoftware ist im Impressum offengelegt. Bei einem API-Fehler wird der betroffene Artikel übersprungen.
- Texte und Faktenprüfung laufen bevorzugt über Groq (`GROQ_API_KEY`, Llama 3.3 70B, kostenlos, 30 Anfragen/Minute); damit erzeugt der geplante Lauf sechs Artikel. Ohne Groq-Key wird Gemini (`gemini-2.5-flash-lite`, kostenlos) genutzt; der geplante Lauf erzeugt dann einen Artikel. Ohne beide Keys greift das kostenlose Pollinations-Modell `openai` (gpt-oss-20b).
- Keine Originalfotos der Nachrichtenseiten verwenden.

## Veröffentlichung
- `npm run generate:daily` erzeugt bis zu sechs Tagesentwürfe in `review/queue/`.
- `npm run auto:publish` prüft alle Entwürfe und veröffentlicht bestandene Artikel als `Auto-Redaktion`; die Quellsprache spielt keine Rolle.
- `AUTO_PUBLISH` ist standardmäßig `true`. Mit der Repository-Variable oder Umgebungsvariable `AUTO_PUBLISH=false` wird die automatische Veröffentlichung abgeschaltet; Entwürfe bleiben dann in `review/queue/` für eine manuelle Freigabe.
- Die Prüfung umfasst Quellen-Host, Originaltitel, Lizenz, Wortzahl, Zahlen, Rollen, Quellenbindung, 6-Wort-Überlappungen, Struktur, Zitate und Bildtyp.
- Manuelle Freigabe bleibt für Stichproben und Sonderfälle möglich.
- Erst die Freigabe schreibt den Artikel nach `posts/` und `data/posts.json`.
- Der tägliche GitHub-Workflow läuft um 06:47 UTC, erzeugt bis zu sechs Artikel und veröffentlicht alle Artikel, die alle Prüfungen bestehen.
- Wenn die Prüfung fehlschlägt, wird kein Artikel veröffentlicht.
- Die frühere Rubrik „Weltnachrichten kurz“ und der separate Briefs-Flow wurden entfernt; die alten URLs leiten auf die Startseite um.

## Rechtstexte
- `legal/impressum.html` und `legal/datenschutz.html` sind mit den Betreiberdaten ausgefüllt und indexierbar.
- `legal/korrekturen.html` ist ebenfalls ausgefüllt und indexierbar.
- Footer-Links zu `/impressum` und `/datenschutz` und Rewrites in `vercel.json` sind gesetzt.
- `npm run legal:check` ist grün. Der Check schlägt bei offenen Platzhaltern oder verbliebenem `noindex` fehl.
