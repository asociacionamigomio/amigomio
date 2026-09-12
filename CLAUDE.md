# AmigoMío

App de reservas del **Hotel, Residencia y Guardería Canina AmigoMío** (El Marquesado, Puerto
Real, Cádiz). Sustituirá a Wix Bookings; la web de Wix (`amigomio.org`) se queda como escaparate,
blog y campus.

Vive en <https://github.com/asociacionamigomio/amigomio>. **El repositorio es público.**

## Interlocutor

Santiago Díaz Fandiño. Médico y juez FCI-IGP, **no programador**. Explícale las cosas en español,
sin jerga, y dile siempre qué tiene que hacer él, paso a paso. Prefiere respuestas directas y con
datos. Trabaja también en `~/ceppb-libro-de-cria`, que usa esta misma pila y las mismas mañas.

## Estado a 12 de septiembre de 2026

**Fase 0 terminada**: entrada con correo y contraseña, fichas de cliente y de perro con su
cuestionario y sus fechas sanitarias, solicitudes de cambio de chip y nombre, y panel de
administración.

**Fase 1 terminada (el motor)**: 32 alojamientos, tarifas y festivos editables desde el panel,
precio de cada noche, presupuesto completo con desglose, disponibilidad con dos topes y
`crear_reserva`. Todo dentro de Postgres.

**También hecho**: pantalla de reservar, mis reservas, clicker virtual, instalación en el móvil,
y **Zapatilla** publicado como Edge Function.

**135 pruebas en verde** (`npm test`).

**Todavía no existe**: el reloj que caduca las reservas a las 24 h, los correos y las push, el
justificante subido, el cuadro de ocupación, la hoja del día, los libros de registro, los tips de
educación canina, las clases de adiestramiento y las pruebas oficiales.

**Pendiente de Santiago**: contrastar el motor con reservas reales ya cobradas (fase 1, tarea 6);
el contenido de los tips; y decidir si el tope de perros son 90 o 92.

Lee `2026-09-12-amigomio-reservas-design.md` (el diseño), `2026-09-12-plan-fase-0.md` y
`2026-09-12-plan-fase-1.md` antes de tocar nada.

## Pila técnica

- **Frontend**: HTML + CSS + JavaScript sin framework. **Sin paso de compilación**: lo que hay en
  el repositorio es lo que se sirve. GitHub Pages desde `main`.
- **Backend**: Supabase — Postgres, Auth (correo y contraseña), Storage y **Row Level Security**
  haciendo cumplir las reglas.
- **Pruebas**: `npm test` (`node --test`), sin framework. `npm run servir` levanta la web en
  <http://localhost:8777>.

## Reglas que no se negocian

1. **Las reglas viven en la base de datos, no en el navegador.** Precio, disponibilidad y permisos
   se comprueban en Postgres con RLS y triggers. Ocultar un botón o deshabilitar un campo es para
   no enseñar cosas inútiles, **nunca** es la protección.
2. **El chip y el nombre del perro son inmutables para el propietario.** Solo puede *solicitar* el
   cambio; lo aprueba administración. Lo impide el trigger `perro_chip_y_nombre_inmutables`.
3. **Nadie se asciende a sí mismo.** `es_admin` y `paga_en_persona` los devuelve a su sitio el
   trigger `cliente_no_se_asciende`.
4. **En el repositorio no entran datos personales ni secretos.** Es público. Ahí no van: correos de
   administración, DNI, teléfonos particulares, la dirección exacta del núcleo, el IBAN ni la clave
   `service_role`. Todo eso vive en la base de datos o en ficheros `*.local.sql`, que están en
   `.gitignore`.
5. **Registro abierto, pero sin correo verificado no se reserva.** Es la única barrera que impide
   que alguien con un correo inventado retenga un alojamiento en Semana Santa.
6. **Tono amigable y familiar** en todo texto que vea el cliente. «Nos falta saber cuánto pesa
   Luna», no «Error: campo obligatorio». El tono ya existe en la web de AmigoMío; se continúa.
7. **Prueba primero.** Cada cambio entra con su prueba escrita antes, y se comprueba que falla
   antes de escribir el código.

## Decisiones que no se deducen del código

1. **La unidad que se reserva es el box, no la plaza.** Un cliente reserva un alojamiento y mete
   dentro de 1 a 3 perros suyos. (Fase 1.)
2. **El peso y el celo NO van en la ficha del perro**: se preguntan en cada reserva. Grabados una
   vez, a los tres meses son mentira y se toman decisiones de manejo con datos falsos.
3. **Solo la rabia y las dos desparasitaciones impiden entrar.** El resto de vacunas se piden y se
   avisa si caducan, pero no bloquean. **Esto se aparta del programa sanitario del núcleo**, que
   exige la pauta completa: es decisión consciente de Santiago del 12/09/2026. Cambiarlo es tocar
   `obligatorio` en `js/sanidad.js`; la lógica de vigencia no se entera de cuáles son cuáles.
4. **La vigencia sanitaria se comprueba contra las fechas de la estancia, no contra hoy.** Y hay
   tres formas distintas de no valer, que no se pueden confundir: las vacunas **caducan después**;
   la desparasitación interna **tiene que ser reciente** (30 días antes); la tos de las perreras
   **necesita margen** (15 días, 21 si es primovacunación).
5. **Administración por lista de correos.** Quien se da de alta con un correo de `admin_autorizado`
   queda administrador solo. La tabla tiene RLS y **cero políticas**: eso es lo que la cierra, no
   un descuido.
6. **El alta del perro va en tres pasos y se puede guardar a medias.** De una sentada la gente
   abandona el formulario.
7. **Subir la cartilla es VOLUNTARIO.** Ni bloquea, ni impide reservar, ni se pide dos veces.
   Está al final de la ficha del perro y con ese tono. Si algún día pareciera un trámite
   obligatorio, la gente abandonaría la ficha entera.
8. **El antiparasitario externo va en lista, no en hueco.** Collar y pipeta a la vez es lo
   normal aquí. La caducidad del conjunto es la MÁS TARDÍA: está cubierto mientras le quede
   alguno.

## Mañas que ya han costado una tarde

- **Nunca llames a una variable de plpgsql como una columna.** Un trigger declaraba `correo` y
  `admin_autorizado` tiene una columna `correo`: Postgres respondía «ambiguous» y la ficha del
  cliente no se creaba nunca. Hay prueba que lo caza.
- **No te tragues los errores de Supabase.** Costó ver lo anterior porque el insert se ignoraba.
- **Si una tabla enlaza dos veces con otra, la consulta tiene que decir por cuál.**
  `cliente!solicitud_cambio_cliente_id_fkey(...)`, no `cliente(...)`. Hay prueba que lo detecta.
- **`js/sesion.js` usa `globalThis.window`**, no `window` a secas: también lo cargan las pruebas,
  donde no hay navegador.
- **El CSS de los campos no puede depender de `type="text"`**, porque es justo lo que se olvida
  escribir.
- **Un `const` no se puede usar antes de su línea.** Una vista se quedaba en «Un momento…» para
  siempre porque el atajo `panel` estaba declarado debajo de donde se usaba. Las funciones
  declaradas con `function` sí valen antes; las flechas asignadas a `const`, no.
- **Chrome no ofrece instalar una PWA cuyo service worker no intercepta peticiones**, aunque el
  manifiesto y los iconos sean perfectos. Y no avisa: el botón no aparece y no sabes por qué.
- **El service worker sirve versiones viejas mientras desarrollas.** Si un cambio no se ve,
  `Cmd+Shift+R`. Lo de Supabase no se cachea nunca, a propósito.
- **Las funciones `security definer` se saltan RLS**, así que la puerta la vigilan ellas mismas.
  Con `auth.uid()` nulo, un visitante sin identificar pasaría las comprobaciones de «¿es tuyo?».
  Hay que distinguir al servidor (`current_user in ('postgres','supabase_admin')`) de internet.

## Los correos

Los avisos **no se mandan desde el navegador**: se encolan en la tabla `aviso` y los entrega la
Edge Function `avisos`. Desde la pantalla se perderían al cerrar la pestaña, se mandarían dos
veces al recargar, y haría falta la clave del proveedor en el navegador, que es como publicarla.

Cada aviso lleva una **marca única**. Es lo que impide mandar dos veces lo mismo, y es el fallo
que convierte un servicio útil en correo basura. `preparar_avisos()` se puede ejecutar todas las
veces que haga falta.

Hacen falta dos secretos en **Edge Functions → Secrets**: `RESEND_API_KEY` y `CRON_SECRET`.

## Zapatilla

El asistente vive en `supabase/functions/zapatilla/`. Dos cosas que no se tocan:

1. **Habla con la base de datos usando la sesión del cliente, nunca `service_role`.** No puede
   hacer nada que ese cliente no pudiera hacer solo. La protección no es lo que le pidamos en el
   texto —un modelo puede ignorar cualquier instrucción— sino que la base de datos le dice que no.
2. **No calcula nada.** Precio, disponibilidad y creación de reserva se preguntan al motor. Si
   Zapatilla sumara por su cuenta, comprometería a AmigoMío con tarifas que no existen.

Se publica desde **Edge Functions → Deploy a new function → Via Editor**, en el navegador. No hace
falta la CLI de Supabase ni Homebrew, que no están instalados en el Mac de Santiago.

La clave de Claude vive en **Edge Functions → Secrets** como `ANTHROPIC_API_KEY`. No entra nunca
en el repositorio ni en una conversación.

## Cómo se aplica un cambio de base de datos

**`npm run sql`** junta todos los ficheros de `db/` en el orden correcto y los deja en el
portapapeles. El orden vive en **`db/orden.txt`**, y hay una prueba que salta si algún fichero
`.sql` no está en esa lista: uno que no esté no se aplica nunca, y eso no se nota hasta que
falla en producción.

Varios ficheros **llevan sus propias pruebas dentro**, en bloques `do $$ ... assert ... end $$`.
Aplicarlos en Supabase ES ejecutar esas pruebas contra Postgres de verdad: si un precio o una
regla falla, la instalación aborta en vez de quedarse callada.

1. Editar el fichero que toque (y añadirlo a `db/orden.txt` si es nuevo).
2. `npm test` — las pruebas leen el SQL y comprueban que todas las tablas tienen RLS y políticas.
3. `npm run sql`, pegar en **SQL Editor → New query** de Supabase y ejecutarlo. Es idempotente:
   todo va con `if not exists` / `or replace` / `drop ... if exists`.
4. Comprobar **en la base real** lo que acabas de escribir. Que el SQL no dé error no significa
   que la regla funcione.

