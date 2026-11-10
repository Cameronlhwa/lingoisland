import { createServer } from "node:http";

const proxyPort = Number(process.env.SMS_PROXY_PORT || 3004);
const appUrl = `http://127.0.0.1:${process.env.SMS_APP_PORT || 3003}/api/sms/webhook`;

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/api/sms/webhook") {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);

    const upstream = await fetch(appUrl, {
      method: "POST",
      headers: {
        "content-type": request.headers["content-type"] || "application/json",
        "telnyx-signature-ed25519": request.headers["telnyx-signature-ed25519"] || "",
        "telnyx-timestamp": request.headers["telnyx-timestamp"] || "",
      },
      body: Buffer.concat(chunks),
    });

    response.writeHead(upstream.status, { "Content-Type": "application/json" });
    response.end(await upstream.text());
  } catch {
    response.writeHead(502, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Webhook upstream unavailable" }));
  }
}).listen(proxyPort, "127.0.0.1", () => {
  console.log(`SMS webhook gateway listening on http://127.0.0.1:${proxyPort}`);
});
