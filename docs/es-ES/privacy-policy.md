# Política de Privacidad

**Última actualización: 28 de septiembre de 2026**

Tickly ("el bot", "nosotros") es un bot de Discord que conecta tu cuenta de Discord con Todoist.
Esta política explica qué datos recopilamos, por qué y durante cuánto tiempo los conservamos.

## 1. Datos que Recopilamos

Cuando usas Tickly, almacenamos los siguientes datos en nuestra base de datos:

| Datos | Propósito |
|---|---|
| ID de Usuario de Discord | Identificarte y vincular tus preferencias y sesión a tu cuenta |
| Preferencia de idioma | Responder en tu idioma preferido |
| Preferencia de retención de sesión | Respetar tu configuración de expiración de sesión |
| Token de acceso de Todoist | Ejecutar operaciones de Todoist en tu nombre (obtener o crear tareas, etc.) |
| Marcas de tiempo de sesión (creada, último uso) | Gestionar el ciclo de vida y expiración de sesiones |

**No** almacenamos el contenido de mensajes de Discord ni el contenido de tareas. Los datos de tareas se envían directamente
a la API de Todoist y están regidos por la [Política de Privacidad de Todoist](https://todoist.com/privacy).

## 2. Cómo Usamos tus Datos

Tus datos se utilizan exclusivamente para proporcionar la funcionalidad de Tickly:
- Tu ID de Usuario de Discord vincula tu sesión de Todoist a tu cuenta de Discord.
- Tu token de acceso se usa únicamente para interactuar con la API de Todoist en tu nombre.
- Ningún dato se vende, comparte con terceros con fines comerciales, ni se usa para publicidad.

## 3. Retención de Datos

- **Las sesiones activas** expiran después de un período configurable de inactividad (por defecto: 30 días).
  Puedes cambiar esto con `/settings`.
- **Las sesiones OAuth pendientes** (iniciadas pero no completadas) expiran automáticamente después de 15 minutos.
- Puedes eliminar tu sesión y token de acceso en cualquier momento ejecutando `/todoist logout`.
- Para solicitar la eliminación completa de tus datos (incluyendo tu registro de usuario), abre un issue en
  [GitHub](https://github.com/antoinemcx/tickly-discord-bot/issues) o contáctanos en nuestro
  [servidor de soporte](https://antoinemcx.fr/discord).

## 4. Servicios de Terceros

Tickly interactúa con los siguientes servicios de terceros:
- **Todoist** — los datos de tareas se transmiten a la API de Todoist.
  Ver [Política de Privacidad de Todoist](https://todoist.com/privacy).
- **Discord** — el bot opera en la plataforma de Discord.
  Ver [Política de Privacidad de Discord](https://discord.com/privacy).

No somos responsables de las prácticas de datos de estos servicios.

## 5. Seguridad

Tu token de acceso de Todoist se cifra antes de almacenarse en nuestra base de datos. Esto significa que no podemos leer tu token en texto plano, ni siquiera con acceso directo a la base de datos. Este cifrado cumple con los requisitos de protección de datos del RGPD.

Tomamos medidas razonables para proteger tus datos, pero ningún sistema es perfectamente seguro.

## 6. Limitación de Responsabilidad

El bot se proporciona "tal cual", sin garantía de ningún tipo. Los desarrolladores de Tickly no son
responsables de:
- cualquier daño directo o indirecto causado por el uso o la imposibilidad de usar el bot
- contenido de tareas enviado a través de comandos, ya que son propiedad de Todoist y creadas por el usuario
- tiempo de inactividad o errores en el uso del bot

Para el descargo de responsabilidad completo, consulta la [Licencia GPL-3.0](../../LICENSE) (secciones 15–16).

## 7. Contacto

Para reportar un problema o hacer una pregunta sobre esta política:
- Abre un issue en [GitHub](https://github.com/antoinemcx/tickly-discord-bot/issues)
- Únete a nuestro [servidor de Discord de soporte](https://antoinemcx.fr/discord)
