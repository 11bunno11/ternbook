import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { Link } from "wouter";
import { useGetMap } from "@workspace/api-client-react";
import type { MapNode } from "@workspace/api-client-react";

export default function Map() {
  const { data: mapData, isLoading } = useGetMap();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeTag, setActiveTag] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStatus, setSearchStatus] = useState({ text: "", error: false });
  const [hoveredNode, setHoveredNode] = useState<MapNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const tags = useMemo(() => {
    if (!mapData) return [];
    const s = new Set<string>();
    mapData.nodes.forEach((n) => {
      n.tags?.forEach((t) => s.add(t));
      n.systemTags?.forEach((t) => s.add(t));
    });
    return Array.from(s).sort();
  }, [mapData]);

  // Graph state refs
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const svgSelectionRef = useRef<d3.Selection<
    SVGSVGElement,
    unknown,
    null,
    undefined
  > | null>(null);
  const nodeSelectionRef = useRef<d3.Selection<
    SVGGElement,
    MapNode,
    SVGGElement,
    unknown
  > | null>(null);
  const linkSelectionRef = useRef<d3.Selection<
    SVGLineElement,
    any,
    SVGGElement,
    unknown
  > | null>(null);
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!mapData || !svgRef.current || !containerRef.current) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    svgSelectionRef.current = svg;

    svg.selectAll("*").remove(); // Clear previous

    const g = svg.append("g");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 8])
      .on("zoom", (e) => g.attr("transform", e.transform));

    zoomRef.current = zoom;
    svg.call(zoom);

    svg.on("mousedown", () => svg.classed("cursor-grabbing", true));
    svg.on("mouseup", () => svg.classed("cursor-grabbing", false));

    const nodes = mapData.nodes.map((d) => ({ ...d }));
    const links = mapData.links.map((d) => ({ ...d }));

    const mutuals = new Set();
    const seen = new Set();
    for (const l of links) {
      const a = l.source,
        b = l.target;
      const k1 = `${a}||${b}`,
        k2 = `${b}||${a}`;
      if (seen.has(k2)) {
        mutuals.add(k1);
        mutuals.add(k2);
      }
      seen.add(k1);
    }

    const sim = d3
      .forceSimulation(nodes as any)
      .force(
        "link",
        d3
          .forceLink(links as any)
          .id((d: any) => d.id)
          .distance(80)
          .strength(0.4),
      )
      .force("charge", d3.forceManyBody().strength(-220))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collide",
        d3.forceCollide().radius((d: any) => nodeRadius(d) + 6),
      );

    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", (d) => {
        const k = `${(d.source as any).id}||${(d.target as any).id}`;
        return mutuals.has(k) ? 1.5 : 1;
      })
      .attr("stroke", (d) => {
        const k = `${(d.source as any).id}||${(d.target as any).id}`;
        return mutuals.has(k) ? "#2a3e2a" : "#222";
      })
      .style("transition", "opacity 0.2s");

    linkSelectionRef.current = link as any;

    const node = g
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer")
      .call(
        d3
          .drag<SVGGElement, any>()
          .on("start", (e, d) => {
            if (!e.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (e, d) => {
            d.fx = e.x;
            d.fy = e.y;
          })
          .on("end", (e, d) => {
            if (!e.active) sim.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      )
      .on("click", (e, d) => window.open(d.url, "_blank", "noopener"))
      .on("mousemove", (e, d) => {
        setHoveredNode(d as MapNode);
        setTooltipPos({ x: e.clientX + 14, y: e.clientY + 14 });
      })
      .on("mouseleave", () => setHoveredNode(null));

    nodeSelectionRef.current = node as any;

    node
      .append("circle")
      .attr("r", nodeRadius)
      .attr("fill", nodeColor)
      .attr("stroke", nodeStroke)
      .attr("stroke-width", 1.5)
      .style(
        "transition",
        "opacity 0.2s, stroke 0.2s, stroke-width 0.2s, filter 0.2s",
      );

    node
      .append("text")
      .attr("x", (d: any) => nodeRadius(d) + 4)
      .attr("y", 4)
      .style("font-family", "Courier")
      .style("font-size", "11px")
      .style("fill", "#888")
      .style("pointer-events", "none")
      .style("transition", "opacity 0.2s")
      .text((d: any) =>
        d.name.length > 20 ? d.name.slice(0, 18) + "…" : d.name,
      );

    sim.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);
      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    const handleResize = () => {
      svg.attr("width", window.innerWidth).attr("height", window.innerHeight);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      sim.stop();
    };
  }, [mapData]);

  useEffect(() => {
    if (!nodeSelectionRef.current || !linkSelectionRef.current) return;

    if (!activeTag) {
      nodeSelectionRef.current.style("opacity", 1);
      linkSelectionRef.current.style("opacity", 1);
      return;
    }

    const visibleIds = new Set(
      mapData?.nodes
        .filter((n) =>
          [...(n.tags || []), ...(n.systemTags || [])].includes(activeTag),
        )
        .map((n) => n.id) || [],
    );

    nodeSelectionRef.current.style("opacity", function (d) {
      return visibleIds.has(d.id) ? 1 : 0.08;
    });

    linkSelectionRef.current.style("opacity", function (d: any) {
      const sourceId = d.source.id ?? d.source;
      const targetId = d.target.id ?? d.target;
      return visibleIds.has(sourceId) && visibleIds.has(targetId) ? 1 : 0.08;
    });
  }, [activeTag, mapData]);

  const nodeRadius = (d: any) =>
    5 + Math.min((d.inboundCount || 0) * 1.5 + (d.neighborCount || 0), 20);

  const nodeColor = (d: any) => {
    if (d.systemTags?.includes("verified")) return "#3a6a3a";
    if (d.systemTags?.includes("highly-connected")) return "#3a3a6a";
    if (d.systemTags?.includes("mutual-ring")) return "#4a3a2a";
    if (d.systemTags?.includes("fresh")) return "#2a4a3a";
    return "#222";
  };

  const nodeStroke = (d: any) => {
    if (d.systemTags?.includes("verified")) return "#6abf6a";
    if (d.systemTags?.includes("highly-connected")) return "#7a7abf";
    if (d.systemTags?.includes("mutual-ring")) return "#bf9a6a";
    if (d.systemTags?.includes("fresh")) return "#6abfaa";
    return "#333";
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchStatus({ text: "", error: false });
      return;
    }
    const q = searchQuery.trim().toLowerCase();
    const match = ((nodeSelectionRef.current?.data() as any[]) || []).find(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        n.url.toLowerCase().includes(q) ||
        (n.description || "").toLowerCase().includes(q),
    );

    if (!match || match.x == null) {
      setSearchStatus({ text: "not found", error: true });
      return;
    }

    setSearchStatus({ text: `→ ${match.name}`, error: false });

    // Zoom and highlight
    if (zoomRef.current && svgSelectionRef.current) {
      const scale = 3;
      const x = window.innerWidth / 2 - scale * match.x;
      const y = window.innerHeight / 2 - scale * match.y;
      svgSelectionRef.current
        .transition()
        .duration(800)
        .ease(d3.easeCubicInOut)
        .call(
          zoomRef.current.transform,
          d3.zoomIdentity.translate(x, y).scale(scale),
        );
    }

    if (nodeSelectionRef.current) {
      nodeSelectionRef.current
        .selectAll("circle")
        .style("stroke", nodeStroke)
        .style("stroke-width", 1.5)
        .style("filter", "none");
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);

      const found = nodeSelectionRef.current.filter(
        (d: any) => d.id === match.id,
      );
      found
        .selectAll("circle")
        .style("stroke", "#fff")
        .style("stroke-width", 3)
        .style("filter", "drop-shadow(0 0 6px rgba(255,255,255,0.6))");

      highlightTimerRef.current = setTimeout(() => {
        nodeSelectionRef.current
          ?.selectAll("circle")
          .style("stroke", nodeStroke)
          .style("stroke-width", 1.5)
          .style("filter", "none");
      }, 3000);
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-[#0a0a0a] text-foreground font-mono overflow-hidden"
    >
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2.5">
        <div>
          <h1 className="text-base text-white font-normal">
            ternbook <span className="text-[#444]">/ map</span>
          </h1>
          <Link
            href="/"
            className="text-xs text-[#555] hover:text-[#aaa] transition-colors"
          >
            ← directory
          </Link>
        </div>

        <form onSubmit={handleSearch} className="flex gap-1.5">
          <input
            type="text"
            placeholder="find a site…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            spellCheck={false}
            className="flex-1 bg-[#111] border border-[#2a2a2a] text-[#ccc] text-xs px-2 py-1 min-w-[160px] focus:outline-none focus:border-[#444] placeholder:text-[#333]"
          />
          <button
            type="submit"
            className="bg-transparent border border-[#2a2a2a] text-[#555] text-xs px-2 py-1 hover:text-[#aaa] hover:border-[#555] cursor-pointer"
          >
            go
          </button>
        </form>

        <div
          className={`text-[0.65rem] min-h-[1em] ${searchStatus.error ? "text-[#7a4a4a]" : "text-[#4a7a5a]"}`}
        >
          {searchStatus.text}
        </div>

        <select
          value={activeTag}
          onChange={(e) => setActiveTag(e.target.value)}
          className="bg-[#111] border border-[#2a2a2a] text-[#ccc] text-xs px-2 py-1 min-w-[160px] appearance-none cursor-pointer focus:outline-none focus:border-[#444]"
        >
          <option value="">all tags</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {mapData && (
          <div className="text-[0.65rem] text-[#444]">
            {mapData.nodes.length} sites · {mapData.links.length} links
          </div>
        )}
      </div>

      {isLoading && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[0.85rem] text-[#444]">
          loading map…
        </div>
      )}

      {hoveredNode && (
        <div
          className="fixed bg-[#111] border border-[#2a2a2a] p-3 text-xs pointer-events-none max-w-[220px] z-20 leading-relaxed"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <div className="text-[#7eb8f7] text-[0.85rem]">
            {hoveredNode.name}
          </div>
          <div className="text-[#666] mt-0.5">{hoveredNode.description}</div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {(hoveredNode.tags || []).map((t, i) => (
              <span
                key={`user-${i}`}
                className="text-[0.6rem] px-1 py-[1px] bg-[#1e2a1e] text-[#6abf6a] border border-[#2a3e2a] rounded-[2px]"
              >
                {t}
              </span>
            ))}
            {(hoveredNode.systemTags || []).map((t, i) => (
              <span
                key={`sys-${i}`}
                className="text-[0.6rem] px-1 py-[1px] bg-[#1e1e2e] text-[#7a7abf] border border-[#2a2a3e] rounded-[2px]"
              >
                {t}
              </span>
            ))}
          </div>
          <div className="text-[#444] text-[0.65rem] mt-1">
            {hoveredNode.neighborCount} neighbors ·{" "}
            {(hoveredNode.mutuals || []).length} mutuals
          </div>
        </div>
      )}

      <svg ref={svgRef} className="block cursor-grab w-full h-full" />
    </div>
  );
}
