import { Link, useLocation } from "wouter";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex flex-col p-6 max-w-7xl mx-auto">
      <header className="flex flex-wrap items-baseline gap-4 mb-8">
        <h1 className="text-xl text-white">ternbook</h1>
        <span className="text-sm text-muted-foreground">a web directory</span>
        <Link href="/random" className={`text-sm hover:text-white transition-colors ${location === "/random" ? "text-white" : "text-muted-foreground"}`}>
          random
        </Link>
        <Link href="/map" className={`text-sm hover:text-white transition-colors ${location === "/map" ? "text-white" : "text-muted-foreground"}`}>
          map
        </Link>
      </header>
      <main className="flex-1 w-full">
        {children}
      </main>
    </div>
  );
}
