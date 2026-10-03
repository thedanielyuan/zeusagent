import type { Metadata, Viewport } from "next";
import "./globals.css";

// The page title is rendered by ChatApp so it can follow the open chat.
export const metadata: Metadata = {
  description: "Chat with leading AI models in one place.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
  // Shrink the layout when the on-screen keyboard opens so the composer stays visible.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="bg-app font-sans text-fg antialiased">{children}</body>
    </html>
  );
}
