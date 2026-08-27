// Genera un refresh token de Google Ads (flujo OAuth2 "installed app" / loopback).
// Corré esto vos mismo en tu propia terminal (PowerShell), no a través de Claude:
//
//   node scripts/get-google-ads-refresh-token.mjs
//
// Te va a pedir el Client ID y el Client Secret (los tipeás vos, quedan solo en tu
// terminal). Después abre el navegador para que apruebes el acceso con la cuenta de
// Google de la MCC de Rainbow, y al final imprime el refresh token en TU pantalla.
// Ese valor lo pegás vos directo en Ajustes de RBW Reports — no se lo pases a Claude.

import http from "node:http";
import https from "node:https";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { exec } from "node:child_process";

const PORT = 8765;
const REDIRECT_URI = `http://127.0.0.1:${PORT}`;
const SCOPE = "https://www.googleapis.com/auth/adwords";

const rl = readline.createInterface({ input: stdin, output: stdout });
const clientId = (await rl.question("Client ID: ")).trim();
const clientSecret = (await rl.question("Client Secret: ")).trim();
rl.close();

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth?` +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
  }).toString();

function openBrowser(url) {
  const cmd =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd);
}

function exchangeCodeForToken(code) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    }).toString();

    const req = https.request(
      {
        hostname: "oauth2.googleapis.com",
        path: "/token",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(JSON.parse(data)));
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    res.end(`Error: ${error}. Podés cerrar esta pestaña.`);
    console.error("\nGoogle devolvió un error:", error);
    server.close();
    process.exit(1);
  }

  if (code) {
    res.end("Listo, ya podés cerrar esta pestaña y volver a la terminal.");
    server.close();

    const tokens = await exchangeCodeForToken(code);
    if (tokens.refresh_token) {
      console.log("\n=== Refresh token (pegalo en Ajustes → Google Ads) ===\n");
      console.log(tokens.refresh_token);
      console.log("\n=======================================================\n");
    } else {
      console.error("\nNo se recibió refresh_token. Respuesta completa:", tokens);
      console.error(
        "Tip: si ya habías autorizado antes con esta cuenta, revocá el acceso en https://myaccount.google.com/permissions y volvé a correr el script.",
      );
    }
    process.exit(tokens.refresh_token ? 0 : 1);
  }
});

server.listen(PORT, () => {
  console.log("\nAbriendo el navegador para autorizar con Google...");
  console.log("Si no se abre solo, pegá esta URL en tu navegador:\n");
  console.log(authUrl + "\n");
  openBrowser(authUrl);
});
