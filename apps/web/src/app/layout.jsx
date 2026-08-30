export const metadata = {
  title: "Dream Drive",
  description: "Ranchi’s trusted self-drive and chauffeur car rentals",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
