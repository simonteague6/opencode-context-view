# Plugin and harness development

This is the development slice for issue #2 under master spec #1, tested on
OpenCode V2.2.6. V2.2.5 compatibility is not claimed.
It contains server, native TUI, and schema-validated RPC package exports.
Capture, accounting, real configuration inspection, and previews are separate
tickets. The configuration view is explicitly a placeholder and does not expose
arbitrary plugin options.

## Commands

- `/context` and `/context usage`: Context Usage placeholder.
- `/context injections`: Context Inspection placeholder.
- `/context config`: read-only Context Configuration placeholder, including
  when no session is selected.

The three views have command-palette entries. Invalid or extra arguments show
`Usage: /context [usage|injections|config]`. Views never initiate prompts.
The server registers only read-only RPC, with no tools or instruction hooks.

The TUI checks for an existing `/context` name or alias before registering its
commands, watches the public reactive command registry for later conflicts,
and checks again before opening a view. On conflict it disables its layer and
shows a fixed actionable notice without interpolating another plugin's name,
description, or exception. Rename/disable the conflicting command and reload
Context View. Native acceptance covers conflicting plugins loaded both before
and after Context View.

## Verification

Use Bun consistently:

```sh
bun install --frozen-lockfile
bun run typecheck
CONTEXT_VIEW_HOST=/absolute/path/to/v2.2.6/opencode bun test
```

`bun test` fails explicitly when `CONTEXT_VIEW_HOST` is absent or its version
does not equal `opencode v2.2.6`. The installed binary can be reused: all test
configuration and state are isolated. It does not silently skip tests or
discover/attach to the user's service. No broader compatibility range or
complete-application release readiness is claimed.

The harness packs the repository, installs that archive into a temporary
project using Bun, starts a foreground OpenCode server, and connects a real
native TUI through a PTY. A terminal emulator reads rendered screen contents;
tests do not mount plugin components or invoke command callbacks directly.
RPC is imported through the installed package's `./rpc` export.

Each fixture uses a fresh HOME, XDG config/data/cache/state, temporary directory,
password, and local scripted provider. No credential-bearing environment is
inherited, and test policy denies all other model providers. The fixture checks
OpenCode's reported local paths before starting
the server. It neither attaches to the user's shared service nor writes live
user configuration. Use a temporary parent directory outside project/config
ancestors; machine-managed OpenCode configuration can still affect isolation
and must be checked on the acceptance machine.

The scripted provider records actual HTTP arrivals and WebSocket messages. It
provides deterministic chat-completion SSE: native acceptance submits an
explicit user prompt, observes actual provider traffic, and reads the reply
rendered by the real TUI. This is test infrastructure, not plugin transport
interception. The WebSocket handler is a traffic trap, not a complete Responses
server; its zero-traffic suite selects WebSocket transport but does not claim
positive WebSocket generation coverage.

The behavioral suite covers:

- Installed server/RPC and native TUI loading; identical usage forms, distinct
  inspection/config views, invalid/extra arguments, and native palette actions.
- Config without an active session and an honest missing-session usage state.
- Earlier/later command collisions with fixed sanitized notices and the
  original other command still executable.
- Zero HTTP arrivals and WebSocket frames from view opens/closes, unchanged
  public history/inbox, and unchanged configuration bytes and modification
  times, with both HTTP and WebSocket-selected provider configurations.
- Actual local prompt/reply traffic and identical provider-visible tools/system
  instructions with the plugin enabled versus disabled. That comparison
  normalizes only the random fixture root, not request content categories.

`CONTEXT_VIEW_TEST_TMP` selects the temporary parent.
`CONTEXT_VIEW_KEEP_TEST_DIR=1` preserves the isolated fixture for diagnosis.
Fixtures can contain test prompts and responses: do not use real secrets.

## Public API constraints

- Target host: OpenCode V2.2.6, with public plugin/client contracts pinned to
  2.2.6 and OpenTUI peers pinned to 0.8.1. Re-run the installed/native suite
  before claiming compatibility with another version.
- Fullscreen dialogs: the public `DialogSize` is
  `"medium" | "large" | "xlarge"`. The placeholder uses documented `xlarge`,
  which is **not** a fullscreen acceptance claim. Master spec #1's fullscreen
  custom-dialog requirement remains unresolved; no private sizing workaround
  or substitution with session panels is included. At the verified 120×40
  terminal size, the placeholder is a centered bounded dialog with the session
  and composer visible behind it, and its text wraps. Do not treat `xlarge`
  as a promise of full-terminal coverage or fixed geometry.
