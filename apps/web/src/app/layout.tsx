import type { Metadata } from "next";
import "./globals.css";
import { getSiteSettings } from "@/lib/site";
import { services } from "@/lib/services";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  getActivePublicTheme,
  getThemeCssVariables,
  getThemeMainClassName,
  getThemeShellClassName,
} from "@/themes/public-theme";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteSettings();
  return {
    metadataBase: new URL(site.url),
    title: {
      default: site.title,
      template: `%s — ${site.title}`,
    },
    description: site.description,
    alternates: {
      canonical: "/",
      types: {
        "application/rss+xml": "/feed",
      },
    },
    openGraph: {
      siteName: site.title,
      title: site.title,
      description: site.description,
      type: "website",
      url: site.url,
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [site, categories, theme] = await Promise.all([
    getSiteSettings(),
    services.taxonomy.getTermsWithCounts("category").catch(() => []),
    getActivePublicTheme(),
  ]);

  const navCategories = categories
    .filter((c) => c.count > 0)
    .map((c) => ({ slug: c.slug, name: c.name }));

  return (
    <html lang={site.language} data-site-theme={theme.id}>
      <body
        className={`flex min-h-screen flex-col ${theme.bodyClassName}`}
        style={getThemeCssVariables(theme)}
      >
        <div className={getThemeShellClassName(theme)}>
        <SiteHeader
          title={site.title}
          description={site.description}
          categories={navCategories}
          theme={theme}
        />
        <main className={getThemeMainClassName(theme)}>
          <div>{children}</div>
        </main>
        <SiteFooter title={site.title} theme={theme} />
        </div>
      </body>
    </html>
  );
}
