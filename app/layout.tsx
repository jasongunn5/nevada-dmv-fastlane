import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nevada DMV FastLane",
  description: "Prepare for Nevada DMV services, confirm your documents, and arrive ready.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
