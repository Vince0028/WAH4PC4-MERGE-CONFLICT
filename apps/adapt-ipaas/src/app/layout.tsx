import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ADAPT iPaaS — Integration Platform Dashboard",
  description: "Intelligent Healthcare Data Integration Platform as a Service for the Philippine Local Health Information Exchange (LHIE)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <div className="flex min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
