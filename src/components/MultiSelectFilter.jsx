import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeValue } from "../utils/dataView";

export default function MultiSelectFilter({
  label,
  options,
  selectedValues,
  onChange
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeValue(query);

    return options.filter((option) => normalizeValue(option.label).includes(normalizedQuery));
  }, [options, query]);

  const summary =
    selectedValues.length === 0
      ? `All ${label}`
      : selectedValues.length === 1
        ? options.find((option) => option.value === selectedValues[0])?.label || `1 selected`
        : `${selectedValues.length} selected`;

  const toggleValue = (value) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((item) => item !== value));
      return;
    }

    onChange([...selectedValues, value]);
  };

  return (
    <div className="multi-filter" ref={rootRef}>
      <label className="multi-filter__field-label">{label}</label>
      <button
        type="button"
        className={`multi-filter__trigger ${isOpen ? "is-open" : ""}`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="multi-filter__summary">{summary}</span>
        <span className="multi-filter__chevron" aria-hidden="true"></span>
      </button>

      {isOpen ? (
        <div className="multi-filter__menu">
          <input
            type="search"
            className="multi-filter__search"
            placeholder={`Search ${label}`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="multi-filter__actions">
            <button type="button" className="text-button" onClick={() => onChange([])}>
              Clear
            </button>
          </div>
          <div className="multi-filter__options">
            {filteredOptions.length === 0 ? (
              <div className="multi-filter__empty">No matches found.</div>
            ) : (
              filteredOptions.map((option) => (
                <label key={option.value} className="multi-filter__option">
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(option.value)}
                    onChange={() => toggleValue(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
