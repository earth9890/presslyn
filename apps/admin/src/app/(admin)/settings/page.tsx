import { services } from "@/lib/services";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

/** Option keys surfaced by the settings screen, with their fallback defaults. */
const OPTION_DEFAULTS: Record<string, string | number | boolean> = {
  blogname: "Presslyn Site",
  blogdescription: "Just another Presslyn site",
  siteurl: "http://localhost:3000",
  admin_email: "",
  timezone_string: "UTC",
  date_format: "F j, Y",
  time_format: "g:i a",
  start_of_week: 1,
  default_category: 1,
  posts_per_page: 10,
  blog_public: true,
  default_comment_status: "open",
  default_ping_status: "open",
  thumbnail_size_w: 150,
  thumbnail_size_h: 150,
  medium_size_w: 300,
  medium_size_h: 300,
  large_size_w: 1024,
  large_size_h: 1024,
  uploads_use_yearmonth_folders: true,
  permalink_structure: "/%postname%/",
};

export default async function SettingsPage() {
  const keys = Object.keys(OPTION_DEFAULTS);

  const [resolved, categories] = await Promise.all([
    Promise.all(
      keys.map((key) =>
        services.options.getOption(key).catch(() => undefined)
      )
    ),
    services.taxonomy.getTermsWithCounts("category").catch(() => []),
  ]);

  const values: Record<string, string | number | boolean> = {};
  keys.forEach((key, i) => {
    const v = resolved[i];
    values[key] = v === undefined || v === null ? OPTION_DEFAULTS[key] : (v as string | number | boolean);
  });

  const categoryOptions = categories.map((c) => ({
    value: String(c.id),
    label: c.name,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SettingsForm values={values} categoryOptions={categoryOptions} />
    </div>
  );
}
