/* ============================================================
   Los sonidos del clicker.

   Santiago, 12/09/2026: poder elegir entre clic, clic-clic, bep
   y bep-bep. Tiene sentido y no es un capricho: en una clase con
   varios perros, dos manos con el mismo clicker marcan también
   al perro de al lado. Cada uno con el suyo y no hay confusión.

   Están aquí y no dentro de la vista para poder probarlos: en
   las pruebas no hay navegador ni sintetizador de audio, pero sí
   se puede comprobar que un clicker sigue siendo un clicker —
   seco, corto y reconocible.

   Qué es un golpe: `cuando` es a los cuántos segundos suena
   desde que se aprieta, y `hz` lo agudo que es. Nada más: el
   sintetizador lo monta la vista.

   Y `chasquidos` es CUÁNTOS SE OYEN, que no es lo mismo que
   cuántos golpes hay: el «clic» son dos tonos separados por 12
   milésimas, y a esa distancia el oído no los separa — es justo
   lo que hace que suene a chasquido metálico y no a pitido.
   ============================================================ */

export const SONIDOS = [
  {
    id: "clic",
    chasquidos: 1,
    nombre: "Clic",
    pista: "El de siempre, como la lengüeta metálica.",
    golpes: [{ cuando: 0,     hz: 2600 },
             { cuando: 0.012, hz: 1900 }],
    /* Dos tonos, pero un solo golpe para el oído: 12
       milésimas no se separan. Es lo que hace que suene a
       chasquido y no a pitido. */
    forma: "square",
  },
  {
    id: "clic-clic",
    chasquidos: 2,
    nombre: "Clic-clic",
    pista: "Dos chasquidos seguidos.",
    golpes: [{ cuando: 0,     hz: 2600 },
             { cuando: 0.012, hz: 1900 },
             { cuando: 0.060, hz: 2600 },
             { cuando: 0.072, hz: 1900 }],
    forma: "square",
  },
  {
    id: "bep",
    chasquidos: 1,
    nombre: "Bep",
    pista: "Un pitido corto, más grave. Para distinguirlo del de al lado.",
    golpes: [{ cuando: 0, hz: 1100 }],
    forma: "sine",
  },
  {
    id: "bep-bep",
    chasquidos: 2,
    nombre: "Bep-bep",
    pista: "Dos pitidos cortos.",
    golpes: [{ cuando: 0,     hz: 1100 },
             { cuando: 0.065, hz: 1100 }],
    forma: "sine",
  },
];

export const POR_DEFECTO = "clic";

export const sonido = id => SONIDOS.find(s => s.id === id) || SONIDOS[0];
