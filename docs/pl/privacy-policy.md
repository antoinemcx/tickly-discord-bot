# Polityka prywatności

**Ostatnia aktualizacja: 28 września 2026**

Tickly („bot”, „my”, „nas”) to bot Discord, który łączy Twoje konto Discord z serwisem Todoist.
Niniejszy dokument wyjaśnia, jakie dane zbieramy, w jakim celu to robimy oraz jak długo je przechowujemy.

## 1. Jakie dane zbieramy

Gdy korzystasz z bota Tickly, w naszej bazie danych zapisujemy następujące informacje:

| Dane | Cel przetwarzania |
|---|---|
| ID użytkownika Discord (Discord User ID) | Identyfikacja użytkownika oraz powiązanie jego preferencji i sesji z kontem |
| Preferowany język | Udzielanie odpowiedzi w wybranym języku |
| Ustawienie czasu trwania sesji | Uwzględnienie wybranego czasu wygaśnięcia sesji |
| Token dostępu Todoist | Wykonywanie operacji w Todoist w Twoim imieniu (np. pobieranie i tworzenie zadań) |
| Znaczniki czasu sesji (utworzenie, ostatnie użycie) | Zarządzanie cyklem życia i wygasaniem sesji |

**Nie** przechowujemy treści wiadomości z Discorda ani zawartości zadań. Dane zadań są przesyłane bezpośrednio do API Todoist i podlegają [Polityce prywatności Todoist](https://todoist.com/privacy).

## 2. W jaki sposób wykorzystujemy Twoje dane

Twoje dane są wykorzystywane wyłącznie w celu zapewnienia prawidłowego działania bota Tickly:
- Twoje ID użytkownika Discord łączy sesję Todoist z Twoim kontem Discord.
- Twój token dostępu służy wyłącznie do komunikacji z API Todoist w Twoim imieniu.
- Żadne dane nie są sprzedawane, udostępniane podmiotom trzecim w celach komercyjnych ani wykorzystywane do wyświetlania reklam.

## 3. Przechowywanie danych

- **Aktywne sesje** wygasają po określonym czasie braku aktywności (domyślnie: 30 dni). Możesz to zmienić za pomocą komendy `/settings`.
- **Oczekujące sesje OAuth** (rozpoczęte, lecz niedokończone) wygasają automatycznie po 15 minutach.
- W każdej chwili możesz usunąć swoją sesję oraz token dostępu, wpisując komendę `/todoist logout`.
- Aby zażądać całkowitego usunięcia swoich danych (w tym profilu użytkownika), utwórz zgłoszenie w serwisie [GitHub](https://github.com/antoinemcx/tickly-discord-bot/issues) lub skontaktuj się z nami na naszym [serwerze wsparcia](https://antoinemcx.fr/discord).

## 4. Usługi podmiotów trzecich

Tickly współpracuje z następującymi usługami zewnętrznymi:
- **Todoist** — dane zadań są przesyłane do API Todoist. Więcej informacji znajdziesz w [Polityce prywatności Todoist](https://todoist.com/privacy).
- **Discord** — bot działa na platformie Discord. Więcej informacji znajdziesz w [Polityce prywatności Discorda](https://discord.com/privacy).

Nie ponosimy odpowiedzialności za praktyki tych podmiotów w zakresie ochrony danych.

## 5. Bezpieczeństwo

Twój token dostępu Todoist jest przechowywany w prywatnej bazie danych. Stosujemy uzasadnione środki ostrożności w celu ochrony Twoich danych, pamiętaj jednak, że żaden system informatyczny nie jest w pełni bezpieczny.

## 6. Ograniczenie odpowiedzialności

Bot jest udostępniany w stanie, w jakim się znajduje („as is”), bez jakichkolwiek gwarancji. Twórcy bota Tickly nie ponoszą odpowiedzialności za:
- jakiekolwiek bezpośrednie lub pośrednie szkody wynikające z korzystania lub braku możliwości korzystania z bota,
- treść zadań przesyłanych za pomocą komend (ich właścicielem jest Todoist, a autorem – użytkownik),
- przerwy w działaniu bota lub błędy występujące podczas jego używania.

Pełną treść wyłączenia odpowiedzialności znajdziesz w [licencji GPL-3.0](../../LICENSE) (sekcje 15–16).

## 7. Kontakt

Aby zgłosić problem lub zadać pytanie dotyczące niniejszej polityki:
- Utwórz zgłoszenie w serwisie [GitHub](https://github.com/antoinemcx/tickly-discord-bot/issues)
- Dołącz do naszego [serwera wsparcia na Discordzie](https://antoinemcx.fr/discord)