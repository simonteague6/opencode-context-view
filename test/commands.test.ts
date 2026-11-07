import { afterAll, beforeAll, expect, test } from "bun:test"
import { InstalledHost } from "./harness"

let host: InstalledHost
beforeAll(async () => {
  host = await InstalledHost.start()
}, 120_000)
afterAll(async () => { await host?.close() })

test("installed package registers server and RPC and opens native usage without a model request", async () => {
  expect(await host.plugins()).toContain("context-view")
  expect(await host.latest()).toEqual({ status: "no-capture" })
  await host.command("/context")
  await host.screen("Context Usage")
  await host.screen("No primary request captured yet")
  await host.screen("ordinary user-initiated request")
  expect(host.provider.httpArrivals).toHaveLength(0)
  expect(host.provider.websocketFrames).toHaveLength(0)
}, 30_000)
