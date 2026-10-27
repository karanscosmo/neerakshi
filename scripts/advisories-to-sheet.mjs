// Optional: copy the anonymised advisories.csv to a Google Sheet so Tableau Public can sync daily.
// Env: NEERAKSHI_EXPORT_URL, ADMIN_PASSCODE, GOOGLE_SERVICE_ACCOUNT_JSON, ADVISORIES_SHEET_ID
import crypto from "node:crypto";

const { NEERAKSHI_EXPORT_URL, ADMIN_PASSCODE, GOOGLE_SERVICE_ACCOUNT_JSON, ADVISORIES_SHEET_ID } = process.env;
if (!NEERAKSHI_EXPORT_URL || !ADMIN_PASSCODE || !GOOGLE_SERVICE_ACCOUNT_JSON || !ADVISORIES_SHEET_ID) {
  console.log("Not configured (see docs/TABLEAU_GUIDE.md) — skipping.");
  process.exit(0);
}
const sa = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
const jwt = `${unsigned}.${crypto.createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url")}`;
const tok = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) })).json();
if (!tok.access_token) throw new Error(`token: ${JSON.stringify(tok)}`);
const csv = await (await fetch(NEERAKSHI_EXPORT_URL, { headers: { "x-admin-passcode": ADMIN_PASSCODE } })).text();
const rows = csv.trim().split("\n").map((l) => l.split(","));
const api = `https://sheets.googleapis.com/v4/spreadsheets/${ADVISORIES_SHEET_ID}/values`;
const auth = { authorization: `Bearer ${tok.access_token}`, "content-type": "application/json" };
await fetch(`${api}/A:Z:clear`, { method: "POST", headers: auth });
const r = await fetch(`${api}/A1?valueInputOption=RAW`, { method: "PUT", headers: auth, body: JSON.stringify({ values: rows }) });
console.log(r.status, await r.text());
