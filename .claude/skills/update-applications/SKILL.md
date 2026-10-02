---
name: update-applications
description: Update the pinned applications topic in the election Discourse category with a table of applicants per role, linking each application topic. Use when asked to update/refresh the applications or applicants table.
---

# Update applications pinned topic

Uses the `discourse` MCP tools. Ignore `roles.fi.txt` and `roles.en.txt`; `roles.txt` (`Finnish,English` per line) is the source of roles.

The MCP tools expose no category metadata or reliable pinned status (`discourse_filter_topics` reports `pinned: false` and omits the category's About topic; Data Explorer queries return 404). For those, `curl -sL` the forum's public JSON endpoints (`<origin>` = forum origin):

- `<origin>/categories.json?include_subcategories=true` – category tree (`id`, `name`, `slug`, `parent_category_id`, `subcategory_list`).
- `<origin>/c/<id>/show.json` – one category (`name`, `parent_category_id`, `read_restricted`).
- `<origin>/c/<slug>/<id>.json` – category topic list with correct `pinned`/`visible`.
- `<origin>/t/<id>.json` – topic `category_id`, `pinned`, `visible`, `deleted_at`.

## 1. Resolve URLs

Needed: the election applications **category URL** (e.g. `https://forum.example.fi/c/hakemukset/13`) and the **pinned topic URL**.

- Use URLs given as skill arguments / in the user's request.
- Otherwise read `APP-CONFIG.md` in the project root.
- Otherwise discover them on the forum:
  - Get the forum origin from a topic URL returned by `discourse_search`, or ask the user.
  - In `categories.json`, find a category named like "Hakemukset / Applications" whose own name or a parent category's name contains the current year.
  - Find its pinned topic in `/c/<slug>/<id>.json` (usually the category's About topic).
  - **Always** stop and ask the user to confirm the found category and topic (show names, parent category and URLs) before proceeding, even if the match looks certain.
- If none of these yield both URLs, stop and ask the user.

## 2. Record URLs

Overwrite `APP-CONFIG.md` in the project root with only the two URLs used (drop all previous content).

## 3. Fetch the pinned topic

Parse the topic ID from the URL and read it with `discourse_read_topic` (`post_limit: 1`). Its first post is the table to update; fetch its raw content with `discourse_read_post`.

## 4. Fetch category topics

Use `discourse_filter_topics` with filter `category:<slug>` (`per_page: 50`), paginating until done. Keep only topics with `visible: true` (the filter already excludes deleted topics).

## 5. Sanity checks

Stop and report to the user if any fails:

- The MCP server's site matches the host in the URLs (topics from steps 3–4 have the same IDs/slugs as in the public JSON).
- The category exists (`/c/<id>/show.json`) and is not hidden.
- The pinned topic (`/t/<id>.json`) has `deleted_at: null`, `visible: true`, `pinned: true`, and `category_id` equal to the category ID.

## 6. Extract role and applicant per topic

Read `APP-MEMORY.md` (if present) for earlier decisions. Skip the pinned topic, topics clearly not applications (e.g. general announcements) and topics recorded as ignored. For each remaining topic, determine the **role(s)** applied for (from `roles.txt`) and the **applicant name**:

1. **Existing entry**: if the topic is already in the pinned table (or in `APP-MEMORY.md`), keep its role(s) and name unless the title clearly states something different now (e.g. edited title); then re-extract and report the change.
2. **Title**: extract both from the title (e.g. `Maija Meikäläinen puheenjohtajaksi`, `Erkki Esimerkki for Chairperson of the Board`).
3. **Body**: if the title doesn't answer both, fetch the first post with `discourse_read_post`. Always record body-based results in `APP-MEMORY.md` so later runs don't refetch.
4. **Ask**: if still unclear or ambiguous, stop and ask the user (AskUserQuestion).

Notes:

- Role names can be similar or ambiguous (e.g. `Toiminnantarkastajat` vs `Varatoiminnantarkastajat`, `Fuksikapteeni` vs `Standing Fuksi Captains`). Match on the whole name, check the topic body when the title is unclear.
- One topic may very rarely apply to several roles; list it under each.
- Applications may be humorous; include them in the table for comedic value, but avoid repeating a link many times if the application is not serious.
- Write the name as the applicant writes it (full name if given), without titles or role text.
- If one topic names several applicants, separate names by `&` in one link.
- If a topic appears to apply for a role not in `roles.txt`, stop and ask whether to ignore it or add the role to the table.

## 7. Update the pinned topic

Build the body from `applications.template.md`, replacing the `| (content) | (name) |` line with rows for each role in `roles.txt` order. The first applicant shares the role's row; further applicants get their own rows with an empty role cell:

```
| **Puheenjohtaja**<br>*Chair* | [Maija Meikäläinen](<topic URL>) |
| | [Matti Meikäläinen](<topic URL>) |
| **Varapuheenjohtaja**<br>*Vice Chair* | |
```

- Sort applicants of a role alphabetically by name (case-insensitive, Finnish order: Å, Ä, Ö after Z; C locale sorting is close enough).
- Roles without applicants: a single row with an empty applicant cell.
- Roles added by the user in step 6 go where the user specified (default: end of the table).
- If the Finnish and English names are identical, write the name once in bold (no `<br>`, no italic line).
- Topic URLs use the form `<forum origin>/t/<slug>/<id>`.

If the result equals the current raw content, skip the update. Otherwise update the first post with `discourse_update_post` (`edit_reason` summarizing the changes).

## 8. Update APP-MEMORY.md

Record decisions not visible in the topic content: body-based and user-resolved extractions (topic ID + title + role(s) + name), ignored topics (ID + title + reason), and roles added outside `roles.txt`. Keep it concise; remove entries for topics that no longer exist.

Finally, report to the user the applicants added, changed, or removed, and roles still without applicants. Include a link to the pinned topic (`<forum origin>/t/<slug>/<id>`).
