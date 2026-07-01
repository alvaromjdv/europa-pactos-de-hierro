import { createServer } from "node:http";
import { handleApiRequest } from "../shared/src/netlify-api";

const port = Number(process.env.API_PORT ?? 8888);

const server = createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = Buffer.concat(chunks).toString("utf8");
  const result = await handleApiRequest({
    method: request.method ?? "GET",
    path: request.url ?? "/",
    body
  });

  response.statusCode = result.status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(result.body));
});

server.listen(port, () => {
  console.log(`Local Netlify API listening on http://localhost:${port}`);
});
