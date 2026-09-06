import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Clock, Trash2, History } from 'lucide-react';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  storageKey?: string;
  className?: string;
  inputClassName?: string;
  onSearchSubmit?: (value: string) => void;
}

const MAX_RECENT_SEARCHES = 5;

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search records...',
  id,
  storageKey = 'general_search',
  className = '',
  inputClassName = '',
  onSearchSubmit
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const localStorageKey = `recent_searches_${storageKey}`;

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(localStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.slice(0, MAX_RECENT_SEARCHES));
        }
      }
    } catch {
      // Ignore storage read errors
    }
  }, [localStorageKey]);

  // Save to recent searches
  const saveRecentSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return;

    setRecentSearches(prev => {
      const filtered = prev.filter(item => item && typeof item === 'string' && item.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      try {
        localStorage.setItem(localStorageKey, JSON.stringify(updated));
      } catch {
        // Ignore storage write errors
      }
      return updated;
    });
  };

  const removeSingleRecentSearch = (e: React.MouseEvent, itemToRemove: string) => {
    e.stopPropagation();
    setRecentSearches(prev => {
      const updated = prev.filter(item => item !== itemToRemove);
      try {
        localStorage.setItem(localStorageKey, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  };

  const clearAllRecentSearches = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches([]);
    try {
      localStorage.removeItem(localStorageKey);
    } catch {
      // Ignore
    }
    setIsOpen(false);
  };

  const handleSelectRecent = (query: string) => {
    onChange(query);
    saveRecentSearch(query);
    if (onSearchSubmit) onSearchSubmit(query);
    setIsOpen(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (value) {
        saveRecentSearch(value);
        if (onSearchSubmit) onSearchSubmit(value);
      }
      setIsOpen(false);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    onChange('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => {
            if (recentSearches.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full pl-8 pr-14 py-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] placeholder-[#8a8886] focus:outline-2 focus:outline-[#71afe5] text-xs transition-colors ${inputClassName}`}
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-[#edebe9] rounded-xs transition-colors"
              title="Clear search query"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {recentSearches.length > 0 && (
            <button
              type="button"
              onClick={() => setIsOpen(prev => !prev)}
              className={`p-1 rounded-xs transition-colors ${
                isOpen 
                  ? 'bg-[#f0fdfa] text-[#0f766e]' 
                  : 'text-neutral-400 hover:text-neutral-700 hover:bg-[#edebe9]'
              }`}
              title="View recent searches (last 5 queries)"
            >
              <History className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Recent Searches Dropdown */}
      {isOpen && recentSearches.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#e1dfdd] rounded-xs shadow-lg py-1.5 z-40 text-xs animate-in fade-in duration-100">
          <div className="flex items-center justify-between px-3 py-1 border-b border-[#edebe9] text-[11px] text-[#605e5c]">
            <span className="font-semibold flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-[#0d9488]" />
              Recent Searches ({recentSearches.length})
            </span>
            <button
              type="button"
              onClick={clearAllRecentSearches}
              className="text-[#a4262c] hover:underline font-semibold flex items-center gap-1 text-[10px]"
            >
              <Trash2 className="w-2.5 h-2.5" />
              Clear all
            </button>
          </div>

          <div className="py-1">
            {recentSearches.map((item, idx) => (
              <div
                key={`${item}-${idx}`}
                onClick={() => handleSelectRecent(item)}
                className="group flex items-center justify-between px-3 py-1.5 hover:bg-[#f3f8fd] cursor-pointer text-[#323130] transition-colors"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <Clock className="w-3 h-3 text-neutral-400 group-hover:text-[#0d9488] shrink-0" />
                  <span className="truncate group-hover:text-[#0f766e]">{item}</span>
                </div>
                <button
                  type="button"
                  onClick={e => removeSingleRecentSearch(e, item)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-[#a4262c] hover:bg-[#edebe9] rounded-xs transition-opacity"
                  title="Remove from history"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="px-3 py-1 border-t border-[#edebe9] bg-[#faf9f8] text-[10px] text-[#8a8886]">
            Press <kbd className="px-1 py-0.5 bg-white border border-[#d2d0ce] rounded text-[9px]">Enter</kbd> to save a new search
          </div>
        </div>
      )}
    </div>
  );
};
