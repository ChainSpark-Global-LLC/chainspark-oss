import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "AI Extraction Patterns",
    description: "Resilient, structured data extraction from unstructured text using LLMs",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className="antialiased">{children}</body>
        </html>
    );
}
