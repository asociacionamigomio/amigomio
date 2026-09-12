const app = document.getElementById("app");

if (!window.CONFIG?.configurado) {
  app.innerHTML = `
    <h1>AmigoMío</h1>
    <div class="aviso">
      Falta conectar la base de datos. Rellena <code>js/config.js</code>
      con los datos de Supabase.
    </div>`;
} else {
  app.innerHTML = `<h1>AmigoMío</h1><p>Conectado. Todavía sin pantallas.</p>`;
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
