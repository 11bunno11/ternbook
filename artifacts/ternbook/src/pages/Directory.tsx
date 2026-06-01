import { useState, useEffect, useRef, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { SiteCard } from "@/components/SiteCard";
import { useListSites, useSearchSites, useGetTags } from "@workspace/api-client-react";
import type { Site } from "@workspace/api-client-react";

const PAGE_SIZE = 20;

export default function Directory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  
  const [filters, setFilters] = useState({
    coreContent: "",
    vibeWebCulture: "",
    contentSafety: "",
    systemTags: "",
  });

  const activeTags = Object.values(filters).filter(Boolean);
  const tagParam = activeTags.length > 0 ? activeTags.join(",") : undefined;

  const [page, setPage] = useState(1);
  const [allSites, setAllSites] = useState<Site[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const observerTarget = useRef<HTMLDivElement>(null);

  const { data: tagsData } = useGetTags();

  const { 
    data: sitesData, 
    isLoading: isSitesLoading,
    isFetching: isSitesFetching
  } = useListSites(
    { 
      page, 
      limit: PAGE_SIZE, 
      tags: tagParam, 
      match: activeTags.length > 0 ? "all" : undefined 
    },
    { query: { enabled: !activeSearch } }
  );

  const {
    data: searchData,
    isLoading: isSearchLoading,
    isFetching: isSearchFetching
  } = useSearchSites(
    { q: activeSearch },
    { query: { enabled: !!activeSearch } }
  );

  useEffect(() => {
    if (!activeSearch && sitesData) {
      if (page === 1) {
        setAllSites(sitesData.sites);
      } else {
        setAllSites(prev => {
          const newSites = sitesData.sites.filter(s => !prev.some(p => p.id === s.id));
          return [...prev, ...newSites];
        });
      }
      setTotalCount(sitesData.total);
      setHasMore(sitesData.page < sitesData.pages);
    }
  }, [sitesData, page, activeSearch]);

  const loadMore = useCallback(() => {
    if (!activeSearch && hasMore && !isSitesFetching) {
      setPage(p => p + 1);
    }
  }, [activeSearch, hasMore, isSitesFetching]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "300px" }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [loadMore]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setActiveSearch(searchQuery.trim());
    } else {
      setActiveSearch("");
      setPage(1);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setSearchQuery("");
      setActiveSearch("");
      setPage(1);
    }
  };

  const resetFilters = () => {
    setFilters({
      coreContent: "",
      vibeWebCulture: "",
      contentSafety: "",
      systemTags: "",
    });
    setSearchQuery("");
    setActiveSearch("");
    setPage(1);
  };

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
    setActiveSearch("");
    setSearchQuery("");
  };

  const displayedSites = activeSearch ? (searchData?.results || []) : allSites;
  const displayedTotal = activeSearch ? (searchData?.count || 0) : totalCount;
  const isLoading = activeSearch ? isSearchFetching : isSitesFetching;

  return (
    <Layout>
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="search… try: tag:blog OR title:word"
          spellCheck={false}
          className="flex-1 bg-input border border-border text-foreground font-mono text-sm px-3 py-2 focus:outline-none focus:border-ring placeholder:text-muted-foreground"
        />
        <button 
          type="submit"
          className="bg-[#1e2a1e] border border-[#2a3e2a] text-[#6abf6a] font-mono text-sm px-4 py-2 hover:bg-[#243024] focus:outline-none transition-colors"
        >
          search
        </button>
      </form>
      
      <div className="text-[0.65rem] text-muted-foreground mb-6 leading-relaxed">
        <span className="bg-[#181818] px-1 py-0.5 text-gray-400">tag:a,b</span> match tags &nbsp; 
        <span className="bg-[#181818] px-1 py-0.5 text-gray-400">title:word</span> match name &nbsp;
        <span className="bg-[#181818] px-1 py-0.5 text-gray-400">desc:word</span> match description &nbsp;
        <span className="bg-[#181818] px-1 py-0.5 text-gray-400">is:verified</span> system tag &nbsp;
        <span className="bg-[#181818] px-1 py-0.5 text-gray-400">-tag:nsfw</span> exclude
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div className="flex flex-col gap-1">
          <label className="text-[0.65rem] text-muted-foreground uppercase tracking-wider">Core Content</label>
          <select 
            value={filters.coreContent}
            onChange={(e) => handleFilterChange("coreContent", e.target.value)}
            className="bg-input border border-border text-foreground text-xs px-2 py-1.5 min-w-[150px] appearance-none focus:outline-none focus:border-ring cursor-pointer"
          >
            <option value="">All</option>
            {tagsData?.coreContent?.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[0.65rem] text-muted-foreground uppercase tracking-wider">Vibe / Web Culture</label>
          <select 
            value={filters.vibeWebCulture}
            onChange={(e) => handleFilterChange("vibeWebCulture", e.target.value)}
            className="bg-input border border-border text-foreground text-xs px-2 py-1.5 min-w-[150px] appearance-none focus:outline-none focus:border-ring cursor-pointer"
          >
            <option value="">All</option>
            {tagsData?.vibeWebCulture?.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[0.65rem] text-muted-foreground uppercase tracking-wider">Content Safety</label>
          <select 
            value={filters.contentSafety}
            onChange={(e) => handleFilterChange("contentSafety", e.target.value)}
            className="bg-input border border-border text-foreground text-xs px-2 py-1.5 min-w-[150px] appearance-none focus:outline-none focus:border-ring cursor-pointer"
          >
            <option value="">All</option>
            {tagsData?.contentSafety?.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[0.65rem] text-muted-foreground uppercase tracking-wider">Ternbook Native</label>
          <select 
            value={filters.systemTags}
            onChange={(e) => handleFilterChange("systemTags", e.target.value)}
            className="bg-input border border-border text-foreground text-xs px-2 py-1.5 min-w-[150px] appearance-none focus:outline-none focus:border-ring cursor-pointer"
          >
            <option value="">All</option>
            {tagsData?.systemTags?.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button 
          onClick={resetFilters}
          className="bg-transparent border border-border text-muted-foreground text-xs px-3 py-1.5 hover:text-foreground hover:border-ring transition-colors cursor-pointer"
        >
          reset all
        </button>
      </div>

      <div className="text-xs text-muted-foreground mb-4">
        {displayedTotal} site{displayedTotal !== 1 ? "s" : ""}
        {activeSearch && (
          <span className="inline-block text-[0.65rem] px-1.5 py-0.5 ml-2 bg-[#1e2a1e] border border-[#2a3e2a] text-[#6abf6a] align-middle">
            search results
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {displayedSites.map(site => (
          <SiteCard key={site.url} site={site} />
        ))}
      </div>

      {displayedSites.length === 0 && !isLoading && (
        <div className="text-sm text-muted-foreground py-10">no sites match</div>
      )}

      {!activeSearch && (
        <div ref={observerTarget} className="text-center text-[0.7rem] text-[#444] py-8 min-h-[64px]">
          {isLoading ? "loading…" : (!hasMore && displayedSites.length > 0 ? "— end of directory —" : "")}
        </div>
      )}
      {activeSearch && displayedSites.length > 0 && (
        <div className="text-center text-[0.7rem] text-[#444] py-8 min-h-[64px]">
          — end of search results —
        </div>
      )}
    </Layout>
  );
}
