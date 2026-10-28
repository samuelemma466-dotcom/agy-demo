import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Command,
  ArrowRight,
  LayoutDashboard,
  Files,
  Smartphone,
  Bot,
  Terminal,
  Settings,
  Sparkles,
  Zap,
} from 'lucide-react';
import { CommandPaletteItem } from '../../types/navigation';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  items: CommandPaletteItem[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  items,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filteredItems = items.filter((item) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    const matchTitle = item.title.toLowerCase().includes(q);
    const matchDesc = item.description.toLowerCase().includes(q);
    const matchKeywords = item.keywords?.some((k) => k.toLowerCase().includes(q));
    const matchCategory = item.category.toLowerCase().includes(q);
    return matchTitle || matchDesc || matchKeywords || matchCategory;
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation within the palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredItems.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredItems.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'home':
        return <LayoutDashboard size={16} />;
      case 'files':
        return <Files size={16} />;
      case 'phone':
        return <Smartphone size={16} />;
      case 'jarvis':
        return <Bot size={16} />;
      case 'developer':
        return <Terminal size={16} />;
      case 'settings':
        return <Settings size={16} />;
      case 'action':
        return <Zap size={16} />;
      default:
        return <Sparkles size={16} />;
    }
  };

  return (
    <div
      className="palette-overlay animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palette-card animate-scale-in">
        {/* Search Input Bar */}
        <div className="palette-search-wrapper">
          <Search size={18} color="var(--text-muted)" />
          <input
            ref={inputRef}
            type="text"
            className="palette-input"
            placeholder="Type a command, action, or page name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd className="kbd-shortcut">ESC to close</kbd>
        </div>

        {/* Results List */}
        <div className="palette-results">
          {filteredItems.length === 0 ? (
            <div
              style={{
                padding: '28px 16px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px',
              }}
            >
              No commands or actions found matching "{query}"
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  className={`palette-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="palette-item-left">
                    <span style={{ color: isSelected ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                      {renderIcon(item.iconName)}
                    </span>
                    <div>
                      <div className="palette-item-title">{item.title}</div>
                      <div className="palette-item-desc">{item.description}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="palette-item-category">{item.category}</span>
                    {isSelected && <ArrowRight size={14} color="var(--accent-cyan)" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Bar */}
        <div className="palette-footer">
          <div className="palette-shortcuts">
            <span>
              <kbd className="kbd-shortcut">↑</kbd> <kbd className="kbd-shortcut">↓</kbd> to navigate
            </span>
            <span>
              <kbd className="kbd-shortcut">↵</kbd> to execute
            </span>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Command size={11} /> Omachy Quick Launcher
          </span>
        </div>
      </div>
    </div>
  );
};
