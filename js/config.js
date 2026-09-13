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

  /* La clave PÚBLICA de los avisos en el móvil. No es un
     secreto: el navegador la necesita para suscribirse y va en
     todas las páginas. La privada, que sí lo es, vive en los
     secretos de Edge Functions como VAPID_PRIVADA. */
  VAPID_PUBLICA: "BMh3Z2a_iqiEnb5r5ZA5-x1-7lofpv55fa9Z-zBjdwzV5OlqUcUob_nshkAfGfAmRCRhg-mRhv4m0xkzIe7Db8U",
};

CONFIG.configurado = CONFIG.SUPABASE_URL !== "PENDIENTE" &&
                     CONFIG.SUPABASE_ANON !== "PENDIENTE";
