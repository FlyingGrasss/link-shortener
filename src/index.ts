import { createApp } from "./app.ts";
import { resolveConfig } from "./config.ts";
import { openDatabase } from "./db.ts";

const config = resolveConfig();
const db = openDatabase(config.dbPath);
const app = createApp({
  db,
  adminToken: config.adminToken,
  baseUrl: config.baseUrl,
  trustProxy: config.trustProxy,
});

if (config.usingDefaultAdminToken) {
  console.warn(
    '[uyarı] ADMIN_TOKEN tanımlı değil; geliştirme varsayılanı "dev-token" kullanılıyor. Üretimde ADMIN_TOKEN ayarlayın.',
  );
}

const server = app.listen(config.port, () => {
  console.log(`kısa çalışıyor: http://localhost:${config.port}`);
  console.log(`Veritabanı: ${config.dbPath}`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${config.port} zaten kullanımda.`);
  } else {
    console.error("Sunucu başlatılamadı:", error);
  }
  db.close();
  process.exit(1);
});

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} alındı, sunucu kapatılıyor...`);

  const forceExit = setTimeout(() => {
    console.error("Kapatma zaman aşımına uğradı.");
    db.close();
    process.exit(1);
  }, 5000);
  forceExit.unref();

  server.close((error) => {
    clearTimeout(forceExit);
    try {
      db.close();
    } catch (closeError) {
      console.error("Veritabanı kapatılamadı:", closeError);
    }

    if (error) {
      console.error("Sunucu kapatılamadı:", error);
      process.exit(1);
    }

    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
