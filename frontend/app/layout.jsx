import './globals.css';

export const metadata = {
  title: 'CGS LMS',
  description: 'Cognisphere Learning Management System',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
