import argon2 from "argon2";
import { db } from "./connection.js";
import { users } from "./schema.js";
import { eq } from "drizzle-orm";

async function main() {
  const password = process.argv[2] || "admin123456";
  const username = process.argv[3] || "admin";

  const hash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  await db.update(users).set({ passwordHash: hash }).where(eq(users.username, username));
  console.log(`Password for "${username}" reset to: ${password}`);
  await db.$client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
