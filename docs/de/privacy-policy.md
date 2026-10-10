# Datenschutzerklärung

**Zuletzt aktualisiert: 28. September 2026**

Tickly ("der Bot", "wir", "uns") ist ein Discord-Bot, der dein Discord-Konto mit Todoist verbindet.
Diese Erklärung erklärt, welche Daten wir sammeln, warum und wie lange wir sie aufbewahren.

## 1. Daten, die wir sammeln

Wenn du Tickly verwendest, speichern wir die folgenden Daten in unserer Datenbank:

| Daten | Zweck |
|---|---|
| Discord-Benutzer-ID | Dich identifizieren und deine Einstellungen und Sitzung mit deinem Konto verknüpfen |
| Spracheinstellung | In deiner bevorzugten Sprache antworten |
| Sitzungsaufbewahrungseinstellung | Deine konfigurierte Sitzungsablaufeinstellung berücksichtigen |
| Todoist-Zugriffstoken | Todoist-Operationen in deinem Namen ausführen (Aufgaben abrufen oder erstellen, usw.) |
| Sitzungszeitstempel (erstellt, zuletzt verwendet) | Sitzungslebenszyklus und -ablauf verwalten |

Wir speichern **keine** Discord-Nachrichteninhalte oder Aufgabeninhalte. Aufgabendaten werden direkt an
die API von Todoist gesendet und unterliegen der [Datenschutzerklärung von Todoist](https://todoist.com/privacy).

## 2. Wie wir deine Daten verwenden

Deine Daten werden ausschließlich verwendet, um die Funktionalität von Tickly bereitzustellen:
- Deine Discord-Benutzer-ID verknüpft deine Todoist-Sitzung mit deinem Discord-Konto.
- Dein Zugriffstoken wird ausschließlich verwendet, um in deinem Namen mit der API von Todoist zu interagieren.
- Keine Daten werden verkauft, zu kommerziellen Zwecken an Dritte weitergegeben oder für Werbung verwendet.

## 3. Datenaufbewahrung

- **Aktive Sitzungen** laufen nach einem konfigurierbaren Zeitraum der Inaktivität ab (Standard: 30 Tage).
  Du kannst dies mit `/settings` ändern.
- **Ausstehende OAuth-Sitzungen** (gestartet aber nicht abgeschlossen) laufen automatisch nach 15 Minuten ab.
- Du kannst deine Sitzung und deinen Zugriffstoken jederzeit löschen, indem du `/todoist logout` ausführst.
- Um eine vollständige Löschung deiner Daten (einschließlich deines Benutzerdatensatzes) zu beantragen, eröffne ein Issue auf
  [GitHub](https://github.com/antoinemcx/tickly-discord-bot/issues) oder kontaktiere uns auf unserem
  [Support-Server](https://antoinemcx.fr/discord).

## 4. Dienste von Drittanbietern

Tickly interagiert mit den folgenden Diensten von Drittanbietern:
- **Todoist** — Aufgabendaten werden an die API von Todoist übertragen.
  Siehe [Datenschutzerklärung von Todoist](https://todoist.com/privacy).
- **Discord** — der Bot läuft auf der Plattform von Discord.
  Siehe [Datenschutzerklärung von Discord](https://discord.com/privacy).

Wir sind nicht verantwortlich für die Datenpraktiken dieser Dienste.

## 5. Sicherheit

Dein Todoist-Zugriffstoken wird verschlüsselt, bevor es in unserer Datenbank gespeichert wird. Das bedeutet, dass wir dein Token nicht im Klartext lesen können, selbst mit direktem Datenbankzugriff. Diese Verschlüsselung entspricht den Datenschutzanforderungen der DSGVO.

Wir treffen angemessene Maßnahmen, um deine Daten zu schützen, aber kein System ist perfekt sicher.

## 6. Haftungsbeschränkung

Der Bot wird "wie er ist" bereitgestellt, ohne Garantie jeglicher Art. Die Entwickler von Tickly sind nicht
verantwortlich für:
- jegliche direkte oder indirekte Schäden, die durch die Nutzung oder Unfähigkeit zur Nutzung des Bots entstehen
- Aufgabeninhalte, die über Befehle gesendet werden, da sie Eigentum von Todoist sind und vom Nutzer erstellt werden
- Ausfallzeiten oder Fehler bei der Nutzung des Bots

Für den vollständigen Haftungsausschluss siehe die [GPL-3.0-Lizenz](../../LICENSE) (Abschnitte 15–16).

## 7. Kontakt

Um ein Problem zu melden oder eine Frage zu dieser Erklärung zu stellen:
- Eröffne ein Issue auf [GitHub](https://github.com/antoinemcx/tickly-discord-bot/issues)
- Tritt unserem [Discord-Support-Server](https://antoinemcx.fr/discord) bei
