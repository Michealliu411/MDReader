interface BreadcrumbProps {
  path: string[];
}

export function Breadcrumb({ path }: BreadcrumbProps) {
  if (path.length === 0) return null;
  return (
    <div className="breadcrumb">
      {path.map((p, i) => (
        <span key={i}>
          {i > 0 && <span className="breadcrumb-sep"> › </span>}
          {p}
        </span>
      ))}
    </div>
  );
}
