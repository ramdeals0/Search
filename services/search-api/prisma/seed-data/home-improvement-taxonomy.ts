export type AttributeTemplateKey =
  | "power_tool"
  | "hand_tool"
  | "hardware"
  | "lumber"
  | "building_material"
  | "plumbing"
  | "electrical"
  | "lighting"
  | "paint"
  | "flooring"
  | "kitchen"
  | "bath"
  | "appliance"
  | "hvac"
  | "lawn_garden"
  | "outdoor_power"
  | "storage"
  | "smart_home"
  | "safety";

export interface LeafCategory {
  id: string;
  department: string;
  category: string;
  subcategory: string;
  productType: string;
  attributeTemplate: AttributeTemplateKey;
  priceRange: [number, number];
  contractorOriented?: boolean;
  seasonal?: boolean;
  diyFriendly?: boolean;
}

export const HOME_IMPROVEMENT_TAXONOMY: LeafCategory[] = [
  { id: "leaf-cordless-drills", department: "Power Tools", category: "Drills", subcategory: "Cordless Drills", productType: "Drill/Driver", attributeTemplate: "power_tool", priceRange: [79, 399], contractorOriented: true, diyFriendly: true },
  { id: "leaf-impact-drivers", department: "Power Tools", category: "Drills", subcategory: "Impact Drivers", productType: "Impact Driver", attributeTemplate: "power_tool", priceRange: [69, 349], contractorOriented: true },
  { id: "leaf-circular-saws", department: "Power Tools", category: "Saws", subcategory: "Circular Saws", productType: "Circular Saw", attributeTemplate: "power_tool", priceRange: [59, 279], contractorOriented: true },
  { id: "leaf-shop-vacs", department: "Power Tools", category: "Vacuums", subcategory: "Shop Vacuums", productType: "Wet/Dry Vac", attributeTemplate: "power_tool", priceRange: [49, 249], diyFriendly: true },
  { id: "leaf-hammers", department: "Hand Tools", category: "Striking", subcategory: "Hammers", productType: "Claw Hammer", attributeTemplate: "hand_tool", priceRange: [12, 45], diyFriendly: true },
  { id: "leaf-screwdriver-sets", department: "Hand Tools", category: "Drivers", subcategory: "Screwdriver Sets", productType: "Screwdriver Set", attributeTemplate: "hand_tool", priceRange: [10, 65], diyFriendly: true },
  { id: "leaf-socket-sets", department: "Hand Tools", category: "Mechanics", subcategory: "Socket Sets", productType: "Socket Set", attributeTemplate: "hand_tool", priceRange: [25, 180], contractorOriented: true },
  { id: "leaf-fasteners", department: "Hardware", category: "Fasteners", subcategory: "Screws", productType: "Drywall Screws", attributeTemplate: "hardware", priceRange: [6, 38], contractorOriented: true },
  { id: "leaf-anchors", department: "Hardware", category: "Anchors", subcategory: "Wall Anchors", productType: "Toggle Anchor", attributeTemplate: "hardware", priceRange: [5, 32], diyFriendly: true },
  { id: "leaf-dimension-lumber", department: "Lumber & Composites", category: "Framing Lumber", subcategory: "Dimensional Lumber", productType: "2x4 Stud", attributeTemplate: "lumber", priceRange: [4, 18], contractorOriented: true },
  { id: "leaf-plywood", department: "Lumber & Composites", category: "Panels", subcategory: "Plywood", productType: "Sheathing Panel", attributeTemplate: "lumber", priceRange: [28, 95], contractorOriented: true },
  { id: "leaf-drywall", department: "Building Materials", category: "Drywall", subcategory: "Panels", productType: "Drywall Sheet", attributeTemplate: "building_material", priceRange: [12, 24], contractorOriented: true },
  { id: "leaf-insulation", department: "Building Materials", category: "Insulation", subcategory: "Fiberglass Batts", productType: "R-13 Batt", attributeTemplate: "building_material", priceRange: [18, 65], contractorOriented: true },
  { id: "leaf-kitchen-faucets", department: "Plumbing", category: "Kitchen Faucets", subcategory: "Pull-Down Faucets", productType: "Pull-Down Faucet", attributeTemplate: "plumbing", priceRange: [89, 389], diyFriendly: true },
  { id: "leaf-toilet-parts", department: "Plumbing", category: "Toilets", subcategory: "Repair Parts", productType: "Flange Kit", attributeTemplate: "plumbing", priceRange: [8, 45], contractorOriented: true },
  { id: "leaf-pvc-fittings", department: "Plumbing", category: "Pipe & Fittings", subcategory: "PVC Fittings", productType: "Elbow Fitting", attributeTemplate: "plumbing", priceRange: [2, 18], contractorOriented: true },
  { id: "leaf-gfci-outlets", department: "Electrical", category: "Outlets", subcategory: "GFCI Outlets", productType: "GFCI Outlet", attributeTemplate: "electrical", priceRange: [14, 38], contractorOriented: true, diyFriendly: true },
  { id: "leaf-breaker-panels", department: "Electrical", category: "Panels", subcategory: "Load Centers", productType: "Breaker Panel", attributeTemplate: "electrical", priceRange: [89, 349], contractorOriented: true },
  { id: "leaf-extension-cords", department: "Electrical", category: "Cords", subcategory: "Extension Cords", productType: "Outdoor Extension Cord", attributeTemplate: "electrical", priceRange: [18, 85], diyFriendly: true },
  { id: "leaf-ceiling-fans", department: "Lighting & Ceiling Fans", category: "Ceiling Fans", subcategory: "Indoor Fans", productType: "Ceiling Fan", attributeTemplate: "lighting", priceRange: [79, 399], diyFriendly: true },
  { id: "leaf-led-bulbs", department: "Lighting & Ceiling Fans", category: "Bulbs", subcategory: "LED Bulbs", productType: "A19 LED Bulb", attributeTemplate: "lighting", priceRange: [4, 28], diyFriendly: true },
  { id: "leaf-shop-lights", department: "Lighting & Ceiling Fans", category: "Work Lighting", subcategory: "Shop Lights", productType: "LED Shop Light", attributeTemplate: "lighting", priceRange: [24, 129], contractorOriented: true },
  { id: "leaf-interior-paint", department: "Paint", category: "Interior Paint", subcategory: "Wall Paint", productType: "Interior Paint", attributeTemplate: "paint", priceRange: [24, 68], diyFriendly: true },
  { id: "leaf-exterior-paint", department: "Paint", category: "Exterior Paint", subcategory: "House Paint", productType: "Exterior Paint", attributeTemplate: "paint", priceRange: [32, 78], seasonal: true },
  { id: "leaf-primer", department: "Paint", category: "Primers", subcategory: "Multi-Surface Primer", productType: "Primer", attributeTemplate: "paint", priceRange: [18, 42], diyFriendly: true },
  { id: "leaf-vinyl-flooring", department: "Flooring", category: "Vinyl", subcategory: "Luxury Vinyl Plank", productType: "LVP Plank", attributeTemplate: "flooring", priceRange: [1.5, 4.5], contractorOriented: true },
  { id: "leaf-kitchen-sinks", department: "Kitchen", category: "Sinks", subcategory: "Stainless Sinks", productType: "Undermount Sink", attributeTemplate: "kitchen", priceRange: [129, 499], diyFriendly: true },
  { id: "leaf-bath-vanities", department: "Bath", category: "Vanities", subcategory: "Single Sink Vanities", productType: "Bath Vanity", attributeTemplate: "bath", priceRange: [199, 899], diyFriendly: true },
  { id: "leaf-refrigerators", department: "Appliances", category: "Refrigeration", subcategory: "French Door Fridges", productType: "Refrigerator", attributeTemplate: "appliance", priceRange: [999, 2899], diyFriendly: true },
  { id: "leaf-portable-ac", department: "Heating, Venting & Cooling", category: "Air Conditioners", subcategory: "Portable AC", productType: "Portable AC", attributeTemplate: "hvac", priceRange: [299, 699], seasonal: true },
  { id: "leaf-smoke-detectors", department: "Heating, Venting & Cooling", category: "Safety Devices", subcategory: "Smoke Detectors", productType: "Smoke Detector", attributeTemplate: "hvac", priceRange: [18, 65], diyFriendly: true },
  { id: "leaf-mulch", department: "Lawn & Garden", category: "Mulch & Soil", subcategory: "Mulch", productType: "Hardwood Mulch", attributeTemplate: "lawn_garden", priceRange: [3, 8], seasonal: true, diyFriendly: true },
  { id: "leaf-string-trimmers", department: "Outdoor Power Equipment", category: "Trimmers", subcategory: "String Trimmers", productType: "String Trimmer", attributeTemplate: "outdoor_power", priceRange: [89, 329], seasonal: true, diyFriendly: true },
  { id: "leaf-pressure-washers", department: "Outdoor Power Equipment", category: "Pressure Washers", subcategory: "Gas Pressure Washers", productType: "Pressure Washer", attributeTemplate: "outdoor_power", priceRange: [249, 699], seasonal: true },
  { id: "leaf-lawn-mowers", department: "Outdoor Power Equipment", category: "Mowers", subcategory: "Battery Mowers", productType: "Battery Lawn Mower", attributeTemplate: "outdoor_power", priceRange: [299, 699], seasonal: true, diyFriendly: true },
  { id: "leaf-storage-racks", department: "Storage & Organization", category: "Garage Storage", subcategory: "Wall Racks", productType: "Wall Storage Rack", attributeTemplate: "storage", priceRange: [39, 189], diyFriendly: true },
  { id: "leaf-smart-thermostats", department: "Smart Home", category: "Climate", subcategory: "Thermostats", productType: "Smart Thermostat", attributeTemplate: "smart_home", priceRange: [79, 249], diyFriendly: true },
  { id: "leaf-work-gloves", department: "Safety & Workwear", category: "Gloves", subcategory: "Work Gloves", productType: "Impact Gloves", attributeTemplate: "safety", priceRange: [12, 45], contractorOriented: true },
  { id: "leaf-safety-glasses", department: "Safety & Workwear", category: "Eye Protection", subcategory: "Safety Glasses", productType: "Safety Glasses", attributeTemplate: "safety", priceRange: [8, 28], contractorOriented: true, diyFriendly: true },
];

export const SEARCH_VOCABULARY = [
  "drill",
  "cordless drill",
  "impact driver",
  "shop vac",
  "ceiling fan",
  "mulch",
  "toilet flange",
  "GFCI outlet",
  "primer",
  "weed trimmer",
  "stud finder",
  "paint sprayer",
  "smoke detector",
  "drywall screws",
  "pressure washer",
  "table saw",
  "extension cord",
  "breaker box",
  "wet dry vacuum",
  "string trimmer",
] as const;

export function getLeafCategoryById(id: string): LeafCategory | undefined {
  return HOME_IMPROVEMENT_TAXONOMY.find((leaf) => leaf.id === id);
}

export function listDepartments(): string[] {
  return [...new Set(HOME_IMPROVEMENT_TAXONOMY.map((leaf) => leaf.department))];
}
