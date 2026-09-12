# Diseño — App de reservas de AmigoMío

**Fecha:** 12 de septiembre de 2026
**Interlocutor:** Santiago Díaz Fandiño. Médico y juez FCI-IGP, **no programador**.
Explicarle todo en español, sin jerga, diciéndole siempre qué tiene que hacer él.
**Estado:** diseño aprobado en conversación. Pendiente de su lectura completa antes de programar.

**Revisión 2 (12/09/2026):** incorporado el *Programa de manejo, higiene y profilaxis del núcleo
zoológico* de 01/09/2026. Santiago lo aportó **como fuente de los libros de registro que necesita
y de los requisitos sanitarios**, no como documento de referencia para la capacidad. De ahí salen
el control sanitario de admisión (§13) y el módulo de libros (§14).

**Los números de capacidad los da Santiago: 30 alojamientos normales y 2 especiales.** Las cifras
del informe (24 boxes, 30 perros) son anteriores y no son la referencia.

---

## 1. Qué es esto

Una aplicación para móvil que gestiona **íntegramente las reservas** del Hotel, Residencia y
Guardería Canina AmigoMío (El Marquesado, Cádiz). Sustituye a Wix Bookings, que hasta hoy es
donde viven las reservas.

Dos perfiles sobre una sola aplicación:

- **Cliente**: reserva estancias, da de alta sus perros con sus pautas de comida y cuidados,
  sube el justificante del pago, consulta sus estancias anteriores y recibe avisos.
- **Administración** (Santiago, y quien él autorice): ve el cuadro de ocupación, asigna boxes,
  gestiona reservas por teléfono, edita tarifas y festivos, autoriza descuentos y pagos en
  persona, y valida los cambios que requieren su visto bueno.

La web de Wix **no se toca**. Sigue siendo el escaparate público, el blog y el campus. Sólo
cambia el botón «Reservar», que pasará a llevar a la app el día del encendido.

---

## 2. Alcance

### Entra ahora (este diseño)

Reservas de estancia · fichas de perro con pautas de comida y cuidados especiales · historial
de estancias · avisos · panel de administración · motor de precios y disponibilidad ·
**control sanitario de admisión** (§13) · **libros de registro oficiales del núcleo** (§14).

### No entra ahora (cada una con su propio diseño, después)

1. **Zapatilla**, el asistente de IA de atención al cliente
2. Reserva de clases de adiestramiento
3. Inscripción a pruebas de trabajo oficiales
4. Tips de educación canina
5. Clicker virtual

**Pero el diseño de ahora deja el hueco hecho para Zapatilla** (ver §9). Las demás se añaden
encima sin rehacer nada.

---

## 3. Decisiones tomadas que no se deducen del código

Estas son las que hay que releer antes de cambiar nada:

1. **La unidad que se reserva es el box, no la plaza.** Un cliente reserva un alojamiento y
   mete dentro de 1 a 3 perros suyos. Por eso la tarifa base es por box y los perros
   adicionales son un suplemento.
2. **El precio se congela al confirmar la reserva.** Una subida de tarifas no reescribe
   reservas ya hechas. El desglose línea a línea se guarda dentro de la reserva.
3. **Una promoción no se aplica a una reserva ya confirmada.** Sólo a quien reserve durante
   la campaña.
4. **El peso y el celo se preguntan en cada reserva, no en la ficha del perro.** Cambian con
   el tiempo; si se graban una vez, a los tres meses son mentira y se toman decisiones de
   manejo con datos falsos. Lo habitual viene precargado de la ficha; sólo se corrige lo que
   cambie.
5. **El chip y el nombre del perro son inmutables para el propietario.** Puede cambiar todo lo
   demás cuando quiera. Chip y nombre sólo puede *solicitarlos*, y el cambio no ocurre hasta
   que administración lo aprueba. Se protege **con regla en la base de datos**, no con un
   campo deshabilitado en pantalla.
6. **El cliente no elige box.** Elige fechas y cuántos perros. El sistema le asigna
   internamente un box provisional (para poder impedir solapes a nivel de motor) y
   administración lo recoloca libremente hasta la llegada.
7. **Las reglas viven en la base de datos, no en el navegador.** Precio y disponibilidad se
   calculan dentro de Postgres. Manipular el móvil no sirve de nada. Es la misma doctrina que
   en Mi CEPPB protege los títulos con trigger.
8. **El IBAN no se escribe en el repositorio.** Es un dato de configuración que vive en la base
   de datos y que Santiago edita desde su panel. El repositorio puede ser público.
9. **La app nace con las reservas apagadas.** Ver §16.
10. **Hay dos topes, no uno.** Que quede box libre NO significa que se pueda admitir. La
    autorización del núcleo zoológico fija un **máximo de perros simultáneos**, y con hasta 3
    perros por box el número de boxes libres se queda corto como control. El motor comprueba
    **las dos cosas** (§7.2).
11. **Ni el número de alojamientos ni el tope legal se escriben en el código.** Los alojamientos
    salen de su tabla; el tope simultáneo es un ajuste editable.
12. **Los perros que comparten box deben ser del mismo propietario y con su autorización
    expresa**, por exigencia del programa sanitario (§5.4 del informe veterinario).

---

## 4. Arquitectura

Cuatro piezas. Sin servidores que mantener, sin cuota mensual, sin pasarela de pago, sin paso
de compilación. Lo que está en el repositorio es lo que se sirve.

| Pieza | Qué hace |
|---|---|
| **PWA** | La aplicación. HTML + CSS + JavaScript sin framework. Se instala desde el navegador («Añadir a pantalla de inicio»). Alojada en GitHub Pages desde `asociacionamigomio/amigomio`. |
| **Supabase** | Base de datos Postgres, autenticación, almacenamiento (justificantes y fotos) y **las reglas**, aplicadas con Row Level Security y triggers. |
| **El reloj** | Tarea programada dentro de Supabase que se despierta cada hora: manda el aviso de las 12 h, el de las 23 h, y caduca a las 24 h las reservas sin justificante liberando el box. |
| **Correo** | Servicio de envío (Resend o equivalente) para avisos, confirmaciones y promociones. Las notificaciones push las emite la propia PWA. |

**Por qué PWA y no App Store:** sin cuota de 99 €/año de Apple, sin revisiones de días por cada
cambio, sin comisión del 30 %, y se actualiza cuando queramos. Coste de infraestructura: 0 € al
volumen de AmigoMío. Contrapartida asumida: en iPhone las notificaciones push sólo llegan si el
cliente instala la app en su pantalla de inicio.

---

## 5. Modelo de datos

### 5.1 Cliente

Persona. Entra con **correo y contraseña**; el registro es **abierto**, sin invitación previa.

- **Verificación de correo obligatoria antes de poder reservar.** Sin ella, cualquiera con un
  correo inventado retiene un box 24 horas en Semana Santa y desaparece. El alta es libre; el
  permiso para reservar llega al pinchar el enlace de confirmación.
- Datos exigidos por el libro de registro: nombre, **DNI**, **domicilio** y teléfono.
- **Persona autorizada para la recogida**: nombre y DNI. En la salida se comprueba su identidad
  y se vuelve a leer el microchip (§14.2). Sin esto, el perro sólo se entrega al propietario.
- Marcas que sólo pone administración: **autorizado a pagar en persona** (se salta el paso del
  justificante).
- Administración puede editar sus datos. Todo cambio queda registrado con fecha y autor.

### 5.2 Perro

Cuelga de un cliente. Se graba una vez:

| Campo | Notas |
|---|---|
| Nombre | **Requiere validación para cambiarlo** |
| Nº de chip | Identificador real; impide altas duplicadas. **Requiere validación** |
| Fecha de nacimiento | |
| Sexo | |
| Castrado | Sí / No |
| Raza | |
| Foto | |
| Capa | Exigido por el libro de registro |
| Estado reproductivo | Exigido por el libro de registro |
| Pautas de alimentación | Texto libre |
| Cuidados que necesita | Texto libre |
| Cuestionario de carácter | Ver 5.3 |
| Fechas sanitarias | Ver §13 |
| Potencialmente peligroso | Si lo es: licencia administrativa y seguro de RC (§13.3) |

### 5.3 El cuestionario de carácter

Se contesta en el alta, en desplegables. Sus respuestas se usan en tres sitios distintos:

**Cambia precio y alojamiento:**
- **Agresivo con personas** → sólo puede ir a uno de los 2 boxes especiales, **siempre solo**,
  a 35 €/día.

**Decide si puede compartir box y patio:**
- Bueno con todos los perros / sólo con machos / sólo con hembras / con ninguno

**Instrucciones de manejo diario (no afectan al precio):**
- Tímido o amigable · Comilón · Polidipsia · Destroyer (rompe cosas, su cama) · Activo o
  sedentario

### 5.4 Datos de la estancia (por reserva, no por perro)

- **Peso actual**
- **En celo, o se le espera**
- Cuidados o pautas distintos de lo habitual esta vez

### 5.5 Alojamiento

Cuatro tipos. **Los dos últimos no son reservables por el cliente** —los asigna administración
cuando hacen falta— pero **sí cuentan para el tope legal de perros**.

| Tipo | Cuántos | Reservable | Para |
|---|---|---|---|
| Normal | 30 | Sí | Estancia corriente |
| Especial | 2 | Sí | Agresivo con personas, siempre solo |
| Aislamiento / cuarentena | Según instalación | No | Enfermo o sospechoso, hasta alta veterinaria |
| Cachorros | Según instalación | No | Pauta vacunal incompleta, circuito independiente |

- Número, tipo, capacidad máxima 3 perros
- Interruptor **fuera de servicio**, para sacarlo del cuadro si está en obras o con la
  refrigeración averiada, sin que el sistema lo siga vendiendo

> **Cifras buenas: 30 + 2**, según Santiago. El informe de 01/09/2026 habla de 24 boxes y 30
> perros, pero es anterior y no se usa como referencia de capacidad.

### 5.5 bis — Tope de perros simultáneos

Ajuste editable desde el panel: número máximo de perros dentro a la vez, **contando todos los
alojamientos**, incluidos aislamiento y cachorros.

**Si se deja en blanco, el motor no aplica este tope** y sólo controla que queden alojamientos
libres. Se rellena cuando Santiago tenga el número bueno. Sigue haciendo falta porque 32
alojamientos a 3 perros darían cabida a 96 perros, que no es un número real de nada.

### 5.6 Reserva

Un cliente, unas fechas, un box, de 1 a 3 perros, extras contratados, horas de entrega y
recogida, desglose de precio congelado, justificante, y quién la creó (cliente / administración
/ Zapatilla).

| Estado | Significado | Box |
|---|---|---|
| Pendiente de justificante | Recién hecha, corriendo las 24 h | Retenido |
| Confirmada | Justificante subido | Retenido |
| En curso | El perro está dentro | Ocupado |
| Finalizada | Pasa al historial | Libre |
| Cancelada | La anula el cliente o administración | Libre |
| Caducada | Se pasaron las 24 h sin justificante | Libre, automático |

### 5.7 Tablas que edita Santiago desde su panel

Tarifas por día de semana · fechas especiales · **calendario de festivos de Puerto Real, que hay
que cargar cada año** (nacionales + Andalucía + locales) · catálogo de extras · promociones y
códigos · configuración (IBAN, horarios, textos, interruptor de reservas).

---

## 6. Motor de precios

### 6.1 Precio base, noche a noche

Gana **la primera regla que encaje**:

1. ¿Es 24, 25 o 31 de diciembre, o 1 de enero? → **25 €**
2. ¿Es festivo en Puerto Real, o **víspera** de festivo (la noche anterior al día festivo)? → **18 €**
3. ¿Es viernes, sábado o domingo? → **18 €**
4. Cualquier otra → **15 €**

**Excepción:** si el box es especial por agresividad con personas, esta escalera no se aplica.
**35 € planos**, sin recargo de fin de semana ni de festivo.

### 6.2 Suplementos

| Concepto | Importe |
|---|---|
| Segundo perro en el mismo box | +10 € por noche |
| Tercer perro en el mismo box | +20 € por noche |
| Medicación **oral** | Incluida, sin cargo |
| Medicación **inyectable** o curas | +8 € por perro y noche |

Dos perros en **boxes separados** son dos reservas de box y por tanto dos tarifas base completas.

### 6.3 Horarios y recargos

**Horario de entrega y recogida:**
- Lunes a viernes y domingos: 10:00–12:30 y 16:30–19:00
- Sábados: 10:00–12:30

**Fuera de horario, siempre previa consulta.** Se cobra **por cada movimiento** (una entrada y
una salida fuera de horario son dos recargos):

| Cuándo | Importe |
|---|---|
| Entre semana | 50 € |
| Fines de semana | 75 € |
| Entre las 21:00 y las 7:30 | 120 € |

«Fin de semana» son sábado y domingo. **Gana siempre la regla más específica:** un movimiento el
sábado a las 22:00 son 120 €, no 75 €, porque la franja nocturna se aplica sea el día que sea.

### 6.4 Extras

Catálogo **editable por Santiago**, no escrito en el código. Cada extra lleva: nombre, precio,
si se cobra por noche o una sola vez, si está activo y si está disponible en verano.

Publicados en la web pero **sin precio definido todavía** — Santiago los rellenará desde el
panel: atención veterinaria en instalaciones · gimnasio canino (cintas) · manejo de perros con
conductas especiales · cuidados por ATV · adiestramiento personalizado (salvo verano) ·
alimentación a cargo del hotel.

Ya incluido en toda estancia, sin cargo: 3 paseos diarios · 3 tomas de comida · medicación oral ·
limpieza del chenil hasta 3 veces al día · supervisión 24 h.

### 6.5 Servicios veterinarios durante la estancia

El cliente puede **solicitar** que durante la estancia se le pongan vacunas o se haga una
desparasitación, prestadas por la veterinaria responsable del núcleo.

**No los cobra AmigoMío.** Los factura directamente la veterinaria según **sus** tarifas. Por eso:

- **No entran en el total de la reserva ni en el importe a transferir.** Si entrasen, AmigoMío
  estaría cobrando por cuenta de un tercero en su cuenta, con las consecuencias fiscales
  correspondientes.
- Se muestran aparte, claramente separados: «lo que pagas a AmigoMío» y «lo que te facturará la
  clínica».
- El precio se muestra como **orientativo, según tarifa de la clínica**, o no se muestra, a
  elección de Santiago.

**Flujo: previa solicitud y aceptación.**

| Estado | Quién |
|---|---|
| Solicitado | El cliente, al reservar o durante la estancia |
| Aceptado / Rechazado | **Administración**. Nunca automático |
| Aplicado | Se registra al ponerlo, con producto, dosis, vía y facultativo |

Al marcarlo como **aplicado** ocurren dos cosas solas:

1. Entra en el **registro de tratamientos** (§14.4), como exige el programa sanitario.
2. **Se actualiza la fecha sanitaria correspondiente en la ficha del perro** (§13.1). Si le ponen
   la rabia el 8 de agosto, la próxima reserva ya lo sabe.

### 6.6 Descuentos

Tres tipos. **No hay descuento fijo por cliente.**

1. **Puntual en una reserva concreta**, que autoriza administración
2. **Promoción con fechas**, que se aplica sola a quien reserve durante la campaña y va
   acompañada de aviso a los usuarios
3. **Código promocional** que el cliente teclea al reservar

### 6.7 Ejemplo completo

Viernes 7 a martes 11 de agosto, 2 perros en el mismo box, uno con curas, recogida el martes
fuera de horario:

| Concepto | Importe |
|---|---|
| 4 noches (V 18 + S 18 + D 18 + L 15) | 69 € |
| Segundo perro, 10 × 4 | 40 € |
| Curas, 8 × 4 | 32 € |
| Recogida fuera de horario, entre semana | 50 € |
| **Total** | **191 €** |

Este desglose es lo que ve el cliente antes de confirmar y lo que se guarda congelado.

---

## 7. Disponibilidad y reglas

### 7.1 Reglas que el sistema impide saltarse

- **Mínimo 2 noches** por reserva
- **Máximo 3 perros** por box
- Un perro **agresivo con personas** sólo puede ir a uno de los 2 especiales y **nunca
  acompañado**. Si los dos están ocupados **no hay disponibilidad**, aunque haya 28 boxes
  normales libres
- Dos perros no comparten box si el cuestionario dice que no son compatibles
- **Sólo se agrupan perros del mismo propietario**, y sólo si éste lo autoriza expresamente al
  reservar. Es exigencia del programa sanitario, no preferencia nuestra: el alojamiento
  individual es el criterio por defecto
- **No se admite ningún perro sin los requisitos sanitarios en vigor** (§13)

### 7.2 Los dos topes

Antes de aceptar una reserva se comprueban **dos cosas distintas**, y ambas tienen que dar
verde:

1. **¿Queda alojamiento libre** del tipo que corresponde, todas las noches de la estancia?
2. **¿Se respeta el tope legal de perros simultáneos** todas esas noches, contando los perros de
   esta reserva y los de todos los demás alojamientos, incluidos aislamiento y cachorros?

El segundo no es redundante: con hasta 3 perros por box, 32 boxes darían cabida a 96 perros,
muy por encima de cualquier autorización. **Sin este control el sistema vendería una infracción
administrativa.**

### 7.3 Cómo se impide la sobreventa

Al reservar, el sistema asigna internamente un **box provisional** — el primero libre del tipo
que corresponda. No se le enseña al cliente ni se le deja elegir. Eso permite que **la propia
base de datos rechace físicamente** cualquier reserva que se solape con otra en el mismo box.
No es una comprobación esquivable: es una restricción del motor.

Dos clientes pulsando «reservar» en el mismo segundo para el último box de Nochevieja: uno
entra, el otro recibe «uy, acaban de cogerlo». Nunca los dos.

Al recolocar un box desde el panel se vuelve a comprobar lo mismo.

---

## 8. Reserva y pago

**El pago es por adelantado**, por transferencia bancaria. No hay pasarela de pago.

1. El cliente reserva → estado **pendiente de justificante**, box retenido
2. Tiene **24 horas** para subir el justificante de la transferencia
3. **A las 12 horas**: aviso
4. **A las 23 horas**: segundo aviso
5. **A las 24 horas**: la reserva se borra sola y el box queda libre
6. Si sube el justificante, **la reserva se confirma automáticamente**

**Excepción:** los clientes marcados por administración como *autorizados a pagar en persona*
se saltan este proceso.

Los avisos de las 12 y 23 horas son **horas transcurridas desde que se hace la reserva**, no las
12:00 y las 23:00 del reloj.

El IBAN de cobro es un dato de configuración editable desde el panel; **no figura en este
repositorio**.

### 8.1 Cancelación y devolución

| Cuándo cancela | Qué pasa |
|---|---|
| **Con 7 días o más** de antelación a la entrada | **Devolución completa** |
| **A menos de 7 días** | **No se puede cancelar.** El botón desaparece y se le indica que llame |

El sistema cuenta los 7 días respecto a la **fecha de entrada**. Administración puede anular
cualquier reserva en cualquier momento, y esa anulación queda registrada con autor y motivo.

> **Riesgo asumido y decidido por Santiago el 12/09/2026.** La confirmación automática al subir
> el archivo significa que el sistema da por pagado algo que nadie ha comprobado: una captura
> cualquiera confirma la reserva. Se le ofreció la alternativa (pasar a «en revisión» y
> confirmar él tras mirar el banco) y eligió la automática. Mitigación existente: el justificante
> queda adjunto y administración puede anular cualquier reserva.

---

## 9. Roles, y el hueco de Zapatilla

### 9.1 Una sola máquina, tres puertas

El alta de perro y la creación de reserva **no viven en la pantalla**: viven en la base de datos
como operaciones con nombre. Encima hay tres puertas que llaman exactamente a lo mismo:

| Puerta | Quién |
|---|---|
| La app | El cliente, por su cuenta |
| El panel | Administración, atendiendo el teléfono, en nombre de un cliente |
| **Zapatilla** | El asistente de IA, conversando con el cliente |

Esto no es elegancia: es la condición para que Zapatilla no sea un peligro. **Zapatilla no sabe
de precios ni de disponibilidad: los pregunta.** Si el modelo alucina que quedan boxes en
Nochevieja o que la noche sale a 12 €, el motor le dirá que no con las mismas reglas que a
cualquiera. Un asistente que calcula precios por su cuenta acaba comprometiendo tarifas que no
existen.

### 9.2 Condiciones para Zapatilla

1. **Sólo actúa sobre el cliente con el que está hablando**, y que ha entrado con su contraseña
2. **Enseña el desglose y espera un sí explícito** antes de crear nada
3. **Toda reserva queda marcada con quién la creó** — cliente, administración o Zapatilla

### 9.3 Quién es Zapatilla

Labrador chocolate de AmigoMío, **perro de asistencia y terapia**, con chaleco azul. No es un
chatbot con nombre de perro: es uno de los perros de la casa. Habla tranquilo, paciente, sin
prisa, el que acompaña. Ni vendedor ni gracioso forzado.

### 9.4 Poderes de administración

Crear perros a nombre de otros clientes · crear y gestionar reservas de terceros (atención
telefónica) · editar datos de cliente · autorizar descuentos puntuales · autorizar pago en
persona · validar solicitudes de cambio de chip y nombre · mover perros de box · editar tarifas,
festivos, extras, promociones y configuración · encender el interruptor de reservas.

---

## 10. Pantallas

### 10.1 Cliente — seis sitios, no más

- **Inicio**: la próxima estancia en grande («A Luna le quedan 12 días para sus vacaciones») y
  el botón de reservar
- **Mis perros**: fichas y alta. El alta va **en pasos cortos** (quién es, cómo come, cómo es de
  carácter) y **se puede guardar a medias**: es un formulario largo y de una sentada se abandona
- **Reservar**
- **Mis reservas**: las pendientes con el reloj de las 24 horas bien visible y el botón de subir
  justificante
- **Historial** de estancias pasadas
- **Avisos**

### 10.2 Administración — dos pantallas de uso diario

**1. El cuadro.** Todos los alojamientos en vertical —normales, especiales, aislamiento y
cachorros— y los días en horizontal. El número sale de la tabla, no está fijado.

```
            L12   M13   X14   J15   V16   S17   D18
Box 01      ██ Luna ██    ·     ·     ·     ·     ·
Box 02        ·   ███ Toby ██████████████████████
Box 03      ██ Kiba + Nala ██   ·     ·     ·     ·
   ⋮
Box 30        ·     ·     ·     ·   ███ Rocky ███
────────────────────────────────────────────────────
Esp 31      ██ Argos (agresivo) ███████    ·     ·
Esp 32        ·     ·     ·     ·     ·     ·     ·
────────────────────────────────────────────────────
Libres       22    19    18    18    11     9    14
```

Colores de marca: amarillo `#F6EC4D` pendiente de justificante · azul `#4E80A5` confirmada ·
azul oscuro perro dentro · rojo `#C32927` requiere atención. Se arrastra un bloque para
recolocar; si el destino no vale, no deja soltarlo y **dice por qué**.

**2. La hoja del día.** Los perros que hay dentro hoy, con su comida, su medicación y los avisos
que importan (destroyer, polidipsia, en celo, no puede coincidir con machos). **Imprimible**,
para colgarla en la nave y que no dependa de que alguien saque el móvil.

Esta pantalla no se pidió explícitamente, pero es la consecuencia directa de que el cliente meta
pautas de comida y cuidados: alguien tiene que leerlas por la mañana.

**Detrás, sin prisa:** entradas y salidas de hoy con sus horas · bandeja de justificantes ·
solicitudes de cambio de chip y nombre pendientes · clientes y perros · ajustes.

### 10.3 Tono

**Amigable y familiar en toda la plataforma.** Ya existe en la web de AmigoMío («tu mejor amig@
también se va de vacaciones», «ser tu mejor amigo es agotador»); se continúa, no se inventa.

| En vez de | Se escribe |
|---|---|
| «Error: campos obligatorios incompletos» | «Nos falta saber cuánto pesa Luna» |
| «Reserva #4471 confirmada» | «¡Listo! Luna tiene sitio del 7 al 11 de agosto» |
| «Su reserva expirará en 1 hora» | «Oye, que se nos va el sitio de Luna: nos queda el justificante» |

---

## 11. Avisos

Dos canales: **correo electrónico** y **notificación push**. (Se descartó WhatsApp: la vía
oficial se paga por mensaje y exige verificar la empresa y aprobar plantillas.)

Qué se avisa: plazo de pago a las 12 h y a las 23 h · confirmación de reserva · recordatorio de
entrada · promociones y ofertas · respuesta a solicitudes de cambio.

---

## 12. Marca

| | |
|---|---|
| Azul principal | `#4E80A5` |
| Azul medio | `#6199C8` |
| Azul claro | `#79BAE4` |
| Amarillo | `#F6EC4D` |
| Rojo | `#C32927` |
| Tipografía | **Poppins** |

Logo original en PNG con transparencia, 1808×1571 (suficiente para todos los iconos de la PWA).

Contacto publicado: info@amigomio.org · +34 673 229 399 · El Marquesado, Cádiz.
Nombre comercial: **Hotel, Residencia y Guardería Canina AmigoMío**.
Dominios: `amigomio.org` y `asociacionamigomio.es`.

---

## 13. Control sanitario de admisión

Las fechas y los plazos de esta sección salen del *Programa de manejo, higiene y profilaxis*
firmado por la veterinaria responsable el 01/09/2026.

**Qué bloquea y qué no lo decide Santiago, y no coincide con el informe.** Decisión de
12/09/2026: **sólo la rabia y las dos desparasitaciones —interna y externa— impiden entrar.**
Todo lo demás se pide en la ficha y se avisa si está caducado, pero no bloquea nada.

> El informe veterinario dice literalmente que no se admite ningún animal sin pauta vacunal
> completa y en vigor, y marca la tos de las perreras como **exigida por el núcleo**. Queda
> constancia de que apartarse de eso es una decisión consciente de Santiago, no un descuido del
> diseño. Volver al criterio del informe es cambiar un `obligatorio` en `js/sanidad.js`: la
> lógica que hay debajo no se entera.

### 13.1 Fechas que guarda la ficha del perro

**Impiden entrar:**

| Requisito | Regla | Plazo antes del ingreso |
|---|---|---|
| **Rabia** | Obligatoria en Andalucía. Primovacunación desde los 3 meses, revacunación anual | En vigor |
| **Desparasitación interna** | Praziquantel + pirantel + febantel, o milbemicina + praziquantel | **30 días** |
| **Antiparasitario externo** | Acreditado documentalmente | En vigor |

**Se piden y se avisan, pero no bloquean:**

| Requisito | Regla | Plazo antes del ingreso |
|---|---|---|
| Polivalente (moquillo, parvovirosis, hepatitis, parainfluenza) | Según ficha técnica (1–3 años) | En vigor |
| Leptospirosis | Anual; recomendable semestral por presión ambiental | En vigor |
| Traqueobronquitis (tos de las perreras) | Revacunación anual o semestral | **15 días** |
| Leishmaniosis | Zona endémica, previo test serológico negativo | — |

En cualquiera de los dos grupos, una **primovacunación o revacunación reciente** necesita **21
días** de margen antes de la entrada.

El cliente introduce las fechas y puede adjuntar foto de la cartilla o del pasaporte europeo.

### 13.2 Qué hace el sistema con esas fechas

Al reservar, comprueba la vigencia **en las fechas de la estancia**, no en el día de hoy. Si algo
vence antes o durante:

- **Avisa al cliente con nombre y fecha concretos:** «la leptospirosis de Luna vence el 3 de
  agosto y vuelve el 11».
- Le da tiempo para resolverlo antes de venir, en vez de descubrirlo en la puerta.
- Administración ve el estado sanitario de cada reserva en su panel y decide.

**Resuelto el 12/09/2026:** los tres obligatorios **bloquean**; los recomendados sólo **avisan**.

### 13.3 Perros potencialmente peligrosos

Distinto de «agresivo con personas», que es comportamiento. Un PPP lo es por raza o tipología y
necesita, por ley:

- **Licencia administrativa** del propietario, con su fecha de caducidad
- **Seguro de responsabilidad civil** en vigor, con su fecha de caducidad

Ambos con fecha y documento adjunto, y comprobados igual que las vacunas.

### 13.4 Identificación

- **No se admite ningún perro sin microchip** registrado en el RAIA.
- Al ingreso se **lee el transpondedor** y se comprueba que coincide con el documento de
  identificación. Ese acto se registra (§14.2).
- Si llega sin identificar o con identificación ilegible, **no se acepta el ingreso**.

---

## 14. Libros de registro del núcleo

Los «libros virtuales» que pide Santiago. La sección 14 del informe veterinario los enumera, y
la 5.2 dice exactamente qué campos lleva el principal. **Conservación mínima de 5 años** para
tratamientos y recetas.

Este módulo es **independiente del de reservas** y se construye después (fase 4), pero se diseña
ahora porque comparte las fichas de perro y cliente y bebe de los mismos datos.

### 14.1 Libro de entradas y salidas

Se alimenta **solo** de las reservas; no se teclea dos veces. Campos exigidos:

- Nº de microchip, especie, raza, sexo, **capa**, fecha de nacimiento y **estado reproductivo**
- Nombre, **DNI**, domicilio y teléfono del propietario, y **persona autorizada para la recogida**
- **Fecha y hora** de entrada y de salida, y procedencia o destino
- **Estado sanitario en el ingreso** y fechas de últimas vacunaciones y desparasitaciones
- Tratamientos aplicados durante la estancia: producto, dosis, vía y facultativo prescriptor
- Incidencias, bajas y, en su caso, causa de la muerte y destino del cadáver

Exportable en PDF a disposición de la autoridad competente.

### 14.2 Ficha de ingreso y de salida

**Ingreso.** Formulario que rellena el personal: estado general y condición corporal, temperatura
rectal, mucosas, piel y pelo (ectoparásitos y lesiones), ojos, oídos, cavidad oral, auscultación
cardiorrespiratoria y valoración del comportamiento. Si hay hallazgo compatible con enfermedad
transmisible (diarrea, vómitos, tos, secreción nasal u ocular, lesiones cutáneas, prurito
intenso), el sistema propone **traslado a aislamiento** y aviso al veterinario responsable antes
de la ubicación definitiva.

**Salida.** Comprobación de identidad de quien recoge, **lectura del microchip**, exploración
previa e informe escrito de incidencias y tratamientos de la estancia. Anotación de fecha y hora.

### 14.3 Parte diario

El informe exige observación **mínimo dos veces al día** de cada animal: ingesta, consumo de
agua, heces, orina, actitud y movilidad, con anotación de incidencias.

**Es la misma pantalla que «la hoja del día» (§10.2)**, que pasa así de ayuda interna a registro
oficial: se imprime para la nave y lo que se anota queda en el libro.

### 14.4 Registro de tratamientos

Producto, dosis, vía, facultativo prescriptor y fecha. Archivo de recetas veterinarias adjuntas.
**Conservación 5 años.** Enlazado con la reserva y con el perro.

Se alimenta de dos sitios: los tratamientos que surjan por incidencia durante la estancia, y los
**servicios veterinarios solicitados por el cliente y aceptados por administración** (§6.5).

### 14.5 Registro de limpieza y desinfección

Elemento, actuación, producto, dosis, responsable y fecha, según el cuadro de frecuencias del
informe: boxes y patios (retirada de heces mínimo 2 veces/día, desinfección semanal y a cada
cambio de ocupante) · comederos y bebederos (lavado diario, desinfección semanal) · camas y
textiles (60 °C, semanal y a cada cambio) · zona de aislamiento (diaria, siempre la última) ·
vehículos (tras cada uso).

### 14.6 Archivo documental

Certificados e informes trimestrales de la empresa DDD (**Isla Plagas**) · albaranes de retirada
de cadáveres por gestor SANDACH (**Crematorio Las Salinas SLL, GRU 3294, TSH01110038**) y de
residuos · informes de las revisiones veterinarias periódicas · fichas técnicas y de seguridad de
los productos empleados.

---

## 15. Datos del núcleo zoológico

Del informe de 01/09/2026.

> **Este repositorio es público.** Por eso aquí sólo figuran los datos de la entidad. **Los
> nombres de personas, el nº de colegiada, los teléfonos personales, la dirección exacta y el
> IBAN no se escriben en el repositorio**: viven en la configuración, dentro de Supabase, y
> Santiago los edita desde su panel. Borrarlos de git después no sirve de nada, porque quedan en
> el historial.

| | |
|---|---|
| Denominación | AmigoMío |
| Titular | Asociación de Perros de Asistencia y Terapia Amigomío — G72292469 |
| Representante legal | *No se escribe aquí: dato de configuración* |
| Domicilio del núcleo | El Marquesado, **Puerto Real**, Cádiz *(calle y número, en configuración)* |
| Nº de núcleo zoológico / REGA | **En trámite** |
| Clasificación | Residencia y centro de adiestramiento de animales de compañía |
| Veterinaria responsable | *Nombre y nº de colegiada: dato de configuración* |
| Urgencias veterinarias | *Teléfono: dato de configuración* |
| Empresa DDD | Isla Plagas |
| Gestor SANDACH | Crematorio de animales Las Salinas SLL |

El domicilio en **Puerto Real** confirma qué calendario de festivos locales hay que cargar (§5.7).

> **Discrepancia menor:** el informe da `info@amigomio.com` y la web `info@amigomio.org`.
> Confirmar cuál es el bueno.

---

## 16. Fases

**Fase 0 — Cimientos.** Repositorio, Supabase, entrada con correo y contraseña, fichas de cliente
y de perro con el cuestionario **y las fechas sanitarias (§13)**, solicitudes de cambio de chip y
nombre, panel de clientes. Todavía no se reserva nada.

**Fase 1 — El motor.** Los alojamientos, tarifas, festivos, extras, cálculo de precio, **los dos
topes de disponibilidad (§7.2)** y la comprobación de vigencia sanitaria. Sin pantallas bonitas. **Prueba de aceptación: coger
reservas reales ya cobradas y comprobar que el motor calcula exactamente lo que se cobró.** Si no
cuadra, hay una regla de la casa sin documentar.

**Fase 2 — Reservar.** Pantalla del cliente, reloj de 24 horas, justificante, correos y push,
el cuadro de alojamientos y la hoja del día. Con el interruptor **apagado**.

**Fase 3 — La prueba real.** Se cargan las reservas futuras que haya en Wix. Durante unas semanas
Santiago crea por el panel las reservas que entren por teléfono y compara el cuadro con la
realidad. Cuando cuadre varias semanas seguidas, está listo.

**El encendido.** Se enciende el interruptor y el botón «Reservar» de Wix pasa a llevar a la app.
**Ese día y no antes.** Condición puesta por Santiago: hasta que no esté todo bien cerrado no se
mueven las reservas de Wix.

**Fase 4 — Los libros de registro (§14).** Libro de entradas y salidas alimentado desde las
reservas, fichas de ingreso y salida, parte diario, registro de tratamientos, registro de
limpieza y archivo documental. Se construye después del encendido porque no bloquea las
reservas, pero **es obligatorio para el núcleo zoológico**: hasta que exista, esos libros hay que
llevarlos en papel.

**Después, cada una con su propio diseño:** Zapatilla · clases de adiestramiento · inscripción a
pruebas oficiales · tips de educación canina · clicker virtual.

---

## 17. Riesgos y cabos sueltos

1. **Confirmación automática del justificante** sin comprobación humana (§8). Decidido y asumido.
2. **Protección de datos.** Guardar nombres, teléfonos, direcciones y datos veterinarios obliga a
   política de privacidad y casilla de consentimiento en el alta. Obligatorio, pendiente de
   redactar.
3. **Festivos.** Hay que cargar cada año el calendario de Puerto Real. Si no se carga, el motor
   cobrará 15 € noches que deberían ser 18 €. Conviene un aviso en el panel cada diciembre.
4. **Precios de extras sin definir** (§6.4). No bloquea: el catálogo es editable.
5. **Push en iPhone** sólo funciona si el cliente instala la PWA. El correo cubre al resto.
6. **Falta el tope de perros simultáneos** (§5.5 bis). Mientras esté en blanco, el motor sólo
   controla que queden alojamientos libres.
7. **El criterio de admisión se aparta del informe veterinario** (§13). Sólo rabia y
   desparasitaciones bloquean; el informe exige la pauta completa. Decisión consciente de
   Santiago, anotada por si algún día hay inspección.
8. **Nº de núcleo zoológico / REGA en trámite.** Hará falta en los libros de registro (§14).
9. **Correo de contacto contradictorio:** `info@amigomio.com` en el informe, `info@amigomio.org`
   en la web.
10. **Los libros de registro son obligatorios desde el primer día**, y la fase 4 llega después
    del encendido. Durante ese intervalo hay que llevarlos en papel.
