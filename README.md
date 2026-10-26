# La Cripta del Rey Ceniza

RPG por turnos con dados d20 para navegador, hecho con Phaser 4, TypeScript y Vite. Sin backend: el build es un sitio
estático.

## Jugar

Versión publicada: https://asierdev.github.io/ashen-king-crypt/ (se despliega con GitHub Actions en cada push a `main`).

## Requisitos

- Node.js 22.12 o superior.

## Comandos

| Comando | Descripción |
|---|---|
| `npm install` | Instala las dependencias. |
| `npm run dev` | Servidor de desarrollo en http://localhost:8080 |
| `npm test` | Tests del núcleo de reglas (Vitest). |
| `npm run typecheck` | Comprobación de tipos con `tsc --noEmit`. |
| `npm run build` | Build de producción en `dist/`. |
| `npm run smoke -- Combat` / `npm run smoke -- flow` | Abre la build en Chrome headless y falla si hay errores de página (requiere `npm run build` antes y el puerto 4173 libre). |
| `npm run balance` | Simula miles de partidas con el núcleo de reglas y muestra el % de victorias por estrategia (`BALANCE_RUNS=N` para cambiar el número). |
| `npm run playthrough -- <url> <carpeta> [fate\|nofate]` | Juega una partida completa contra el servidor de desarrollo y guarda una captura por escena. |

## Sonido

Efectos y ambiente sintetizados con Web Audio. Suenan tras pulsar Comenzar; la tecla `M` o el botón de la portada los
silencian (el ajuste se recuerda en este navegador).

## Semilla

El parámetro `?seed=N` en la URL reproduce una partida .

## Arte

Los PNG normalizados van en `public/assets/sprites/<defId>/` con cuatro tiras horizontales: `idle.png`, `attack.png`,
`hit.png` y `death.png`. Si falta un PNG, el juego usa un placeholder generado por código.

Cada unidad declara en `src/game/assets.ts` el tamaño de frame y la caja visible del personaje (`bodyHeight`, `footPad`,
`centerX`), medidas sobre la tira `idle`, y una escala. Así los pies quedan en el suelo y las barras encima de la cabeza.

| `defId` | Unidad | Carpeta |
|---|---|---|
| `warrior` | Guerrero (Bran) | `public/assets/sprites/warrior/` |
| `cleric` | Clériga (Isolda) | `public/assets/sprites/cleric/` |
| `mage` | Mago (Teodric) | `public/assets/sprites/mage/` |
| `rogue` | Pícara (Nerea) | `public/assets/sprites/rogue/` |
| `skeleton` | Esqueleto | `public/assets/sprites/skeleton/` |
| `ghoul` | Necrófago | `public/assets/sprites/ghoul/` |
| `cultist` | Sectario | `public/assets/sprites/cultist/` |
| `ashenKing` | Rey Ceniza | `public/assets/sprites/ashenKing/` |

Fondo opcional: `public/assets/backgrounds/crypt.png`.

Ver `CREDITS.md` para las licencias.
