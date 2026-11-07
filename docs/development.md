# Plugin and harness development

This is an unverified development slice for issue #2 under master spec #1.
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
commands and again before opening a view. Its conflict notice is fixed text;
it does not interpolate another plugin's name, description, or exception.
Ordering, aliases, reload behavior, and conflicts registered later require
real-host verification; collision acceptance is not established by this code.

## Verification

Use Bun consistently:

```sh
bun install --frozen-lockfile
bun run typecheck
CONTEXT_VIEW_HOST=/absolute/path/to/isolated/v2.2.5/opencode bun test
```

`bun test` fails explicitly when `CONTEXT_VIEW_HOST` is absent or its version
does not equal `opencode v2.2.5`. It does not silently skip tests or use the
live installation. Providing a host is a prerequisite, not proof of acceptance.
No compatibility range or release readiness is claimed.

The harness packs the repository, installs that archive into a temporary
project using Bun, starts a foreground OpenCode server, and connects a real
native TUI through a PTY. A terminal emulator reads rendered screen contents;
tests do not mount plugin components or invoke command callbacks directly.
RPC is imported through the installed package's `./rpc` export.

Each fixture uses a fresh HOME, XDG config/data/cache/state, temporary directory,
password, and local scripted provider. No credential-bearing environment is
inherited. The fixture checks OpenCode's reported local paths before starting
the server. It neither attaches to the user's shared service nor writes live
user configuration. Use a temporary parent directory outside project/config
ancestors; machine-managed OpenCode configuration can still affect isolation
and must be checked on the acceptance machine.

The scripted provider records actual HTTP arrivals and WebSocket messages. It
provides deterministic chat-completion SSE for later request-driven slices;
this fixture is test infrastructure, not plugin transport interception.
Its positive request/response path still needs a real-host smoke test before
it can be called a validated provider fixture.

`CONTEXT_VIEW_TEST_TMP` selects the temporary parent.
`CONTEXT_VIEW_KEEP_TEST_DIR=1` preserves the isolated fixture for diagnosis.
Fixtures can contain test prompts and responses: do not use real secrets.

## Open acceptance constraints

- Required host: OpenCode V2.2.5, with public plugin/client contracts pinned to
  2.2.5 and OpenTUI peers pinned to 0.8.0. Full installed-package/native-TUI
  acceptance must run on that host.
- Fullscreen dialogs: V2.2.5's public `DialogSize` is
  `"medium" | "large" | "xlarge"`. The placeholder uses documented `xlarge`,
  which is **not** a fullscreen acceptance claim. Master spec #1's fullscreen
  custom-dialog requirement remains unresolved; no private sizing workaround
  or substitution with session panels is included.
- Behavioral TDD: the initial acceptance test is blocked during setup by host
  availability. Typechecking is not behavioral red/green evidence. Command
  equivalence, palette, invalid arguments, collisions, no model-visible
  additions, history/configuration immutability, and actual zero-traffic
  behavior remain to be exercised through the installed/native seam.
