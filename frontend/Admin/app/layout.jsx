import "./globals.css";

export const metadata = {
  title: "Master Admin",
  description: "Admin Panel — Manage plans, users, deposits, withdrawals & site settings",
};

/* Explicit viewport — keeps the panel sized correctly on mobile browsers */
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Caveat:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&family=Dancing+Script:wght@400;600;700&family=Inter:wght@400;500;600;700;800&family=Josefin+Sans:wght@400;500;600;700&family=Lato:wght@400;700&family=Lora:wght@400;500;600;700&family=Merriweather:wght@400;700;900&family=Mulish:wght@400;500;600;700;800&family=Montserrat:wght@400;500;600;700;800&family=Nunito:wght@400;600;700;800&family=Open+Sans:wght@400;500;600;700&family=Oswald:wght@400;500;600;700&family=Playfair+Display:wght@400;600;700;800&family=Poppins:wght@400;500;600;700;800&family=Quicksand:wght@400;500;600;700&family=Roboto:wght@400;500;600;700&family=Rubik:wght@400;500;600;700;800&family=Work+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
