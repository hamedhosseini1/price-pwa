import type { Metadata, Viewport } from "next";
import { SettingsProvider } from "@/lib/settings";
import "./globals.css";

export const metadata: Metadata = {
  title: "قیمت لحظه‌ای | ارز، طلا، کریپتو، نفت",
  description: "نمایش لحظه‌ای قیمت ارز، طلا و سکه، ارزهای دیجیتال و نفت — مینیمال، سریع و آفلاین‌خوان",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "قیمت لحظه‌ای" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
  width: "device-width",
  initialScale: 1,
};

// Inline theme init: runs before paint, prevents dark/light flash.
const themeInit = `(function(){try{var t=JSON.parse(localStorage.getItem('pp-theme')||'"light"');document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" data-theme="light">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <SettingsProvider>{children}</SettingsProvider>
        <noscript>برای مشاهده قیمت‌های لحظه‌ای، جاوااسکریپت را فعال کنید.</noscript>
      </body>
    </html>
  );
}
