import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState } from "react";

function optionText(children) {
  if (Array.isArray(children)) {
    return children.map(optionText).join("");
  }

  if (children === null || children === undefined || typeof children === "boolean") {
    return "";
  }

  if (isValidElement(children)) {
    return optionText(children.props.children);
  }

  return String(children);
}

function buildOptions(children) {
  return Children.toArray(children)
    .filter((child) => isValidElement(child) && child.type === "option")
    .map((child) => ({
      value: String(child.props.value ?? ""),
      label: optionText(child.props.children).trim() || String(child.props.value ?? ""),
      disabled: Boolean(child.props.disabled)
    }));
}

export default function SearchableSelect({
  value = "",
  onChange,
  children,
  disabled = false,
  required = false,
  placeholder = "Select",
  className = "",
  name,
  id,
  ...props
}) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const options = useMemo(() => buildOptions(children), [children]);
  const stringValue = String(value ?? "");
  const selectedOption = options.find((option) => option.value === stringValue);
  const placeholderOption = options.find((option) => option.value === "");
  const visibleOptions = useMemo(() => options.filter((option) => option.value !== ""), [options]);
  const resolvedPlaceholder = placeholderOption?.label || placeholder;
  const selectedLabel = stringValue ? selectedOption?.label || stringValue : resolvedPlaceholder;

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return visibleOptions;
    }

    return visibleOptions.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
  }, [query, visibleOptions]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      window.setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [isOpen]);

  const emitChange = (nextValue) => {
    onChange?.({
      target: { value: nextValue, name },
      currentTarget: { value: nextValue, name }
    });
  };

  const handleSelect = (option) => {
    if (option.disabled) {
      return;
    }

    emitChange(option.value);
    setIsOpen(false);
  };

  const handleAll = () => {
    setQuery("");
    if (placeholderOption) {
      emitChange("");
    }
  };

  const handleClear = () => {
    setQuery("");
    if (placeholderOption) {
      emitChange("");
    }
  };

  return (
    <div
      ref={rootRef}
      className={`searchable-select ${isOpen ? "searchable-select--open" : ""} ${disabled ? "searchable-select--disabled" : ""} ${className}`.trim()}
    >
      <select
        {...props}
        id={selectId}
        name={name}
        value={stringValue}
        required={required}
        disabled={disabled}
        className="searchable-select__native"
        onChange={(event) => emitChange(event.target.value)}
        onInvalid={() => {
          setIsOpen(true);
          window.setTimeout(() => searchRef.current?.focus(), 0);
        }}
      >
        {children}
      </select>
      <button
        type="button"
        className={`searchable-select__trigger ${!stringValue ? "searchable-select__trigger--placeholder" : ""}`.trim()}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${selectId}-listbox`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="searchable-select__value">{selectedLabel}</span>
        <span className="searchable-select__chevron" aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="searchable-select__panel">
          <input
            ref={searchRef}
            type="search"
            className="searchable-select__search"
            value={query}
            placeholder="Search..."
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="searchable-select__actions">
            <button type="button" className="searchable-select__action searchable-select__action--all" onClick={handleAll}>
              ALL
            </button>
            <button type="button" className="searchable-select__action searchable-select__action--clear" onClick={handleClear}>
              CLEAR
            </button>
          </div>
          <div id={`${selectId}-listbox`} className="searchable-select__list" role="listbox">
            {filteredOptions.length ? (
              filteredOptions.map((option) => (
                <button
                  key={`${option.value}-${option.label}`}
                  type="button"
                  className={`searchable-select__option ${option.value === stringValue ? "searchable-select__option--selected" : ""}`.trim()}
                  disabled={option.disabled}
                  role="option"
                  aria-selected={option.value === stringValue}
                  onClick={() => handleSelect(option)}
                >
                  <span className="searchable-select__check" aria-hidden="true" />
                  <span className="searchable-select__option-label">{option.label}</span>
                </button>
              ))
            ) : (
              <div className="searchable-select__empty">No matching options.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}