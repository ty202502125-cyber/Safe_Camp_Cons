import { useEffect, useRef, useState } from "react";

export default function BoardSelect({
  label,
  value,
  onChange,
  options,
  ariaLabel,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);

  const items = options.map((option) =>
    option && typeof option === "object"
      ? { value: String(option.value), label: option.label }
      : { value: String(option), label: String(option) },
  );
  const selected = items.find((item) => item.value === String(value));

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const active = listRef.current.querySelector('[aria-selected="true"]');
    (active || listRef.current.querySelector('[role="option"]'))?.focus();
  }, [open]);

  const choose = (item) => {
    onChange(item.value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onButtonKeyDown = (event) => {
    if (["ArrowDown", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onListKeyDown = (event) => {
    const nodes = Array.from(
      listRef.current?.querySelectorAll('[role="option"]') || [],
    );
    const index = nodes.indexOf(document.activeElement);

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }
    if (!nodes.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      nodes[(index + 1) % nodes.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      nodes[(index - 1 + nodes.length) % nodes.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      nodes[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      nodes[nodes.length - 1]?.focus();
    }
  };

  return (
    <div ref={rootRef} className={`board-select ${className}`.trim()}>
      <span className="board-select-label">{label}</span>
      <button
        ref={buttonRef}
        type="button"
        className={`board-select-control ${open ? "on" : ""}`.trim()}
        aria-label={ariaLabel || label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onButtonKeyDown}
      >
        <span className="board-select-value">
          {selected?.label || "Select"}
        </span>
        <span className="board-select-arrow" aria-hidden="true">
          ⌄
        </span>
      </button>
      {open && (
        <div
          ref={listRef}
          className="board-select-menu"
          role="listbox"
          aria-label={ariaLabel || label}
          onKeyDown={onListKeyDown}
        >
          {items.map((item) => {
            const isSelected = item.value === String(value);
            return (
              <button
                type="button"
                key={item.value}
                role="option"
                aria-selected={isSelected}
                className={`board-select-option ${isSelected ? "on" : ""}`.trim()}
                onClick={() => choose(item)}
              >
                <span>{item.label}</span>
                {isSelected && (
                  <span className="board-select-check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
