import { useState } from "react";
import { Link, useLocation } from "wouter";

export default function Random() {
  const [tag, setTag] = useState(() => new URLSearchParams(window.location.search).get("tag") || "");
  const [status, setStatus] = useState({ text: "", isError: false });
  const [isLoading, setIsLoading] = useState(false);

  const handleWander = async () => {
    setIsLoading(true);
    setStatus({ text: "…", isError: false });

    const tab = window.open("", "_blank");
    if (!tab) {
      setStatus({ text: "popup blocked. allow popups to wander.", isError: true });
      setIsLoading(false);
      return;
    }

    try {
      const url = "/api/random" + (tag ? `?tag=${encodeURIComponent(tag.trim())}` : "");
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        tab.close();
        setStatus({ text: data.error || "something went wrong", isError: true });
        return;
      }

      tab.location.href = data.url;
      setStatus({ text: "", isError: false });
    } catch {
      tab.close();
      setStatus({ text: "could not reach the server", isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-background text-foreground font-mono">
      <nav className="fixed top-4 left-4 text-xs">
        <Link href="/" className="text-[#444] hover:text-[#aaa] transition-colors">
          ← directory
        </Link>
      </nav>

      <h1 className="text-base font-normal text-[#333] tracking-[0.1em]">
        ternbook / wander
      </h1>

      <div className="flex gap-2 items-center">
        <input 
          type="text"
          value={tag}
          onChange={e => setTag(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleWander()}
          placeholder="tag filter (optional)"
          spellCheck={false}
          className="bg-[#111] border border-[#222] text-[#aaa] font-mono text-sm px-2.5 py-1.5 w-44 text-center focus:outline-none focus:border-[#444] placeholder:text-[#333]"
        />
      </div>

      <button 
        onClick={handleWander}
        disabled={isLoading}
        className="bg-[#0e0e0e] border border-[#333] text-[#ccc] font-mono text-2xl tracking-[0.15em] px-12 py-4 cursor-pointer transition-colors select-none hover:border-[#666] hover:text-white active:bg-[#141414] disabled:opacity-50"
      >
        wander
      </button>

      <div className={`text-[0.7rem] min-h-[1.2em] text-center ${status.isError ? "text-[#7a4a4a]" : "text-[#444]"}`}>
        {status.text}
      </div>
    </div>
  );
}
