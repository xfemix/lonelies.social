import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'LONELIES',
  description: 'Truth over comfort. lonelies.social',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-50 text-zinc-900">
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-zinc-200 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.svg" alt="LONELIES" width={160} height={40} />
              <span className="sr-only">LONELIES</span>
            </div>
            <nav className="text-sm text-zinc-600">truth over comfort</nav>
          </header>
          <main className="flex-1 container mx-auto p-4 max-w-5xl">{children}</main>
          <footer className="border-t border-zinc-200 p-4 text-xs text-zinc-500">© {new Date().getFullYear()} lonelies.social</footer>
        </div>
      </body>
    </html>
  );
}
