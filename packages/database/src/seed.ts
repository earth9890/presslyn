/**
 * Database seed script.
 *
 * Creates default admin user, options, taxonomies, terms, and sample content.
 * Idempotent — safe to run multiple times (uses onConflictDoNothing).
 *
 * Usage: pnpm --filter @presslyn/database db:seed
 * Set PRESSLYN_ADMIN_PASSWORD env var to specify admin password,
 * otherwise a random one is generated and displayed.
 */

import { randomBytes } from "crypto";
import { db } from "./connection.js";
import { users, options, taxonomies, terms, posts } from "./schema.js";
import { sql } from "drizzle-orm";

// We use argon2 via a dynamic import since this is a seed script
// and @presslyn/core may not be built yet
import argon2 from "argon2";

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

async function seed() {
  console.log("Seeding Presslyn database...\n");

  // ─── Admin User ──────────────────────────────────────────
  console.log("Creating admin user...");
  const adminPassword =
    process.env.PRESSLYN_ADMIN_PASSWORD || randomBytes(16).toString("base64url");
  const isGenerated = !process.env.PRESSLYN_ADMIN_PASSWORD;

  const [admin] = await db
    .insert(users)
    .values({
      email: "admin@presslyn.com",
      username: "admin",
      passwordHash: await hashPassword(adminPassword),
      displayName: "Administrator",
      role: "administrator",
    })
    .onConflictDoNothing({ target: users.username })
    .returning();

  if (admin) {
    console.log(`  + Admin user created (id: ${admin.id})`);
  } else {
    console.log("  = Admin user already exists, skipping");
  }

  // ─── Default Options ─────────────────────────────────────
  console.log("Setting default options...");
  // Option keys follow WordPress naming (blogname, blogdescription, siteurl,
  // home, timezone_string, default_category, …) so the admin, REST/tRPC API,
  // and the future WXR importer all share one canonical vocabulary.
  const defaultOptions = [
    { key: "blogname", value: "Presslyn Site" },
    { key: "blogdescription", value: "Just another Presslyn site" },
    { key: "siteurl", value: "http://localhost:3000" },
    { key: "home", value: "http://localhost:3000" },
    { key: "admin_email", value: "admin@presslyn.com" },
    { key: "posts_per_page", value: 10 },
    { key: "date_format", value: "F j, Y" },
    { key: "time_format", value: "g:i a" },
    { key: "timezone_string", value: "UTC" },
    { key: "start_of_week", value: 1 },
    { key: "permalink_structure", value: "/%postname%/" },
    { key: "default_comment_status", value: "open" },
    { key: "default_ping_status", value: "open" },
    { key: "default_category", value: 1 },
    { key: "thumbnail_size_w", value: 150 },
    { key: "thumbnail_size_h", value: 150 },
    { key: "medium_size_w", value: 300 },
    { key: "medium_size_h", value: 300 },
    { key: "large_size_w", value: 1024 },
    { key: "large_size_h", value: 1024 },
    { key: "uploads_use_yearmonth_folders", value: true },
    { key: "blog_public", value: true },
    { key: "active_theme", value: "presslyn-default" },
    { key: "active_plugins", value: [] },
  ];

  let optionsInserted = 0;
  for (const opt of defaultOptions) {
    const result = await db
      .insert(options)
      .values({ key: opt.key, value: opt.value, autoload: true })
      .onConflictDoNothing({ target: options.key })
      .returning();
    if (result.length > 0) optionsInserted++;
  }
  console.log(`  + ${optionsInserted} options set (${defaultOptions.length - optionsInserted} already existed)`);

  // ─── Default Taxonomies ──────────────────────────────────
  console.log("Creating default taxonomies...");
  const [categoryTax] = await db
    .insert(taxonomies)
    .values({
      name: "Categories",
      slug: "category",
      description: "Post categories",
      hierarchical: true,
    })
    .onConflictDoNothing({ target: taxonomies.slug })
    .returning();

  const [tagTax] = await db
    .insert(taxonomies)
    .values({
      name: "Tags",
      slug: "post_tag",
      description: "Post tags",
      hierarchical: false,
    })
    .onConflictDoNothing({ target: taxonomies.slug })
    .returning();

  if (categoryTax) console.log(`  + Category taxonomy created (id: ${categoryTax.id})`);
  else console.log("  = Category taxonomy already exists");
  if (tagTax) console.log(`  + Tag taxonomy created (id: ${tagTax.id})`);
  else console.log("  = Tag taxonomy already exists");

  // ─── Default Terms ───────────────────────────────────────
  // Need the actual taxonomy ID for the uncategorized term
  const [catTaxRow] = await db
    .select({ id: taxonomies.id })
    .from(taxonomies)
    .where(sql`${taxonomies.slug} = 'category'`)
    .limit(1);

  if (catTaxRow) {
    console.log("Creating default terms...");
    const [uncategorized] = await db
      .insert(terms)
      .values({
        taxonomyId: catTaxRow.id,
        name: "Uncategorized",
        slug: "uncategorized",
        description: "Default category",
      })
      .onConflictDoNothing()
      .returning();

    if (uncategorized) console.log(`  + Uncategorized term created (id: ${uncategorized.id})`);
    else console.log("  = Uncategorized term already exists");
  }

  // ─── Sample Content ──────────────────────────────────────
  // Only create if admin user was just created (first run)
  if (admin) {
    console.log("Creating sample content...");
    const [helloPost] = await db
      .insert(posts)
      .values({
        authorId: admin.id,
        postType: "post",
        title: "Hello World",
        slug: "hello-world",
        content:
          "Welcome to Presslyn. This is your first post. Edit or delete it, then start writing!",
        excerpt: "Welcome to Presslyn.",
        status: "publish",
        publishedAt: new Date(),
      })
      .returning();
    console.log(`  + Post: "Hello World" (id: ${helloPost.id})`);

    const [samplePage] = await db
      .insert(posts)
      .values({
        authorId: admin.id,
        postType: "page",
        title: "Sample Page",
        slug: "sample-page",
        content:
          "This is an example page. It's different from a blog post because it will stay in one place and will show up in your site navigation.",
        excerpt: "",
        status: "publish",
        publishedAt: new Date(),
      })
      .returning();
    console.log(`  + Page: "Sample Page" (id: ${samplePage.id})`);
  }

  console.log("\nSeed complete!\n");
  if (admin && isGenerated) {
    console.log("  Admin credentials (save these!):");
    console.log(`    Username: admin`);
    console.log(`    Password: ${adminPassword}`);
    console.log("");
    console.log("  Set PRESSLYN_ADMIN_PASSWORD env var to use a specific password.");
  }
  console.log("  Admin: http://localhost:3001");
  console.log("  Site:  http://localhost:3000\n");

  // Gracefully close the database connection
  await db.$client.end();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error("Seed failed:", err);
  try {
    await db.$client.end();
  } catch { /* ignore */ }
  process.exit(1);
});
