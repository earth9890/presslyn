/**
 * Presslyn Hook System
 *
 * The async-first equivalent of WordPress's actions and filters.
 * This is the core extensibility mechanism — plugins, themes, and
 * internal modules all communicate through hooks.
 *
 * WordPress equivalents:
 *   add_action()    → hooks.addAction()
 *   do_action()     → hooks.doAction()
 *   add_filter()    → hooks.addFilter()
 *   apply_filters() → hooks.applyFilters()
 *   remove_action() → hooks.removeAction()
 *   remove_filter() → hooks.removeFilter()
 *   has_action()    → hooks.hasAction()
 *   has_filter()    → hooks.hasFilter()
 */

type HookCallback = (...args: any[]) => any | Promise<any>;

interface HookEntry {
  callback: HookCallback;
  priority: number;
  id: string;
}

export class HookSystem {
  private actions: Map<string, HookEntry[]> = new Map();
  private filters: Map<string, HookEntry[]> = new Map();

  // ─── Actions ───────────────────────────────────────────────

  addAction(
    hook: string,
    callback: HookCallback,
    priority: number = 10,
    id?: string
  ): void {
    const entries = this.actions.get(hook) ?? [];
    entries.push({
      callback,
      priority,
      id: id ?? this.generateId(),
    });
    entries.sort((a, b) => a.priority - b.priority);
    this.actions.set(hook, entries);
  }

  async doAction(hook: string, ...args: any[]): Promise<void> {
    const entries = this.actions.get(hook);
    if (!entries) return;

    for (const entry of entries) {
      await entry.callback(...args);
    }
  }

  removeAction(hook: string, id: string): boolean {
    const entries = this.actions.get(hook);
    if (!entries) return false;

    const index = entries.findIndex((e) => e.id === id);
    if (index === -1) return false;

    entries.splice(index, 1);
    return true;
  }

  hasAction(hook: string): boolean {
    const entries = this.actions.get(hook);
    return !!entries && entries.length > 0;
  }

  // ─── Filters ───────────────────────────────────────────────

  addFilter<T>(
    hook: string,
    callback: (value: T, ...args: any[]) => T | Promise<T>,
    priority: number = 10,
    id?: string
  ): void {
    const entries = this.filters.get(hook) ?? [];
    entries.push({
      callback,
      priority,
      id: id ?? this.generateId(),
    });
    entries.sort((a, b) => a.priority - b.priority);
    this.filters.set(hook, entries);
  }

  async applyFilters<T>(hook: string, value: T, ...args: any[]): Promise<T> {
    const entries = this.filters.get(hook);
    if (!entries) return value;

    let result = value;
    for (const entry of entries) {
      result = await entry.callback(result, ...args);
    }
    return result;
  }

  removeFilter(hook: string, id: string): boolean {
    const entries = this.filters.get(hook);
    if (!entries) return false;

    const index = entries.findIndex((e) => e.id === id);
    if (index === -1) return false;

    entries.splice(index, 1);
    return true;
  }

  hasFilter(hook: string): boolean {
    const entries = this.filters.get(hook);
    return !!entries && entries.length > 0;
  }

  // ─── Utilities ─────────────────────────────────────────────

  removeAll(hook?: string): void {
    if (hook) {
      this.actions.delete(hook);
      this.filters.delete(hook);
    } else {
      this.actions.clear();
      this.filters.clear();
    }
  }

  getActionCount(hook: string): number {
    return this.actions.get(hook)?.length ?? 0;
  }

  getFilterCount(hook: string): number {
    return this.filters.get(hook)?.length ?? 0;
  }

  private idCounter = 0;
  private generateId(): string {
    return `hook_${++this.idCounter}`;
  }
}

/** Global hook instance — the default for all of Presslyn */
export const hooks = new HookSystem();
