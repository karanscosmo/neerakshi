/** Registers the bot webhook with Telegram: npm run telegram:set-webhook (needs TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, NEXT_PUBLIC_SITE_URL). */
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
if (!token || !secret || !site) {
  console.error("Set TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and NEXT_PUBLIC_SITE_URL first.");
  process.exit(1);
}
const url = `${site}/api/telegram/webhook`;
(async () => {
  const r = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url, secret_token: secret, allowed_updates: ["message"], drop_pending_updates: true }),
  });
  console.log(r.status, await r.text());
  const cmds = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ commands: [{ command: "today", description: "Today's irrigation advice" }, { command: "lang", description: "Language: en / hi / kn" }, { command: "stop", description: "Stop daily alerts" }] }),
  });
  console.log(cmds.status, await cmds.text());
})();
