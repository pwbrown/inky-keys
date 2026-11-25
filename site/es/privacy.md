# Privacidad

Inky Keys no recoge **nada** sobre ti.

- **Sin estadísticas, rastreo, anuncios, informes de errores ni scripts de terceros.** El código del juego solo se comunica con el sitio desde el que se cargó, además de la descarga opcional de palabras y, cuando jugáis juntos, de los otros dispositivos de tu propia red (las dos cosas se describen más abajo).
- **Tus datos se quedan en tu navegador.** Las teclas que eliges, tus ajustes de teclas, tu progreso, tus récords y tus estadísticas por tecla se guardan en tu dispositivo (IndexedDB) y nunca se envían a ningún sitio. Los ajustes de pantalla y de sonido se guardan en el almacenamiento local del navegador.
- **Los jugadores.** Varias personas pueden jugar en un mismo navegador, cada una con sus propios datos guardados. Un jugador es solo un nombre y un color de gota de tinta que tú eliges, guardados con los datos en tu dispositivo. No hay cuentas, y nada pasa de un dispositivo a otro a menos que lo envíes tú (mira **Pasar a otro dispositivo** más abajo).
- **Tú tienes el control.** En el juego, abre **Gestionar datos guardados** (pulsa **G** en el menú principal) para exportar una copia de seguridad de los datos del jugador actual, importar una o borrarlos. **Cambiar de jugador** (U) te permite renombrar o borrar jugadores. Si borras los datos del sitio de Inky Keys en tu navegador, se borra todo.
- **Sin conexión.** Después de la primera visita, el juego funciona desde la caché de tu navegador y no necesita conexión.

## El alojamiento del sitio web

Cuando el juego se sirve desde un sitio web (por ejemplo, GitHub Pages), ese servicio de alojamiento recibe la información normal que incluye cualquier petición web, como tu dirección IP y el tipo de navegador, y puede guardar registros del servidor según su propia política de privacidad. Inky Keys no tiene acceso a esos registros y no les añade nada. Para GitHub Pages, consulta la [declaración de privacidad de GitHub](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

## Listas de palabras (descarga opcional)

Al pulsar **L** se abren las **Listas de palabras**, donde puedes descargar palabras sobre un tema. Solo cuando haces clic en **Descargar palabras**, Inky Keys envía el tema que escribiste, y nada más, a la [API pública de Wikipedia](https://www.mediawiki.org/wiki/API:Main_page) en tu idioma de las palabras (`es.wikipedia.org` para las palabras en español, `en.wikipedia.org` para el inglés, `fr.wikipedia.org` para el francés), que devuelve el artículo que mejor coincide. La petición no lleva cookies, ni referente, ni identificadores (solo una cabecera con el nombre del juego, como Wikimedia pide a las aplicaciones). Wikipedia recibe la petición como lo haría cualquier servidor web (incluida tu dirección IP), según la [política de privacidad de Wikimedia](https://foundation.wikimedia.org/wiki/Policy:Privacy_policy). Inky Keys elige las palabras del artículo en tu dispositivo, se queda solo con ellas y las guarda en tu dispositivo para que funcionen sin conexión.

Es la única petición a internet que hace el juego aparte de cargarse a sí mismo, y nunca ocurre si no lo pides tú.

## Pasar a otro dispositivo

En **Gestionar datos guardados**, **Copiar enlace de traspaso** pone el nombre, la gota de tinta y el progreso del jugador actual (todo lo que hay en sus datos guardados excepto las listas de palabras descargadas) en un enlace, después de un `#`. Los navegadores nunca envían esa parte al sitio web. Te envías el enlace a ti mismo como quieras y lo abres en el otro dispositivo, donde el juego lo lee, lo quita de la barra de direcciones y te pregunta si quieres añadir el jugador o sustituir al actual.

Cualquiera que tenga el enlace puede cargar una copia de ese progreso, así que envíatelo solo a ti. El juego comprueba un enlace de traspaso exactamente igual que un archivo de copia de seguridad importado.

## Compartir tu resultado de la Página del día

En la pantalla de la **Página del día** puedes copiar tu resultado. Se crea en tu dispositivo; el juego no envía nada.

- **Copiar el resultado** pone un texto corto en tu portapapeles: tus puntos, tus palabras por minuto, tu precisión, la nota de cada página, tu racha y un **enlace de reto**.
- El enlace de reto contiene el número de la página del día, la distribución de tu teclado, tu idioma de las palabras (cuando no es el inglés), tus puntos y las notas de las páginas, después de un `#` en la dirección. Los navegadores nunca envían esa parte al sitio web, así que el servicio de alojamiento no la ve cuando un amigo abre el enlace. Tu nombre de jugador solo se añade si marcas **Firmar mi enlace de reto**.
- Cuando abres el enlace de reto de otra persona, el juego lo lee en tu navegador y lo quita de la barra de direcciones. Un nombre en un enlace se reduce a letras, números y espacios, y se deja fuera si el filtro de palabras no lo permitiría.

## Jugar juntos

**Jugar juntos** conecta tu dispositivo directamente con los de tus amigos en la misma red (WebRTC). No hay servidor de juego: el juego no usa servidores STUN, TURN ni de retransmisión, así que la conexión se queda en tu red y nada sale a internet.

- **Los códigos.** Como no hay servidor, los jugadores se intercambian un código corto en cada sentido: la invitación del anfitrión y luego la respuesta del jugador. Un código contiene lo que dos navegadores necesitan para encontrarse en tu red: una huella de clave de un solo uso, una contraseña de un solo uso, y la dirección y el puerto de este dispositivo en la red local. Normalmente los navegadores esconden la dirección tras un nombre al azar (`….local`); después de permitir el micrófono, pueden mostrar la dirección local real (como `192.168.1.23`). Un código solo sirve en tu red, para esa partida.
- **Enviar los códigos.** Tú eliges cómo viaja un código: copiarlo, enviarlo como enlace (va después de un `#`, que los navegadores nunca envían al sitio web) o **reproducirlo como sonido**. Si lo envías por una aplicación de mensajes o por correo, ese servicio lo lleva como cualquier otro mensaje.
- **El sonido y el micrófono.** **Escuchar** enciende el micrófono para oír un código que reproduce el otro dispositivo; **Dejar de escuchar**, conectar o cerrar Jugar juntos lo apagan. El sonido se descodifica en tu dispositivo y se descarta enseguida; no se graba ni se envía nada.
- **Lo que comparten los jugadores.** Tu nombre de jugador y el color de tu gota de tinta van al anfitrión, que los muestra a todos en la partida. El anfitrión comprueba los nombres con el mismo filtro de palabras que los enlaces de reto. No se guarda nada en los otros dispositivos.

## Enlaces a GitHub

La pantalla **Acerca de** tiene enlaces al código fuente de Inky Keys y a un formulario para proponer ideas o informar de errores, ambos en GitHub. Son enlaces normales: el juego no envía nada, y GitHub solo sabe de ti si haces clic en uno, en una pestaña nueva, según la [declaración de privacidad de GitHub](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).
