import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "CashFlow — Income & Expense Tracker",
  description: "Track Cash In and Cash Out with Google Drive Cloud Backups",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CashFlow",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var forestColor = localStorage.getItem('forest_header_color') || '#81b9a1';
                  document.documentElement.style.setProperty('--forest-header-bg', forestColor);
                  var mode = localStorage.getItem('app_theme') || 'volt';
                  document.documentElement.classList.remove('theme-volt', 'theme-light', 'theme-forest', 'theme-ocean', 'theme-amethyst', 'theme-sunset');
                  if (mode === 'volt') {
                    document.documentElement.classList.add('dark', 'theme-volt');
                  } else if (mode === 'forest') {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('theme-forest');
                  } else if (mode === 'ocean') {
                    document.documentElement.classList.add('dark', 'theme-ocean');
                  } else if (mode === 'amethyst') {
                    document.documentElement.classList.add('dark', 'theme-amethyst');
                  } else if (mode === 'sunset') {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('theme-sunset');
                  } else if (mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('theme-light');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-slate-50 dark:bg-slate-950 transition-colors duration-200`}
      >
        {children}
      </body>
    </html>
  );
}
