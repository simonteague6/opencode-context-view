import { mkdtemp, mkdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, isAbsolute } from "node:path"
import { OpenCode } from "@opencode/client"
import xterm from "@xterm/headless"
import { scriptedProvider } from "./provider"

const { Terminal } = xterm

async function run(argv: string[], cwd: string, env?: Record<string, string>) {
  const process = Bun.spawn(argv, { cwd, env, stdout: "pipe", stderr: "pipe", timeout: 60_000 })
  const [stdout, stderr, code] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited])
  if (code !== 0) throw new Error(`${argv[0]} failed (${code}): ${stderr}`)
  return stdout
}

export class InstalledHost {
  readonly provider = scriptedProvider()
  readonly terminal = new Terminal({ cols: 120, rows: 40, allowProposedApi: true })
  root = ""
  directory = ""
  env!: Record<string, string>
  client!: ReturnType<typeof OpenCode.make>
  sessionID = ""
  server?: ReturnType<typeof Bun.spawn>
  tui?: ReturnType<typeof Bun.spawn>
  private changed = new Set<() => void>()

  static async start() {
    const host = new InstalledHost()
    try { await host.start(); return host } catch (error) { await host.close(); throw error }
  }

  private async start() {
    const binary = Bun.env.CONTEXT_VIEW_HOST
    if (!binary) throw new Error("Acceptance requires CONTEXT_VIEW_HOST pointing to an isolated OpenCode V2.2.5 binary; the live host is not a fallback.")
    if (!isAbsolute(binary)) throw new Error("CONTEXT_VIEW_HOST must be an absolute path")
    const version = await run([binary, "--version"], process.cwd())
    if (version.trim() !== "opencode v2.2.5") throw new Error(`Required OpenCode V2.2.5; found ${version.trim()}`)
    this.root = await mkdtemp(join(Bun.env.CONTEXT_VIEW_TEST_TMP ?? tmpdir(), "context-view-"))
    this.directory = join(this.root, "project")
    await mkdir(this.directory)
    this.env = {
      PATH: process.env.PATH!, HOME: join(this.root, "home"),
      XDG_CONFIG_HOME: join(this.root, "config"), XDG_DATA_HOME: join(this.root, "data"),
      XDG_CACHE_HOME: join(this.root, "cache"), XDG_STATE_HOME: join(this.root, "state"),
      TMPDIR: this.root, TERM: "xterm-256color", COLORTERM: "truecolor",
      OPENCODE_PASSWORD: crypto.randomUUID(),
    }
    // Archive and install, never a workspace link or source-tree plugin path.
    const archive = join(this.root, "plugin.tgz")
    await run(["bun", "pm", "pack", "--filename", archive], process.cwd())
    await Bun.write(join(this.directory, "package.json"), '{"private":true,"type":"module"}')
    await run(["bun", "add", archive], this.directory, this.env)
    await mkdir(join(this.env.XDG_CONFIG_HOME, "opencode"), { recursive: true })
    await Bun.write(join(this.env.XDG_CONFIG_HOME, "opencode/opencode.json"), JSON.stringify({ update: "disable" }))
    await Bun.write(join(this.directory, "opencode.json"), JSON.stringify({
      plugins: [join(this.directory, "node_modules/opencode-context-view")],
      model: "fixture/fixture",
      providers: { fixture: {
        name: "Deterministic fixture", package: "@opencode/ai/providers/openai-compatible",
        settings: { baseURL: this.provider.url, apiKey: "fixture-only" },
        models: { fixture: { name: "Fixture", limit: { context: 32000, output: 1024 } } },
      } },
    }))
    for (const kind of ["home", "config", "data", "cache", "state"] as const) {
      const path = (await run([binary, "debug", "paths", kind], this.directory, this.env)).trim()
      if (!path.startsWith(this.root + "/")) throw new Error(`Host ${kind} path escapes isolated fixture: ${path}`)
    }
    this.server = Bun.spawn([binary, "serve", "--hostname", "127.0.0.1", "--port", "0"], {
      cwd: this.directory, env: this.env, stdout: "pipe", stderr: "pipe",
    })
    const url = await this.serverURL(this.server)
    this.client = OpenCode.make({ baseUrl: url, headers: { Authorization: `Basic ${btoa(`opencode:${this.env.OPENCODE_PASSWORD}`)}` } })
    await this.client.server.info()
    const session = await this.client.session.create({ title: "Empty fixture", location: { directory: this.directory } })
    this.sessionID = session.id
    this.terminal.onData(data => this.tui?.terminal?.write(data))
    this.tui = Bun.spawn([binary, "--server", url, "--session", session.id, this.directory], {
      cwd: this.directory, env: this.env,
      terminal: { cols: 120, rows: 40, data: (_terminal, data) => {
        this.terminal.write(data, () => { for (const notify of this.changed) notify() })
      } },
    })
    await this.screen("Empty fixture")
  }

  private async serverURL(child: ReturnType<typeof Bun.spawn>) {
    const stream = child.stdout
    if (typeof stream === "number" || !stream) throw new Error("Missing host stdout")
    let output = ""
    const reader = stream.getReader()
    const timeout = setTimeout(() => child.kill(), 30_000)
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        output += new TextDecoder().decode(value)
        const match = output.match(/http:\/\/127\.0\.0\.1:\d+/)
        if (match) return match[0]
      }
    } finally {
      clearTimeout(timeout)
      reader.releaseLock()
    }
    throw new Error(`Host exited without listening: ${output}`)
  }

  text() {
    const buffer = this.terminal.buffer.active
    return Array.from({ length: this.terminal.rows }, (_, row) => buffer.getLine(buffer.viewportY + row)?.translateToString(true) ?? "").join("\n")
  }

  async screen(text: string, timeout = 15_000) {
    if (this.text().includes(text)) return
    await new Promise<void>((resolve, reject) => {
      const check = () => { if (this.text().includes(text)) { cleanup(); resolve() } }
      const timer = setTimeout(() => { cleanup(); reject(new Error(`Native TUI did not show ${JSON.stringify(text)}:\n${this.text()}`)) }, timeout)
      const cleanup = () => { clearTimeout(timer); this.changed.delete(check) }
      this.changed.add(check)
      check()
    })
  }

  async command(command: string) {
    this.tui!.terminal!.write(command)
    await this.screen(command)
    this.tui!.terminal!.write("\r")
  }

  async plugins() {
    return JSON.stringify(await this.client.plugin.list({ location: { directory: this.directory } }))
  }

  async latest() {
    const { ContextView } = await import(Bun.resolveSync("opencode-context-view/rpc", this.directory))
    return this.client.rpc(ContextView).latest({ sessionID: this.sessionID }, { location: { directory: this.directory } })
  }

  async close() {
    for (const child of [this.tui, this.server]) {
      if (!child) continue
      child.kill()
      await child.exited
      child.terminal?.close()
    }
    this.terminal.dispose()
    this.provider.close()
    if (this.root && !Bun.env.CONTEXT_VIEW_KEEP_TEST_DIR) await rm(this.root, { recursive: true, force: true })
  }
}
