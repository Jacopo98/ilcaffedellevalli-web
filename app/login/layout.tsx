import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accesso riservato | Il Caffè delle Valli",
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
