import { Plugin, usePlugin } from "@opencode/plugin/tui"
import { ContextView } from "./rpc"

const syntax = "Usage: /context [usage|injections|config]"
const titles = { usage: "Context Usage", injections: "Context Inspection", config: "Context Configuration" } as const
type View = keyof typeof titles

function Placeholder(props: { title: string; message: string }) {
  const context = usePlugin()
  context.keymap.layer(() => ({
    commands: [{ bind: "q", run: () => context.ui.dialog.clear() }],
  }))
  return <box flexDirection="column" padding={1} gap={1}>
    <text fg={context.theme.text.base}>{props.title}</text>
    <text fg={context.theme.text.base}>{props.message}</text>
    <text fg={context.theme.text.base}>Escape or q to close</text>
  </box>
}

export default Plugin.define({
  id: "context-view.tui",
  setup(context) {
    let alive = true
    let generation = 0
    const collision = () => context.keymap.commands().some(command =>
      !command.id?.startsWith("context-view.") &&
      (command.slash?.name === "context" || command.slash?.aliases?.includes("context")),
    ) || context.data.location.command.list(context.location)?.some(command => command.name === "context") === true

    const warnCollision = () => context.ui.toast.show({
      title: "Context View unavailable",
      message: "The /context command is already registered. Disable or rename the conflicting command, then reload Context View.",
      variant: "error",
    })

    async function open(view: View) {
      if (collision()) { warnCollision(); return }
      const current = ++generation
      const route = context.ui.router.current()
      const sessionID = route.type === "session" ? route.sessionID : undefined
      let message = "No primary request captured yet. An ordinary user-initiated request is needed; opening this view never sends one."
      if (view === "config") {
        message += "\nConfiguration view placeholder. Display options belong to the connected server/location; configure through plugin options. This view is read-only."
      } else if (!sessionID) {
        message = "No active session. Open a session to inspect its latest captured primary request.\n" + message
      } else {
        try {
          await context.client.rpc(ContextView).latest({ sessionID }, {
            location: context.location ?? context.data.location.default(),
          })
        } catch {
          message = "Context View server unavailable. Check that the package is enabled on the connected server, then reopen this view."
        }
      }
      if (!alive || current !== generation) return
      // V2.2.5 offers xlarge, not a fullscreen custom-dialog API.
      context.ui.dialog.set({ size: "xlarge" })
      context.ui.dialog.show(() => <Placeholder title={titles[view]} message={message} />, () => { generation++ })
    }

    if (collision()) {
      warnCollision()
      return
    }
    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "context-view.usage", title: "Context Usage", group: "Context View", palette: true,
          slash: { name: "context", arguments: true },
          run: async input => {
            const args = (input ?? "").trim().split(/\s+/).filter(Boolean)
            if (args.length === 0) { await open("usage"); return }
            if (args.length === 1 && Object.hasOwn(titles, args[0])) { await open(args[0] as View); return }
            context.ui.toast.show({ title: "Context View", message: syntax, variant: "warning" })
          },
        },
        { id: "context-view.inspection", title: "Context Inspection", group: "Context View", palette: true, run: () => open("injections") },
        { id: "context-view.config", title: "Context Configuration", group: "Context View", palette: true, run: () => open("config") },
      ],
    }))
    return () => { alive = false; generation++ }
  },
})
