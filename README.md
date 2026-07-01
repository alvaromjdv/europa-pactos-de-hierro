# Europa: Pactos de Hierro

MVP web multiplayer por turnos para 2 jugadores, preparado para crecer a 6. El cliente usa Vite, React, TypeScript y PixiJS. La logica autoritativa corre con boardgame.io en un servidor Node separado.

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
$env:PORT="8010"; npm --workspace @europa/server run start
$env:VITE_SERVER_URL="http://localhost:8010"; npm --workspace @europa/frontend run dev
```

macOS/Linux:

```bash
PORT=8010 npm --workspace @europa/server run start
VITE_SERVER_URL=http://localhost:8010 npm --workspace @europa/frontend run dev
```

Con backend y frontend activos, puedes repetir la prueba real de dos navegadores:

```bash
npm run test:e2e
```

## Probar en LAN

Para probar desde otro ordenador en la misma red:

1. Arranca el backend escuchando en un puerto libre, por ejemplo `8010`.
2. Arranca el frontend con `VITE_SERVER_URL` apuntando a la IP LAN del equipo que ejecuta el backend, por ejemplo `http://192.168.1.37:8010`.
3. Abre desde el segundo ordenador la URL LAN que imprime Vite, por ejemplo `http://192.168.1.37:5173`.
4. Un jugador crea la partida y comparte el codigo o link; el otro jugador entra con ese codigo.

El servidor detecta origenes LAN locales en desarrollo y tambien acepta `CLIENT_ORIGIN` separado por comas si necesitas fijarlos manualmente.

## Validation status

- `npm install` OK
- `npm run validate` OK
- `npm run test:e2e` OK
- Playwright 2-browser sync OK

## Nota tecnica sobre npm audit

`npm audit` puede reportar vulnerabilidades transitivas. No ejecutes `npm audit fix --force` sin revision previa porque puede actualizar dependencias con cambios rompientes y desestabilizar el MVP.

## Variables de entorno

Servidor:

- `PORT`: puerto HTTP/WebSocket del backend. Por defecto `8000`.
- `CLIENT_ORIGIN`: origen permitido por CORS. Por defecto `http://localhost:5173`; acepta varios origenes separados por comas.
- `DATA_DIR`: carpeta para persistencia local FlatFile. Por defecto `./data`.

Frontend:

- `VITE_SERVER_URL`: URL del backend. Por defecto `http://localhost:8000`.

## Flujo de juego

1. Cada jugador escribe su nombre.
2. Un jugador crea la partida y comparte el codigo.
3. El segundo jugador se une con ese codigo.
4. Ambos entran al tablero y juegan por fases: produccion, movimiento, batalla y consolidacion.
5. Gana quien controle 3 capitales.

## Deploy

Frontend en Vercel:

1. Configura el proyecto apuntando a `frontend`.
2. Define `VITE_SERVER_URL` con la URL publica del backend.
3. Usa `npm run build` como comando de build y `dist` como carpeta de salida.

Backend en Railway, Render o Fly.io:

1. Despliega el repo completo.
2. Usa `npm --workspace @europa/server run start` como comando.
3. Define `PORT`, `CLIENT_ORIGIN` y `DATA_DIR`.
4. Usa almacenamiento persistente para `DATA_DIR` en produccion temprana.

Vercel Functions no son adecuadas para este backend porque boardgame.io usa conexion persistente por WebSocket.
