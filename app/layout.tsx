import type { Metadata } from "next";
import "./globals.css";
import { TokenProvider } from "@/lib/design/TokenProvider";
import { UserProvider } from "@/lib/auth/UserContext";

export const metadata: Metadata = {
  title: "vita",
  description: "Autonomous view builder — generate and manage views from any source.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <TokenProvider>
          <UserProvider>{children}</UserProvider>
        </TokenProvider>
      </body>
    </html>
  );
}
