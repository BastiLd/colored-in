const HEX_COLOR_PATTERN = /^#?[0-9a-fA-F]{6}$/;

function normalizeColor(value: string): string | null {
  const trimmed = value.trim();
  if (!HEX_COLOR_PATTERN.test(trimmed)) {
    return null;
  }

  return `#${trimmed.replace(/^#/, "").toUpperCase()}`;
}

export function parseColorsParam(rawValue: string | null): string[] {
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(",")
    .map(normalizeColor)
    .filter((color): color is string => Boolean(color));
}

export function buildBuilderSearch(colors: string[]): string {
  const params = new URLSearchParams();
  params.set("colors", colors.join(","));
  return `?${params.toString()}`;
}
