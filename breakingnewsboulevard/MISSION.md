# MISSION: Offizielle Quellen, eigenständige Nachrichten

Breaking News Boulevard fasst Meldungen offizieller Primärquellen in eigenständigen deutschen
Nachrichtenartikeln zusammen. Jeder Artikel wird vor Veröffentlichung automatisch gegen Quelle und Format geprüft.

## Quellen
- Aktive Quellen: NASA, CISA/US-Regierung, UK Government, Wikinews, Europäische Kommission, Destatis und Bundesgerichtshof.
- UN News, WHO, ESA und Bundesregierung sind wegen unklarer bzw. restriktiver Nutzungsrechte gesperrt; die WHO ist wegen der nicht-kommerziellen Lizenz CC BY-NC-SA 3.0 IGO deaktiviert.
- Nur in `scripts/lib/news.mjs` freigegebene offizielle Quellen verwenden.
- Nur Quellen aus der aktiven Registry: Pressemitteilungen und Agenturmeldungen mit geprüfter offener Lizenz; keine Medienquellen ohne freie Lizenz.
- Quellenlink immer auf den tatsächlich verwendeten Artikel, nicht auf eine Übersichtsseite.
- Nutzungsrechte und Quellenangabe aus der Quellen-Registry übernehmen.
- Im Artikel Originaltitel, Veröffentlichungsdatum der Quelle, Quellenlink, Lizenz und Änderungshinweis ausweisen.
- Gesperrte Quellen nicht automatisch aktivieren.

## Artikel
- Bilder: zuerst ein frei lizenziertes Foto von Wikimedia Commons oder NASA verwenden; sonst eine eigene redaktionelle Illustration. Bildurheber, Lizenz und Bildquelle im Artikel ausweisen.
- 120–180 Wörter Fließtext, 0–1 Zwischenüberschrift: kurze eigene Zusammenfassung statt Absatz-für-Absatz-Übersetzung.
- Erster Absatz: genau ein Satz mit Was, Wo und Wer. Danach ein Absatz, der die Bedeutung ausschließlich mit Fakten aus der Quelle erklärt.
- Jeder Satz muss durch den Quelltext gedeckt sein; keine eigene Einordnung, keine Prognosen, kein Ausblick, kein Fazit, keine Empfehlungen und keine Dashboard-/Frühindikator-Sätze.
- Durchgehend Deutsch, eigene Formulierungen, keine wörtliche Übersetzung und keine enge Umformulierung der Quellstruktur.
- Fasse 2–4 Kernaussagen zusammen; Details nur, wenn sie für die Kernaussage nötig sind.
- Nie mehr als 9 aufeinanderfolgende Wörter aus dem Quelltext übernehmen.
- Höchstens ein kurzes Zitat mit maximal 25 Wörtern; nur wenn es exakt im Quelltext steht.
- Keine erfundenen Fakten, Namen, Funktionen, Zahlen, Orte, Zitate oder Zusammenhänge.
- Zahlen, Einheiten, Zeitangaben und Amtsbezeichnungen exakt aus der Quelle übernehmen.
- Keine Meinung, keine Sensationslust, kein Clickbait.
- Bei dünner Quellenlage lieber keinen Artikel erzeugen.

## Weltnachrichten kurz
- `npm run briefs:daily` erzeugt bis zu zehn Kurzmeldungen pro Tag in `data/briefs.json` und rendert `weltnachrichten-kurz.html` sowie den Startseiten-Bereich.
- Quellen sind ausschließlich BBC, Reuters, Tagesschau, Al Jazeera, DW und The Guardian über ihre öffentlichen RSS-Feeds.
- Nur Überschrift und Kurzbeschreibung aus dem Feed verwenden; keine Artikel-URL nachladen und keine Originaltexte, Originalüberschriften oder Fotos speichern oder veröffentlichen.
- Jede Meldung ist eine eigenständige deutsche Zusammenfassung mit Was, Wo und Wer, maximal 50 Wörtern insgesamt.
- Keine Sätze, Satzteile oder Wortfolgen aus der Quelle übernehmen; 5-Wort-Überlappungen, nicht gedeckte Zahlen und Zitate werden verworfen.
- Quelle bei jeder Meldung sichtbar und verlinkt anzeigen; bei Reuters über Google News zusätzlich „via Google News“ ausweisen.
- Keine Bilder von Nachrichtenseiten verwenden. Der KI-Hinweis bleibt auf Startseite und Übersichtsseite sichtbar.
- Bei dünner Quellenlage oder fehlgeschlagener Prüfung wird die Meldung übersprungen; maximal zehn Meldungen pro UTC-Tag.

## Freigabe
- `npm run generate:daily` erzeugt bis zu zwei Tagesentwürfe in `review/queue/`.
- `npm run auto:publish` prüft alle Entwürfe und veröffentlicht bestandene Artikel als `Auto-Redaktion`; die Quellsprache spielt keine Rolle.
- `AUTO_PUBLISH` ist standardmäßig `true`. Mit der Repository-Variable oder Umgebungsvariable `AUTO_PUBLISH=false` wird die automatische Veröffentlichung abgeschaltet; Entwürfe bleiben dann in `review/queue/` für eine manuelle Freigabe.
- Die Prüfung umfasst Quellen-Host, Originaltitel, Lizenz, Zitat, Wortzahl, Zahlen, Rollen, 10-Wort-Überlappungen, Quellenbindung und Artikelstruktur.
- Manuelle Freigabe bleibt für Stichproben und Sonderfälle möglich.
- Erst die Freigabe schreibt den Artikel nach `posts/` und `data/posts.json`.
- Der tägliche GitHub-Workflow läuft um 06:47 UTC, erzeugt bis zu zwei Artikel und veröffentlicht alle Artikel, die alle Prüfungen bestehen.
- Wenn die Prüfung fehlschlägt, wird kein Artikel veröffentlicht.

## Rechtstexte
- `legal/impressum.html` und `legal/datenschutz.html` sind mit den Betreiberdaten ausgefüllt und indexierbar.
- `legal/korrekturen.html` ist ebenfalls ausgefüllt und indexierbar.
- Footer-Links zu `/impressum` und `/datenschutz` und Rewrites in `vercel.json` sind gesetzt; die Legal-Seiten sind nicht mehr in `.vercelignore` ausgeschlossen.
- `npm run legal:check` ist grün. Der Check schlägt bei offenen Platzhaltern oder verbliebenem `noindex` fehl.
