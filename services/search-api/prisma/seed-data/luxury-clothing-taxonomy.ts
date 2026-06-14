export interface LuxuryLeafCategory {
  id: string;
  department: string;
  subcategory: string;
  productType: string;
  priceRange: [number, number];
  keywords?: string[];
}

export const LUXURY_CLOTHING_TAXONOMY: LuxuryLeafCategory[] = [
  { id: "lux-w-dresses", department: "Women", subcategory: "Dresses", productType: "Silk Dress", priceRange: [890, 4200], keywords: ["evening", "cocktail", "gown"] },
  { id: "lux-w-tops", department: "Women", subcategory: "Tops", productType: "Silk Blouse", priceRange: [420, 1800], keywords: ["blouse", "camisole"] },
  { id: "lux-w-knit", department: "Women", subcategory: "Knitwear", productType: "Cashmere Sweater", priceRange: [650, 2400], keywords: ["cashmere", "knit"] },
  { id: "lux-w-outer", department: "Women", subcategory: "Outerwear", productType: "Wool Coat", priceRange: [1200, 5200], keywords: ["coat", "trench", "overcoat"] },
  { id: "lux-w-denim", department: "Women", subcategory: "Denim", productType: "Designer Jeans", priceRange: [380, 980], keywords: ["jeans", "denim"] },
  { id: "lux-w-skirts", department: "Women", subcategory: "Skirts", productType: "Pleated Skirt", priceRange: [520, 2100], keywords: ["skirt", "midi"] },
  { id: "lux-w-pants", department: "Women", subcategory: "Pants", productType: "Tailored Trouser", priceRange: [480, 1650], keywords: ["trouser", "pant"] },
  { id: "lux-m-shirts", department: "Men", subcategory: "Shirts", productType: "Dress Shirt", priceRange: [320, 890], keywords: ["shirt", "oxford"] },
  { id: "lux-m-knit", department: "Men", subcategory: "Knitwear", productType: "Merino Sweater", priceRange: [420, 1200], keywords: ["sweater", "knit"] },
  { id: "lux-m-outer", department: "Men", subcategory: "Outerwear", productType: "Leather Jacket", priceRange: [1800, 6800], keywords: ["jacket", "blazer"] },
  { id: "lux-m-denim", department: "Men", subcategory: "Denim", productType: "Selvedge Jeans", priceRange: [340, 920], keywords: ["jeans", "denim"] },
  { id: "lux-m-suits", department: "Men", subcategory: "Suits", productType: "Two-Piece Suit", priceRange: [2200, 8500], keywords: ["suit", "tailored"] },
  { id: "lux-m-pants", department: "Men", subcategory: "Pants", productType: "Wool Trouser", priceRange: [380, 1100], keywords: ["trouser", "chino"] },
  { id: "lux-a-handbags", department: "Accessories", subcategory: "Handbags", productType: "Leather Handbag", priceRange: [1200, 7200], keywords: ["handbag", "tote", "clutch"] },
  { id: "lux-a-shoes", department: "Accessories", subcategory: "Shoes", productType: "Leather Loafer", priceRange: [680, 2400], keywords: ["loafer", "heel", "sneaker"] },
  { id: "lux-a-jewelry", department: "Accessories", subcategory: "Jewelry", productType: "Gold Necklace", priceRange: [950, 9800], keywords: ["necklace", "bracelet", "ring"] },
  { id: "lux-a-scarves", department: "Accessories", subcategory: "Scarves", productType: "Silk Scarf", priceRange: [280, 980], keywords: ["scarf", "wrap"] },
  { id: "lux-a-sunglasses", department: "Accessories", subcategory: "Sunglasses", productType: "Acetate Sunglasses", priceRange: [320, 890], keywords: ["sunglasses", "eyewear"] },
  { id: "lux-a-belts", department: "Accessories", subcategory: "Belts", productType: "Leather Belt", priceRange: [240, 780], keywords: ["belt", "leather"] },
  { id: "lux-a-watches", department: "Accessories", subcategory: "Watches", productType: "Swiss Watch", priceRange: [2800, 18500], keywords: ["watch", "timepiece"] },
];

export function getLuxuryLeafById(id: string): LuxuryLeafCategory | undefined {
  return LUXURY_CLOTHING_TAXONOMY.find((leaf) => leaf.id === id);
}
