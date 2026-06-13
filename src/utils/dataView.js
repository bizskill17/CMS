export function normalizeValue(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim().toLowerCase();
}

export function getRecordValue(record, accessor) {
  if (typeof accessor === "function") {
    return accessor(record);
  }

  return record?.[accessor];
}

export function buildFilterOptions(records, accessor, formatter) {
  const unique = new Map();

  records.forEach((record) => {
    const rawValue = getRecordValue(record, accessor);
    const normalized = normalizeValue(rawValue);

    if (!normalized) return;

    unique.set(String(rawValue), formatter ? formatter(rawValue, record) : String(rawValue));
  });

  return [...unique.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function sortRecords(records, sortConfig) {
  if (!sortConfig?.key) {
    return records;
  }

  return [...records].sort((a, b) => {
    const aValue = getRecordValue(a, sortConfig.key);
    const bValue = getRecordValue(b, sortConfig.key);

    if (aValue === bValue) return 0;
    if (aValue === null || aValue === undefined || aValue === "") return 1;
    if (bValue === null || bValue === undefined || bValue === "") return -1;

    const left = typeof aValue === "string" ? aValue.toLowerCase() : aValue;
    const right = typeof bValue === "string" ? bValue.toLowerCase() : bValue;
    const result = left < right ? -1 : 1;

    return sortConfig.direction === "asc" ? result : -result;
  });
}

export function filterRecords(records, { searchTerm, searchKeys, activeFilters }) {
  const normalizedSearch = normalizeValue(searchTerm);

  return records.filter((record) => {
    const matchesSearch =
      !normalizedSearch ||
      searchKeys.some((key) => normalizeValue(getRecordValue(record, key)).includes(normalizedSearch));

    if (!matchesSearch) {
      return false;
    }

    return Object.entries(activeFilters).every(([filterKey, selectedValues]) => {
      if (!selectedValues || selectedValues.length === 0) {
        return true;
      }

      const recordValue = getRecordValue(record, filterKey);
      return selectedValues.includes(String(recordValue));
    });
  });
}
