import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Exam Slides Preparation AI",
  description: "Upload PYQs and slides, then answer from uploaded college material."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
