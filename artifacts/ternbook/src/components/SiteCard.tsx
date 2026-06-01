import { Site } from "@workspace/api-client-react/src/generated/api.schemas";

export function SiteCard({ site }: { site: Site }) {
  const mutualCount = (site.mutuals || []).length;
  const neighborsCount = (site.neighbors || []).length;

  return (
    <div className="border border-card-border p-4 bg-card hover:border-muted-foreground/30 transition-colors">
      <h2 className="text-base mb-1">
        <a 
          href={site.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-[#7eb8f7] hover:underline"
        >
          {site.name}
        </a>
      </h2>
      <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
        {site.description || ""}
      </p>
      
      <div className="flex flex-wrap gap-1.5 mb-3">
        {(site.tags || []).map((t, i) => (
          <span key={`user-${i}`} className="text-[0.65rem] px-1.5 py-0.5 bg-[#1e2a1e] text-[#6abf6a] border border-[#2a3e2a]">
            {t}
          </span>
        ))}
        {(site.systemTags || []).map((t, i) => (
          <span key={`sys-${i}`} className="text-[0.65rem] px-1.5 py-0.5 bg-[#1e1e2e] text-[#7a7abf] border border-[#2a2a3e]">
            {t}
          </span>
        ))}
      </div>
      
      <div className="text-[0.65rem] text-muted-foreground mt-2 flex items-center gap-2">
        <span>{neighborsCount} neighbors</span>
        {mutualCount > 0 && (
          <>
            <span>·</span>
            <span>{mutualCount} mutual{mutualCount !== 1 ? "s" : ""}</span>
          </>
        )}
      </div>
    </div>
  );
}
