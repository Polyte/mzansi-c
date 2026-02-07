import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mzansi - Ride Sharing & Delivery API",
  description: "Mzansi backend API for ride-sharing and delivery services",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
