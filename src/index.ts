import { Plugin } from "@opencode/plugin"
import { ContextView } from "./rpc"

export default Plugin.define({
  id: "context-view",
  async setup(context) {
    const registration = await context.rpc.register(ContextView, {
      latest: async () => ({ status: "no-capture" as const }),
    })
    return () => registration.dispose()
  },
})
