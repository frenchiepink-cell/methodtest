import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Method",
  description: "Training log prototype",
};

export const viewport: Viewport = {
  themeColor: "#0B0B0F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-ink text-zinc-100 antialiased">
        <div className="mx-auto min-h-screen w-full max-w-md">{children}</div>
      </body>
    </html>
  );
}
