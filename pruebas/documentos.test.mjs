/* ============================================================
   La cartilla, fotografiada.

   Encargo de Santiago del 12/09/2026: que el cliente pueda subir
   las fotos de la cartilla veterinaria —la hoja de datos, la de
   vacunas, la de rabia y la de desparasitaciones—, y también el
   seguro y la licencia de PPP si hace falta.

   Es VOLUNTARIO. No bloquea nada, no impide reservar y no se
   pide dos veces. Quien lo sube se ahorra que le pregunten, y
   nosotros tenemos el papel cuando la inspección lo pida.

   Lo que se comprueba aquí:
   - que están las cuatro páginas de la cartilla y los dos papeles
   - que ninguna es obligatoria
   - que la foto se encoge ANTES de subirla (una foto de móvil son
     cuatro megas y la cuota de Storage no es infinita)
   - que el cubo es privado y cada uno ve lo suyo
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TIPOS_DOCUMENTO, tipoDocumento, rutaDocumento,
         LADO_MAXIMO, TAMANO_MAXIMO } from "../js/documentos.js";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const aplanar = t => t.replace(/\s+/g, " ");
const aplanarSql = t => t.replace(/^\s*--.*$/gm, "").replace(/\s+/g, " ");

test("están las cuatro páginas de la cartilla", () => {
  const ids = TIPOS_DOCUMENTO.map(t => t.id);
  for (const id of ["cartilla_datos", "cartilla_vacunas",
                    "cartilla_rabia", "cartilla_desparasitaciones"])
    assert.ok(ids.includes(id), `falta ${id}`);
});

test("y el seguro y la licencia de PPP", () => {
  const ids = TIPOS_DOCUMENTO.map(t => t.id);
  assert.ok(ids.includes("seguro"));
  assert.ok(ids.includes("licencia_ppp"));
});

test("ninguno es obligatorio", () => {
  /* Si uno lo fuera, medio cliente se quedaría sin poder
     reservar por no encontrar la cartilla. */
  for (const t of TIPOS_DOCUMENTO)
    assert.notEqual(t.obligatorio, true, `${t.id} no puede ser obligatorio`);
});

test("cada tipo se explica en cristiano", () => {
  for (const t of TIPOS_DOCUMENTO) {
    assert.ok(t.nombre, `${t.id} sin nombre`);
    assert.ok(t.pista, `${t.id} sin explicación de qué hoja es`);
    assert.doesNotMatch(t.nombre + t.pista, /obligatorio|debe|error/i,
      `${t.id} está escrito en administrativo`);
  }
});

test("los papeles de PPP solo se piden a los PPP", () => {
  assert.equal(tipoDocumento("licencia_ppp").soloPpp, true);
  assert.equal(tipoDocumento("seguro").soloPpp, true);
  assert.notEqual(tipoDocumento("cartilla_rabia").soloPpp, true);
});

test("la ruta empieza por el usuario, que es lo que exige la política", () => {
  /* La política de Storage mira la PRIMERA carpeta: si el fichero
     no cuelga del id del usuario, Supabase rechaza la subida. */
  const ruta = rutaDocumento("u-123", "p-456", "cartilla_rabia", "foto.jpg");
  assert.match(ruta, /^u-123\//);
  assert.ok(ruta.includes("p-456"), "y cada perro en su carpeta");
  assert.match(ruta, /cartilla_rabia/, "que se sepa qué hoja es sin abrirla");
  assert.match(ruta, /\.jpg$/, "conservando la extensión");
});

test("dos fotos de la misma hoja no se pisan", () => {
  const a = rutaDocumento("u", "p", "cartilla_vacunas", "1.jpg");
  const b = rutaDocumento("u", "p", "cartilla_vacunas", "2.jpg");
  assert.notEqual(a, b, "la cartilla de vacunas ocupa más de una página");
});

test("la foto se encoge antes de subirla", () => {
  /* Una foto de móvil son cuatro megas. Subir diez así por perro
     se come la cuota de Storage y el cliente se queda mirando la
     barra de progreso en el aparcamiento del veterinario. */
  assert.ok(LADO_MAXIMO <= 2000, "no hace falta más para leer una cartilla");
  assert.ok(LADO_MAXIMO >= 1200, "ni menos, que hay que poder leer las fechas");

  const fuente = aplanar(leer("js/documentos.js"));
  assert.match(fuente, /createElement\("canvas"\)/, "se reescala con canvas");
  assert.match(fuente, /toBlob/);
  assert.match(fuente, /image\/jpeg/);
});

test("los PDF se suben tal cual, no se pasan por el canvas", () => {
  /* El seguro casi siempre llega en PDF. Meterlo en un canvas
     daría una imagen en blanco y nadie sabría por qué. */
  const fuente = aplanar(leer("js/documentos.js"));
  assert.match(fuente, /pdf/i);
});

test("hay un tope de tamaño y se avisa antes de subir", () => {
  assert.ok(TAMANO_MAXIMO > 0);
  const fuente = leer("js/documentos.js");
  assert.match(fuente, /TAMANO_MAXIMO/);
});

/* ---------- La base de datos ---------- */
const sql = aplanarSql(leer("db/documentos.sql"));

test("los documentos se guardan en su tabla, con RLS", () => {
  assert.match(sql, /create table if not exists documento_perro/);
  assert.match(sql, /alter table documento_perro enable row level security/);
});

test("cada uno ve los papeles de sus perros, y administración los de todos", () => {
  assert.match(sql, /create policy .* on documento_perro for select/);
  assert.match(sql, /es_admin\(\)/, "administración tiene que poder verlos");
  assert.match(sql, /perro/, "el permiso sale de a quién es el perro");
});

test("nadie cuelga un papel del perro de otro", () => {
  assert.match(sql, /for insert/);
  assert.match(sql, /with check/);
});

test("el cubo de cartillas no es público", () => {
  const storage = aplanarSql(leer("db/storage.sql"));
  assert.match(storage, /'cartillas', *'cartillas', *false/,
    "una cartilla lleva los datos del propietario");
});

/* ---------- La pantalla ---------- */
test("la ficha del perro enseña los papeles y deja añadir", () => {
  const vista = aplanar(leer("js/vistas/perros.js"));
  assert.match(vista, /documentosDe|documentos\(/);
  assert.match(vista, /subirDocumento/);
  assert.match(vista, /voluntario|si quieres|no hace falta/i,
    "hay que dejar claro que no es obligatorio");
});

test("se abre con un enlace que caduca, no con una dirección pública", () => {
  /* El cubo es privado: la única forma de enseñar la imagen es
     pedir un enlace firmado, y que caduque. */
  const datos = aplanar(leer("js/datos.js"));
  assert.match(datos, /createSignedUrl/);
  assert.doesNotMatch(datos, /getPublicUrl/,
    "una cartilla no se sirve en abierto");
});

test("administración ve la cartilla desde la ficha de estancia", () => {
  /* Es el sitio donde se mira cuando llega el perro o cuando
     pregunta la inspección: tenerla a un clic ahorra el paseo
     hasta el archivador. */
  const vista = aplanar(leer("js/vistas/admin-estancia.js"));
  assert.match(vista, /documentosDe/);
  assert.match(vista, /verDocumento/);
});
