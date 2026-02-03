// app/layout.tsx
import "./globals.css";
import Header from "./Header";
import Providers from "./providers";

export const metadata = {
  title: "Superblog",
  description: "A blog app using Next.js and Prisma",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/icon?family=Material+Icons"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <div className="h-screen flex flex-col overflow-hidden">
            <Header />
            <main className="flex-1 overflow-hidden">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
