# Europa: Pactos de Hierro

MVP web multiplayer por turnos para 2-4 jugadores. El cliente usa Vite, React, TypeScript y PixiJS. La logica autoritativa corre con boardgame.io en un servidor Node separado.

## Ejecutar localmente

```bash
npm install
npm run validate
npm run dev
```

URLs por defecto:

- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- Health check: http://localhost:8000/health

Si el puerto `8000` esta ocupado, usa `8010` para el backend y apunta el frontend a ese puerto.

PowerShell:

```powershell
$env:PORT="8010"; npm run start:server
$env:VITE_SERVER_ORIGIN="http://localhost:8010"; npm --workspace @europa/frontend run dev
```

macOS/Linux:

```bash
PORT=8010 npm run start:server
VITE_SERVER_ORIGIN=http://localhost:8010 npm --workspace @europa/frontend run dev
```

Con backend y frontend activos:

```bash
npm run test:e2e
```

## Scripts

- `npm run dev`: arranca backend y frontend en desarrollo.
- `npm run validate`: ejecuta tests de reglas y builds de server/frontend.
- `npm run test:e2e`: prueba dos navegadores con lobby, carta, combate y sincronizacion.
- `npm run build`: compila todos los workspaces.
- `npm run start:server`: arranca el backend Node.
- `npm run start:frontend`: sirve el build del frontend con Vite preview.

## Variables de entorno

Backend:

- `NODE_ENV`: `development` o `production`.
- `PORT`: puerto HTTP/WebSocket. Ejemplo local `8000`; Render suele usar `10000`; Railway/Fly inyectan `PORT`.
- `DATA_DIR`: carpeta usada por FlatFile JSON. Ejemplo local `./data`.
- `FRONTEND_ORIGIN`: origen permitido por CORS. En produccion es obligatorio y debe ser el dominio real del frontend, por ejemplo `https://europa-pactos.vercel.app`.
- `SERVER_ORIGIN`: URL publica del backend, por ejemplo `https://europa-server.onrender.com`.

Frontend:

- `VITE_SERVER_ORIGIN`: URL publica del backend. Vite requiere el prefijo `VITE_` para exponerla al navegador.

Compatibilidad:

- El backend acepta `CLIENT_ORIGIN` como alias antiguo de `FRONTEND_ORIGIN`, pero para produccion usa `FRONTEND_ORIGIN`.
- El frontend acepta `VITE_SERVER_URL` como alias antiguo de `VITE_SERVER_ORIGIN`.

Archivos de referencia:

- `.env.example`
- `server/.env.example`
- `frontend/.env.example`

## Produccion y CORS

En `NODE_ENV=production`, el backend solo acepta origins configurados en `FRONTEND_ORIGIN`. No se agregan `localhost`, `127.0.0.1` ni IPs LAN automaticamente.

Puedes configurar varios origins separados por coma durante pruebas cerradas:

```text
FRONTEND_ORIGIN=https://europa-pactos.vercel.app,https://preview-europa.vercel.app
```

No uses `*` como origin en produccion.

## Persistencia

El MVP usa `FlatFile` de boardgame.io sobre JSON en `DATA_DIR`.

Esto es suficiente para una prueba cerrada si:

- hay pocas partidas simultaneas;
- el backend corre como una unica instancia;
- el proveedor mantiene disco persistente entre reinicios;
- aceptas que no es una base de datos transaccional.

Limitaciones:

- Railway/Render/Fly pueden requerir volumen persistente explicito.
- Sin volumen, las partidas pueden perderse en redeploys, reinicios o migraciones de instancia.
- No escales a multiples replicas con FlatFile.

Migracion futura recomendada:

- crear una interfaz de almacenamiento para matches;
- mover persistencia a Postgres o Supabase;
- usar backups y migraciones;
- mantener FlatFile solo para desarrollo local.

La migracion no esta implementada en esta fase para no romper la estabilidad del MVP.

## Deploy del backend

### Railway

1. Crea un nuevo proyecto desde el repositorio.
2. Servicio: Node.js.
3. Build command: `npm install && npm --workspace @europa/server run build`.
4. Start command: `npm run start:server`.
5. Variables:
   - `NODE_ENV=production`
   - `PORT` lo puede inyectar Railway automaticamente.
   - `DATA_DIR=/data` si configuras volumen, o `./data` para prueba efimera.
   - `FRONTEND_ORIGIN=https://TU-FRONTEND.vercel.app`
   - `SERVER_ORIGIN=https://TU-BACKEND.up.railway.app`
6. Si quieres persistencia real, crea un volumen y monta `DATA_DIR` ahi.
7. Verifica `https://TU-BACKEND/health`.

### Render

Puedes usar `render.yaml` como punto de partida.

1. Crea un Web Service desde el repo.
2. Build command: `npm install && npm --workspace @europa/server run build`.
3. Start command: `npm run start:server`.
4. Health check path: `/health`.
5. Variables:
   - `NODE_ENV=production`
   - `PORT=10000`
   - `DATA_DIR=/var/data` si usas persistent disk.
   - `FRONTEND_ORIGIN=https://TU-FRONTEND.vercel.app`
   - `SERVER_ORIGIN=https://TU-BACKEND.onrender.com`
6. Activa Persistent Disk si quieres conservar partidas.
7. Verifica `https://TU-BACKEND/health`.

### Fly.io

1. Ejecuta `fly launch` y elige Node app.
2. Configura el start command como `npm run start:server`.
3. Define secretos:

```bash
fly secrets set NODE_ENV=production
fly secrets set FRONTEND_ORIGIN=https://TU-FRONTEND.vercel.app
fly secrets set SERVER_ORIGIN=https://TU-BACKEND.fly.dev
fly secrets set DATA_DIR=/data
```

4. Crea un volumen si quieres persistencia:

```bash
fly volumes create europa_data --size 1
```

5. Monta el volumen en `/data`.
6. Verifica `https://TU-BACKEND.fly.dev/health`.

## Deploy del frontend en Vercel

El repo incluye `vercel.json`.

1. Importa el repositorio en Vercel.
2. Framework: Vite.
3. Build command: `npm install && npm --workspace @europa/frontend run build`.
4. Output directory: `frontend/dist`.
5. Variable:
   - `VITE_SERVER_ORIGIN=https://TU-BACKEND`
6. Despliega.
7. Copia la URL final del frontend.
8. Vuelve al backend y fija:
   - `FRONTEND_ORIGIN=https://TU-FRONTEND.vercel.app`
9. Redeploy del backend.

## Probar partida online

1. Abre la URL del frontend desplegado en dos navegadores o dos ordenadores.
2. Jugador A escribe nombre y crea partida.
3. Jugador A copia el link/codigo.
4. Jugador B abre el link o introduce el codigo.
5. Jugador A juega una carta, recluta, pasa fase, mueve y ataca.
6. Jugador B debe ver el log y los cambios sincronizados.
7. Verifica el backend en `/health` si algo no conecta.

## Probar en LAN

Para probar desde otro ordenador en la misma red:

1. Arranca backend en un puerto libre, por ejemplo `8010`.
2. Arranca frontend con `VITE_SERVER_ORIGIN` apuntando a la IP LAN del backend, por ejemplo `http://192.168.1.37:8010`.
3. Abre desde el segundo ordenador la URL LAN que imprime Vite, por ejemplo `http://192.168.1.37:5173`.
4. Un jugador crea partida y comparte codigo/link.

En desarrollo, el servidor detecta origins LAN locales. En produccion no.

## Hardening minimo

- `.env` y `.env.local` estan ignorados por Git.
- No subas secretos ni tokens al repo.
- En produccion `FRONTEND_ORIGIN` es obligatorio y restringe CORS.
- Los codigos de partida son ids aleatorios de boardgame.io; no contienen nombres, credenciales ni estado de partida.
- El health check publico `/health` no expone `DATA_DIR` ni secretos.
- El servidor registra entorno, origenes permitidos, directorio de datos y errores no controlados.
- Revisa `npm audit`, pero no ejecutes `npm audit fix --force` sin revision porque puede introducir cambios rompientes.

## Validation status

- `npm install` OK
- `npm run validate` OK
- `npm run test:e2e` OK
- Playwright 2-browser sync OK

## Flujo de juego

1. Cada jugador escribe su nombre.
2. Un jugador crea la partida y comparte el codigo.
3. El segundo jugador se une con ese codigo.
4. Ambos juegan por fases: produccion, movimiento, batalla y consolidacion.
5. Se pueden jugar cartas de evento, resolver combate con terreno y ganar por capitales o poder.

## Nota sobre Vercel Functions

Vercel Functions no son adecuadas para el backend porque boardgame.io usa conexion persistente por WebSocket. Usa Railway, Render o Fly.io para el servidor.
