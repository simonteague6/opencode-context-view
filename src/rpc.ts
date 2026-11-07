import { Rpc } from "@opencode/plugin/rpc"
import { z } from "zod"

// This slice deliberately exposes only an honest empty state, not capture APIs.
export const ContextView = Rpc.define({
  id: "context-view",
  events: {},
  methods: {
    latest: {
      input: z.object({ sessionID: z.string().min(1) }).strict(),
      output: z.object({ status: z.literal("no-capture") }).strict(),
    },
  },
})

export default ContextView
