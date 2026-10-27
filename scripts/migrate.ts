/** Apply Drizzle migrations to DATABASE_URL (or the local PGlite database). */
import { createDb } from "@/lib/server/dbcore";

createDb({ migrate: true })
  .then(() => {
    console.log("✓ migrations applied");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
