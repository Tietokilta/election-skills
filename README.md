# Election Discourse helpers

Claude Code skills for keeping the pinned topics in vaalit.tietokilta.fi up to date.

The skills talk to the forum through the `discourse` MCP server, authenticated securely with a Discourse User API key.

Run `claude` in this directory and start from `/discourse-setup`.

- **`discourse-setup`** installs the `discourse` MCP server and authenticates it with a User API key.
- **`update-roles`** refreshes the pinned roles topic so each role links to its introduction topic, using `roles.txt` and `roles.template.md`.
- **`update-applications`** refreshes the pinned applications topic with each role's applicants, linking their application topics, using `roles.txt` and `applications.template.md`.
