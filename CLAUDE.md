# Election Discourse helpers

Skills that keep pinned topics in a guild election Discourse category up to date, via the `discourse` MCP server.

## Structure

- `.claude/skills/discourse-setup/` – installs and authenticates the `discourse` MCP server (User API key; secrets never enter the conversation).
- `.claude/skills/update-roles/` – updates the pinned roles topic.
- `roles.txt` – roles as `Finnish,English`, built from `roles.fi.txt` and `roles.en.txt` (inputs; don't read them).
- `roles.template.md` – body template for the roles topic.
- `CONFIG.md` – category and pinned topic URLs used on the latest run (overwritten each run).
- `ROLE-MEMORY.md` – role-matching decisions not visible on the forum (e.g. ignored topics).
