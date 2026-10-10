import "./globals.css";
import GlobalAuthGuard from "./components/GlobalAuthGuard";

export const metadata = {
  title: "",
  description: "Login & Register",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <GlobalAuthGuard />
        {children}
      </body>
    </html>
  );
}
