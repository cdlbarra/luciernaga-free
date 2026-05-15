export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "sans-serif", padding: "2rem", background: "#0f0f0f", color: "#f0f0f0", minHeight: "100vh", boxSizing: "border-box" }}>
        {children}
      </body>
    </html>
  );
}