#!/usr/bin/env node
// Obtains a Discourse User API key and writes it to an MCP profile (mode 0600).
// Never prints the key or the encrypted payload; the private key stays in memory
// except for the openssl fallback, where it lives briefly in a private temp dir.
import { execFileSync } from "node:child_process";
import {
  constants,
  generateKeyPairSync,
  privateDecrypt,
  randomBytes,
} from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APP_NAME = "Claude Code Discourse MCP";

function parseArgs() {
  const opts = { scopes: "read,write,session_info", allowWrites: true };
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--site") opts.site = a[++i];
    else if (a[i] === "--scopes") opts.scopes = a[++i];
    else if (a[i] === "--profile") opts.profile = a[++i];
    else if (a[i] === "--read-only") opts.allowWrites = false;
    else fail(`Unknown argument: ${a[i]}`);
  }
  if (!opts.site) fail("--site is required");
  opts.site = new URL(opts.site).origin;
  opts.profile ??= path.join(
    os.homedir(),
    ".config",
    "discourse-mcp",
    `${new URL(opts.site).hostname}.json`,
  );
  return opts;
}

function fail(msg) {
  console.log(`ERROR: ${msg}`);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(site, p, body) {
  const res = await fetch(site + p, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) fail(`POST ${p} failed with HTTP ${res.status}`);
  return res.json();
}

async function deviceFlow(opts, req) {
  const auth = await post(opts.site, "/user-api-key/device.json", {
    ...req,
    padding: "oaep",
  });
  console.log(
    `OPEN_URL: ${auth.verification_uri_with_request || auth.verification_uri}`,
  );
  console.log(`USER_CODE: ${auth.user_code}`);
  console.log("WAITING: approve the request in the browser");
  const deadline = Date.now() + auth.expires_in * 1000;
  while (Date.now() < deadline) {
    await sleep(Math.max(1, auth.interval) * 1000);
    const r = await post(opts.site, "/user-api-key/device/poll.json", {
      device_code: auth.device_code,
    });
    if (r.status === "authorized") return r.payload;
    if (r.status !== "authorization_pending")
      fail(`authorization ${r.status}`);
  }
  fail("authorization timed out");
}

async function pasteFlow(opts, req, tmpDir) {
  const url = new URL(opts.site + "/user-api-key/new");
  url.search = new URLSearchParams({ ...req, padding: "oaep" }).toString();
  const payloadFile = path.join(tmpDir, "payload.txt");
  fs.writeFileSync(payloadFile, "", { mode: 0o600 });
  console.log(`OPEN_URL: ${url}`);
  console.log(`PAYLOAD_FILE: ${payloadFile}`);
  console.log(
    "WAITING: paste the payload shown by Discourse into PAYLOAD_FILE and save",
  );
  const deadline = Date.now() + 30 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(2000);
    const text = fs.readFileSync(payloadFile, "utf8").replace(/\s+/g, "");
    if (text) return text;
  }
  fail("timed out waiting for the payload file");
}

function decrypt(payload, privateKey, tmpDir) {
  const buf = Buffer.from(payload, "base64");
  try {
    return privateDecrypt(
      { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING },
      buf,
    );
  } catch {
    // Older Discourse ignores padding=oaep and uses PKCS#1 v1.5, which Node refuses to decrypt.
    const keyFile = path.join(tmpDir, "private.pem");
    const inFile = path.join(tmpDir, "payload.bin");
    fs.writeFileSync(keyFile, privateKey, { mode: 0o600 });
    fs.writeFileSync(inFile, buf, { mode: 0o600 });
    try {
      return execFileSync(
        "openssl",
        [
          "pkeyutl",
          "-decrypt",
          "-inkey",
          keyFile,
          "-in",
          inFile,
          "-pkeyopt",
          "rsa_padding_mode:pkcs1",
        ],
        { stdio: ["ignore", "pipe", "ignore"] },
      );
    } catch {
      fail("could not decrypt the payload (is openssl installed?)");
    }
  }
}

function writeProfile(opts, key, clientId) {
  fs.mkdirSync(path.dirname(opts.profile), { recursive: true, mode: 0o700 });
  const profile = {
    site: opts.site,
    auth_pairs: [
      { site: opts.site, user_api_key: key, user_api_client_id: clientId },
    ],
    allow_writes: opts.allowWrites,
  };
  const tmp = `${opts.profile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(profile, null, 2) + "\n", {
    mode: 0o600,
  });
  fs.renameSync(tmp, opts.profile);
}

function existingClientId(profilePath, site) {
  try {
    const p = JSON.parse(fs.readFileSync(profilePath, "utf8"));
    return p.auth_pairs?.find((x) => x.site === site)?.user_api_client_id;
  } catch {
    return undefined;
  }
}

async function main() {
  const opts = parseArgs();
  // Reusing the client id makes Discourse replace the previous key instead of adding another.
  const clientId =
    existingClientId(opts.profile, opts.site) ??
    `claude-code-${randomBytes(8).toString("hex")}`;
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const nonce = randomBytes(32).toString("hex");
  const req = {
    application_name: APP_NAME,
    client_id: clientId,
    scopes: opts.scopes,
    public_key: publicKey,
    nonce,
  };

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "discourse-uak-"));
  fs.chmodSync(tmpDir, 0o700);
  const cleanup = () => fs.rmSync(tmpDir, { recursive: true, force: true });
  process.on("exit", cleanup);
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"])
    process.on(sig, () => process.exit(1));

  const head = await fetch(opts.site + "/user-api-key/new", { method: "HEAD" });
  const device =
    head.ok && head.headers.get("auth-api-device-code")?.toLowerCase() === "true";
  const payload = device
    ? await deviceFlow(opts, req)
    : await pasteFlow(opts, req, tmpDir);

  let result;
  try {
    result = JSON.parse(decrypt(payload, privateKey, tmpDir).toString("utf8"));
  } catch {
    fail("decrypted payload is not valid JSON");
  }
  if (result.nonce !== nonce) fail("nonce mismatch; aborting");
  if (typeof result.key !== "string" || !result.key)
    fail("payload has no key");

  writeProfile(opts, result.key, clientId);
  console.log(`PROFILE: ${opts.profile}`);
  console.log(`DONE: scopes=${opts.scopes} allow_writes=${opts.allowWrites}`);
}

main().catch((e) => fail(e?.message || String(e)));
