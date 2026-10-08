import type { Metadata } from "next";
import { Fraunces, Figtree } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const display = Fraunces({ variable: "--font-display", subsets: ["latin"], axes: ["SOFT", "opsz"] });
const body = Figtree({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Collaborative Corner · Atlanta Jewish community calendar",
  description:
    "See what's happening across Jewish Atlanta (organizations, synagogues, day schools, public school breaks, and holidays) before you pick a date.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} antialiased`}>
      <body className="min-h-dvh flex flex-col">
        <header className="border-b border-line/80 bg-paper/80 backdrop-blur sticky top-0 z-20">
          <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <Mark />
              <span className="font-display text-xl font-semibold tracking-tight text-ink group-hover:text-pomegranate-ink">
                Collaborative Corner
              </span>
            </Link>
            <nav className="ml-auto flex gap-5 text-sm text-ink-soft">
              <Link href="/" className="hover:text-ink">Calendar</Link>
              <Link href="/sources" className="hover:text-ink">Sources</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line/80 text-xs text-ink-soft">
          <div className="mx-auto max-w-7xl px-4 py-5 flex flex-wrap gap-x-6 gap-y-1">
            <span>A community resource for Atlanta Jewish professionals. All times Eastern (Atlanta).</span>
            <span>Calendars are gathered automatically each week. Always confirm with the hosting organization.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}

/** Six overlapping circles: many calendars, one community. */
function Mark() {
  const colors = ["--c-holiday", "--c-public-school", "--c-day-school", "--c-institution", "--c-synagogue", "--c-community-sheet"];
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden>
      {colors.map((c, i) => {
        const a = (i / colors.length) * Math.PI * 2 - Math.PI / 2;
        return <circle key={c} cx={15 + Math.cos(a) * 6.5} cy={15 + Math.sin(a) * 6.5} r="6" fill={`var(${c})`} opacity="0.72" />;
      })}
    </svg>
  );
}
