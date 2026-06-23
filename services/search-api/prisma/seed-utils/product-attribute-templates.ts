import type {
  AttributeTemplateKey,
  LeafCategory,
} from "../seed-data/home-improvement-taxonomy.js";
import { LEAF_SEARCH_KEYWORDS } from "../seed-data/product-templates.js";
import { FLEET_FARM_LEAF_KEYWORDS } from "../seed-data/fleet-farm-product-templates.js";
import type { SyntheticBrand } from "../seed-data/brands.js";
import type { SeededRng } from "./random.js";

export interface ProductCopyBundle {
  specs: Record<string, string | number | boolean>;
  shortDescription: string;
  longDescription: string;
  description: string;
  aiSearchBlurb: string;
  useCases: string[];
  searchCriteria: string[];
  features: string[];
}

export interface HeroCopyInput {
  title: string;
  brand: string;
  shortDescription: string;
  longDescription: string;
  keywords: string[];
  specs: Record<string, string | number | boolean>;
  isContractorGrade?: boolean;
  isSeasonal?: boolean;
}

function specSummary(specs: Record<string, string | number | boolean>): string {
  return Object.entries(specs)
    .slice(0, 8)
    .map(([key, value]) => `${key.replace(/([A-Z])/g, " $1").trim()} ${value}`)
    .join(", ");
}

function formatCategoryPath(leaf: LeafCategory): string {
  return `${leaf.department} > ${leaf.category} > ${leaf.subcategory}`;
}

const TEMPLATE_SHOPPER_PHRASES: Record<AttributeTemplateKey, string[]> = {
  power_tool: [
    "cordless power tool",
    "battery powered tool",
    "job site drill",
    "home workshop tool",
    "driver bit compatible",
  ],
  hand_tool: [
    "hand tool",
    "toolbox essential",
    "home repair tool",
    "trade quality hand tool",
  ],
  hardware: [
    "fastener pack",
    "mounting hardware",
    "construction fasteners",
    "project hardware kit",
  ],
  lumber: [
    "framing lumber",
    "construction lumber",
    "wood stud",
    "outdoor rated lumber",
  ],
  building_material: [
    "building supplies",
    "remodel material",
    "construction panel",
    "insulation and drywall supplies",
  ],
  plumbing: [
    "plumbing fixture",
    "bath and kitchen plumbing",
    "water supply upgrade",
    "leak repair parts",
  ],
  electrical: [
    "electrical supply",
    "wiring upgrade",
    "outlet and switch parts",
    "home electrical code compliance",
  ],
  lighting: [
    "light fixture",
    "home lighting upgrade",
    "energy efficient lighting",
    "room lighting refresh",
  ],
  paint: [
    "paint and primer",
    "wall coating",
    "interior refresh paint",
    "project finishing supplies",
  ],
  flooring: [
    "floor covering",
    "waterproof flooring",
    "click lock flooring",
    "room flooring update",
  ],
  kitchen: [
    "kitchen upgrade",
    "sink and faucet install",
    "cabinet area refresh",
    "countertop companion product",
  ],
  bath: [
    "bathroom remodel",
    "vanity upgrade",
    "bath refresh",
    "guest bath update",
  ],
  appliance: [
    "major appliance",
    "kitchen appliance replacement",
    "energy efficient appliance",
    "move in ready appliance",
  ],
  hvac: [
    "home comfort",
    "climate control",
    "safety and ventilation",
    "seasonal heating and cooling",
  ],
  lawn_garden: [
    "yard care",
    "landscape supplies",
    "curb appeal project",
    "garden bed maintenance",
  ],
  outdoor_power: [
    "yard power equipment",
    "outdoor cleanup tool",
    "lawn and landscape equipment",
    "seasonal yard maintenance",
  ],
  storage: [
    "garage organization",
    "workshop storage",
    "tool storage solution",
    "utility room organization",
  ],
  smart_home: [
    "connected home device",
    "smart home upgrade",
    "Wi-Fi home automation",
    "remote control home product",
  ],
  safety: [
    "job site safety",
    "PPE gear",
    "workshop protection",
    "ANSI rated safety gear",
  ],
  pet_supply: ["dog food", "cat food", "pet treats", "wild bird seed"],
  farm_livestock: ["livestock feed", "cattle mineral", "poultry feed", "farm fencing"],
  automotive: ["motor oil", "oil filter", "car battery", "trailer hitch"],
  fishing: ["fishing rod", "spinning reel", "tackle box", "fishing line"],
  workwear: ["work boots", "carhartt jacket", "work jeans", "insulated bibs"],
  grocery: ["beef jerky", "snack mix", "bottled water", "candy"],
  sporting_outdoor: ["trail camera", "rifle scope", "cooler", "camping gear"],
};

function buildFeatureList(input: {
  leaf: LeafCategory;
  specs: Record<string, string | number | boolean>;
  useCases: string[];
}): string[] {
  const specFeatures = Object.entries(input.specs)
    .filter(([key]) => !["productType", "department", "category", "subcategory"].includes(key))
    .slice(0, 8)
    .map(([key, value]) => `${key.replace(/([A-Z])/g, " $1").trim()}: ${value}`);
  const useCaseFeatures = input.useCases.slice(0, 3).map((useCase) => `Built for ${useCase}`);
  return [
    `Fleet Farm ${input.leaf.department} assortment`,
    `Category: ${input.leaf.category} > ${input.leaf.subcategory}`,
    ...specFeatures,
    ...useCaseFeatures,
  ];
}

function buildAiSearchBlurb(input: {
  title: string;
  brand: SyntheticBrand | { name: string };
  leaf: LeafCategory;
  shortDescription: string;
  longDescription: string;
  useCases: string[];
  searchCriteria: string[];
  specs: Record<string, string | number | boolean>;
  variantSuffix?: string;
}): string {
  const shopperPhrases = TEMPLATE_SHOPPER_PHRASES[input.leaf.attributeTemplate] ?? [];
  const alternateNames = [
    ...shopperPhrases.slice(0, 2),
    ...(LEAF_SEARCH_KEYWORDS[input.leaf.id] ?? []).slice(0, 3),
  ].filter((value, index, list) => list.indexOf(value) === index);

  return [
    input.shortDescription,
    input.longDescription,
    `Shopper-friendly terms include ${alternateNames.join(", ")}.`,
    `Common projects: ${input.useCases.join(", ")}.`,
    `Category path: ${formatCategoryPath(input.leaf)}.`,
    `Key specifications: ${specSummary(input.specs)}.`,
    input.variantSuffix
      ? `This configuration is optimized for ${input.variantSuffix.toLowerCase()} applications.`
      : undefined,
    `Related search terms: ${input.searchCriteria.slice(0, 12).join(", ")}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildSearchCriteria(input: {
  leaf: LeafCategory;
  brand: SyntheticBrand;
  specs: Record<string, string | number | boolean>;
  useCases: string[];
}): string[] {
  const fromSpecs = Object.entries(input.specs).flatMap(([key, value]) => {
    if (typeof value === "boolean") {
      return value
        ? [key.replace(/([A-Z])/g, " $1").trim().toLowerCase()]
        : [];
    }
    return [String(value)];
  });
  const leafKeywords =
    LEAF_SEARCH_KEYWORDS[input.leaf.id] ?? FLEET_FARM_LEAF_KEYWORDS[input.leaf.id] ?? [];

  return [
    input.leaf.productType.toLowerCase(),
    input.leaf.subcategory.toLowerCase(),
    input.leaf.category.toLowerCase(),
    input.leaf.department.toLowerCase(),
    input.brand.name.toLowerCase(),
    ...leafKeywords,
    ...(TEMPLATE_SHOPPER_PHRASES[input.leaf.attributeTemplate] ?? []),
    ...input.useCases.map((item) => item.toLowerCase()),
    ...fromSpecs.map((item) => item.toLowerCase()),
  ].filter((value, index, list) => value.length > 1 && list.indexOf(value) === index);
}

function generateSpecs(
  template: AttributeTemplateKey,
  leaf: LeafCategory,
  rng: SeededRng,
  extraSpecs: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  const base: Record<string, string | number | boolean> = {
    productType: leaf.productType,
    department: leaf.department,
    category: leaf.category,
    subcategory: leaf.subcategory,
    ...extraSpecs,
  };

  switch (template) {
    case "power_tool":
      return {
        ...base,
        toolType: leaf.productType,
        voltage: rng.pick(["12V", "18V", "20V", "40V", "120V"]),
        cordless: rng.bool(0.72),
        brushless: rng.bool(0.58),
        chuckSize: rng.pick(["3/8 in", "1/2 in"]),
        includedBatteries: rng.pick([0, 1, 2]),
        maxRpm: rng.pick([1200, 1800, 2400, 3200]),
      };
    case "hand_tool":
      return {
        ...base,
        handleMaterial: rng.pick(["fiberglass", "steel", "rubber overmold", "wood"]),
        headWeight: rng.pick(["8 oz", "12 oz", "16 oz", "20 oz"]),
        pieceCount: rng.pick([1, 6, 12, 20, 120]),
        driveSize: rng.pick(["1/4 in", "3/8 in", "1/2 in"]),
        gripType: rng.pick(["cushion", "anti-slip", "magnetic"]),
      };
    case "hardware":
      return {
        ...base,
        material: rng.pick(["steel", "stainless steel", "zinc", "brass"]),
        finish: rng.pick(["phosphate", "zinc plated", "black oxide", "plain"]),
        packCount: rng.pick([25, 50, 100, 250]),
        threadType: rng.pick(["coarse", "fine", "self-tapping"]),
        loadRating: rng.pick(["25 lb", "50 lb", "75 lb", "100 lb"]),
      };
    case "lumber":
      return {
        ...base,
        nominalDimensions: rng.pick(["2 in x 4 in", "2 in x 6 in", "2 in x 8 in"]),
        length: rng.pick(["8 ft", "10 ft", "12 ft", "16 ft"]),
        woodSpecies: rng.pick(["southern yellow pine", "spruce", "fir"]),
        pressureTreated: rng.bool(0.45),
        grade: rng.pick(["stud", "select", "standard"]),
      };
    case "building_material":
      return {
        ...base,
        thickness: rng.pick(["1/2 in", "5/8 in", "1 in", "2 in"]),
        panelSize: rng.pick(["4 ft x 8 ft", "4 ft x 9 ft", "16 in x 48 in"]),
        rValue: rng.pick(["R-11", "R-13", "R-19", "R-30"]),
        moistureResistant: rng.bool(0.35),
        fireRated: rng.bool(0.2),
      };
    case "plumbing":
      return {
        ...base,
        finish: rng.pick(["chrome", "brushed nickel", "matte black", "stainless"]),
        material: rng.pick(["brass", "stainless steel", "PVC", "PVD"]),
        connectionSize: rng.pick(['1/2 in', '3/4 in', "1-1/4 in", "3 in"]),
        flowRate: rng.pick(["1.2 GPM", "1.5 GPM", "1.8 GPM"]),
        watersense: rng.bool(0.55),
      };
    case "electrical":
      return {
        ...base,
        amperage: rng.pick(["15A", "20A", "30A", "100A"]),
        voltage: rng.pick(["120V", "240V"]),
        gauge: rng.pick(["14/3", "12/3", "10/3"]),
        length: rng.pick(["25 ft", "50 ft", "100 ft"]),
        tamperResistant: rng.bool(0.6),
        weatherResistant: rng.bool(0.35),
      };
    case "lighting":
      return {
        ...base,
        bulbBase: rng.pick(["E26", "E12", "GU10"]),
        lumens: rng.pick([450, 800, 1100, 4000]),
        colorTemperature: rng.pick(["2700K", "3000K", "4000K", "5000K"]),
        bladeSpan: rng.pick(["44 in", "52 in", "56 in"]),
        dampRated: rng.bool(0.4),
      };
    case "paint":
      return {
        ...base,
        sheen: rng.pick(["flat", "eggshell", "satin", "semi-gloss"]),
        containerSize: rng.pick(["1 qt", "1 gal", "5 gal"]),
        interiorExterior: rng.pick(["interior", "exterior", "multi-surface"]),
        vocLevel: rng.pick(["low-VOC", "zero-VOC"]),
        coverage: rng.pick(["350 sq ft/gal", "400 sq ft/gal"]),
      };
    case "flooring":
      return {
        ...base,
        wearLayer: rng.pick(["12 mil", "20 mil", "22 mil"]),
        coverage: rng.pick(["18 sq ft", "23.6 sq ft", "30 sq ft"]),
        waterproof: rng.bool(0.8),
        installMethod: rng.pick(["click-lock", "glue-down", "peel-and-stick"]),
        thickness: rng.pick(["5 mm", "6.5 mm", "8 mm"]),
      };
    case "kitchen":
      return {
        ...base,
        bowlConfiguration: rng.pick(["single bowl", "double bowl", "farmhouse"]),
        gauge: rng.pick(["16", "18", "20"]),
        width: rng.pick(["30 in", "33 in", "36 in"]),
        material: rng.pick(["stainless steel", "composite granite", "fireclay"]),
        mountingType: rng.pick(["undermount", "drop-in", "farmhouse apron"]),
      };
    case "bath":
      return {
        ...base,
        width: rng.pick(["24 in", "30 in", "36 in", "48 in"]),
        finish: rng.pick(["white", "gray", "espresso", "navy"]),
        topMaterial: rng.pick(["cultured marble", "quartz", "solid surface"]),
        sinkIncluded: true,
        faucetHoleSpacing: rng.pick(["4 in", "8 in"]),
      };
    case "appliance":
      return {
        ...base,
        capacity: rng.pick(["18 cu ft", "22 cu ft", "25 cu ft", "28 cu ft"]),
        fuelType: rng.pick(["electric", "gas", "dual fuel"]),
        energyStar: rng.bool(0.7),
        finish: rng.pick(["stainless steel", "black stainless", "white"]),
        width: rng.pick(["30 in", "33 in", "36 in"]),
      };
    case "hvac":
      return {
        ...base,
        btu: rng.pick(["8000 BTU", "10000 BTU", "12000 BTU", "14000 BTU"]),
        coverageArea: rng.pick(["250 sq ft", "350 sq ft", "450 sq ft"]),
        sensorType: rng.pick(["photoelectric", "ionization", "dual sensor"]),
        packCount: rng.pick([1, 2, 3]),
        smartAlerts: rng.bool(0.45),
      };
    case "lawn_garden":
      return {
        ...base,
        bagSize: rng.pick(["1 cu ft", "2 cu ft", "3 cu ft"]),
        color: rng.pick(["natural", "brown", "black", "red"]),
        organic: rng.bool(0.35),
        seasonality: rng.pick(["spring", "summer", "fall", "year-round"]),
      };
    case "outdoor_power":
      return {
        ...base,
        powerSource: rng.pick(["battery", "gas", "corded electric"]),
        cuttingWidth: rng.pick(["13 in", "21 in", "22 in"]),
        engineSize: rng.pick(["25 cc", "160 cc", "190 cc"]),
        airSpeed: rng.pick(["130 MPH", "155 MPH", "170 MPH"]),
        psi: rng.pick([1800, 2400, 3100, 3600]),
      };
    case "storage":
      return {
        ...base,
        width: rng.pick(["36 in", "48 in", "64 in", "72 in"]),
        capacity: rng.pick(["150 lb", "250 lb", "300 lb", "600 lb"]),
        tiers: rng.pick([3, 4, 5]),
        material: rng.pick(["powder-coated steel", "heavy-gauge steel", "wire"]),
        mountingType: rng.pick(["wall-mounted", "freestanding", "modular rail"]),
      };
    case "smart_home":
      return {
        ...base,
        connectivity: rng.pick(["Wi-Fi", "Z-Wave", "Matter", "Bluetooth"]),
        voiceAssistant: rng.pick(["Alexa", "Google Assistant", "Apple HomeKit"]),
        learning: rng.bool(0.55),
        energyStar: rng.bool(0.4),
        sensorCount: rng.pick([0, 1, 2, 3]),
      };
    case "safety":
      return {
        ...base,
        size: rng.pick(["S", "M", "L", "XL"]),
        ansiRated: true,
        antiFog: rng.bool(0.65),
        touchscreen: rng.bool(0.35),
        packCount: rng.pick([1, 2, 3, 6]),
      };
    case "pet_supply":
      return {
        ...base,
        animalType: rng.pick(["dog", "cat", "wild bird", "small animal"]),
        lifeStage: rng.pick(["puppy", "adult", "senior", "all life stages"]),
        bagWeight: rng.pick(["4 lb", "15 lb", "30 lb", "40 lb"]),
        flavor: rng.pick(["chicken", "beef", "salmon", "mixed"]),
        grainFree: rng.bool(0.4),
      };
    case "farm_livestock":
      return {
        ...base,
        species: rng.pick(["cattle", "horse", "poultry", "goat", "sheep"]),
        form: rng.pick(["pellets", "block", "loose mineral", "bagged feed"]),
        bagWeight: rng.pick(["40 lb", "50 lb", "80 lb"]),
        medicated: rng.bool(0.15),
        organic: rng.bool(0.2),
      };
    case "automotive":
      return {
        ...base,
        viscosity: rng.pick(["5W-30", "10W-30", "15W-40", "SAE 30"]),
        containerSize: rng.pick(["1 qt", "5 qt", "1 gal", "2 gal"]),
        synthetic: rng.bool(0.55),
        vehicleType: rng.pick(["car", "truck", "farm equipment", "ATV"]),
        coldWeatherRated: rng.bool(0.35),
      };
    case "fishing":
      return {
        ...base,
        rodLength: rng.pick(["6 ft", "6 ft 6 in", "7 ft", "7 ft 6 in"]),
        power: rng.pick(["ultralight", "medium", "medium-heavy", "heavy"]),
        lineWeight: rng.pick(["4-8 lb", "6-12 lb", "10-20 lb"]),
        species: rng.pick(["walleye", "bass", "panfish", "northern pike"]),
        freshwater: true,
      };
    case "workwear":
      return {
        ...base,
        size: rng.pick(["S", "M", "L", "XL", "2XL"]),
        material: rng.pick(["cotton duck", "denim", "polyester blend", "fleece"]),
        insulated: rng.bool(0.45),
        steelToe: rng.bool(0.35),
        waterproof: rng.bool(0.3),
      };
    case "grocery":
      return {
        ...base,
        packSize: rng.pick(["single", "6-pack", "12-pack", "family size"]),
        flavor: rng.pick(["original", "smoky", "honey", "spicy"]),
        shelfStable: true,
        midwestFavorite: true,
      };
    case "sporting_outdoor":
      return {
        ...base,
        activity: rng.pick(["hunting", "fishing", "camping", "hiking", "target shooting"]),
        weatherRated: rng.pick(["waterproof", "water-resistant", "all-season"]),
        magnification: rng.pick(["none", "3-9x40", "4-12x50", "10x42"]),
        batteryPowered: rng.bool(0.5),
      };
    default:
      return base;
  }
}

const USE_CASES_BY_TEMPLATE: Record<AttributeTemplateKey, string[]> = {
  power_tool: [
    "deck building",
    "framing",
    "cabinet installation",
    "garage workshop projects",
    "furniture assembly",
  ],
  hand_tool: [
    "home repair",
    "automotive maintenance",
    "demolition prep",
    "trim work",
    "mechanical fastening",
  ],
  hardware: [
    "drywall hanging",
    "shelf mounting",
    "deck construction",
    "cabinet installs",
    "outdoor fence builds",
  ],
  lumber: [
    "wall framing",
    "outdoor decking",
    "shed builds",
    "fencing",
    "rough carpentry",
  ],
  building_material: [
    "interior remodeling",
    "basement finishing",
    "attic insulation upgrades",
    "new construction",
    "patch and repair",
  ],
  plumbing: [
    "bathroom remodel",
    "kitchen upgrade",
    "leak repair",
    "vanity replacement",
    "toilet service",
  ],
  electrical: [
    "kitchen remodel",
    "bathroom GFCI upgrade",
    "garage wiring",
    "outdoor power",
    "panel upgrades",
  ],
  lighting: [
    "living room refresh",
    "garage lighting upgrade",
    "bedroom comfort",
    "workshop visibility",
    "energy savings retrofit",
  ],
  paint: [
    "interior room refresh",
    "exterior siding protection",
    "trim and door painting",
    "primer before wallpaper",
    "rental turnover repaint",
  ],
  flooring: [
    "basement renovation",
    "kitchen update",
    "rental property refresh",
    "waterproof mudroom install",
    "whole-home flooring project",
  ],
  kitchen: [
    "kitchen remodel",
    "sink replacement",
    "new home build",
    "countertop upgrade",
    "pantry refresh",
  ],
  bath: [
    "guest bath refresh",
    "primary bath remodel",
    "condo update",
    "vanity replacement",
    "storage upgrade",
  ],
  appliance: [
    "kitchen renovation",
    "new home move-in",
    "appliance replacement",
    "energy upgrade",
    "rental turnover",
  ],
  hvac: [
    "seasonal cooling",
    "whole-home safety",
    "bedroom comfort",
    "garage workspace cooling",
    "code compliance upgrade",
  ],
  lawn_garden: [
    "landscape beds",
    "curb appeal refresh",
    "tree and shrub care",
    "seasonal yard prep",
    "garden maintenance",
  ],
  outdoor_power: [
    "lawn maintenance",
    "driveway cleaning",
    "leaf cleanup",
    "seasonal yard work",
    "property maintenance",
  ],
  storage: [
    "garage organization",
    "workshop setup",
    "seasonal gear storage",
    "tool organization",
    "utility room tidy-up",
  ],
  smart_home: [
    "energy savings",
    "remote climate control",
    "connected home upgrade",
    "vacation home monitoring",
    "comfort automation",
  ],
  safety: [
    "job site protection",
    "DIY workshop safety",
    "construction compliance",
    "landscaping protection",
    "warehouse tasks",
  ],
  pet_supply: [
    "daily pet feeding",
    "backyard bird watching",
    "small animal care",
    "training rewards",
    "farm dog nutrition",
  ],
  farm_livestock: [
    "cattle herd nutrition",
    "horse barn feeding",
    "backyard poultry",
    "pasture management",
    "winter livestock care",
  ],
  automotive: [
    "oil change service",
    "farm truck maintenance",
    "winter driving prep",
    "trailer towing",
    "fleet vehicle upkeep",
  ],
  fishing: [
    "walleye opener",
    "bass fishing weekends",
    "ice fishing season",
    "shore fishing trips",
    "tackle organization",
  ],
  workwear: [
    "farm chores",
    "construction jobs",
    "cold weather work",
    "weekend projects",
    "warehouse shifts",
  ],
  grocery: [
    "road trip snacks",
    "hunting camp pantry",
    "job site lunch",
    "family movie night",
    "tailgate treats",
  ],
  sporting_outdoor: [
    "deer season prep",
    "camping weekends",
    "trail scouting",
    "target practice",
    "outdoor recreation",
  ],
};

export function generateProductCopy(input: {
  leaf: LeafCategory;
  brand: SyntheticBrand;
  rng: SeededRng;
  title: string;
  extraSpecs?: Record<string, string | number | boolean>;
  variantSuffix?: string;
}): ProductCopyBundle {
  const specs = generateSpecs(
    input.leaf.attributeTemplate,
    input.leaf,
    input.rng,
    input.extraSpecs ?? {},
  );
  const useCases = input.rng.shuffle(USE_CASES_BY_TEMPLATE[input.leaf.attributeTemplate]).slice(0, 4);
  const audience = input.leaf.contractorOriented ? "professional contractors" : "DIY homeowners";
  const shopperPhrases = TEMPLATE_SHOPPER_PHRASES[input.leaf.attributeTemplate] ?? [];
  const leafKeywords =
    LEAF_SEARCH_KEYWORDS[input.leaf.id] ?? FLEET_FARM_LEAF_KEYWORDS[input.leaf.id] ?? [];
  const searchCriteria = buildSearchCriteria({
    leaf: input.leaf,
    brand: input.brand,
    specs,
    useCases,
  });

  const shortDescription = input.variantSuffix
    ? `${input.brand.name} ${input.leaf.productType} configured as ${input.variantSuffix} for ${input.leaf.subcategory.toLowerCase()} projects in ${input.leaf.department.toLowerCase()}.`
    : `${input.brand.name} ${input.leaf.productType} designed for ${input.leaf.subcategory.toLowerCase()} work across ${input.leaf.department.toLowerCase()} projects.`;

  const longDescription = [
    `${input.title} is a ${input.leaf.productType.toLowerCase()} built for ${audience} tackling ${useCases.slice(0, 2).join(" and ")}.`,
    `It performs reliably in ${formatCategoryPath(input.leaf).toLowerCase()} applications and includes ${specSummary(specs)}.`,
    `Shoppers often search for this item when planning ${useCases.join(", ")} or comparing ${shopperPhrases.slice(0, 2).join(" and ")} options.`,
    leafKeywords.length > 0
      ? `Also relevant for searches like ${leafKeywords.slice(0, 4).join(", ")}.`
      : undefined,
    input.leaf.seasonal
      ? "Seasonal availability makes it a strong choice for peak spring and summer project windows."
      : "Suitable for year-round home improvement, maintenance, and trade applications.",
  ]
    .filter(Boolean)
    .join(" ");

  const aiSearchBlurb = buildAiSearchBlurb({
    title: input.title,
    brand: input.brand,
    leaf: input.leaf,
    shortDescription,
    longDescription,
    useCases,
    searchCriteria,
    specs,
    variantSuffix: input.variantSuffix,
  });

  const description = [
    shortDescription,
    longDescription,
    `Ideal for ${useCases.join(", ")}.`,
    `Specifications include ${specSummary(specs)}.`,
  ].join(" ");

  const features = buildFeatureList({ leaf: input.leaf, specs, useCases });

  return {
    specs,
    shortDescription,
    longDescription,
    description,
    aiSearchBlurb,
    useCases,
    searchCriteria,
    features,
  };
}

export function enrichHeroProductCopy(input: {
  hero: HeroCopyInput;
  leaf: LeafCategory;
}): ProductCopyBundle {
  const useCases = (
    USE_CASES_BY_TEMPLATE[input.leaf.attributeTemplate] ?? ["home improvement projects"]
  ).slice(0, 4);
  const searchCriteria = [
    ...input.hero.keywords,
    input.hero.brand.toLowerCase(),
    input.leaf.productType.toLowerCase(),
    input.leaf.subcategory.toLowerCase(),
    input.leaf.category.toLowerCase(),
    input.leaf.department.toLowerCase(),
    ...(LEAF_SEARCH_KEYWORDS[input.leaf.id] ?? []),
    ...(TEMPLATE_SHOPPER_PHRASES[input.leaf.attributeTemplate] ?? []),
    ...Object.values(input.hero.specs).map(String),
  ].filter((value, index, list) => value.length > 1 && list.indexOf(value) === index);

  const audience = input.hero.isContractorGrade
    ? "professional contractors and serious DIYers"
    : "DIY homeowners and weekend project planners";
  const shortDescription = input.hero.shortDescription;
  const longDescription = [
    input.hero.longDescription,
    `${input.hero.title} is trusted for ${useCases.slice(0, 2).join(" and ")} in the ${input.leaf.department.toLowerCase()} aisle.`,
    `Built for ${audience}, it fits ${formatCategoryPath(input.leaf).toLowerCase()} needs and includes ${specSummary(input.hero.specs)}.`,
    input.hero.keywords.length > 0
      ? `Common search phrases include ${input.hero.keywords.join(", ")}.`
      : undefined,
    input.hero.isSeasonal
      ? "Popular during seasonal project peaks when shoppers refresh yards, exteriors, or comfort systems."
      : "A dependable choice for everyday repairs, remodels, and maintenance tasks.",
  ]
    .filter(Boolean)
    .join(" ");

  const aiSearchBlurb = buildAiSearchBlurb({
    title: input.hero.title,
    brand: { name: input.hero.brand },
    leaf: input.leaf,
    shortDescription,
    longDescription,
    useCases,
    searchCriteria,
    specs: input.hero.specs,
  });

  const description = [shortDescription, longDescription].join(" ");
  const features = buildFeatureList({
    leaf: input.leaf,
    specs: input.hero.specs,
    useCases,
  });

  return {
    specs: input.hero.specs,
    shortDescription,
    longDescription,
    description,
    aiSearchBlurb,
    useCases,
    searchCriteria,
    features,
  };
}
