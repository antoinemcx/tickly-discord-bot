# Erste Schritte mit Tickly
## Installation
Tickly kann auf zwei Arten installiert werden:
- [**Server-Installation:**](https://discord.com/oauth2/authorize?client_id=1483931102514249830) nutze Tickly innerhalb eines bestimmten Servers.
- [**Benutzer-Installation (empfohlen):**](https://discord.com/oauth2/authorize?client_id=1483931102514249830) nutze Tickly von überall in Discord, einschließlich Direktnachrichten und Servern.

Wir empfehlen, Tickly **auf deinem Benutzerkonto** als Benutzer-Installation zu installieren, für das beste Erlebnis.  
So kannst du den Bot von überall in Discord nutzen: in Direktnachrichten oder auf jedem Server, auch wenn dieser ihn nicht hinzugefügt hat.  
Einige Befehle sind möglicherweise nur mit einer Benutzer-Installation verfügbar.

![Benutzer-Installations-Button](../../src/bot/assets/user_install.png)

> Bitte beachte jedoch, dass einige Server benutzerinstallierte Apps (in den Discord-Berechtigungen "externe Apps" genannt) deaktivieren können.  
> Der Bot würde auf diesen Servern nicht funktionieren und du müsstest den Server bitten, ihn als Server-Installation zu installieren.

## Erste Schritte
Wenn du neu beim Bot bist, folge diesen einfachen Schritten:
1. Installiere Tickly auf deinem Benutzerkonto oder auf deinem Server.
2. Öffne einen beliebigen Chat, in dem Tickly verfügbar ist, tippe `/` und führe `/todoist login` aus.
3. Du wirst zur Todoist OAuth2-Anmeldung weitergeleitet.  
Nachdem du den Zugriff genehmigt hast, speichert Tickly deinen Todoist-Zugriffstoken in einer Sitzung für zukünftige Interaktionen.  
Standardmäßig läuft deine Sitzung nach 30 Tagen Inaktivität ab — du kannst dies in `/settings` ändern.
4. Zurück in Discord, führe `/help` aus, um die Befehlsliste und eine Startanleitung zu sehen.

## Interaktion mit dem Bot
Nach der Installation kannst du mit dem Bot interagieren durch:
- [**Schrägstrich-Befehle**](https://discord.com/blog/welcome-to-the-new-era-of-discord-apps): tippe `/` in einem beliebigen Textkanal oder einer Direktnachricht und wähle einen Befehl aus.
- [**Nachrichten-Kontextmenü**](https://discord.com/blog/welcome-to-the-new-era-of-discord-apps): klicke mit der rechten Maustaste auf eine beliebige Nachricht und wähle einen Befehl aus dem Abschnitt "Apps".

## Deine erste Aufgabe hinzufügen
Um eine Aufgabe zu Todoist hinzuzufügen, hast du drei Möglichkeiten:
1. Verwende den Schrägstrich-Befehl `/todoist add` und fülle das Formular aus.
2. Verwende den "Add to Todoist" Kontextmenü-Befehl auf einer beliebigen Nachricht.  
   Dies füllt das Formular mit dem Nachrichteninhalt vor.

   ![Aus Nachricht hinzufügen](../add_from_message.png)
3. Verwende den Parameter `content` des `/todoist add` Befehls für natürliche Spracheingabe.  
   Zum Beispiel kannst du `/todoist add content:Milch kaufen morgen um 17 Uhr !!2 #MeinProjekt` eingeben. Mehr dazu [hier](https://www.todoist.com/fr/help/articles/use-task-quick-add-in-todoist-va4Lhpzz#h_01J1DEY59AGACAT8JW998EPH74).

   ![Natürliche Sprache hinzufügen](../add_natural_language.png)
