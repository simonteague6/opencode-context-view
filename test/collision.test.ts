import { expect, test } from "bun:test"
import { InstalledHost } from "./harness"

test("an earlier plugin keeps its slash command and receives a fixed actionable collision notice", async () => {
  const host = await InstalledHost.start({ collision: "before" })
  try {
    await host.screen("Context View unavailable")
    await host.screen("Disable or rename the conflicting command")
    expect(host.text()).not.toContain("COLLISION-CANARY")
    await host.command("/context")
    await host.screen("Original command retained")
    expect(host.text()).not.toContain("No primary request captured yet")
    expect(host.provider.httpArrivals).toHaveLength(0)
    expect(host.provider.websocketFrames).toHaveLength(0)
  } finally { await host.close() }
}, 120_000)

test("a later conflicting plugin is reported without taking over its command", async () => {
  const host = await InstalledHost.start({ collision: "after" })
  try {
    await host.screen("Context View unavailable")
    await host.screen("Disable or rename the conflicting command")
    expect(host.text()).not.toContain("COLLISION-CANARY")
    await host.command("/context")
    await host.screen("Original command retained")
    expect(host.text()).not.toContain("No primary request captured yet")
    expect(host.provider.httpArrivals).toHaveLength(0)
  } finally { await host.close() }
}, 120_000)
