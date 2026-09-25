---
name: update-roles
description: Update the pinned roles topic in the election Discourse category with links to each role's introduction topic. Use when asked to update/refresh the roles table.
---

# Update roles pinned topic

Uses the `discourse` MCP tools. Ignore `roles.fi.txt` and `roles.en.txt`; `roles.txt` (`Finnish,English` per line) is the source of roles.

## 1. Resolve URLs

Needed: the election **category URL** (e.g. `https://forum.example.fi/c/vaalit/12`) and the **pinned topic URL**.

- Use URLs given as skill arguments / in the user's request.
- Otherwise read `CONFIG.md` in the project root.
- If neither provides both, stop and ask the user.

## 2. Record URLs

Overwrite `CONFIG.md` in the project root with only the two URLs used (drop all previous content).

## 3. Fetch the pinned topic

Parse the topic ID from the URL and read it with `discourse_read_topic` (`post_limit: 1`). Its first post is the table to update; fetch its raw content with `discourse_read_post`.

## 4. Fetch category topics

Use `discourse_filter_topics` with a filter like `category:<slug> status:listed` (`per_page: 50`), paginating until done. Keep only topics that are not deleted, unlisted/invisible, or otherwise hidden.

## 5. Sanity checks

Stop and report to the user if any fails:

- The MCP server's site matches the host in the URLs.
- The category exists and is not deleted/hidden.
- The pinned topic exists, is not deleted/hidden, is pinned, and belongs to the category.

## 6. Match roles to topics

Read `ROLE-MEMORY.md` (if present) for earlier decisions. For each role in `roles.txt`, find the topic introducing it.

- Role names can be similar or ambiguous (e.g. `Toiminnantarkastajat` vs `Varatoiminnantarkastajat`, `Fuksikapteeni` vs `Standing Fuksi Captains`, `ISOvastaava` vs `ISO Boss`). Match on the whole name, check the topic body when the title is unclear.
- Keep the matches currently linked in the pinned topic unless the user *explicitly* asks to change them, or the linked topic no longer exists/is hidden.
- If any match is ambiguous, stop and ask the user (AskUserQuestion).
- If a topic appears to introduce an electable role but matches no role, stop and ask whether to ignore it or add it to the table. Ignore topics already recorded as ignored in `ROLE-MEMORY.md` and topics clearly not about a role (e.g. the pinned topic itself, general announcements).

## 7. Update the pinned topic

Build the body from `roles.template.md`, replacing the `| (content) |` line with one row per role in `roles.txt` order:

```
| [Puheenjohtaja / *Chair*](<topic URL>) |
| Varapuheenjohtaja / *Vice Chair* |
```

- Matched roles: a single link wrapping both names.
- Unmatched roles: plain names, no links.
- Roles added by the user in step 6 go where the user specified (default: end of the table).
- If the Finnish and English names are identical, write the name once (no slash, not italicized).
- Topic URLs use the form `<forum origin>/t/<slug>/<id>`.
- Keep both names within the same link, as the target is the same. Old versions of this skill may have incorrectly created two separate links.

If the result equals the current raw content, skip the update. Otherwise update the first post with `discourse_update_post` (`edit_reason` summarizing the changes).

## 8. Update ROLE-MEMORY.md

Record decisions not visible in the topic content: ignored topics (ID + title + reason), roles added outside `roles.txt`, and resolved ambiguities worth remembering. Keep it concise; remove entries that no longer apply.

Finally, report to the user which roles were linked, newly linked, or left unlinked.
