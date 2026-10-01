import "./globals.css";
import Shell from "../components/Shell";

export const metadata = { title: "Dream-Drive Admin" };
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
export const dynamic = "force-dynamic";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
