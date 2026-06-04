import type { Metadata } from "next";
import "./globals.css";
import { getSiteSettings } from "@/lib/site";
import { services } from "@/lib/services";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

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
  const [site, categories] = await Promise.all([
    getSiteSettings(),
    services.taxonomy.getTermsWithCounts("category").catch(() => []),
  ]);

  const navCategories = categories
    .filter((c) => c.count > 0)
    .map((c) => ({ slug: c.slug, name: c.name }));

  return (
    <html lang={site.language}>
      <body className="flex min-h-screen flex-col">
        <SiteHeader
          title={site.title}
          description={site.description}
          categories={navCategories}
        />
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
          {children}
        </main>
        <SiteFooter title={site.title} />
      </body>
    </html>
  );
}
