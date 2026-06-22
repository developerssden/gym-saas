export function splitFullName(fullName: string): {
  first_name: string;
  last_name: string;
} {
  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    throw new Error("full_name is required");
  }

  if (parts.length === 1) {
    return { first_name: parts[0], last_name: "-" };
  }

  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  };
}
