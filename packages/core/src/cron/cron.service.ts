/**
 * Cron Service
 *
 * WordPress equivalent: wp-includes/cron.php
 * Real scheduled tasks (not WordPress's fake cron that relies on page visits).
 */

import { hooks } from "../hooks.js";

interface ScheduledEvent {
  hook: string;
  interval: number; // milliseconds, 0 = one-time
  args: unknown[];
  nextRun: number; // timestamp
  timer?: ReturnType<typeof setTimeout>;
}

export class CronService {
  private events: Map<string, ScheduledEvent> = new Map();
  private running = false;

  /**
   * Schedule a recurring event.
   * Equivalent to wp_schedule_event().
   */
  scheduleEvent(hook: string, intervalMs: number, ...args: unknown[]): void {
    const key = this.eventKey(hook, args);

    if (this.events.has(key)) return; // Already scheduled

    const event: ScheduledEvent = {
      hook,
      interval: intervalMs,
      args,
      nextRun: Date.now() + intervalMs,
    };

    this.events.set(key, event);

    if (this.running) {
      this.scheduleTimer(key, event);
    }
  }

  /**
   * Schedule a one-time event.
   * Equivalent to wp_schedule_single_event().
   */
  scheduleSingleEvent(hook: string, timestamp: number, ...args: unknown[]): void {
    const key = this.eventKey(hook, args);

    // Clear existing timer if overwriting to prevent leaked timers
    const existing = this.events.get(key);
    if (existing?.timer) {
      clearTimeout(existing.timer);
    }

    const event: ScheduledEvent = {
      hook,
      interval: 0,
      args,
      nextRun: timestamp,
    };

    this.events.set(key, event);

    if (this.running) {
      this.scheduleTimer(key, event);
    }
  }

  /**
   * Remove a scheduled event.
   * Equivalent to wp_unschedule_event().
   */
  unscheduleEvent(hook: string, ...args: unknown[]): boolean {
    const key = this.eventKey(hook, args);
    const event = this.events.get(key);

    if (event?.timer) clearTimeout(event.timer);
    return this.events.delete(key);
  }

  /**
   * Start the cron system. Idempotent — a second call while already running is
   * a no-op so existing timers aren't overwritten and leaked.
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    for (const [key, event] of this.events) {
      this.scheduleTimer(key, event);
    }
  }

  /**
   * Stop the cron system and clear all timers.
   */
  stop(): void {
    this.running = false;
    for (const event of this.events.values()) {
      if (event.timer) {
        clearTimeout(event.timer);
        event.timer = undefined;
      }
    }
  }

  /**
   * List all scheduled events.
   */
  getScheduledEvents(): Array<{ hook: string; interval: number; nextRun: Date; args: unknown[] }> {
    return Array.from(this.events.values()).map((e) => ({
      hook: e.hook,
      interval: e.interval,
      nextRun: new Date(e.nextRun),
      args: e.args,
    }));
  }

  /** setTimeout overflows (and fires immediately) past this; chunk long waits. */
  private static readonly MAX_TIMEOUT_MS = 2_147_483_647;

  private scheduleTimer(key: string, event: ScheduledEvent): void {
    // Always clear any prior timer for this event so re-scheduling can't leak.
    if (event.timer) {
      clearTimeout(event.timer);
      event.timer = undefined;
    }

    const remaining = event.nextRun - Date.now();
    // Clamp to setTimeout's safe max; a clamped wait re-schedules until due.
    const delay = Math.max(0, Math.min(remaining, CronService.MAX_TIMEOUT_MS));

    event.timer = setTimeout(async () => {
      // If the delay was clamped (far-future event), we haven't reached the
      // run time yet — re-schedule the remaining wait instead of firing.
      if (Date.now() < event.nextRun) {
        if (this.running) this.scheduleTimer(key, event);
        return;
      }
      try {
        await hooks.doAction(event.hook, ...event.args);
      } catch (err) {
        // Log error but don't crash — recurring events must keep running
        console.error(`[presslyn:cron] Error in hook "${event.hook}":`, err);
      }

      if (event.interval > 0) {
        // Recurring — reschedule
        event.nextRun = Date.now() + event.interval;
        if (this.running) {
          this.scheduleTimer(key, event);
        }
      } else {
        // One-time — remove
        this.events.delete(key);
      }
    }, delay);
  }

  private eventKey(hook: string, args: unknown[]): string {
    return `${hook}:${JSON.stringify(args)}`;
  }
}

/** Built-in schedule intervals (matching WordPress) */
export const SCHEDULES = {
  hourly: 60 * 60 * 1000,
  twicedaily: 12 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
} as const;
