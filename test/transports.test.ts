import { expect, test } from "bun:test"
import { InstalledHost } from "./harness"

test("views make no HTTP arrivals or model frames when the selected provider uses WebSocket transport", async () => {
  const host = await InstalledHost.start({ transport: "websocket" })
  try {
    const history = await host.history()
    const configuration = await host.configuration()
    for (const command of ["/context", "/context usage", "/context injections", "/context config"]) {
      await host.command(command)
      await host.screen("No primary request captured yet")
      await host.closeView()
    }
    expect(host.provider.httpArrivals).toHaveLength(0)
    expect(host.provider.websocketFrames).toHaveLength(0)
    expect(await host.history()).toEqual(history)
    expect(await host.configuration()).toEqual(configuration)
  } finally { await host.close() }
}, 120_000)
