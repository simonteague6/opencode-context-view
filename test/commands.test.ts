import { afterAll, afterEach, beforeAll, expect, test } from "bun:test"
import { InstalledHost } from "./harness"

let host: InstalledHost
beforeAll(async () => {
  host = await InstalledHost.start()
}, 120_000)
afterAll(async () => { await host?.close() })
afterEach(async () => { await host?.closeView() })

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

test("usage alias is equivalent and inspection and config open their own placeholders", async () => {
  await host.command("/context")
  await host.screen("No primary request captured yet")
  const usage = host.text()
  await host.closeView()
  await host.command("/context usage")
  await host.screen("No primary request captured yet")
  expect(host.text()).toBe(usage)
  await host.closeView()
  await host.command("/context injections")
  await host.screen("Context Inspection")
  await host.screen("No primary request captured yet")
  await host.closeView()
  await host.command("/context config")
  await host.screen("Context Configuration")
  await host.screen("Configuration view placeholder")
  await host.screen("connected server/location")
  expect(host.provider.httpArrivals).toHaveLength(0)
  expect(host.provider.websocketFrames).toHaveLength(0)
}, 30_000)

test("unknown and extra arguments show accepted syntax without submitting a prompt", async () => {
  for (const command of ["/context unsupported", "/context usage extra"]) {
    await host.command(command)
    await host.screen("Usage: /context [usage|injections|config]")
    expect(host.text()).not.toContain("Escape or q to close")
    await host.absent("Usage: /context [usage|injections|config]")
  }
  expect(host.provider.httpArrivals).toHaveLength(0)
  expect(host.provider.websocketFrames).toHaveLength(0)
}, 30_000)

test("native command palette discovers all views and opens config", async () => {
  host.key("\x10")
  await host.screen("Commands")
  host.key("Context")
  await host.screen("Context Usage")
  await host.screen("Context Inspection")
  await host.screen("Context Configuration")
  host.key(" Configuration")
  await host.absent("Context Usage")
  host.key("\r")
  await host.screen("Configuration view placeholder")
  expect(host.provider.httpArrivals).toHaveLength(0)
}, 30_000)

test("opening and closing every view leaves provider traffic, history and configuration untouched", async () => {
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
}, 30_000)

test("q closes only the active view and is released back to native prompt input", async () => {
  await host.command("/context")
  await host.screen("Escape or q to close")
  host.key("q")
  await host.absent("Escape or q to close")
  host.key("SCOPED_q_INPUT")
  await host.screen("SCOPED_q_INPUT")
  host.key("\x15")
  await host.absent("SCOPED_q_INPUT")
  expect(host.provider.httpArrivals).toHaveLength(0)
}, 30_000)

test("config works without an active session and usage explains the missing session", async () => {
  host.key("\x18n") // documented session.new default: <leader>n
  await host.command("/context config")
  await host.screen("Configuration view placeholder")
  await host.screen("connected server/location")
  await host.closeView()
  await host.command("/context usage")
  await host.screen("No active session")
  await host.screen("No primary request captured yet")
  expect(host.provider.httpArrivals).toHaveLength(0)
}, 30_000)
