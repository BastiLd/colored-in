export interface Palette {
  id: string;
  name: string;
  colors: string[];
  tags: string[];
  isFree: boolean;
}

// HSL to Hex converter
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

// Seeded random for consistent generation
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

// Generate harmonious color palette with smooth gradients like Coolors
function generateCoolorsStylePalette(seed: number): string[] {
  const random = seededRandom(seed);
  
  // Color scheme types weighted towards more harmonious results
  const schemeTypes = [
    'gradient', 'gradient', 'gradient',      // Smooth gradient transitions
    'analogous', 'analogous',                 // Similar hues
    'monochromatic', 'monochromatic',        // Single hue variations
    'warm-gradient', 'warm-gradient',         // Warm color flow
    'cool-gradient', 'cool-gradient',         // Cool color flow
    'earth-tones',                            // Natural browns/greens
    'pastel-rainbow',                         // Soft rainbow
    'sunset', 'sunset',                       // Orange/pink/purple
    'ocean',                                  // Blues/teals/greens
    'forest',                                 // Greens/browns
    'berry',                                  // Pinks/purples/reds
    'split-complementary',                    // Harmonious contrast
  ];
  
  const scheme = schemeTypes[Math.floor(random() * schemeTypes.length)];
  const colorCount = 5; // Coolors typically uses 5 colors
  const colors: string[] = [];
  
  switch (scheme) {
    case 'gradient': {
      // Smooth hue gradient
      const startHue = random() * 360;
      const hueRange = 30 + random() * 90; // 30-120 degree range
      const startSat = 40 + random() * 40;
      const startLight = 25 + random() * 20;
      const endLight = 60 + random() * 25;
      
      for (let i = 0; i < colorCount; i++) {
        const t = i / (colorCount - 1);
        const hue = (startHue + t * hueRange) % 360;
        const sat = startSat + random() * 15 - 7;
        const light = startLight + t * (endLight - startLight);
        colors.push(hslToHex(hue, Math.max(20, Math.min(90, sat)), Math.max(15, Math.min(90, light))));
      }
      break;
    }
    
    case 'analogous': {
      const baseHue = random() * 360;
      const baseSat = 50 + random() * 35;
      
      for (let i = 0; i < colorCount; i++) {
        const hue = (baseHue + (i - 2) * 15) % 360;
        const sat = baseSat + (random() * 20 - 10);
        const light = 30 + i * 12 + random() * 8;
        colors.push(hslToHex(Math.max(0, hue), Math.max(25, Math.min(85, sat)), Math.max(20, Math.min(85, light))));
      }
      break;
    }
    
    case 'monochromatic': {
      const hue = random() * 360;
      const baseSat = 45 + random() * 40;
      
      for (let i = 0; i < colorCount; i++) {
        const sat = baseSat + (random() * 15 - 7);
        const light = 20 + i * 15;
        colors.push(hslToHex(hue, Math.max(20, Math.min(90, sat)), Math.max(15, Math.min(85, light))));
      }
      break;
    }
    
    case 'warm-gradient': {
      const startHue = random() * 60; // 0-60 (reds to yellows)
      const hueRange = 40 + random() * 40;
      
      for (let i = 0; i < colorCount; i++) {
        const t = i / (colorCount - 1);
        const hue = (startHue + t * hueRange) % 360;
        const sat = 55 + random() * 30;
        const light = 25 + t * 50 + random() * 10;
        colors.push(hslToHex(hue, Math.max(40, Math.min(90, sat)), Math.max(20, Math.min(85, light))));
      }
      break;
    }
    
    case 'cool-gradient': {
      const startHue = 180 + random() * 80; // 180-260 (cyans to purples)
      const hueRange = 30 + random() * 50;
      
      for (let i = 0; i < colorCount; i++) {
        const t = i / (colorCount - 1);
        const hue = (startHue + t * hueRange) % 360;
        const sat = 45 + random() * 35;
        const light = 25 + t * 50 + random() * 10;
        colors.push(hslToHex(hue, Math.max(30, Math.min(85, sat)), Math.max(20, Math.min(85, light))));
      }
      break;
    }
    
    case 'earth-tones': {
      const earthHues = [20, 30, 40, 80, 100, 120]; // Browns, tans, olives, greens
      const baseIndex = Math.floor(random() * 3);
      
      for (let i = 0; i < colorCount; i++) {
        const hue = earthHues[(baseIndex + i) % earthHues.length] + random() * 15;
        const sat = 25 + random() * 35;
        const light = 25 + i * 13 + random() * 8;
        colors.push(hslToHex(hue, sat, Math.max(20, Math.min(80, light))));
      }
      break;
    }
    
    case 'pastel-rainbow': {
      const startHue = random() * 360;
      
      for (let i = 0; i < colorCount; i++) {
        const hue = (startHue + i * 50) % 360;
        const sat = 55 + random() * 25;
        const light = 75 + random() * 15;
        colors.push(hslToHex(hue, sat, Math.min(92, light)));
      }
      break;
    }
    
    case 'sunset': {
      const hues = [350, 15, 35, 50, 280]; // Red, orange, gold, yellow, purple
      const shuffled = [...hues].sort(() => random() - 0.5);
      
      for (let i = 0; i < colorCount; i++) {
        const hue = shuffled[i] + random() * 15 - 7;
        const sat = 60 + random() * 30;
        const light = 35 + i * 10 + random() * 10;
        colors.push(hslToHex(Math.max(0, hue % 360), Math.max(40, Math.min(95, sat)), Math.max(25, Math.min(80, light))));
      }
      break;
    }
    
    case 'ocean': {
      const baseHue = 180 + random() * 40; // Cyan to blue range
      
      for (let i = 0; i < colorCount; i++) {
        const hue = baseHue + (i - 2) * 12 + random() * 10;
        const sat = 45 + random() * 40;
        const light = 20 + i * 15 + random() * 8;
        colors.push(hslToHex(hue % 360, Math.max(30, Math.min(90, sat)), Math.max(15, Math.min(85, light))));
      }
      break;
    }
    
    case 'forest': {
      const greenHues = [100, 120, 140, 80, 160];
      
      for (let i = 0; i < colorCount; i++) {
        const hue = greenHues[i % greenHues.length] + random() * 20 - 10;
        const sat = 35 + random() * 40;
        const light = 20 + i * 14 + random() * 8;
        colors.push(hslToHex(Math.max(60, Math.min(180, hue)), Math.max(25, Math.min(80, sat)), Math.max(15, Math.min(80, light))));
      }
      break;
    }
    
    case 'berry': {
      const berryHues = [340, 320, 300, 280, 350];
      
      for (let i = 0; i < colorCount; i++) {
        const hue = berryHues[i] + random() * 15 - 7;
        const sat = 50 + random() * 35;
        const light = 25 + i * 13 + random() * 8;
        colors.push(hslToHex(hue % 360, Math.max(35, Math.min(90, sat)), Math.max(20, Math.min(80, light))));
      }
      break;
    }
    
    case 'split-complementary': {
      const baseHue = random() * 360;
      const hues = [
        baseHue,
        baseHue + 30,
        (baseHue + 150) % 360,
        (baseHue + 180) % 360,
        (baseHue + 210) % 360,
      ];
      
      for (let i = 0; i < colorCount; i++) {
        const hue = hues[i] + random() * 10 - 5;
        const sat = 50 + random() * 30;
        const light = 35 + random() * 35;
        colors.push(hslToHex(Math.max(0, hue % 360), Math.max(35, Math.min(85, sat)), Math.max(25, Math.min(75, light))));
      }
      break;
    }
    
    default: {
      // Fallback: simple gradient
      const hue = random() * 360;
      for (let i = 0; i < colorCount; i++) {
        colors.push(hslToHex(hue, 50 + random() * 30, 25 + i * 14));
      }
    }
  }
  
  return colors;
}

// Generate palette names
function generatePaletteName(seed: number): string {
  const random = seededRandom(seed);
  
  const prefixes = [
    "Soft", "Bold", "Muted", "Vibrant", "Deep", "Light", "Dark", "Warm", "Cool", "Fresh",
    "Calm", "Bright", "Subtle", "Rich", "Pale", "Vivid", "Gentle", "Earthy", "Pastel", "Neutral",
    "Golden", "Silver", "Rustic", "Modern", "Classic", "Vintage", "Urban", "Natural", "Tropical", "Nordic",
    "Coastal", "Desert", "Forest", "Mountain", "Ocean", "Sunset", "Sunrise", "Autumn", "Spring", "Summer",
    "Winter", "Midnight", "Dawn", "Dusk", "Twilight", "Misty", "Foggy", "Sunny", "Cloudy", "Stormy"
  ];
  
  const middles = [
    "Pink", "Rose", "Coral", "Peach", "Orange", "Gold", "Yellow", "Lime", "Green", "Mint",
    "Teal", "Cyan", "Blue", "Navy", "Indigo", "Violet", "Purple", "Magenta", "Berry", "Crimson",
    "Ruby", "Amber", "Honey", "Sage", "Olive", "Forest", "Ocean", "Sky", "Stone", "Sand",
    "Clay", "Terra", "Cocoa", "Mocha", "Latte", "Cream", "Pearl", "Opal", "Jade", "Emerald",
    "Sapphire", "Amethyst", "Topaz", "Onyx", "Ivory", "Ebony", "Bronze", "Copper", "Steel", "Chrome"
  ];
  
  const suffixes = [
    "Dream", "Bliss", "Harmony", "Serenity", "Wonder", "Magic", "Whisper", "Glow", "Shimmer", "Radiance",
    "Breeze", "Wave", "Mist", "Haze", "Spark", "Flow", "Drift", "Cascade", "Echo", "Pulse",
    "Bloom", "Flutter", "Dance", "Rise", "Fall", "Shift", "Blend", "Fusion", "Touch", "Moment",
    "Vision", "Essence", "Spirit", "Soul", "Heart", "Charm", "Grace", "Elegance", "Beauty", "Delight",
    "Joy", "Peace", "Love", "Hope", "Faith", "Trust", "Truth", "Light", "Shadow", "Reflection"
  ];
  
  const usePrefix = random() > 0.3;
  const useSuffix = random() > 0.2;
  
  let name = middles[Math.floor(random() * middles.length)];
  
  if (usePrefix) {
    name = prefixes[Math.floor(random() * prefixes.length)] + " " + name;
  }
  
  if (useSuffix) {
    name = name + " " + suffixes[Math.floor(random() * suffixes.length)];
  }
  
  return name;
}

// Generate tags based on palette colors
function generateTags(colors: string[], seed: number): string[] {
  const random = seededRandom(seed);
  const tags: string[] = [];
  
  // Analyze colors to determine tags
  const avgHue = colors.reduce((sum, color) => {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    if (max !== min) {
      const d = max - min;
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      else if (max === g) h = ((b - r) / d + 2) * 60;
      else h = ((r - g) / d + 4) * 60;
    }
    return sum + h;
  }, 0) / colors.length;
  
  const avgLight = colors.reduce((sum, color) => {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return sum + (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }, 0) / colors.length;
  
  // Hue-based tags
  if (avgHue >= 0 && avgHue < 30) tags.push("warm", "red");
  else if (avgHue >= 30 && avgHue < 60) tags.push("warm", "orange");
  else if (avgHue >= 60 && avgHue < 90) tags.push("warm", "yellow");
  else if (avgHue >= 90 && avgHue < 150) tags.push("nature", "green");
  else if (avgHue >= 150 && avgHue < 210) tags.push("cool", "cyan");
  else if (avgHue >= 210 && avgHue < 270) tags.push("cool", "blue");
  else if (avgHue >= 270 && avgHue < 330) tags.push("purple", "violet");
  else tags.push("warm", "pink");
  
  // Lightness-based tags
  if (avgLight < 0.35) tags.push("dark", "deep");
  else if (avgLight > 0.7) tags.push("light", "pastel");
  else tags.push("balanced");
  
  // Random additional tags
  const extraTags = ["modern", "classic", "elegant", "minimal", "bold", "soft", "vivid", "muted", "trendy", "timeless"];
  if (random() > 0.5) {
    tags.push(extraTags[Math.floor(random() * extraTags.length)]);
  }
  
  return [...new Set(tags)].slice(0, 4);
}

// Target: 50,000 palettes
const TARGET_PALETTE_COUNT = 50000;
const FREE_PALETTE_COUNT = 2000;

// Generate a single palette by index (on-demand generation)
function generatePaletteByIndex(index: number): Palette {
  const seed = index * 12345 + 67890;
  const colors = generateCoolorsStylePalette(seed);
  const name = generatePaletteName(seed + 11111);
  const tags = generateTags(colors, seed + 22222);
  
  return {
    id: String(index + 1),
    name,
    colors,
    tags,
    isFree: index < FREE_PALETTE_COUNT
  };
}

// Cache for generated palettes (sparse array for on-demand generation)
const _paletteCache: Map<number, Palette> = new Map();

// Get a palette by index with caching
function getPaletteByIndex(index: number): Palette {
  if (!_paletteCache.has(index)) {
    _paletteCache.set(index, generatePaletteByIndex(index));
  }
  return _paletteCache.get(index)!;
}

// Generate palettes for a range (for pagination)
function getPalettesInRange(start: number, end: number): Palette[] {
  const palettes: Palette[] = [];
  for (let i = start; i < Math.min(end, TARGET_PALETTE_COUNT); i++) {
    palettes.push(getPaletteByIndex(i));
  }
  return palettes;
}

// For backwards compatibility - generates all palettes (use sparingly)
export function getAllPalettes(): Palette[] {
  return getPalettesInRange(0, TARGET_PALETTE_COUNT);
}

// For backwards compatibility - avoid using, prefer paginated functions
export const presetPalettes: Palette[] = [];

export function getRandomPalette(): string[] {
  // Generate a random palette from the free range without loading all palettes
  const randomIndex = Math.floor(Math.random() * FREE_PALETTE_COUNT);
  const palette = getPaletteByIndex(randomIndex);
  return [...palette.colors];
}

export function generateRandomColors(count: number = 5): string[] {
  return generateCoolorsStylePalette(Date.now());
}

export function searchPalettes(query: string, showProOnly: boolean = false): Palette[] {
  const maxIndex = showProOnly ? TARGET_PALETTE_COUNT : FREE_PALETTE_COUNT;
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) {
    return getPalettesInRange(0, maxIndex);
  }
  
  const results: Palette[] = [];
  for (let i = 0; i < maxIndex; i++) {
    const palette = getPaletteByIndex(i);
    if (palette.name.toLowerCase().includes(lowerQuery) ||
        palette.tags.some(tag => tag.includes(lowerQuery))) {
      results.push(palette);
    }
  }
  return results;
}

export function getFreePalettes(): Palette[] {
  return getPalettesInRange(0, FREE_PALETTE_COUNT);
}

export function getFreePalettesPaginated(page: number, pageSize: number = 50): { palettes: Palette[], hasMore: boolean, total: number } {
  const start = page * pageSize;
  const end = Math.min(start + pageSize, FREE_PALETTE_COUNT);
  return {
    palettes: getPalettesInRange(start, end),
    hasMore: end < FREE_PALETTE_COUNT,
    total: FREE_PALETTE_COUNT
  };
}

// Plan-based scroll limits (how many can be loaded via infinite scroll)
const planScrollLimits: Record<string, number> = {
  free: 2000,
  pro: 10000,
  ultra: 25000,
  individual: 50000,
};

// Search all palettes (generates on-demand as needed)
export function searchAllPalettes(query: string): Palette[] {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return [];
  
  const results: Palette[] = [];
  for (let i = 0; i < TARGET_PALETTE_COUNT; i++) {
    const palette = getPaletteByIndex(i);
    if (palette.name.toLowerCase().includes(lowerQuery) ||
        palette.tags.some(tag => tag.includes(lowerQuery))) {
      results.push(palette);
    }
  }
  return results;
}

export function getPalettesByPlan(plan: string, page: number, pageSize: number = 50): { palettes: Palette[], hasMore: boolean, total: number } {
  const scrollLimit = planScrollLimits[plan] || planScrollLimits.free;
  const start = page * pageSize;
  const end = Math.min(start + pageSize, scrollLimit);
  return {
    palettes: getPalettesInRange(start, end),
    hasMore: end < scrollLimit,
    total: scrollLimit
  };
}

export { hslToHex };
