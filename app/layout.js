import "./globals.css";

export const metadata = {
  title: "Noisy Neighbor Visualizer",
  description: "An interactive visualization of the noisy neighbor problem and potential solutions.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
