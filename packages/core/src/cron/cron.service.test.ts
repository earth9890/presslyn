import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CronService, SCHEDULES } from "./cron.service.js";

// Mock the hooks module so we don't depend on the real global HookSystem
vi.mock("../hooks.js", () => {
  const callbacks = new Map<string, Array<(...args: unknown[]) => unknown>>();

  return {
    hooks: {
      addAction(hook: string, cb: (...args: unknown[]) => unknown) {
        const list = callbacks.get(hook) ?? [];
        list.push(cb);
        callbacks.set(hook, list);
      },
      async doAction(hook: string, ...args: unknown[]) {
        const list = callbacks.get(hook) ?? [];
        for (const cb of list) {
          await cb(...args);
        }
      },
      /** Helper to clear between tests */
      _reset() {
        callbacks.clear();
      },
      _callbacks: callbacks,
    },
  };
});

// Import hooks after mocking so we get the mocked version
import { hooks } from "../hooks.js";

describe("CronService", () => {
  let cron: CronService;

  beforeEach(() => {
    vi.useFakeTimers();
    cron = new CronService();
    (hooks as any)._reset();
  });

  afterEach(() => {
    cron.stop();
    vi.useRealTimers();
  });

  // ─── scheduleEvent ─────────────────────────────────────────

  describe("scheduleEvent", () => {
    it("adds a recurring event", () => {
      cron.scheduleEvent("my_hook", 5000);
      const events = cron.getScheduledEvents();
      expect(events).toHaveLength(1);
      expect(events[0].hook).toBe("my_hook");
      expect(events[0].interval).toBe(5000);
    });

    it("deduplicates: second call with same hook+args is a no-op", () => {
      cron.scheduleEvent("my_hook", 5000, "arg1");
      cron.scheduleEvent("my_hook", 10000, "arg1"); // same hook + args
      const events = cron.getScheduledEvents();
      expect(events).toHaveLength(1);
      expect(events[0].interval).toBe(5000); // original kept, not overwritten
    });

    it("allows same hook with different args", () => {
      cron.scheduleEvent("my_hook", 5000, "arg1");
      cron.scheduleEvent("my_hook", 5000, "arg2");
      expect(cron.getScheduledEvents()).toHaveLength(2);
    });
  });

  // ─── scheduleSingleEvent ───────────────────────────────────

  describe("scheduleSingleEvent", () => {
    it("adds a one-time event", () => {
      const ts = Date.now() + 5000;
      cron.scheduleSingleEvent("once_hook", ts);
      const events = cron.getScheduledEvents();
      expect(events).toHaveLength(1);
      expect(events[0].hook).toBe("once_hook");
      expect(events[0].interval).toBe(0);
    });

    it("overwrites existing single event with same hook+args", () => {
      const ts1 = Date.now() + 5000;
      const ts2 = Date.now() + 10000;

      cron.scheduleSingleEvent("once_hook", ts1);
      cron.scheduleSingleEvent("once_hook", ts2); // overwrite

      const events = cron.getScheduledEvents();
      expect(events).toHaveLength(1);
      expect(events[0].nextRun.getTime()).toBe(ts2);
    });

    it("clears old timer when overwriting a running single event", async () => {
      cron.start();

      const ts1 = Date.now() + 5000;
      cron.scheduleSingleEvent("once_hook", ts1);

      // Overwrite with a later timestamp while running
      const ts2 = Date.now() + 20000;
      cron.scheduleSingleEvent("once_hook", ts2);

      // Register a callback to detect firing
      let fired = 0;
      hooks.addAction("once_hook", () => {
        fired++;
      });

      // Advance past ts1 but before ts2 — the original timer should be cleared
      await vi.advanceTimersByTimeAsync(6000);
      expect(fired).toBe(0);

      // Advance to past ts2
      await vi.advanceTimersByTimeAsync(15000);
      expect(fired).toBe(1);
    });
  });

  // ─── unscheduleEvent ───────────────────────────────────────

  describe("unscheduleEvent", () => {
    it("removes a scheduled event", () => {
      cron.scheduleEvent("my_hook", 5000);
      const removed = cron.unscheduleEvent("my_hook");
      expect(removed).toBe(true);
      expect(cron.getScheduledEvents()).toHaveLength(0);
    });

    it("returns false for non-existent event", () => {
      expect(cron.unscheduleEvent("no_such_hook")).toBe(false);
    });

    it("clears the timer of a running event", async () => {
      cron.scheduleEvent("my_hook", 5000);
      cron.start();

      let fired = false;
      hooks.addAction("my_hook", () => {
        fired = true;
      });

      cron.unscheduleEvent("my_hook");
      await vi.advanceTimersByTimeAsync(10000);
      expect(fired).toBe(false);
    });
  });

  // ─── getScheduledEvents ────────────────────────────────────

  describe("getScheduledEvents", () => {
    it("lists all scheduled events", () => {
      cron.scheduleEvent("hook_a", 1000);
      cron.scheduleEvent("hook_b", 2000);
      cron.scheduleSingleEvent("hook_c", Date.now() + 3000);

      const events = cron.getScheduledEvents();
      expect(events).toHaveLength(3);

      const hookNames = events.map((e) => e.hook).sort();
      expect(hookNames).toEqual(["hook_a", "hook_b", "hook_c"]);
    });

    it("returns an empty array when nothing is scheduled", () => {
      expect(cron.getScheduledEvents()).toEqual([]);
    });

    it("returns nextRun as a Date object", () => {
      cron.scheduleEvent("hook_a", 1000);
      const event = cron.getScheduledEvents()[0];
      expect(event.nextRun).toBeInstanceOf(Date);
    });
  });

  // ─── start / stop ─────────────────────────────────────────

  describe("start / stop", () => {
    it("fires timers when started", async () => {
      let called = false;
      hooks.addAction("test_hook", () => {
        called = true;
      });

      cron.scheduleEvent("test_hook", 1000);
      cron.start();

      await vi.advanceTimersByTimeAsync(1100);
      expect(called).toBe(true);
    });

    it("does not fire timers before start is called", async () => {
      let called = false;
      hooks.addAction("test_hook", () => {
        called = true;
      });

      cron.scheduleEvent("test_hook", 1000);
      // Do NOT call cron.start()

      await vi.advanceTimersByTimeAsync(5000);
      expect(called).toBe(false);
    });

    it("stop clears all timers", async () => {
      let count = 0;
      hooks.addAction("test_hook", () => {
        count++;
      });

      cron.scheduleEvent("test_hook", 1000);
      cron.start();

      await vi.advanceTimersByTimeAsync(1100); // fires once
      expect(count).toBe(1);

      cron.stop();
      await vi.advanceTimersByTimeAsync(5000); // should not fire again
      expect(count).toBe(1);
    });
  });

  // ─── Recurring events reschedule after firing ──────────────

  describe("recurring events", () => {
    it("reschedules after each firing", async () => {
      let count = 0;
      hooks.addAction("recurring_hook", () => {
        count++;
      });

      cron.scheduleEvent("recurring_hook", 1000);
      cron.start();

      await vi.advanceTimersByTimeAsync(1100); // fire 1
      expect(count).toBe(1);

      await vi.advanceTimersByTimeAsync(1000); // fire 2
      expect(count).toBe(2);

      await vi.advanceTimersByTimeAsync(1000); // fire 3
      expect(count).toBe(3);
    });

    it("passes args to the hook callback on each firing", async () => {
      const received: unknown[][] = [];
      hooks.addAction("arg_hook", (...args: unknown[]) => {
        received.push(args);
      });

      cron.scheduleEvent("arg_hook", 1000, "x", 42);
      cron.start();

      await vi.advanceTimersByTimeAsync(1100);
      expect(received).toHaveLength(1);
      expect(received[0]).toEqual(["x", 42]);

      await vi.advanceTimersByTimeAsync(1000);
      expect(received).toHaveLength(2);
    });
  });

  // ─── Single events removed after firing ────────────────────

  describe("single events", () => {
    it("are removed after firing", async () => {
      let count = 0;
      hooks.addAction("single_hook", () => {
        count++;
      });

      cron.scheduleSingleEvent("single_hook", Date.now() + 1000);
      cron.start();

      await vi.advanceTimersByTimeAsync(1100);
      expect(count).toBe(1);
      expect(cron.getScheduledEvents()).toHaveLength(0);

      // Should not fire again
      await vi.advanceTimersByTimeAsync(5000);
      expect(count).toBe(1);
    });
  });

  // ─── Error handling in hook callbacks ──────────────────────

  describe("error handling", () => {
    it("does not crash recurring events when callback throws", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      let callCount = 0;
      hooks.addAction("error_hook", () => {
        callCount++;
        if (callCount === 1) {
          throw new Error("boom");
        }
      });

      cron.scheduleEvent("error_hook", 1000);
      cron.start();

      // First firing — throws
      await vi.advanceTimersByTimeAsync(1100);
      expect(callCount).toBe(1);
      expect(consoleSpy).toHaveBeenCalledOnce();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("error_hook"),
        expect.any(Error)
      );

      // Second firing — should still fire (recurring event survived the error)
      await vi.advanceTimersByTimeAsync(1000);
      expect(callCount).toBe(2);

      consoleSpy.mockRestore();
    });

    it("logs error but continues for single events", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      hooks.addAction("single_error_hook", () => {
        throw new Error("single boom");
      });

      cron.scheduleSingleEvent("single_error_hook", Date.now() + 500);
      cron.start();

      await vi.advanceTimersByTimeAsync(600);
      expect(consoleSpy).toHaveBeenCalled();

      // Single event should be removed even after error
      expect(cron.getScheduledEvents()).toHaveLength(0);

      consoleSpy.mockRestore();
    });
  });

  // ─── SCHEDULES constants ───────────────────────────────────

  describe("SCHEDULES", () => {
    it("has correct values", () => {
      expect(SCHEDULES.hourly).toBe(3_600_000);
      expect(SCHEDULES.twicedaily).toBe(43_200_000);
      expect(SCHEDULES.daily).toBe(86_400_000);
      expect(SCHEDULES.weekly).toBe(604_800_000);
    });
  });
});
