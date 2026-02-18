import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Setup Wizard - Ticket System",
  description: "Initialize your ticket system",
};

export default function SetupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
