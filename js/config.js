/* ============================================================
   Conexión con Supabase.

   Estos dos datos NO son contraseñas. Supabase los llama públicos
   por diseño: van dentro de la página y cualquiera puede leerlos.
   Lo que protege AmigoMío son las políticas de la base de datos
   (db/schema.sql), no el ocultar esta clave.

   La clave `service_role` no se escribe aquí jamás.

   Los sacas del panel de Supabase:
     Project Settings > API  >  "Project URL"  y  "anon public"
   ============================================================ */
window.CONFIG = {
  SUPABASE_URL:  "https://sovzbrrpcbmnevrdwaej.supabase.co",
  SUPABASE_ANON: "sb_publishable_1eNdsYkpqefEIwJU7aakrw_UwzFu9kP",
};

CONFIG.configurado = CONFIG.SUPABASE_URL !== "PENDIENTE" &&
                     CONFIG.SUPABASE_ANON !== "PENDIENTE";
