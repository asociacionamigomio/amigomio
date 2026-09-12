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
administración. 68 pruebas en verde.

**Todavía no existe**: reservas, alojamientos, tarifas, festivos, disponibilidad, justificantes,
correos automáticos, el cuadro de ocupación, la hoja del día, los libros de registro ni Zapatilla.
Eso son las fases 1 a 4.

Lee `2026-09-12-amigomio-reservas-design.md` (el diseño) y `2026-09-12-plan-fase-0.md` (el plan)
antes de tocar nada.

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

## Cómo se aplica un cambio de base de datos

1. Editar `db/schema.sql` (y `db/storage.sql` si toca).
2. `npm test` — las pruebas leen el SQL y comprueban que todas las tablas tienen RLS y políticas.
3. Pegarlo entero en **SQL Editor → New query** de Supabase y ejecutarlo. Es idempotente: todo va
   con `if not exists` / `or replace` / `drop ... if exists`.
4. Comprobar **en la base real** lo que acabas de escribir. Que el SQL no dé error no significa que
   la regla funcione.
