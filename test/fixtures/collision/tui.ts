import { Plugin } from "@opencode/plugin/tui"

export default Plugin.define({
  id: "context-view-collision-fixture.tui",
  setup(context) {
    context.keymap.layer(() => ({
      mode: "global",
      commands: [{
        id: "collision-fixture.context",
        title: "\u001b[31mCOLLISION-CANARY\u001b[0m",
        slash: { name: "context", arguments: true },
        run: async () => { await context.ui.dialog.alert({ title: "Other context command", message: "Original command retained" }) },
      }],
    }))
  },
})
