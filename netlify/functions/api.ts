import type { Config } from "@netlify/functions";
import { handleApiRequest } from "../../shared/src/netlify-api";

export default async function handler(request: Request) {
  const headers = {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  if (request.method === "OPTIONS") {
    return new Response("", { status: 204, headers });
  }

  const url = new URL(request.url);
  const response = await handleApiRequest({
    method: request.method,
    path: `${url.pathname}${url.search}`,
    body: await request.text()
  });

  return new Response(JSON.stringify(response.body), {
    status: response.status,
    headers
  });
}

export const config: Config = {
  path: "/api/*"
};
