# Pierwsze kroki z Tickly
## Instalacja
Tickly można dodać na dwa sposoby:
- [**Instalacja na serwerze:**](https://discord.com/oauth2/authorize?client_id=1483931102514249830) korzystaj z bota Tickly na wybranym serwerze.
- [**Instalacja na koncie użytkownika (zalecana):**](https://discord.com/oauth2/authorize?client_id=1483931102514249830) korzystaj z bota Tickly w dowolnym miejscu na Discordzie, w tym na serwerach i w wiadomościach prywatnych.

Dla największej wygody zalecamy instalację bota Tickly **na swoim koncie użytkownika**.  
Pozwala to na korzystanie z niego w każdym miejscu na Discordzie: w wiadomościach prywatnych oraz na dowolnym serwerze, nawet jeśli bot nie został tam dodany.  
Niektóre komendy mogą być dostępne wyłącznie w przypadku instalacji na koncie użytkownika.

![Przycisk instalacji na koncie użytkownika](../../src/bot/assets/user_install.png)

> Uwaga! Niektóre serwery mogą blokować aplikacje instalowane na koncie użytkownika (nazywane "aplikacjami zewnętrznymi" w uprawnieniach serwera Discord).  
> W takich przypadkach bot nie zadziała i konieczne może być dodanie go na serwerze.

## Pierwsze kroki
Jeżeli korzystasz z bota po raz pierwszy, wykonaj te proste kroki:
1. Dodaj bota Tickly na swoim koncie lub na serwerze.
2. Otwórz dowolny czat, gdzie Tickly jest dostępny, wpisz `/` i uruchom `/todoist login`.
3. Nastąpi przekierowanie do strony logowania OAuth2 Todoist.  
Po zatwierdzeniu dostępu Tickly zapisze Twój token Todoist na czas trwania sesji dla przyszłych interakcji.  
Domyślnie Twoja sesja wygasa po 30 dniach nieaktywności - możesz zmienić to za pomocą `/settings`.
4. Po powrocie do Discorda użyj komendy `/help`, aby wyświetlić listę komend oraz poradnik na start.

## Korzystanie z bota
Po zakończeniu instalacji możesz wchodzić w interakcję z botem za pomocą:
- [**Komend slash**](https://discord.com/blog/welcome-to-the-new-era-of-discord-apps): wpisz `/` na dowolnym kanale tekstowym lub w wiadomości prywatnej i wybierz komendę.
- [**Menu kontekstowego wiadomości**](https://discord.com/blog/welcome-to-the-new-era-of-discord-apps): kliknij prawym przyciskiem myszy na dowolną wiadomość, następnie wybierz dowolną komendę z sekcji "Aplikacje".

## Dodawanie pierwszego zadania
Aby dodać zadanie do Todoist masz trzy możliwości:
1. Użyj komendy `/todoist add` i wypełnij formularz.
2. Użyj "Dodaj zadanie Todoist" z menu kontekstowego dowolnej wiadomości.  
   Spowoduje to wstępne wypełnienie formularza treścią wiadomości.

   ![Dodawanie z wiadomości](../add_from_message.png)
3. Użyj parametru `content` w komendzie `/todoist add`, aby skorzystać z inteligentnego rozpoznawania.  
   Możesz na przykład wpisać `/todoist add content:Kupić mleko jutro o 17 !!2 #MójProjekt`. Więcej informacji znajdziesz [tutaj](https://www.todoist.com/pl/help/articles/use-task-quick-add-in-todoist-va4Lhpzz#h_01J1DEY59AGACAT8JW998EPH74).

   ![Dodawanie za pomocą inteligentnego rozpoznawania](../add_natural_language.png)
