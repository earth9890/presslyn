import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Presslyn Admin",
  description: "Presslyn CMS Administration",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
