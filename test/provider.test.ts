import { expect, test } from "bun:test"
import { InstalledHost } from "./harness"

test("an explicit native user prompt reaches the scripted provider and renders its deterministic reply", async () => {
  const host = await InstalledHost.start()
  try {
    expect(host.provider.httpArrivals).toHaveLength(0)
    await host.prompt("LOCAL_FIXTURE_USER_REQUEST")
    const arrivals = host.provider.httpArrivals.filter(request => request.path === "/v1/chat/completions")
    expect(arrivals.length).toBeGreaterThan(0)
    const primary = arrivals.find(request => request.body.includes("LOCAL_FIXTURE_USER_REQUEST"))
    expect(primary).toBeDefined()
    expect(JSON.stringify(await host.history())).toContain("Fixture response.")
  } finally { await host.close() }
}, 120_000)

test("loading the installed plugin adds no model-visible tool or system instruction", async () => {
  const requests: { system: unknown[]; tools: unknown[] }[] = []
  for (const plugin of [false, true]) {
    const host = await InstalledHost.start({ plugin })
    try {
      await host.prompt("LOCAL_FIXTURE_USER_REQUEST")
      const primary = host.provider.httpArrivals.find(request => request.body.includes("LOCAL_FIXTURE_USER_REQUEST"))!
      const request = JSON.parse(primary.body.replaceAll(host.root, "<fixture>"))
      requests.push({
        system: request.messages.filter((message: { role: string }) => message.role === "system"),
        tools: request.tools,
      })
    } finally { await host.close() }
  }
  expect(requests[0].system.length).toBeGreaterThan(0)
  expect(requests[0].tools.length).toBeGreaterThan(0)
  expect(requests[1]).toEqual(requests[0])
}, 120_000)
