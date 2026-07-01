# Europa: Pactos de Hierro

MVP web multiplayer por turnos para 2-4 jugadores. El cliente usa Vite, React, TypeScript y PixiJS. En produccion funciona 100% en Netlify Free: frontend estatico, Netlify Functions y persistencia JSON en Netlify Blobs, sincronizando por HTTP polling cada 1.5 segundos.

No usa WebSockets en produccion y no requiere Render, Fly, Railway ni tarjeta.

## Arquitectura actual

- Frontend: `frontend/`, Vite + React.
- API: `netlify/functions/api.ts`.
- Handlers compartidos: `shared/src/netlify-api.ts`.
- Logica autoritativa: funciones puras de `shared/src/game.ts`.
- Persistencia produccion: Netlify Blobs, store `matches`.
- Persistencia local de tests: archivos JSON en `data/netlify-local`.
- Sincronizacion: HTTP polling con `version` y optimistic locking.

Endpoints:

- `GET /api/health`
- `POST /api/matches/create`
- `POST /api/matches/join`
- `GET /api/matches/:matchId`
- `POST /api/matches/:matchId/move`

Cada movimiento envia `expectedVersion`. Si el estado remoto ya cambio, la API devuelve `409` y el cliente refresca la partida.

## Ejecutar localmente

```bash
npm install
npm run validate
npm run test:e2e
```

El E2E levanta automaticamente:

- un API local compatible con Netlify Functions;
- un frontend Vite con `VITE_SERVER_ORIGIN` apuntando a ese API;
- dos contextos Playwright para crear/unirse y jugar acciones sincronizadas por polling.

Para desarrollo manual con la arquitectura Netlify:

```bash
node --import tsx scripts/local-netlify-api.ts
VITE_SERVER_ORIGIN=http://localhost:8888 npm --workspace @europa/frontend run dev
```

En PowerShell:

```powershell
$env:VITE_SERVER_ORIGIN="http://localhost:8888"; npm --workspace @europa/frontend run dev
```

## Scripts

- `npm run dev`: modo legado, arranca servidor Node boardgame.io y frontend.
- `npm run validate`: tests de reglas/API y builds de shared/server/frontend.
- `npm run test:e2e`: prueba dos navegadores contra API local estilo Netlify.
- `npm run build`: compila todos los workspaces.
- `npm run start:server`: modo legado, arranca backend Node.
- `npm run start:frontend`: sirve el build del frontend con Vite preview.

## Produccion en Netlify

El repo incluye `netlify.toml`.

URL desplegada:

- `https://luminous-pudding-286099.netlify.app`
- Health: `https://luminous-pudding-286099.netlify.app/api/health`

Configuracion:

- Build command: `npm install && npm --workspace @europa/frontend run build`
- Publish directory: `frontend/dist`
- Functions directory: `netlify/functions`
- API route: `netlify/functions/api.ts` usa `config.path = "/api/*"` con el runtime moderno de Netlify Functions.

Deploy desde GitHub:

1. Sube el repo a GitHub.
2. En Netlify, crea un site nuevo desde GitHub.
3. Selecciona el repo.
4. Confirma la configuracion detectada por `netlify.toml`.
5. Despliega.
6. Verifica `https://TU-SITE.netlify.app/api/health`.
7. Abre `https://TU-SITE.netlify.app` en dos navegadores.
8. Crea una partida, comparte codigo/link, une el segundo jugador y juega una ronda.

No necesitas variables de entorno para produccion Netlify basica. El frontend llama a `/api` en el mismo dominio.

## Seguridad minima

- Cada jugador recibe `playerCredentials` al unirse.
- Cada `GET /api/matches/:matchId` requiere `playerID` y `playerSecret`.
- Cada movimiento requiere `playerID`, `playerSecret` y `expectedVersion`.
- La API valida turno, fase, propietario, tropas, conexiones, cartas y combate usando `shared`.
- Los movimientos fuera de turno o invalidos se rechazan server-side.
- Las partidas se guardan por `matchId`; los secretos no se exponen en la URL compartida.

## Limites del plan Free

- Netlify Functions no mantienen procesos persistentes.
- No hay WebSockets; el polling puede tardar 1-2 segundos en reflejar cambios.
- Netlify Blobs funciona para playtests cerrados con esta API HTTP; no es una base transaccional para escalado competitivo.
- El optimistic locking evita sobrescribir estados obvios, pero no sustituye una base de datos transaccional para alto volumen.
- Para produccion seria, migrar a Postgres/Supabase o un servicio con operaciones atomicas.

## Modo legado local

El servidor `server/` con boardgame.io se mantiene como referencia local/desarrollo anterior. Produccion ya no depende de el.

Si lo usas:

```bash
npm run dev
```

URLs por defecto:

- Frontend: `http://localhost:5173`
- Backend legado: `http://localhost:8000`
- Health legado: `http://localhost:8000/health`

Si el puerto `8000` esta ocupado, puedes usar `8010`:

```powershell
$env:PORT="8010"; npm run start:server
$env:VITE_SERVER_ORIGIN="http://localhost:8010"; npm --workspace @europa/frontend run dev
```

## Probar partida online

1. Abre la URL de Netlify en dos navegadores o dos ordenadores.
2. Jugador A escribe nombre y crea partida.
3. Jugador A copia link/codigo.
4. Jugador B abre el link o introduce el codigo.
5. Jugador A juega carta, recluta, pasa fase, mueve, ataca, fortifica y pasa turno.
6. Jugador B debe ver cambios y log sincronizados por polling.

## Validation status

- `npm install` OK
- `npm run validate` OK
- `npm run test:e2e` OK
- Playwright 2-browser polling sync OK
- Netlify `/api/health` OK
- Playwright 2-browser online sync OK en `https://luminous-pudding-286099.netlify.app`

## Nota sobre npm audit

Revisa `npm audit`, pero no ejecutes `npm audit fix --force` sin revision. Puede introducir cambios rompientes en dependencias del juego.
