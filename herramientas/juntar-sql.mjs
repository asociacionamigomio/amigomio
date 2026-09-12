/* ============================================================
   Junta todos los ficheros de base de datos EN ORDEN y los deja
   en el portapapeles.

   El orden importa: `tarifas.sql` usa `es_admin()`, que está en
   `schema.sql`; `reloj.sql` toca la tabla `reserva`, que está
   en `reservas.sql`. Pegarlos desordenados falla a la mitad y
   deja la base a medias.

   Todos son idempotentes —`if not exists`, `or replace`,
   `drop ... if exists`— así que se puede volver a pasar las
   veces que haga falta. Y varios llevan sus propias pruebas
   dentro: si algo no cuadra, la instalación ABORTA en vez de
   quedarse callada.

       npm run sql          -> al portapapeles
       npm run sql -- ver   -> por pantalla
   ============================================================ */
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const db = join(raiz, "db");

const orden = readFileSync(join(db, "orden.txt"), "utf8")
  .split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));

const trozos = [];
const faltan = [];

for (const fichero of orden) {
  const ruta = join(db, fichero);
  if (!existsSync(ruta)) { faltan.push(fichero); continue; }
  trozos.push(
    `-- ############################################################\n` +
    `-- ${fichero}\n` +
    `-- ############################################################\n` +
    readFileSync(ruta, "utf8"));
}

const todo = trozos.join("\n\n");

if (process.argv.includes("ver")) {
  console.log(todo);
} else {
  execSync("pbcopy", { input: todo });
  console.log(`Copiado al portapapeles: ${trozos.length} ficheros, ` +
              `${todo.split("\n").length} líneas.`);
  console.log("Pégalo en Supabase → SQL Editor → New query y dale a Run.");
}

if (faltan.length) {
  console.error(`\nOJO, estos no están: ${faltan.join(", ")}`);
  process.exit(1);
}
