"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CheckmarkCircle01Icon } from "hugeicons-react";
import { apiFetch, ApiError } from "@/lib/api-client";

type FieldType =
  | "text"
  | "url"
  | "email"
  | "number"
  | "select"
  | "checkbox"
  | "textarea";

interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  hint?: string;
  /** For select fields. */
  options?: { value: string; label: string }[];
  /** Render two number inputs side by side (e.g. width × height). */
  pairWith?: string;
}

interface SectionDef {
  id: string;
  label: string;
  description: string;
  fields: FieldDef[];
}

export interface SettingsFormProps {
  /** All option values keyed by WordPress option name. */
  values: Record<string, string | number | boolean>;
  /** Category choices for the "default category" select. */
  categoryOptions: { value: string; label: string }[];
  /** Published-page choices for the privacy-policy-page select. */
  pageOptions: { value: string; label: string }[];
}

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const WEEKDAYS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

const OPEN_CLOSED = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
];

const PERMALINK_PRESETS = [
  { value: "", label: "Plain (?p=123)" },
  { value: "/%year%/%monthnum%/%day%/%postname%/", label: "Day and name" },
  { value: "/%year%/%monthnum%/%postname%/", label: "Month and name" },
  { value: "/archives/%post_id%", label: "Numeric" },
  { value: "/%postname%/", label: "Post name" },
];

/** Number fields that must be coerced to numbers when saving. */
const NUMBER_KEYS = new Set([
  "posts_per_page",
  "start_of_week",
  "thumbnail_size_w",
  "thumbnail_size_h",
  "medium_size_w",
  "medium_size_h",
  "large_size_w",
  "large_size_h",
  "default_category",
]);

const BOOLEAN_KEYS = new Set(["blog_public", "uploads_use_yearmonth_folders"]);

function buildSections(
  categoryOptions: { value: string; label: string }[],
  pageOptions: { value: string; label: string }[]
): SectionDef[] {
  return [
    {
      id: "general",
      label: "General",
      description: "Site identity, contact, and locale.",
      fields: [
        { key: "blogname", label: "Site Title", type: "text" },
        {
          key: "blogdescription",
          label: "Tagline",
          type: "text",
          hint: "In a few words, explain what this site is about.",
        },
        { key: "siteurl", label: "Site Address (URL)", type: "url" },
        {
          key: "admin_email",
          label: "Administration Email",
          type: "email",
          hint: "This address is used for admin purposes.",
        },
        {
          key: "timezone_string",
          label: "Timezone",
          type: "select",
          options: TIMEZONES.map((tz) => ({ value: tz, label: tz })),
        },
        {
          key: "date_format",
          label: "Date Format",
          type: "text",
          hint: "PHP-style date tokens (e.g. F j, Y).",
        },
        { key: "time_format", label: "Time Format", type: "text" },
        {
          key: "start_of_week",
          label: "Week Starts On",
          type: "select",
          options: WEEKDAYS,
        },
      ],
    },
    {
      id: "writing",
      label: "Writing",
      description: "Defaults applied to new content.",
      fields: [
        {
          key: "default_category",
          label: "Default Post Category",
          type: "select",
          options:
            categoryOptions.length > 0
              ? categoryOptions
              : [{ value: "1", label: "Uncategorized" }],
        },
      ],
    },
    {
      id: "reading",
      label: "Reading",
      description: "How content is presented to visitors.",
      fields: [
        {
          key: "posts_per_page",
          label: "Blog pages show at most",
          type: "number",
          hint: "Number of posts per page.",
        },
        {
          key: "blog_public",
          label: "Search engine visibility",
          type: "checkbox",
          hint: "Allow search engines to index this site.",
        },
      ],
    },
    {
      id: "discussion",
      label: "Discussion",
      description: "Comment and pingback defaults.",
      fields: [
        {
          key: "default_comment_status",
          label: "Allow comments on new posts",
          type: "select",
          options: OPEN_CLOSED,
        },
        {
          key: "default_ping_status",
          label: "Allow pingbacks & trackbacks",
          type: "select",
          options: OPEN_CLOSED,
        },
      ],
    },
    {
      id: "media",
      label: "Media",
      description: "Image sizes generated on upload.",
      fields: [
        {
          key: "thumbnail_size_w",
          label: "Thumbnail size",
          type: "number",
          pairWith: "thumbnail_size_h",
        },
        {
          key: "medium_size_w",
          label: "Medium size",
          type: "number",
          pairWith: "medium_size_h",
        },
        {
          key: "large_size_w",
          label: "Large size",
          type: "number",
          pairWith: "large_size_h",
        },
        {
          key: "uploads_use_yearmonth_folders",
          label: "Organize uploads into month- and year-based folders",
          type: "checkbox",
        },
      ],
    },
    {
      id: "permalinks",
      label: "Permalinks",
      description: "URL structure for posts.",
      fields: [
        {
          key: "permalink_structure",
          label: "Permalink structure",
          type: "select",
          options: PERMALINK_PRESETS,
          hint: "Choose how post URLs are formed.",
        },
      ],
    },
    {
      id: "privacy",
      label: "Privacy",
      description: "Designate a page that explains your privacy policy.",
      fields: [
        {
          key: "wp_page_for_privacy_policy",
          label: "Privacy Policy Page",
          type: "select",
          options: pageOptions,
          hint: "Choose a published page to use as your privacy policy.",
        },
      ],
    },
  ];
}

export function SettingsForm({
  values: initial,
  categoryOptions,
  pageOptions,
}: SettingsFormProps) {
  const sections = useMemo(
    () => buildSections(categoryOptions, pageOptions),
    [categoryOptions, pageOptions]
  );
  const [activeTab, setActiveTab] = useState(sections[0].id);

  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const out: Record<string, string | boolean> = {};
    for (const section of buildSections(categoryOptions, pageOptions)) {
      for (const f of section.fields) {
        const raw = initial[f.key];
        if (f.type === "checkbox") out[f.key] = Boolean(raw);
        else out[f.key] = raw === undefined || raw === null ? "" : String(raw);
        if (f.pairWith) {
          const pr = initial[f.pairWith];
          out[f.pairWith] = pr === undefined || pr === null ? "" : String(pr);
        }
      }
    }
    return out;
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function update(key: string, value: string | boolean) {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  }

  function coerce(key: string, value: string | boolean): unknown {
    if (BOOLEAN_KEYS.has(key)) return Boolean(value);
    if (NUMBER_KEYS.has(key)) {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    }
    return value;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const keys = Object.keys(values);
      for (const key of keys) {
        await apiFetch(`/api/v1/settings/${key}`, {
          method: "PUT",
          body: { value: coerce(key, values[key]) },
        });
      }
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to save settings. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  const current = sections.find((s) => s.id === activeTab) ?? sections[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-surface p-1">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveTab(s.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === s.id
                ? "bg-accent text-white"
                : "text-text-secondary hover:bg-surface-raised hover:text-text-primary"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}
      {saved && (
        <div className="flex items-center gap-2 rounded-md border border-success/20 bg-success/5 px-4 py-3 text-sm text-success">
          <CheckmarkCircle01Icon size={16} />
          Settings saved.
        </div>
      )}

      <section className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-5 py-3.5">
          <h3 className="text-sm font-semibold text-text-primary">{current.label}</h3>
          <p className="mt-0.5 text-xs text-text-muted">{current.description}</p>
        </div>
        <div className="space-y-4 p-5">
          {current.fields.map((field) => (
            <Field
              key={field.key}
              label={field.label}
              htmlFor={`opt-${field.key}`}
              hint={field.hint}
            >
              {renderInput(field, values, update)}
            </Field>
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

function renderInput(
  field: FieldDef,
  values: Record<string, string | boolean>,
  update: (key: string, value: string | boolean) => void
) {
  const id = `opt-${field.key}`;

  if (field.type === "checkbox") {
    return (
      <label className="inline-flex items-center gap-2">
        <input
          id={id}
          type="checkbox"
          checked={Boolean(values[field.key])}
          onChange={(e) => update(field.key, e.target.checked)}
          className="rounded border-border"
        />
        <span className="text-sm text-text-secondary">Enabled</span>
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <select
        id={id}
        value={String(values[field.key] ?? "")}
        onChange={(e) => update(field.key, e.target.value)}
        className={inputClass}
      >
        {field.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.pairWith) {
    return (
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          min={0}
          value={String(values[field.key] ?? "")}
          onChange={(e) => update(field.key, e.target.value)}
          className={`${inputClass} w-24`}
          aria-label={`${field.label} width`}
        />
        <span className="text-sm text-text-muted">×</span>
        <input
          type="number"
          min={0}
          value={String(values[field.pairWith] ?? "")}
          onChange={(e) => update(field.pairWith!, e.target.value)}
          className={`${inputClass} w-24`}
          aria-label={`${field.label} height`}
        />
        <span className="text-sm text-text-secondary">px</span>
      </div>
    );
  }

  return (
    <input
      id={id}
      type={field.type === "number" ? "number" : field.type}
      value={String(values[field.key] ?? "")}
      onChange={(e) => update(field.key, e.target.value)}
      className={field.type === "number" ? `${inputClass} w-24` : inputClass}
    />
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 sm:gap-4">
      <div className="sm:pt-1.5">
        <label htmlFor={htmlFor} className="text-sm font-medium text-text-primary">
          {label}
        </label>
        {hint && <p className="mt-0.5 text-xs text-text-muted">{hint}</p>}
      </div>
      <div className="sm:col-span-2">{children}</div>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none transition-colors focus:border-accent focus-visible:ring-2 focus-visible:ring-accent";
