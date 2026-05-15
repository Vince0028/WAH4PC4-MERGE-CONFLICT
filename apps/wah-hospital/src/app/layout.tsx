import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WAH Hospital — Wireless Access for Health",
  description: "WAH Hospital Prototype System using PH Core HL7 FHIR R4 for the ADAPT LHIE Healthcare Data Exchange",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <div className="flex min-h-screen">{children}</div>
      </body>
    </html>
  );
}
