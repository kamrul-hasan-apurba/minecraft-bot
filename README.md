# Minecraft bot for entores.aternos.me

A [mineflayer](https://github.com/PrismarineJS/mineflayer) bot (Java Edition) that joins your Aternos server.
It runs on Vercel in short visits, or on any always-on Node host.

## Deploy on Vercel (from GitHub)

1. Push this project to a GitHub repo. Keep `api/bot.js` inside the `api` folder.
2. In Vercel: Add New > Project > import the repo > Deploy.
3. Project > Settings > Environment Variables: add `CRON_SECRET` (any long random text), then redeploy.
4. Start your server on aternos.org, then open `https://YOUR-APP.vercel.app/api/bot?key=YOUR_SECRET`.
   You should get `"status":"bot is joining"` and `EntoresBot` appears in the game. Details are in Vercel > Logs.
5. A Vercel function can run 5 minutes at most, so each visit lasts `RUN_SECONDS` (280) and the bot then leaves.
   To bring it back, create a job on cron-job.org that opens the URL from step 4 every 4 minutes.
   A new visit takes over from the previous one (the old one gets "logged in from another location"),
   so the bot stays in the game. Players will see it join and leave every few minutes.

Vercel's own cron is not used: on the Hobby plan it only allows one run per day, and a faster schedule fails the deploy.
On the Pro plan you can add this to `vercel.json` instead of using cron-job.org (Vercel sends the secret itself):

    "crons": [{ "path": "/api/bot", "schedule": "*/4 * * * *" }]

Free-tier limits still apply: running non-stop would use up the Hobby plan's memory hours in roughly a week.
For a bot that is always there, use an always-on host (below).

## Settings (environment variables)

| Name | Default | What it does |
| --- | --- | --- |
| `CRON_SECRET` | none (required on Vercel) | the `key` in the URL |
| `MC_HOST` | `entores.aternos.me` | server address |
| `MC_PORT` | `49803` | server port (check it on Aternos if the bot stops connecting) |
| `BOT_USERNAME` | `EntoresBot` | the bot's name (max 16 characters) |
| `MC_VERSION` | auto | force a Minecraft version, e.g. `1.21.4` |
| `RUN_SECONDS` | `280` | how long one visit lasts (keep it below 300) |
| `ANTI_AFK` | `false` | `true` = look around and jump every 15 seconds (only useful on always-on hosts) |

## Run it on an always-on host (Railway, Render, Fly.io, a VPS, your PC)

    npm install
    npm start

It stays online and reconnects on its own. Choose a worker / background service type, not a web service.

## Troubleshooting

- "could not join": the server has to be running. Start it on aternos.org first.
- "Failed to verify username" / "not authenticated": the server is premium-only (online-mode). This bot logs in offline, so the server must be in cracked / offline mode.
- "You are not whitelisted": add the bot's name to the whitelist.
- Version errors: pick a Minecraft version in Aternos that mineflayer supports, or set `MC_VERSION`.
- Deploy error about `maxDuration`: turn on Fluid Compute in the Vercel project settings, or lower `maxDuration` to `60` in `vercel.json` and `RUN_SECONDS` to `55`.
- Vercel says the function is too large: add `"excludeFiles": "node_modules/minecraft-data/minecraft-data/data/bedrock/**"` next to `maxDuration` in `vercel.json`.

## Heads-up about Aternos

Aternos forum answers say that bots which keep a server from auto-stopping go against the Aternos terms
(https://aternos.org/tos) and can get an account suspended. Use it at your own risk.
