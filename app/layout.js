import "./globals.css";

export const metadata = {
  title: "KV cache lab — interactive LLM primer",
  description:
    "Step through autoregressive decode, attention over a prefix, and why caching past K/V matters.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
