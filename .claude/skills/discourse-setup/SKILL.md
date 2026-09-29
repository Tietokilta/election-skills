---
name: discourse-setup
description: Install and authenticate the `discourse` MCP server for this project with a Discourse User API key. Use when asked to set up, connect, log in to, or switch the Discourse server.
---

# Discourse MCP setup

**Secrets:** never read, print, or ask the user to paste the encrypted payload, the API key, the profile file, or the script's `PAYLOAD_FILE`. Only the script touches them.

## 1. Check prerequisites

Run `command -v npx`. If missing, tell the user to install Node.js (which provides `npx`) and stop.

## 2. Ask for the Discourse URL

Always ask, even if a URL was given before — the user may be switching servers.

Ask with AskUserQuestion. Options:

- `https://vaalit.tietokilta.fi` (default, listed first as recommended).
- If a `*-CONFIG.md` file exists and its URLs use a different origin: "`<origin>` (from <file>)".
- "A different server" – then ask for the URL in plain text (unless typed via "Other").

Normalize to the origin (`https://host`). If any `*-CONFIG.md` points to a different host, tell the user its URLs belong to the old server and ask whether to delete it.

## 3. Generate the key

Run in the background (`run_in_background`):

```
node .claude/skills/discourse-setup/scripts/generate-user-api-key.mjs --site <origin>
```

Options: `--scopes` (default `read,write,session_info`), `--read-only` (sets `allow_writes: false`), `--profile` (default `~/.config/discourse-mcp/<host>.json`).

The script prints only these status lines; read its output to relay them:

- `OPEN_URL` + `USER_CODE` (device flow): tell the user to open the URL while logged in, confirm the code, and approve.
- `OPEN_URL` + `PAYLOAD_FILE` (older Discourse): tell the user to approve, then paste the shown payload into `PAYLOAD_FILE` themselves (e.g. `nano <file>` in their own terminal) — never into the chat.
- `PROFILE` + `DONE`: success. `ERROR: ...`: report and stop.

Wait for the completion notification; don't poll.

## 4. Register the MCP server

```
claude mcp remove discourse -s local   # ignore "not found"
claude mcp add discourse -s local -- npx -y @discourse/mcp@latest --profile <PROFILE>
claude mcp get discourse
```

The profile pins the site, so no separate site selection is needed. Confirm the status is Connected, then tell the user to run `/mcp` (or restart) to load the new tools. The key can be revoked at `<origin>/my/preferences/security` → Apps.
