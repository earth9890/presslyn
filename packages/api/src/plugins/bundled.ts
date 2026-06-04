/**
 * Bundled plugins shipped with Presslyn. These register themselves with the
 * PluginManager at startup; site owners activate/deactivate them from the
 * admin Plugins screen. They demonstrate the lifecycle and serve as the seed
 * of the plugin ecosystem.
 */

import { PluginManager } from "@presslyn/core";

export function registerBundledPlugins(manager: PluginManager): void {
  // "Hello Presslyn" — a minimal example plugin. On activation it registers a
  // `the_content` filter that appends a small attribution; deactivation
  // removes it. Demonstrates the full register → activate → hook → deactivate
  // flow against real persisted state.
  manager.register({
    manifest: {
      id: "hello-presslyn",
      name: "Hello Presslyn",
      version: "1.0.0",
      description:
        "A starter example plugin. Appends a friendly note to post content when active.",
      author: "Presslyn",
    },
    setup: (ctx) => {
      ctx.hooks.addFilter(
        "the_content",
        (content: string) =>
          `${content}\n<p class="presslyn-hello">👋 Powered by Presslyn.</p>`,
        20,
        "hello-presslyn:the_content"
      );
    },
    teardown: (ctx) => {
      ctx.hooks.removeFilter("the_content", "hello-presslyn:the_content");
    },
  });
}
