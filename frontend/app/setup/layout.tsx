import type { Metadata } from "next";

export const metadata: Metadata = {
  title: 'Setup Wizard - OpenTicket',
  description: 'Initialize OpenTicket',
};

export default function SetupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
