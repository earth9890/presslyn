#!/usr/bin/env node

/**
 * Presslyn CLI — WP-CLI-equivalent management tool.
 *
 * Service-backed commands (status, user:*, post:list, export, import) connect
 * directly to the database via the core services. Schema commands
 * (db:migrate, db:seed) delegate to the database package's existing scripts.
 */

import { Command } from "commander";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import {
  buildWxr,
  collectWxrData,
  parseWxr,
  importWxr,
  cacheStoreFromEnv,
} from "@presslyn/core";
import { services, done } from "./services.js";

const program = new Command();

program
  .name("presslyn")
  .description("Presslyn CMS — CLI management tool")
  .version("0.1.0");

function fail(message: string): never {
  console.error(`Error: ${message}`);
  return done(1);
}

// ─── status ────────────────────────────────────────────────
program
  .command("status")
  .description("Show installation status and content counts")
  .action(async () => {
    try {
      const [posts, pages, users, comments, blogname] = await Promise.all([
        services.content.queryPosts({ postType: "post", limit: 1 }),
        services.content.queryPosts({ postType: "page", limit: 1 }),
        services.users.listUsers({ limit: 1 }),
        services.comments.getCommentCounts(),
        services.options.getOption("blogname").catch(() => "Presslyn"),
      ]);
      console.log(`Presslyn CMS v0.1.0`);
      console.log(`Site:      ${blogname}`);
      console.log(`Database:  connected`);
      console.log(`Posts:     ${posts.total}`);
      console.log(`Pages:     ${pages.total}`);
      console.log(`Users:     ${users.total}`);
      console.log(`Comments:  ${comments.total} (${comments.pending} pending)`);
      done();
    } catch (err) {
      fail(err instanceof Error ? err.message : "Could not reach the database.");
    }
  });

// ─── user:create ───────────────────────────────────────────
program
  .command("user:create")
  .description("Create a user")
  .requiredOption("-e, --email <email>", "email address")
  .requiredOption("-u, --username <username>", "username")
  .requiredOption("-p, --password <password>", "password (8+ chars)")
  .option("-n, --display-name <name>", "display name")
  .option("-r, --role <role>", "role", "subscriber")
  .action(async (opts) => {
    try {
      const user = await services.users.createUser({
        email: opts.email,
        username: opts.username,
        password: opts.password,
        displayName: opts.displayName ?? opts.username,
        role: opts.role,
      });
      console.log(`Created user #${user.id} (${user.username}) — ${user.role}`);
      done();
    } catch (err) {
      fail(err instanceof Error ? err.message : "Could not create user.");
    }
  });

// ─── user:list ─────────────────────────────────────────────
program
  .command("user:list")
  .description("List users")
  .option("-r, --role <role>", "filter by role")
  .action(async (opts) => {
    try {
      const { users, total } = await services.users.listUsers({
        role: opts.role,
        limit: 100,
      });
      for (const u of users) {
        console.log(
          `#${String(u.id).padEnd(4)} ${u.username.padEnd(20)} ${u.role.padEnd(14)} ${u.email}`
        );
      }
      console.log(`\n${total} user(s).`);
      done();
    } catch (err) {
      fail(err instanceof Error ? err.message : "Could not list users.");
    }
  });

// ─── post:list ─────────────────────────────────────────────
program
  .command("post:list")
  .description("List posts or pages")
  .option("-t, --type <type>", "post type (post|page)", "post")
  .option("-s, --status <status>", "filter by status")
  .action(async (opts) => {
    try {
      const { posts, total } = await services.content.queryPosts({
        postType: opts.type,
        status: opts.status,
        orderBy: "date",
        order: "desc",
        limit: 100,
      });
      for (const p of posts) {
        console.log(
          `#${String(p.id).padEnd(4)} [${p.status.padEnd(7)}] ${p.title || "(untitled)"}  /${p.slug}`
        );
      }
      console.log(`\n${total} ${opts.type}(s).`);
      done();
    } catch (err) {
      fail(err instanceof Error ? err.message : "Could not list content.");
    }
  });

// ─── export ────────────────────────────────────────────────
program
  .command("export")
  .description("Export all content to a WXR file")
  .option("-o, --out <file>", "output file", "presslyn-export.xml")
  .action(async (opts) => {
    try {
      const data = await collectWxrData(
        {
          options: services.options,
          content: services.content,
          taxonomy: services.taxonomy,
          comments: services.comments,
          users: services.users,
        },
        new Date().toISOString()
      );
      writeFileSync(opts.out, buildWxr(data), "utf-8");
      console.log(
        `Exported ${data.items.length} item(s) to ${opts.out}.`
      );
      done();
    } catch (err) {
      fail(err instanceof Error ? err.message : "Export failed.");
    }
  });

// ─── import ────────────────────────────────────────────────
program
  .command("import <file>")
  .description("Import a WXR file")
  .option(
    "-a, --author <id>",
    "default author id for unmatched authors",
    "1"
  )
  .option("-m, --media", "download and re-link attachment media", false)
  .action(async (file: string, opts) => {
    try {
      const xml = await readFile(file, "utf-8");
      const parsed = parseWxr(xml);
      const summary = await importWxr(
        parsed,
        {
          content: services.content,
          taxonomy: services.taxonomy,
          comments: services.comments,
          users: services.users,
          media: services.media,
        },
        { defaultAuthorId: Number(opts.author) || 1, importMedia: !!opts.media }
      );
      console.log(
        `Imported ${summary.posts} posts, ${summary.pages} pages, ` +
          `${summary.comments} comments, ${summary.media} media ` +
          `(${summary.categories} categories, ${summary.tags} tags; ` +
          `${summary.skipped} skipped).`
      );
      done();
    } catch (err) {
      fail(err instanceof Error ? err.message : "Import failed.");
    }
  });

// ─── cache:flush ───────────────────────────────────────────
program
  .command("cache:flush")
  .description("Flush the object cache (Redis when REDIS_URL is set)")
  .action(async () => {
    try {
      const store = cacheStoreFromEnv();
      const backed = !!process.env.REDIS_URL;
      // Flush every namespace (empty prefix clears all cache keys).
      await store.flushPrefix("");
      await store.close?.();
      if (backed) {
        console.log("Flushed the Redis object cache.");
      } else {
        console.log(
          "No REDIS_URL configured — the object cache is per-process " +
            "(in-memory), so there is nothing shared to flush."
        );
      }
      done();
    } catch (err) {
      fail(err instanceof Error ? err.message : "Could not flush cache.");
    }
  });

// ─── db:migrate / db:seed (delegate to the database package) ──
function delegate(script: string) {
  const result = spawnSync(
    "pnpm",
    ["--filter", "@presslyn/database", script],
    { stdio: "inherit" }
  );
  done(result.status ?? 0);
}

program
  .command("db:migrate")
  .description("Run database migrations (delegates to drizzle-kit)")
  .action(() => delegate("db:migrate"));

program
  .command("db:seed")
  .description("Seed the database with default data")
  .action(() => delegate("db:seed"));

program.parseAsync();
