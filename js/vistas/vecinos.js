/* ============================================================
   Los vecinos: quién más pasa por AmigoMío.

   Sólo salen los que han dicho que sí en su ficha, y de ellos
   sólo lo que se puede enseñar: nombre de pila, foto, y sus
   perros con nombre, raza y foto.

   NO sale —ni puede salir— el apellido, el DNI, la dirección, el
   teléfono, el chip del perro ni nada de su salud. No es que
   esta pantalla no lo pinte: es que la base de datos no lo da.
   Se pregunta por dos vistas que sólo tienen esas columnas.
   ============================================================ */
import { perfilesVisibles, perrosVisibles, verFotos, miFicha } from "../datos.js";

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const SEXOS = { macho: "macho", hembra: "hembra" };

export async function render(contenedor) {
  contenedor.innerHTML = `<p class="cargando">Un momento…</p>`;

  const [gente, perros, yo] = await Promise.all([
    perfilesVisibles(), perrosVisibles(), miFicha(),
  ]);

  /* Los enlaces de las fotos se piden TODOS DE UNA VEZ: pedirlos
     de uno en uno serían cuarenta viajes al servidor para pintar
     una lista. */
  const fotos = await verFotos([
    ...gente.map(p => p.foto),
    ...perros.map(p => p.foto),
  ]);

  const edad = iso => {
    if (!iso) return "";
    const años = Math.floor((Date.now() - new Date(iso)) / (365.25 * 86400000));
    return años >= 1 ? ` · ${años} ${años === 1 ? "año" : "años"}` : " · cachorro";
  };

  const avatar = (ruta, porDefecto) => fotos[ruta]
    ? `<img src="${fotos[ruta]}" alt="">` : porDefecto;

  contenedor.innerHTML = `
    <h2>Los vecinos</h2>
    <p class="flojo">Quienes pasan por AmigoMío y han querido presentarse.
       ${yo?.perfil_visible
         ? "Tú también sales, porque lo activaste en tu ficha."
         : `Si quieres salir tú, enciéndelo en <strong>Mi ficha</strong>.`}</p>

    ${gente.length === 0 ? `
      <div class="tarjeta vacio">
        <p>Todavía no se ha presentado nadie.</p>
        <p class="flojo">Puedes ser el primero: enciéndelo en tu ficha.</p>
        <button class="boton" data-ir="ficha">Ir a mi ficha</button>
      </div>` : `
      <div class="vecinos">
        ${gente.map(persona => {
          const suyos = perros.filter(p => p.cliente_id === persona.id);
          return `
          <div class="tarjeta vecino">
            <div class="fila-cliente">
              <div class="avatar">${avatar(persona.foto, "👤")}</div>
              <div>
                <h3>${esc(persona.nombre) || "Alguien"}</h3>
                <p class="flojo">${suyos.length === 0 ? "sin perros todavía"
                  : suyos.length === 1 ? "un perro" : `${suyos.length} perros`}</p>
              </div>
            </div>

            ${suyos.length ? `
              <div class="perros-vecino">
                ${suyos.map(p => `
                  <div class="perro-vecino">
                    <div class="avatar">${avatar(p.foto, "🐕")}</div>
                    <div>
                      <strong>${esc(p.nombre)}</strong>
                      <p class="flojo">${esc(p.raza) || "sin raza"}${
                        p.sexo ? ` · ${SEXOS[p.sexo] ?? ""}` : ""}${edad(p.fecha_nacimiento)}</p>
                    </div>
                  </div>`).join("")}
              </div>` : ""}
          </div>`;
        }).join("")}
      </div>`}`;

  contenedor.querySelectorAll("[data-ir]").forEach(b =>
    b.addEventListener("click", () => window.irA?.(b.dataset.ir)));
}
