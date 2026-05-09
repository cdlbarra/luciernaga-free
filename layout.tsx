import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Luciérnaga Dashboard",
  description: "MVP — Stack gratuito",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "sans-serif", padding: "2rem", background: "#0f0f0f", color: "#f0f0f0" }}>
        {children}
      </body>
    </html>
  );
}
