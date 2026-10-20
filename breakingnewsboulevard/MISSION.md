# MISSION: Offizielle Quellen, eigenständige Nachrichten

Breaking News Boulevard fasst Meldungen offizieller Primärquellen in eigenständigen deutschen
Nachrichtenartikeln zusammen. Jeder Artikel wird vor Veröffentlichung automatisch gegen Quelle und Format geprüft.

## Quellen
- Nur in `scripts/lib/news.mjs` freigegebene offizielle Quellen verwenden.
- Nur Quellen aus der aktiven Registry: Pressemitteilungen und Agenturmeldungen mit geprüfter offener Lizenz; keine Medienquellen ohne freie Lizenz.
- Quellenlink immer auf den tatsächlich verwendeten Artikel, nicht auf eine Übersichtsseite.
- Nutzungsrechte und Quellenangabe aus der Quellen-Registry übernehmen.
- Im Artikel Originaltitel, Veröffentlichungsdatum der Quelle, Quellenlink, Lizenz und Änderungshinweis ausweisen.
- Gesperrte Quellen nicht automatisch aktivieren.

## Artikel
- 120–180 Wörter Fließtext, 0–2 Zwischenüberschriften: kurze eigene Zusammenfassung statt Absatz-für-Absatz-Übersetzung.
- Durchgehend Deutsch, eigene Formulierungen, keine wörtliche Übersetzung und keine enge Umformulierung der Quellstruktur.
- Fasse 2–4 Kernaussagen zusammen; Details nur, wenn sie für die Kernaussage nötig sind.
- Nie mehr als 9 aufeinanderfolgende Wörter aus dem Quelltext übernehmen.
- Höchstens ein kurzes Zitat mit maximal 25 Wörtern; nur wenn es exakt im Quelltext steht.
- Keine erfundenen Fakten, Namen, Funktionen, Zahlen, Orte, Zitate oder Zusammenhänge.
- Zahlen, Einheiten, Zeitangaben und Amtsbezeichnungen exakt aus der Quelle übernehmen.
- Keine Meinung, keine Sensationslust, kein Clickbait.
- Bei dünner Quellenlage lieber keinen Artikel erzeugen.

## Freigabe
- `npm run generate:one` erzeugt einen Tagesentwurf in `review/queue/`.
- `npm run auto:publish` prüft den Entwurf und gibt ihn als `Auto-Redaktion` frei.
- Die Prüfung umfasst Quellen-Host, Originaltitel, Lizenz, Zitat, Wortzahl, Zahlen, Rollen und 10-Wort-Überlappungen.
- Manuelle Freigabe bleibt für Stichproben und Sonderfälle möglich.
- Erst die Freigabe schreibt den Artikel nach `posts/` und `data/posts.json`.
- Der tägliche GitHub-Workflow läuft um 06:15 UTC, veröffentlicht einen Artikel und pusht die Änderung.
- Wenn die Prüfung fehlschlägt, wird kein Artikel veröffentlicht.

## Rechtstexte
- `legal/impressum.html` und `legal/datenschutz.html` sind mit den Betreiberdaten ausgefüllt und indexierbar.
- `legal/korrekturen.html` ist ebenfalls ausgefüllt und indexierbar.
- Footer-Links zu `/impressum` und `/datenschutz` und Rewrites in `vercel.json` sind gesetzt; die Legal-Seiten sind nicht mehr in `.vercelignore` ausgeschlossen.
- `npm run legal:check` ist grün. Der Check schlägt bei offenen Platzhaltern oder verbliebenem `noindex` fehl.
