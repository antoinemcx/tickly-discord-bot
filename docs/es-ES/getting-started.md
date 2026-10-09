# Primeros pasos con Tickly
## Instalación
Tickly se puede instalar de dos formas:
- [**Instalación en servidor:**](https://discord.com/oauth2/authorize?client_id=1483931102514249830) usa Tickly dentro de un servidor específico.
- [**Instalación de usuario (recomendado):**](https://discord.com/oauth2/authorize?client_id=1483931102514249830) usa Tickly desde cualquier lugar en Discord, incluyendo mensajes directos y servidores.

Recomendamos instalar Tickly **en tu cuenta de usuario**, como instalación de usuario, para la mejor experiencia.  
Te permite usar el bot desde cualquier lugar en Discord: en mensajes directos o en cualquier servidor, incluso si no lo han añadido.  
Algunos comandos pueden estar disponibles solo con una instalación de usuario.

![Botón de instalación de usuario](../../src/bot/assets/user_install.png)

> Sin embargo, ten en cuenta que algunos servidores pueden desactivar las aplicaciones instaladas por usuarios (llamadas "aplicaciones externas" en los permisos de Discord).  
> El bot no funcionaría en esos servidores y podrías necesitar que el servidor lo instale como instalación de servidor.

## Primeros pasos
Si eres nuevo con el bot, sigue estos sencillos pasos:
1. Instala Tickly en tu cuenta de usuario o en tu servidor.
2. Abre cualquier chat donde Tickly esté disponible, escribe `/`, y ejecuta `/todoist login`.
3. Serás redirigido al inicio de sesión OAuth2 de Todoist.  
Después de aprobar el acceso, Tickly almacena tu token de acceso de Todoist en una sesión para futuras interacciones.  
Por defecto, tu sesión expira después de 30 días de inactividad — puedes cambiar esto en `/settings`.
4. De vuelta en Discord, ejecuta `/help` para ver la lista de comandos y una guía de inicio.

## Interactuando con el bot
Después de instalarlo, puedes interactuar con el bot usando:
- [**Comandos de barra**](https://discord.com/blog/welcome-to-the-new-era-of-discord-apps): escribe `/` en cualquier canal de texto o mensaje directo y selecciona un comando.
- [**Menú contextual de mensaje**](https://discord.com/blog/welcome-to-the-new-era-of-discord-apps): haz clic derecho en cualquier mensaje y selecciona un comando de la sección "Aplicaciones".

## Añadiendo tu primera tarea
Para añadir una tarea a Todoist, tienes tres opciones:
1. Usa el comando de barra `/todoist add` y completa el formulario.
2. Usa el comando de menú contextual "Add to Todoist" en cualquier mensaje.  
   Esto rellenará previamente el formulario con el contenido del mensaje.

   ![Añadir desde mensaje](../add_from_message.png)
3. Usa el parámetro `content` del comando `/todoist add` para usar entrada en lenguaje natural.  
   Por ejemplo, puedes escribir `/todoist add content:Comprar leche mañana a las 5pm !!2 #MiProyecto`. Ver más [aquí](https://www.todoist.com/fr/help/articles/use-task-quick-add-in-todoist-va4Lhpzz#h_01J1DEY59AGACAT8JW998EPH74).

   ![Añadir lenguaje natural](../add_natural_language.png)
