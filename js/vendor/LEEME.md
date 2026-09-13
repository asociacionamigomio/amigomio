# Librerías de fuera

Aquí vive, tal cual, código que no es nuestro.

## `supabase.js`

Es `@supabase/supabase-js` **versión 2.45.4**, el mismo fichero que servía
`cdn.jsdelivr.net`, copiado al repositorio el 13/09/2026.

**Por qué no se carga del CDN.** Porque la aplicación no arranca sin él, y un
CDN es de otro: si va lento, si el móvil está en una red que lo bloquea, o si
sencillamente no contesta, AmigoMío se queda en «Cargando…» y no hay nada que
podamos hacer. Le pasó a Santiago en su móvil ese mismo día.

Aquí, en cambio, lo sirve GitHub Pages con el resto de la aplicación, entra en
el caché del service worker como todo lo demás, y funciona sin cobertura.

**Para actualizarlo** hay que traerse el fichero nuevo a mano, con la versión
clavada —jamás la etiqueta de «la última», que convierte una actualización
ajena en una avería nuestra un martes cualquiera— y probar la aplicación entera
antes de subirlo:

```sh
curl -o js/vendor/supabase.js \
  https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js
```
