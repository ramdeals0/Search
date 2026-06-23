import {
  HOME_IMPROVEMENT_TAXONOMY,
  type LeafCategory,
} from "./home-improvement-taxonomy.js";

/**
 * Additional leaf categories modeled on FleetFarm.com department navigation
 * (Hunting & Shooting accessories, Fishing, Farm & Livestock, Pets, Automotive, etc.).
 */
export const FLEET_FARM_EXTRA_LEAVES: LeafCategory[] = [
  { id: "leaf-ff-rifle-scopes", department: "Hunting & Shooting", category: "Optics", subcategory: "Rifle Scopes", productType: "Rifle Scope", attributeTemplate: "sporting_outdoor", priceRange: [89, 599], seasonal: true },
  { id: "leaf-ff-binoculars", department: "Hunting & Shooting", category: "Optics", subcategory: "Binoculars", productType: "Hunting Binoculars", attributeTemplate: "sporting_outdoor", priceRange: [49, 349], seasonal: true },
  { id: "leaf-ff-game-cameras", department: "Hunting & Shooting", category: "Game Cameras", subcategory: "Trail Cameras", productType: "Trail Camera", attributeTemplate: "sporting_outdoor", priceRange: [79, 299], seasonal: true },
  { id: "leaf-ff-archery-targets", department: "Hunting & Shooting", category: "Archery", subcategory: "Targets", productType: "Archery Target", attributeTemplate: "sporting_outdoor", priceRange: [24, 149], seasonal: true },
  { id: "leaf-ff-shooting-safety", department: "Hunting & Shooting", category: "Firearm Accessories", subcategory: "Shooting Safety", productType: "Shooting Ear Protection", attributeTemplate: "safety", priceRange: [12, 89], seasonal: true },
  { id: "leaf-ff-ammo-storage", department: "Hunting & Shooting", category: "Ammunition", subcategory: "Ammunition Storage", productType: "Ammo Can", attributeTemplate: "sporting_outdoor", priceRange: [8, 45], seasonal: true },
  { id: "leaf-ff-deer-attractant", department: "Hunting & Shooting", category: "Food Plots & Feeding", subcategory: "Deer Attractants", productType: "Deer Attractant Block", attributeTemplate: "farm_livestock", priceRange: [6, 28], seasonal: true },
  { id: "leaf-ff-fishing-rods", department: "Fishing", category: "Rods", subcategory: "Spinning Rods", productType: "Spinning Rod", attributeTemplate: "fishing", priceRange: [29, 189], seasonal: true },
  { id: "leaf-ff-fishing-reels", department: "Fishing", category: "Reels", subcategory: "Spinning Reels", productType: "Spinning Reel", attributeTemplate: "fishing", priceRange: [24, 249], seasonal: true },
  { id: "leaf-ff-tackle-boxes", department: "Fishing", category: "Tackle Storage", subcategory: "Tackle Boxes", productType: "Tackle Box", attributeTemplate: "fishing", priceRange: [12, 79], seasonal: true },
  { id: "leaf-ff-fishing-line", department: "Fishing", category: "Line", subcategory: "Monofilament Line", productType: "Fishing Line", attributeTemplate: "fishing", priceRange: [5, 32], seasonal: true },
  { id: "leaf-ff-live-bait", department: "Fishing", category: "Bait", subcategory: "Live Bait Supplies", productType: "Bait Bucket", attributeTemplate: "fishing", priceRange: [8, 45], seasonal: true },
  { id: "leaf-ff-ice-fishing", department: "Fishing", category: "Ice Fishing", subcategory: "Ice Augers", productType: "Ice Auger", attributeTemplate: "fishing", priceRange: [89, 449], seasonal: true },
  { id: "leaf-ff-cattle-feed", department: "Farm & Livestock", category: "Cattle", subcategory: "Cattle Feed", productType: "Cattle Mineral Block", attributeTemplate: "farm_livestock", priceRange: [18, 65], contractorOriented: true },
  { id: "leaf-ff-poultry-feed", department: "Farm & Livestock", category: "Poultry", subcategory: "Chicken Feed", productType: "Layer Pellets", attributeTemplate: "farm_livestock", priceRange: [14, 48], contractorOriented: true },
  { id: "leaf-ff-horse-feed", department: "Farm & Livestock", category: "Horse", subcategory: "Horse Feed", productType: "Horse Feed Pellets", attributeTemplate: "farm_livestock", priceRange: [18, 55], contractorOriented: true },
  { id: "leaf-ff-livestock-fencing", department: "Farm & Livestock", category: "Fencing", subcategory: "Electric Fencing", productType: "Electric Fence Charger", attributeTemplate: "farm_livestock", priceRange: [49, 299], contractorOriented: true },
  { id: "leaf-ff-hay-bales", department: "Farm & Livestock", category: "Hay & Bedding", subcategory: "Grass Hay", productType: "Grass Hay Bale", attributeTemplate: "farm_livestock", priceRange: [8, 22], seasonal: true },
  { id: "leaf-ff-farm-gates", department: "Farm & Livestock", category: "Gates & Panels", subcategory: "Tube Gates", productType: "Tube Gate", attributeTemplate: "farm_livestock", priceRange: [79, 249], contractorOriented: true },
  { id: "leaf-ff-tractor-hydraulic", department: "Farm & Livestock", category: "Farm Implements", subcategory: "Hydraulic Fluid", productType: "Hydraulic Fluid", attributeTemplate: "automotive", priceRange: [18, 68], contractorOriented: true },
  { id: "leaf-ff-dog-food", department: "Pets & Wild Bird", category: "Dog", subcategory: "Dry Dog Food", productType: "Dry Dog Food", attributeTemplate: "pet_supply", priceRange: [12, 58], diyFriendly: true },
  { id: "leaf-ff-cat-food", department: "Pets & Wild Bird", category: "Cat", subcategory: "Dry Cat Food", productType: "Dry Cat Food", attributeTemplate: "pet_supply", priceRange: [8, 42], diyFriendly: true },
  { id: "leaf-ff-wild-bird-seed", department: "Pets & Wild Bird", category: "Wild Bird", subcategory: "Bird Seed", productType: "Wild Bird Seed Mix", attributeTemplate: "pet_supply", priceRange: [6, 28], seasonal: true, diyFriendly: true },
  { id: "leaf-ff-pet-bedding", department: "Pets & Wild Bird", category: "Small Animal", subcategory: "Bedding", productType: "Small Animal Bedding", attributeTemplate: "pet_supply", priceRange: [8, 32], diyFriendly: true },
  { id: "leaf-ff-dog-treats", department: "Pets & Wild Bird", category: "Dog", subcategory: "Dog Treats", productType: "Dog Training Treats", attributeTemplate: "pet_supply", priceRange: [5, 24], diyFriendly: true },
  { id: "leaf-ff-motor-oil", department: "Tires & Automotive", category: "Automotive Maintenance", subcategory: "Motor Oil", productType: "Synthetic Motor Oil", attributeTemplate: "automotive", priceRange: [22, 48], diyFriendly: true },
  { id: "leaf-ff-oil-filters", department: "Tires & Automotive", category: "Automotive Maintenance", subcategory: "Oil Filters", productType: "Oil Filter", attributeTemplate: "automotive", priceRange: [6, 18], diyFriendly: true },
  { id: "leaf-ff-farm-batteries", department: "Tires & Automotive", category: "Batteries", subcategory: "Truck & Farm Batteries", productType: "Farm Battery", attributeTemplate: "automotive", priceRange: [89, 219], contractorOriented: true },
  { id: "leaf-ff-wiper-blades", department: "Tires & Automotive", category: "Automotive Replacement Parts", subcategory: "Wiper Blades", productType: "Wiper Blade Set", attributeTemplate: "automotive", priceRange: [12, 38], diyFriendly: true },
  { id: "leaf-ff-tire-chains", department: "Tires & Automotive", category: "Tires", subcategory: "Tire Chains", productType: "Tire Chain Set", attributeTemplate: "automotive", priceRange: [49, 189], seasonal: true },
  { id: "leaf-ff-trailer-hitches", department: "Tires & Automotive", category: "Trailers & Towing", subcategory: "Hitches", productType: "Trailer Hitch", attributeTemplate: "automotive", priceRange: [79, 349], contractorOriented: true },
  { id: "leaf-ff-carhartt-jacket", department: "Clothing & Footwear", category: "Men's Clothing", subcategory: "Workwear", productType: "Insulated Work Jacket", attributeTemplate: "workwear", priceRange: [89, 199], seasonal: true },
  { id: "leaf-ff-work-boots", department: "Clothing & Footwear", category: "Men's Footwear", subcategory: "Work Boots", productType: "Steel Toe Work Boot", attributeTemplate: "workwear", priceRange: [79, 219], contractorOriented: true },
  { id: "leaf-ff-jeans", department: "Clothing & Footwear", category: "Men's Clothing", subcategory: "Jeans", productType: "Relaxed Fit Jeans", attributeTemplate: "workwear", priceRange: [29, 59], diyFriendly: true },
  { id: "leaf-ff-base-layers", department: "Clothing & Footwear", category: "Men's Clothing", subcategory: "Base Layers", productType: "Thermal Base Layer Top", attributeTemplate: "workwear", priceRange: [18, 48], seasonal: true },
  { id: "leaf-ff-winter-gloves", department: "Clothing & Footwear", category: "Gloves", subcategory: "Winter Gloves", productType: "Insulated Work Gloves", attributeTemplate: "workwear", priceRange: [12, 38], seasonal: true },
  { id: "leaf-ff-snacks", department: "Grocery & Snacks", category: "Snacks", subcategory: "Jerky & Meat Snacks", productType: "Beef Jerky", attributeTemplate: "grocery", priceRange: [4, 18], diyFriendly: true },
  { id: "leaf-ff-candy", department: "Grocery & Snacks", category: "Candy", subcategory: "Bagged Candy", productType: "Candy Mix", attributeTemplate: "grocery", priceRange: [3, 12], diyFriendly: true },
  { id: "leaf-ff-popcorn", department: "Grocery & Snacks", category: "Snacks", subcategory: "Popcorn", productType: "Microwave Popcorn", attributeTemplate: "grocery", priceRange: [3, 9], diyFriendly: true },
  { id: "leaf-ff-bottled-water", department: "Grocery & Snacks", category: "Beverages", subcategory: "Water", productType: "Bottled Water Pack", attributeTemplate: "grocery", priceRange: [4, 12], diyFriendly: true },
  { id: "leaf-ff-yeti-cooler", department: "Sporting Goods", category: "Coolers", subcategory: "Hard Coolers", productType: "Rotomolded Cooler", attributeTemplate: "sporting_outdoor", priceRange: [199, 449], seasonal: true },
  { id: "leaf-ff-camping-chair", department: "Sporting Goods", category: "Camping", subcategory: "Chairs", productType: "Camping Chair", attributeTemplate: "sporting_outdoor", priceRange: [19, 89], seasonal: true },
  { id: "leaf-ff-bike-helmet", department: "Sporting Goods", category: "Biking", subcategory: "Helmets", productType: "Bike Helmet", attributeTemplate: "sporting_outdoor", priceRange: [24, 89], diyFriendly: true },
  { id: "leaf-ff-exercise-weights", department: "Sporting Goods", category: "Fitness", subcategory: "Weights", productType: "Dumbbell Set", attributeTemplate: "sporting_outdoor", priceRange: [29, 149], diyFriendly: true },
  { id: "leaf-ff-snow-blower", department: "Outdoor Power Equipment", category: "Snow Removal", subcategory: "Snow Blowers", productType: "Two-Stage Snow Blower", attributeTemplate: "outdoor_power", priceRange: [699, 1499], seasonal: true, contractorOriented: true },
  { id: "leaf-ff-chainsaw", department: "Outdoor Power Equipment", category: "Chainsaws", subcategory: "Gas Chainsaws", productType: "Gas Chainsaw", attributeTemplate: "outdoor_power", priceRange: [199, 499], seasonal: true },
  { id: "leaf-ff-salt-spreader", department: "Farm & Livestock", category: "Farm Supplies", subcategory: "Salt Spreaders", productType: "Tow-Behind Spreader", attributeTemplate: "farm_livestock", priceRange: [149, 399], seasonal: true },
  { id: "leaf-ff-ice-melt", department: "Home Improvement", category: "Ice Melt", subcategory: "Rock Salt", productType: "Ice Melt Pellets", attributeTemplate: "building_material", priceRange: [8, 22], seasonal: true },
  { id: "leaf-ff-propane", department: "Farm & Livestock", category: "Farm Supplies", subcategory: "Propane Accessories", productType: "Propane Tank", attributeTemplate: "farm_livestock", priceRange: [45, 89], contractorOriented: true },
  { id: "leaf-ff-heated-water", department: "Farm & Livestock", category: "Livestock Watering", subcategory: "Heated Buckets", productType: "Heated Water Bucket", attributeTemplate: "farm_livestock", priceRange: [39, 89], seasonal: true },
  { id: "leaf-ff-fleet-farm-exclusive", department: "Fleet Farm Brands", category: "Exclusive Brands", subcategory: "Farm & Ranch", productType: "Fleet Farm Exclusive Supply", attributeTemplate: "farm_livestock", priceRange: [8, 45], contractorOriented: true },
];

export const FLEET_FARM_TAXONOMY: LeafCategory[] = [
  ...HOME_IMPROVEMENT_TAXONOMY,
  ...FLEET_FARM_EXTRA_LEAVES,
];

export function getFleetFarmLeafById(id: string): LeafCategory | undefined {
  return FLEET_FARM_TAXONOMY.find((leaf) => leaf.id === id);
}
