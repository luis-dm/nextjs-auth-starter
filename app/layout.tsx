// app/layout.tsx
import "./globals.css";
import Header from "./Header";
import Providers from "./providers";
import { Toaster } from "react-hot-toast";

export const metadata = {
  title: "OpenBIM",
  description: "BIM App",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
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
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 1800,
              style: {
                background: "#fff",
                color: "#000",
                border: "1px solid #000",
                borderRadius: "0.5rem",
              },
              success: {
                iconTheme: {
                  primary: "#000",
                  secondary: "#fff",
                },
              },
              error: {
                iconTheme: {
                  primary: "#000",
                  secondary: "#fff",
                },
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
