import type { Heading } from "../lib/markdown";

interface SidebarProps {
  headings: Heading[];
  activeId: string | null;
  onJump: (id: string) => void;
}

export function Sidebar({ headings, activeId, onJump }: SidebarProps) {
  if (headings.length === 0) {
    return (
      <aside className="sidebar">
        <p className="sidebar-empty">无大纲</p>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <nav className="outline">
        {headings.map((h) => (
          <a
            key={h.id}
            className={`outline-item level-${h.level}${
              h.id === activeId ? " active" : ""
            }`}
            onClick={() => onJump(h.id)}
          >
            {h.text}
          </a>
        ))}
      </nav>
    </aside>
  );
}
