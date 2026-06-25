import { useState, useEffect, useRef } from "react";

interface SearchBarProps {
  visible: boolean;
  onSearch: (keyword: string, caseSensitive: boolean) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  matchCount: number;
  currentMatch: number;
}

export function SearchBar({
  visible,
  onSearch,
  onNext,
  onPrev,
  onClose,
  matchCount,
  currentMatch,
}: SearchBarProps) {
  const [keyword, setKeyword] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) inputRef.current?.focus();
  }, [visible]);

  useEffect(() => {
    onSearch(keyword, caseSensitive);
  }, [keyword, caseSensitive, onSearch]);

  if (!visible) return null;

  return (
    <div className="search-bar">
      <input
        ref={inputRef}
        type="text"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="搜索…"
      />
      <button onClick={() => setCaseSensitive((c) => !c)}>
        {caseSensitive ? "Aa" : "aa"}
      </button>
      <span className="search-count">
        {matchCount > 0 ? `${currentMatch + 1}/${matchCount}` : "0/0"}
      </span>
      <button onClick={onPrev}>↑</button>
      <button onClick={onNext}>↓</button>
      <button onClick={onClose}>✕</button>
    </div>
  );
}
