// Minecraft bot (mineflayer, Java Edition) for an Aternos server.
//
//   On Vercel:       GET /api/bot?key=<CRON_SECRET>
//                    -> answers at once; the bot stays in the game for RUN_SECONDS, then leaves
//   Always-on host:  npm start   (Railway, Render, Fly.io, a VPS, your own PC ...)
//                    -> stays online and reconnects by itself
//
// Every setting can be changed with environment variables (see README.md).

const crypto = require('crypto');
const mineflayer = require('mineflayer');

const config = {
  host: process.env.MC_HOST || 'entores.aternos.me',
  port: Number(process.env.MC_PORT) || 49803,
  username: process.env.BOT_USERNAME || 'EntoresBot',
  version: process.env.MC_VERSION || false, // false = detect the server's version automatically
  runSeconds: Number(process.env.RUN_SECONDS) || 280, // keep this below the function limit (300s)
  antiAfk: String(process.env.ANTI_AFK).toLowerCase() === 'true',
  secret: process.env.CRON_SECRET || '',
};

const log = (...args) => console.log(new Date().toISOString(), ...args);

function shorten(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 300 ? text.slice(0, 300) + '...' : text;
}

// One visit: join, stay for `seconds` (Infinity = until disconnected), leave.
// Never rejects; resolves with { reason, spawned }.
function runSession(seconds) {
  return new Promise((resolve) => {
    let spawned = false;
    let finished = false;
    let ended = false;
    let afkTimer = null;
    const timers = [];

    log(`connecting to ${config.host}:${config.port} as ${config.username}`);
    const bot = mineflayer.createBot({
      host: config.host,
      port: config.port,
      username: config.username,
      version: config.version,
      auth: 'offline', // works on cracked (online-mode=false) servers
      hideErrors: true,
    });

    const finish = (reason) => {
      if (finished) return;
      finished = true;
      timers.forEach((t) => clearTimeout(t));
      clearInterval(afkTimer);
      const done = () => resolve({ reason: String(reason), spawned });
      if (ended) return done();
      bot.once('end', done);
      setTimeout(done, 1500); // don't wait forever for the socket to close
      try {
        bot.quit();
      } catch (err) {
        done();
      }
    };

    bot.once('login', () => log(`logged in as ${bot.username}`));

    bot.once('spawn', () => {
      spawned = true;
      log(`in the game (Minecraft ${bot.version})`);
      if (config.antiAfk) {
        afkTimer = setInterval(() => {
          try {
            Promise.resolve(bot.look(Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.6, true)).catch(() => {});
            bot.setControlState('jump', true);
            setTimeout(() => bot.setControlState('jump', false), 250);
          } catch (err) {
            /* ignore */
          }
        }, 15000);
      }
    });

    bot.on('kicked', (reason) => log('kicked:', shorten(reason)));
    bot.on('error', (err) => log('error:', err && err.message ? err.message : String(err)));
    bot.on('end', (reason) => {
      ended = true;
      finish(reason || 'connection closed');
    });

    // never got into the world: server offline, wrong port, unsupported version, ...
    timers.push(
      setTimeout(() => {
        if (!spawned) {
          log('could not join within 30 seconds');
          finish('join timeout');
        }
      }, 30000)
    );

    if (Number.isFinite(seconds)) {
      timers.push(
        setTimeout(() => {
          log(`${seconds}s are up, leaving`);
          finish('visit over');
        }, seconds * 1000)
      );
    }
  });
}

// ---------------------------------------------------------------- Vercel

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function isAuthorized(req) {
  if (!config.secret) return false;
  const url = new URL(req.url || '/', 'http://localhost');
  const fromQuery = url.searchParams.get('key') || '';
  const fromHeader = String((req.headers && req.headers.authorization) || '').replace(/^Bearer\s+/i, '');
  return safeEqual(fromQuery, config.secret) || safeEqual(fromHeader, config.secret);
}

module.exports = async function handler(req, res) {
  const reply = (status, body) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
  };

  if (!config.secret) {
    return reply(500, {
      ok: false,
      error: 'CRON_SECRET is not set. Add it under Settings > Environment Variables in Vercel, then redeploy.',
    });
  }
  if (!isAuthorized(req)) {
    return reply(401, { ok: false, error: 'Wrong or missing key.' });
  }

  // waitUntil keeps the function alive after the response, so the bot can stay in the game.
  const { waitUntil } = require('@vercel/functions');
  waitUntil(
    runSession(config.runSeconds)
      .then((result) => log(`visit finished: ${result.reason}`))
      .catch((err) => log('visit failed:', err && err.message ? err.message : String(err)))
  );

  reply(202, {
    ok: true,
    status: 'bot is joining',
    server: `${config.host}:${config.port}`,
    username: config.username,
    staysForSeconds: config.runSeconds,
  });
};

// ---------------------------------------------------------------- always-on (npm start)

async function runForever() {
  process.on('uncaughtException', (err) => log('uncaught:', err && err.message));
  process.on('unhandledRejection', (err) => log('unhandled:', err && err.message ? err.message : String(err)));

  let misses = 0; // tries in a row that never got into the world
  for (;;) {
    let result;
    try {
      result = await runSession(Infinity);
    } catch (err) {
      result = { reason: err.message, spawned: false };
    }
    misses = result.spawned ? 0 : misses + 1;
    const wait = result.spawned ? 15 : Math.min(30 * 2 ** (misses - 1), 300);
    log(`disconnected (${shorten(result.reason)}), trying again in ${wait}s`);
    await new Promise((resolve) => setTimeout(resolve, wait * 1000));
  }
}

if (require.main === module) runForever();
