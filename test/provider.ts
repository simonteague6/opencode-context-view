// Scripted transport belongs only to the harness, never the plugin.
export function scriptedProvider() {
  const httpArrivals: { path: string; body: string }[] = []
  const websocketFrames: string[] = []
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request, server) {
      const path = new URL(request.url).pathname
      if (request.headers.get("upgrade") === "websocket") {
        if (server.upgrade(request)) return
        return new Response("Upgrade failed", { status: 400 })
      }
      httpArrivals.push({ path, body: await request.text() })
      if (path === "/v1/chat/completions") {
        const chunk = (delta: object, finish_reason: string | null) =>
          `data: ${JSON.stringify({ id: "fixture", object: "chat.completion.chunk", model: "fixture", choices: [{ index: 0, delta, finish_reason }] })}\n\n`
        return new Response(chunk({ role: "assistant", content: "Fixture response." }, null) + chunk({}, "stop") + "data: [DONE]\n\n", {
          headers: { "content-type": "text/event-stream" },
        })
      }
      return new Response("Unexpected provider request", { status: 400 })
    },
    websocket: {
      message(_socket, message) { websocketFrames.push(String(message)) },
    },
  })
  return { httpArrivals, websocketFrames, url: `http://127.0.0.1:${server.port}/v1`, close: () => server.stop(true) }
}
