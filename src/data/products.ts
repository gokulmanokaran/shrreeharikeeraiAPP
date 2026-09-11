export type ProductCategory =
  | "new-arrivals"
  | "keerai"
  | "microgreens"
  | "vegetables"
  | "premium-products"
  | "cut-fruits"
  | "sprouts"
  | "fresh-juices"
  | "nuts-seeds"
  | "healthy-snacks"
  | "seasonal-exotic-fruits"
  | "mushrooms"
  | "cold-pressed-oil";

export interface ProductVariant {
  id: string; // Unique variant ID (e.g. "pomegranate-peeled-250g", "lemon-juice-with-sugar")
  name?: string; // Optional variant name override
  unit: string; // e.g. "250g", "500g", "With Sugar", "Without Sugar"
  price: number;
  inStock?: boolean;
}

export interface Product {
  id: string;
  name: string;          // English name
  nameTamil?: string;    // Tamil name (optional)
  tamilName?: string;    // Tamil name alias (optional)
  price: number;         // Default/starting price
  mrp?: number;          // Maximum Retail Price
  unit: string;          // Default/starting unit
  quantity?: string;     // Quantity descriptor
  category: ProductCategory | string;
  secondaryCategory?: ProductCategory | string;
  description?: string;
  shortDescription?: string;
  note?: string;
  image?: string;
  inStock: boolean;
  stockQuantity?: number;
  featured?: boolean;
  active?: boolean;
  sortOrder?: number;
  variantType?: "weight" | "sugar";
  variants?: ProductVariant[];
  updatedAt?: string;
}

/** Returns display label: "English / Tamil" if Tamil name is set, else just English */
export function getProductDisplayName(product: Product): string {
  if (product.nameTamil) {
    return `${product.name} / ${product.nameTamil}`;
  }
  return product.name;
}

/** Helper to create an effective cart product from a parent product and a chosen variant */
export function getVariantProduct(product: Product, variant: ProductVariant): Product {
  const isSugar = product.variantType === "sugar";
  const parentInStock =
    product.inStock !== false &&
    (product.stockQuantity === undefined || product.stockQuantity > 0);
  return {
    ...product,
    id: variant.id,
    price: variant.price,
    mrp: product.mrp,
    unit: isSugar ? `${product.unit} (${variant.unit})` : variant.unit,
    inStock: variant.inStock !== false && parentInStock,
    stockQuantity: product.stockQuantity,
  };
}

export const PRODUCTS: Product[] = [
  {
    id: "prod_mtkupkpw",
    name: "Nuts & Seeds  Laddu",
    nameTamil: "சத்து மாவு லட்டு",
    tamilName: "சத்து மாவு லட்டு",
    price: 149,
    mrp: 149,
    unit: "100g Box",
    quantity: "250g",
    category: "healthy-snacks",
    secondaryCategory: "new-arrivals",
    image: "https://res.cloudinary.com/kil3rfap/image/upload/f_auto,q_auto/ChatGPT_Image_Sep_3_2026_07_17_58_AM",
    description: "Wholesome goodness in every bite. Our Nuts & Seeds Laddu is a delicious, naturally satisfying sweet made with a nourishing blend of premium nuts and nutrient-rich seeds. Packed with the goodness of almonds, cashews, sesame, sunflower seeds, pumpkin seeds, and other wholesome ingredients, each laddu offers a delightful combination of crunch, richness, and natural sweetness.",
    inStock: true,
    stockQuantity: 25,
    featured: false,
    active: true,
    sortOrder: 0,
    variantType: "weight",
    variants: [
      {
        id: "prod_mtkupkpw_1788400752322",
        unit: "100g",
        price: 149,
        inStock: true,
      },
      {
        id: "prod_mtkupkpw_1788400821250",
        unit: "250g",
        price: 369,
        inStock: true,
      },
    ],
  },
  // ── Greens / Keerai (Fresh Cleaned Packs) ───────────────────────────────
  {
    id: "ponnangani-keerai",
    name: "Ponnangani Keerai",
    nameTamil: "பொன்னாங்கண்ணி கீரை",
    price: 49,
    unit: "250g Cleaned Pack",
    category: "keerai",
    description:
      "Fresh cleaned Ponnangani Keerai (Sessile Joyweed). Rich in iron and vitamins. Ready to cook straight from the pack.",
    image: "/product-images/ponnangani-keerai.webp",
    inStock: true,
  },
  {
    id: "palak-leaves",
    name: "Palak Leaves",
    nameTamil: "பாலக்கீரை",
    price: 53,
    unit: "250g Cleaned Pack",
    category: "keerai",
    description:
      "Freshly cleaned Palak (Spinach) leaves. Naturally rich in iron, calcium and vitamins. Ready to cook.",
    image: "/product-images/palak-leaves.webp",
    inStock: true,
  },
  {
    id: "araikeerai",
    name: "Araikeerai",
    nameTamil: "அரைக்கீரை",
    price: 47,
    unit: "250g Cleaned Pack",
    category: "keerai",
    description:
      "Tender Araikeerai (Amaranthus dubius) leaves, carefully cleaned and packed fresh. Great for kootu and poriyal.",
    image: "/product-images/araikeerai.webp",
    inStock: true,
  },
  {
    id: "thandukeerai",
    name: "Thandukeerai",
    nameTamil: "தண்டுக்கீரை",
    price: 45,
    unit: "250g Cleaned Pack",
    category: "keerai",
    description:
      "Fresh Thandukeerai with juicy stems and bright green leaves. Packed with nutrients and perfect for South Indian recipes.",
    image: "/product-images/thandukeerai.webp",
    inStock: true,
  },
  {
    id: "senkeerai",
    name: "Senkeerai",
    nameTamil: "செங்கீரை",
    price: 45,
    unit: "250g Cleaned Pack",
    category: "keerai",
    description:
      "Vibrant Senkeerai (Red Amaranth) with distinctive red-purple veins. Highly nutritious and full of natural colour.",
    image: "/product-images/senkeerai.webp",
    inStock: true,
  },
  {
    id: "murungaikeerai",
    name: "Murungaikeerai",
    nameTamil: "முருங்கைக்கீரை",
    price: 77,
    unit: "250g Cleaned Pack",
    category: "keerai",
    description:
      "Premium Murungaikeerai (Moringa / Drumstick Leaves). A superfood packed with protein, vitamins and minerals.",
    image: "/product-images/murungaikeerai.webp",
    inStock: true,
  },
  {
    id: "manathakkaali-keerai",
    name: "Manathakkaali Keerai",
    nameTamil: "மணத்தக்காளி கீரை",
    price: 49,
    unit: "250g Cleaned Pack",
    category: "keerai",
    description:
      "Fresh Manathakkaali (Black Nightshade) leaves. Traditionally used for its cooling properties and digestive benefits.",
    image: "/product-images/manathakkaali-keerai.webp",
    inStock: true,
  },
  {
    id: "paruppukeerai",
    name: "Paruppukeerai",
    nameTamil: "பருப்புக்கீரை",
    price: 49,
    unit: "250g Cleaned Pack",
    category: "keerai",
    description:
      "Tender Paruppukeerai (Tropical Amaranth) with delicate pale green leaves. Excellent for dal-based dishes.",
    image: "/product-images/paruppukeerai.webp",
    inStock: true,
  },
  {
    id: "sirukeerai",
    name: "Sirukeerai",
    nameTamil: "சிறுகீரை",
    price: 49,
    unit: "250g Cleaned Pack",
    category: "keerai",
    description:
      "Fresh Sirukeerai (Tropical Amaranth / Slender Amaranth) leaves. Mild in taste and rich in nutrients.",
    image: "/product-images/sirukeerai.webp",
    inStock: true,
  },
  {
    id: "venthayakeerai",
    name: "Venthayakeerai",
    nameTamil: "வெந்தயக்கீரை",
    price: 59,
    unit: "250g Cleaned Pack",
    category: "keerai",
    description:
      "Fresh Venthayakeerai (Fenugreek Leaves / Methi). Distinctively aromatic with a slight bitterness. Excellent for health.",
    image: "/product-images/venthayakeerai.webp",
    inStock: true,
  },
  {
    id: "puthina",
    name: "Puthina",
    nameTamil: "புதினா",
    price: 43,
    unit: "100g Pack",
    category: "keerai",
    description:
      "Fresh Puthina (Mint Leaves). Aromatic and refreshing. Perfect for chutneys, biriyani, juices and teas.",
    image: "/product-images/puthina.webp",
    inStock: true,
  },
  {
    id: "karuveppillai",
    name: "Karuveppillai",
    nameTamil: "கருவேப்பிலை",
    price: 23,
    unit: "100g Pack",
    category: "keerai",
    description:
      "Fresh Karuveppillai (Curry Leaves). An essential ingredient in South Indian cooking — aromatic and flavourful.",
    image: "/product-images/karuveppillai.webp",
    inStock: true,
  },
  {
    id: "coriander-leaves",
    name: "Coriander Leaves",
    nameTamil: "கொத்தமல்லி",
    price: 27,
    unit: "100g Pack",
    category: "keerai",
    description:
      "Fresh Coriander (Kothamalli) Leaves. Fragrant and versatile — perfect for garnishing, chutneys and cooking.",
    image: "/product-images/coriander-leaves.webp",
    inStock: true,
  },
  {
    id: "dwarf-copper-leaves",
    name: "Dwarf Copper Leaves",
    nameTamil: "சிவப்பு பொன்னாங்கண்ணிக்கீரை",
    price: 59,
    unit: "250g Cleaned Pack",
    category: "keerai",
    description:
      "Fresh cleaned Dwarf Copper Leaves (Sivappu Ponnanganni Keerai). Deep copper-red leaves rich in antioxidants and iron. Ready to cook.",
    image: "/product-images/dwarf-copper-leaves.webp",
    inStock: true,
  },

  // ── Microgreens (40g Packs) ──────────────────────────────────────────────
  {
    id: "methi-microgreens",
    name: "Methi",
    nameTamil: "வெந்தயக் கீரை",
    price: 79,
    unit: "40g Pack",
    category: "microgreens",
    description:
      "Fresh tender Methi (Fenugreek) microgreens packed in a 40g container. Loaded with vital enzymes, minerals, and rich aroma.",
    image: "/product-images/methi-microgreens.webp",
    inStock: true,
  },
  {
    id: "alfalfa-microgreens",
    name: "Alfalfa",
    nameTamil: "குதிரை மசால்",
    price: 99,
    unit: "40g Pack",
    category: "microgreens",
    description:
      "Nutrient-rich delicate Alfalfa microgreens. Crisp, nutty, and exceptionally rich in vitamins A, C, E, and K.",
    image: "/product-images/alfalfa-microgreens.webp",
    inStock: true,
  },
  {
    id: "mustard-microgreens",
    name: "Mustard",
    nameTamil: "கடுகு",
    price: 99,
    unit: "40g Pack",
    category: "microgreens",
    description:
      "Fresh zesty Mustard microgreens with a pleasant peppery kick. Excellent for salads, sandwiches, and garnishing.",
    image: "/product-images/mustard-microgreens.webp",
    inStock: true,
  },
  {
    id: "radish-china-rose-microgreens",
    name: "Radish (China Rose)",
    nameTamil: "சீனா ரோஸ் முள்ளங்கி",
    price: 99,
    unit: "40g Pack",
    category: "microgreens",
    description:
      "Vibrant China Rose Radish microgreens with stunning pink stems and spicy radish punch. High in vitamin C and antioxidants.",
    image: "/product-images/radish-china-rose-microgreens.webp",
    inStock: true,
  },
  {
    id: "radish-white-microgreens",
    name: "Radish (White)",
    nameTamil: "வெள்ளை முள்ளங்கி",
    price: 99,
    unit: "40g Pack",
    category: "microgreens",
    description:
      "Crisp white Radish microgreens with tender green leaves. Refreshing peppery crunch with digestive enzymes and zinc.",
    image: "/product-images/radish-white-microgreens.webp",
    inStock: true,
  },
  {
    id: "sunflower-microgreens",
    name: "Sunflower",
    nameTamil: "சூரியகாந்தி",
    price: 99,
    unit: "40g Pack",
    category: "microgreens",
    description:
      "Nutty, crunchy Sunflower microgreens with thick, juicy cotyledons. A complete plant protein powerhouse.",
    image: "/product-images/sunflower-microgreens.webp",
    inStock: true,
  },
  {
    id: "spinach-microgreens",
    name: "Spinach",
    nameTamil: "பாலக் கீரை",
    price: 99,
    unit: "40g Pack",
    category: "microgreens",
    description:
      "Fresh tender Spinach microgreens packed with iron, folate, and vital vitamins. Mild, sweet taste perfect for smoothies, salads, and garnishing.",
    image: "/product-images/Spinach.webp",
    inStock: true,
  },
  {
    id: "amaranthus-pink-microgreens",
    name: "Amaranthus (Pink)",
    nameTamil: "இளஞ்சிவப்பு தண்டுக்கீரை",
    price: 109,
    unit: "40g Pack",
    category: "microgreens",
    description:
      "Stunning magenta-pink Amaranthus microgreens. Adds vibrant color, subtle earthy sweetness, and high concentrations of betalains.",
    image: "/product-images/amaranthus-pink-microgreens.webp",
    inStock: true,
  },
  {
    id: "beetroot-microgreens",
    name: "Beetroot",
    nameTamil: "பீட்ரூட்",
    price: 109,
    unit: "40g Pack",
    category: "microgreens",
    description:
      "Gorgeous ruby-stemmed Beetroot microgreens with deep purple-green leaves. Sweet, earthy flavor rich in dietary nitrates and iron.",
    image: "/product-images/beetroot-microgreens.webp",
    inStock: true,
  },
  {
    id: "broccoli-microgreens",
    name: "Broccoli",
    nameTamil: "ப்ரோக்கோலி",
    price: 109,
    unit: "40g Pack",
    category: "microgreens",
    description:
      "Powerhouse Broccoli microgreens celebrated for immense sulforaphane content. Mild, fresh cabbage-like flavor.",
    image: "/product-images/broccoli-microgreens.webp",
    inStock: true,
  },
  {
    id: "khol-rabi-microgreens",
    name: "Khol Rabi",
    nameTamil: "நூல் கோல்",
    price: 109,
    unit: "40g Pack",
    category: "microgreens",
    description:
      "Tender purple and green Kohlrabi microgreens with a sweet, mild turnip-like crunch. Rich in vitamin C and glucosinolates.",
    image: "/product-images/khol-rabi-microgreens.webp",
    inStock: true,
  },
  {
    id: "pak-choi-microgreens",
    name: "Pak Choi",
    nameTamil: "பாக் சோய்",
    price: 109,
    unit: "40g Pack",
    category: "microgreens",
    description:
      "Juicy, tender Pak Choi (Bok Choy) microgreens with mild brassica sweetness. High in vitamins A, C, and dietary minerals.",
    image: "/product-images/pak-choi-microgreens.webp",
    inStock: true,
  },
  {
    id: "radish-purple-sango-microgreens",
    name: "Radish (Purple Sango)",
    nameTamil: "பர்பிள் சாங்கோ முள்ளங்கி",
    price: 109,
    unit: "40g Pack",
    category: "microgreens",
    description:
      "Intense deep purple Radish Sango microgreens. Striking visual appeal with a crisp, spicy radish punch and anthocyanins.",
    image: "/product-images/radish-purple-sango-microgreens.webp",
    inStock: true,
  },

  // ── Cut Vegetables (250g & 500g Variants) ─────────────────────────────────
  {
    id: "small-onion-peeled",
    name: "Small Onion (Peeled)",
    nameTamil: "சிறிய வெங்காயம் (உரித்தது)",
    price: 49,
    unit: "250g",
    category: "vegetables",
    image: "/product-images/Onion (Peeled).webp",
    variantType: "weight",
    variants: [
      { id: "small-onion-peeled-250g", unit: "250g", price: 49 },
      { id: "small-onion-peeled-500g", unit: "500g", price: 89 },
    ],
    description:
      "Fresh small onions, peeled and ready to use. Saves time in the kitchen without compromising on authentic flavour.",
    inStock: true,
  },
  {
    id: "garlic-peeled",
    name: "Garlic (Peeled)",
    nameTamil: "பூண்டு (உரித்தது)",
    price: 119,
    unit: "250g",
    category: "vegetables",
    image: "/product-images/Garlic (Peeled).webp",
    variantType: "weight",
    variants: [
      { id: "garlic-peeled-250g", unit: "250g", price: 119 },
      { id: "garlic-peeled-500g", unit: "500g", price: 229 },
    ],
    description:
      "Premium garlic cloves, peeled and ready to use. Fresh, pungent and full of natural goodness.",
    inStock: true,
  },
  {
    id: "green-peas-peeled",
    name: "Green Peas (Peeled)",
    nameTamil: "பச்சை பட்டாணி (உரித்தது)",
    price: 119,
    unit: "250g",
    category: "vegetables",
    image: "/product-images/Green Peas (Peeled).webp",
    variantType: "weight",
    variants: [
      { id: "green-peas-peeled-250g", unit: "250g", price: 119 },
      { id: "green-peas-peeled-500g", unit: "500g", price: 229 },
    ],
    description:
      "Fresh green peas, shelled and ready to cook. Plump, tender and naturally sweet.",
    inStock: true,
  },
  {
    id: "sweet-corn-peeled",
    name: "Sweet Corn (Peeled)",
    nameTamil: "ஸ்வீட் கார்ன் (உரித்தது)",
    price: 79,
    unit: "250g",
    category: "vegetables",
    image: "/product-images/Sweet Corn (Peeled).webp",
    variantType: "weight",
    variants: [
      { id: "sweet-corn-peeled-250g", unit: "250g", price: 79 },
      { id: "sweet-corn-peeled-500g", unit: "500g", price: 149 },
    ],
    description:
      "Fresh sweet corn kernels, peeled and ready to use. Juicy, crunchy and naturally sweet.",
    inStock: true,
  },
  {
    id: "avaraikkai-sliced",
    name: "Avaraikkai (Sliced)",
    nameTamil: "அவரைக்காய் (நறுக்கியது)",
    price: 69,
    unit: "250g",
    category: "vegetables",
    image: "/product-images/Avaraikkai (Sliced).webp",
    variantType: "weight",
    variants: [
      { id: "avaraikkai-sliced-250g", unit: "250g", price: 69 },
      { id: "avaraikkai-sliced-500g", unit: "500g", price: 129 },
    ],
    description:
      "Fresh avaraikkai (broad beans) sliced and ready to cook. Perfect for South Indian stir fries.",
    inStock: true,
  },
  {
    id: "coconut-grated",
    name: "Coconut (Grated)",
    nameTamil: "தேங்காய் (துறுவியது)",
    price: 119,
    unit: "250g",
    category: "vegetables",
    image: "/product-images/Coconut (Grated).webp",
    variantType: "weight",
    variants: [
      { id: "coconut-grated-250g", unit: "250g", price: 119 },
      { id: "coconut-grated-500g", unit: "500g", price: 229 },
    ],
    description:
      "Freshly grated coconut, ready to use in chutneys, curries and sweets. No grating needed.",
    inStock: true,
  },
  {
    id: "cauliflower-sliced",
    name: "Cauliflower (Sliced)",
    nameTamil: "காலிஃப்ளவர் (நறுக்கியது)",
    price: 119,
    unit: "250g",
    category: "vegetables",
    image: "/product-images/Cauliflower (Sliced).webp",
    variantType: "weight",
    variants: [
      { id: "cauliflower-sliced-250g", unit: "250g", price: 119 },
      { id: "cauliflower-sliced-500g", unit: "500g", price: 229 },
    ],
    description:
      "Fresh cauliflower florets, sliced and ready to cook. Tender and versatile for any recipe.",
    inStock: true,
  },
  {
    id: "carrot-sliced",
    name: "Carrot (Sliced)",
    nameTamil: "கேரட் (நறுக்கியது)",
    price: 49,
    unit: "250g",
    category: "vegetables",
    image: "/product-images/Carrot (Sliced).webp",
    variantType: "weight",
    variants: [
      { id: "carrot-sliced-250g", unit: "250g", price: 49 },
      { id: "carrot-sliced-500g", unit: "500g", price: 89 },
    ],
    description:
      "Fresh carrots, sliced and ready to cook. Crisp, sweet and full of beta-carotene.",
    inStock: true,
  },
  {
    id: "beans-sliced",
    name: "Beans (Sliced)",
    nameTamil: "பீன்ஸ் (நறுக்கியது)",
    price: 59,
    unit: "250g",
    category: "vegetables",
    image: "/product-images/Beans (Sliced).webp",
    variantType: "weight",
    variants: [
      { id: "beans-sliced-250g", unit: "250g", price: 59 },
      { id: "beans-sliced-500g", unit: "500g", price: 109 },
    ],
    description:
      "Fresh green beans, sliced and ready to use. Tender and ideal for poriyal, stir fries and curries.",
    inStock: true,
  },
  {
    id: "beetroot-sliced",
    name: "Beetroot (Sliced)",
    nameTamil: "பீட்ரூட் (நறுக்கியது)",
    price: 49,
    unit: "250g",
    category: "vegetables",
    image: "/product-images/Beetroot (Sliced).webp",
    variantType: "weight",
    variants: [
      { id: "beetroot-sliced-250g", unit: "250g", price: 49 },
      { id: "beetroot-sliced-500g", unit: "500g", price: 89 },
    ],
    description:
      "Fresh beetroot, sliced and ready to cook. Earthy, naturally sweet and rich in iron.",
    inStock: true,
  },
  {
    id: "cabbage-sliced",
    name: "Cabbage (Sliced)",
    nameTamil: "முட்டைகோஸ் (நறுக்கியது)",
    price: 39,
    unit: "250g",
    category: "vegetables",
    image: "/product-images/Cabbage (Sliced).webp",
    variantType: "weight",
    variants: [
      { id: "cabbage-sliced-250g", unit: "250g", price: 39 },
      { id: "cabbage-sliced-500g", unit: "500g", price: 69 },
    ],
    description:
      "Crisp cabbage, finely sliced and ready to cook. Great for kootu, poriyal and salads.",
    inStock: true,
  },
  {
    id: "drumstick-sliced",
    name: "Drumstick (Sliced)",
    nameTamil: "முருங்கைக்காய் (நறுக்கியது)",
    price: 39,
    unit: "250g",
    category: "vegetables",
    image: "/product-images/Drumstick (Sliced).webp",
    variantType: "weight",
    variants: [
      { id: "drumstick-sliced-250g", unit: "250g", price: 39 },
      { id: "drumstick-sliced-500g", unit: "500g", price: 79 },
    ],
    description:
      "Fresh drumstick (moringa pods), sliced and ready to cook. Perfect for sambar and curries.",
    inStock: true,
  },

  // ── Cut Fruits ───────────────────────────────────────────────────────────
  {
    id: "pomegranate-peeled",
    name: "Pomegranate (Peeled)",
    nameTamil: "மாதுளை (தோல் உரிக்கப்பட்டது)",
    price: 99,
    unit: "250g",
    category: "cut-fruits",
    image: "/product-images/Pomegranate (Peeled).webp",
    variantType: "weight",
    variants: [
      { id: "pomegranate-peeled-250g", unit: "250g", price: 99 },
      { id: "pomegranate-peeled-500g", unit: "500g", price: 189 },
    ],
    description:
      "Fresh pomegranate seeds, peeled and ready to eat. Bursting with ruby-red sweetness.",
    inStock: true,
  },
  {
    id: "papaya-cut",
    name: "Papaya (Cut)",
    nameTamil: "பப்பாளி (வெட்டியது)",
    price: 59,
    unit: "250g",
    category: "cut-fruits",
    image: "/product-images/Papaya (Cut).webp",
    variantType: "weight",
    variants: [
      { id: "papaya-cut-250g", unit: "250g", price: 59 },
      { id: "papaya-cut-500g", unit: "500g", price: 99 },
    ],
    description:
      "Ripe papaya cut fresh and ready to eat. Naturally sweet with a smooth texture.",
    inStock: true,
  },
  {
    id: "fruits-mix-salad-250g",
    name: "Fruits Mix Salad",
    nameTamil: "பழ கலவை சாலட்",
    price: 69,
    unit: "250g",
    category: "cut-fruits",
    image: "/product-images/Fruits Mix Salad.webp",
    description:
      "A colourful medley of fresh seasonal fruits, cut and ready to enjoy. Perfect for a healthy snack.",
    inStock: true,
  },

  // ── Sprouts (100g Packs) ──────────────────────────────────────────────────
  {
    id: "pachai-payaru-sprouts",
    name: "Pachai Payaru",
    nameTamil: "பச்சை பயறு முளைகட்டியது",
    price: 29,
    unit: "100g",
    category: "sprouts",
    image: "/product-images/Pachai Payaru.webp",
    description:
      "Fresh green moong sprouts. Light, crisp and packed with protein and enzymes. Ready to eat.",
    inStock: true,
  },
  {
    id: "brown-chana-sprouts",
    name: "Brown Chana",
    nameTamil: "பழுப்பு சனா முளைகட்டியது",
    price: 29,
    unit: "100g",
    category: "sprouts",
    image: "/product-images/Brown Chana.webp",
    description:
      "Freshly sprouted brown chana. Rich in fibre and protein. Great for salads or a healthy snack.",
    inStock: true,
  },
  {
    id: "mixed-sprouts",
    name: "Mixed Sprouts",
    nameTamil: "கலப்பு முளைகட்டியது",
    price: 29,
    unit: "100g",
    category: "sprouts",
    image: "/product-images/Mixed Sprouts.webp",
    description:
      "A nourishing mix of sprouted legumes and seeds. Full of vitamins, minerals and plant protein.",
    inStock: true,
  },

  // ── Fresh Juices (250 ml — With / Without Sugar) ──────────────────────────
  {
    id: "lemon-juice",
    name: "Lemon Juice",
    nameTamil: "எலுமிச்சை ஜூஸ்",
    price: 29,
    unit: "250 ml",
    category: "fresh-juices",
    image: "/product-images/lemon.webp",
    variantType: "sugar",
    variants: [
      { id: "lemon-juice-with-sugar", unit: "With Sugar", price: 29 },
      { id: "lemon-juice-without-sugar", unit: "Without Sugar", price: 29 },
    ],
    description:
      "Freshly squeezed lemon juice made to order. Choose with or without sugar for a tangy refresher.",
    inStock: true,
  },
  {
    id: "apple-juice",
    name: "Apple Juice",
    nameTamil: "ஆப்பிள் ஜூஸ்",
    price: 139,
    unit: "250 ml",
    category: "fresh-juices",
    image: "/product-images/apple.webp",
    variantType: "sugar",
    variants: [
      { id: "apple-juice-with-sugar", unit: "With Sugar", price: 139 },
      { id: "apple-juice-without-sugar", unit: "Without Sugar", price: 139 },
    ],
    description:
      "Freshly pressed crisp apple juice. Choose with or without sugar for pure natural sweetness.",
    inStock: true,
  },
  {
    id: "muskmelon-juice",
    name: "Muskmelon Juice",
    nameTamil: "முலாம்பழம் ஜூஸ்",
    price: 89,
    unit: "250 ml",
    category: "fresh-juices",
    image: "/product-images/Muskmelon Juice.webp",
    variantType: "sugar",
    variants: [
      { id: "muskmelon-juice-with-sugar", unit: "With Sugar", price: 89 },
      { id: "muskmelon-juice-without-sugar", unit: "Without Sugar", price: 89 },
    ],
    description:
      "Smooth, hydrating muskmelon juice. Choose with or without sugar for a cooling experience.",
    inStock: true,
  },
  {
    id: "watermelon-juice",
    name: "Watermelon Juice",
    nameTamil: "தர்பூசணி ஜூஸ்",
    price: 49,
    unit: "250 ml",
    category: "fresh-juices",
    image: "/product-images/Watermelon Juice.webp",
    variantType: "sugar",
    variants: [
      { id: "watermelon-juice-with-sugar", unit: "With Sugar", price: 49 },
      { id: "watermelon-juice-without-sugar", unit: "Without Sugar", price: 49 },
    ],
    description:
      "Chilled pure watermelon juice. Choose with or without sugar for the ultimate refresher.",
    inStock: true,
  },
  {
    id: "pomegranate-juice",
    name: "Pomegranate Juice",
    nameTamil: "மாதுளை ஜூஸ்",
    price: 109,
    unit: "250 ml",
    category: "fresh-juices",
    image: "/product-images/Pomegranate Juice.webp",
    variantType: "sugar",
    variants: [
      { id: "pomegranate-juice-with-sugar", unit: "With Sugar", price: 109 },
      { id: "pomegranate-juice-without-sugar", unit: "Without Sugar", price: 109 },
    ],
    description:
      "Antioxidant-packed ruby pomegranate juice. Choose with or without sugar.",
    inStock: true,
  },
  {
    id: "sathukudi-juice",
    name: "Sathukudi Juice",
    nameTamil: "சாத்துக்குடி ஜூஸ்",
    price: 49,
    unit: "250 ml",
    category: "fresh-juices",
    image: "/product-images/Sathukudi Juice.webp",
    variantType: "sugar",
    variants: [
      { id: "sathukudi-juice-with-sugar", unit: "With Sugar", price: 49 },
      { id: "sathukudi-juice-without-sugar", unit: "Without Sugar", price: 49 },
    ],
    description:
      "Freshly squeezed Sathukudi (sweet lime) juice. Choose with or without sugar.",
    inStock: true,
  },
  {
    id: "amla-juice",
    name: "Amla Juice",
    nameTamil: "நெல்லிக்காய் ஜூஸ்",
    price: 79,
    unit: "250 ml",
    category: "fresh-juices",
    image: "/product-images/Amla Juice.webp",
    variantType: "sugar",
    variants: [
      { id: "amla-juice-with-sugar", unit: "With Sugar", price: 79 },
      { id: "amla-juice-without-sugar", unit: "Without Sugar", price: 79 },
    ],
    description:
      "Immunity-boosting fresh amla (gooseberry) juice. Choose with or without sugar.",
    inStock: true,
  },
  {
    id: "beetroot-juice",
    name: "Beetroot Juice",
    nameTamil: "பீட்ரூட் ஜூஸ்",
    price: 49,
    unit: "250 ml",
    category: "fresh-juices",
    image: "/product-images/Beetroot Juice.webp",
    variantType: "sugar",
    variants: [
      { id: "beetroot-juice-with-sugar", unit: "With Sugar", price: 49 },
      { id: "beetroot-juice-without-sugar", unit: "Without Sugar", price: 49 },
    ],
    description:
      "Iron-rich vibrant beetroot juice. Choose with or without sugar.",
    inStock: true,
  },
  {
    id: "grape-juice",
    name: "Grape Juice",
    nameTamil: "திராட்சை ஜூஸ்",
    price: 49,
    unit: "250 ml",
    category: "fresh-juices",
    image: "/product-images/Grape Juice.webp",
    variantType: "sugar",
    variants: [
      { id: "grape-juice-with-sugar", unit: "With Sugar", price: 49 },
      { id: "grape-juice-without-sugar", unit: "Without Sugar", price: 49 },
    ],
    description:
      "Fresh grape juice rich in antioxidants. Choose with or without sugar.",
    inStock: true,
  },
  {
    id: "carrot-juice",
    name: "Carrot Juice",
    nameTamil: "கேரட் ஜூஸ்",
    price: 49,
    unit: "250 ml",
    category: "fresh-juices",
    image: "/product-images/Carrot Juice.webp",
    variantType: "sugar",
    variants: [
      { id: "carrot-juice-with-sugar", unit: "With Sugar", price: 49 },
      { id: "carrot-juice-without-sugar", unit: "Without Sugar", price: 49 },
    ],
    description:
      "Beta-carotene rich freshly extracted carrot juice. Choose with or without sugar.",
    inStock: true,
  },
  {
    id: "orange-juice",
    name: "Orange Juice",
    nameTamil: "ஆரஞ்சு ஜூஸ்",
    price: 89,
    unit: "250 ml",
    category: "fresh-juices",
    image: "/product-images/Orange Juice.webp",
    variantType: "sugar",
    variants: [
      { id: "orange-juice-with-sugar", unit: "With Sugar", price: 89 },
      { id: "orange-juice-without-sugar", unit: "Without Sugar", price: 89 },
    ],
    description:
      "Freshly squeezed orange juice loaded with vitamin C. Choose with or without sugar.",
    inStock: true,
  },
  {
    id: "abc-juice",
    name: "ABC Juice",
    nameTamil: "ABC ஜூஸ்",
    price: 119,
    unit: "250 ml",
    category: "fresh-juices",
    note: "Apple, Beetroot & Carrot",
    image: "/product-images/ABC juice.webp",
    variantType: "sugar",
    variants: [
      { id: "abc-juice-with-sugar", unit: "With Sugar", price: 119 },
      { id: "abc-juice-without-sugar", unit: "Without Sugar", price: 119 },
    ],
    description:
      "The powerhouse blend of Apple, Beetroot, and Carrot. Choose with or without sugar for daily vitality.",
    inStock: true,
  },

  // ── Premium Quality Dry Fruits & Seeds ────────────────────────────────────
  {
    id: "black-dates",
    name: "Black Dates",
    nameTamil: "கருப்பு பேரீச்சை",
    price: 200,
    unit: "500g",
    category: "nuts-seeds",
    image: "/product-images/Black Dates.webp",
    description:
      "Naturally sweet and rich black dates. A wholesome snack or natural sweetener for your recipes.",
    inStock: true,
  },
  {
    id: "almond",
    name: "Almond",
    nameTamil: "பாதாம்",
    price: 275,
    unit: "250g",
    category: "nuts-seeds",
    image: "/product-images/Almond.webp",
    description:
      "Premium quality almonds, carefully selected. Crunchy, nutritious and perfect for snacking.",
    inStock: true,
  },
  {
    id: "pista-unsalted",
    name: "Pista Unsalted",
    nameTamil: "உப்பில்லா பிஸ்தா",
    price: 830,
    unit: "250g",
    category: "nuts-seeds",
    image: "/product-images/Pista unsalted.webp",
    description:
      "Premium unsalted pistachios. Rich, buttery flavour with no added salt — pure natural goodness.",
    inStock: true,
  },
  {
    id: "walnut",
    name: "Walnut",
    nameTamil: "வால்நட்",
    price: 420,
    unit: "250g",
    category: "nuts-seeds",
    image: "/product-images/Walnut.webp",
    description:
      "Whole walnuts with a rich, earthy taste. Versatile for snacking, baking or adding to salads.",
    inStock: true,
  },
  {
    id: "fig",
    name: "Fig",
    nameTamil: "அத்திப்பழம்",
    price: 300,
    unit: "250g",
    category: "nuts-seeds",
    image: "/product-images/Fig.webp",
    description:
      "Soft, naturally sweet dried figs. A wholesome treat packed with natural flavour.",
    inStock: true,
  },
  {
    id: "yellow-raisins",
    name: "Yellow Raisins",
    nameTamil: "மஞ்சள் திராட்சை",
    price: 160,
    unit: "250g",
    category: "nuts-seeds",
    image: "/product-images/Yellow raisins.webp",
    description:
      "Golden yellow raisins, naturally sweet and tender. Great for snacking, cooking or baking.",
    inStock: true,
  },
  {
    id: "black-raisins",
    name: "Black Raisins",
    nameTamil: "கருப்பு திராட்சை",
    price: 185,
    unit: "250g",
    category: "nuts-seeds",
    image: "/product-images/Black Raisins.webp",
    description:
      "Rich black raisins with intense natural sweetness. A classic nutritious addition to any meal.",
    inStock: true,
  },
  {
    id: "cashew",
    name: "Cashew",
    nameTamil: "முந்திரி",
    price: 265,
    unit: "250g",
    category: "nuts-seeds",
    image: "/product-images/Cashew.webp",
    description:
      "Creamy, premium whole cashews. Perfect for snacking or cooking rich, flavourful dishes.",
    inStock: true,
  },
  {
    id: "chia-seeds",
    name: "Chia Seeds",
    nameTamil: "சியா விதைகள்",
    price: 115,
    unit: "250g",
    category: "nuts-seeds",
    image: "/product-images/Chia seeds.webp",
    description:
      "Tiny but mighty chia seeds. Mix into drinks, smoothies, puddings or sprinkle on meals.",
    inStock: true,
  },
  {
    id: "pumpkin-seeds",
    name: "Pumpkin Seeds",
    nameTamil: "பூசணி விதைகள்",
    price: 175,
    unit: "250g",
    category: "nuts-seeds",
    image: "/product-images/Pumpkin seeds.webp",
    description:
      "Crunchy pumpkin seeds, naturally nutritious. Great for snacking or adding texture to dishes.",
    inStock: true,
  },
  {
    id: "sabja-seeds",
    name: "Sabja Seeds",
    nameTamil: "சப்ஜா விதைகள்",
    price: 100,
    unit: "250g",
    category: "nuts-seeds",
    image: "/product-images/Sabja seeds.webp",
    description:
      "Sabja (basil) seeds that bloom beautifully in water. A refreshing addition to drinks and desserts.",
    inStock: true,
  },
  {
    id: "flax-seeds",
    name: "Flax Seeds",
    nameTamil: "ஆளி விதைகள்",
    price: 80,
    unit: "250g",
    category: "nuts-seeds",
    image: "/product-images/Flax seeds.webp",
    description:
      "Earthy flax seeds packed with natural goodness. Sprinkle on yogurt, salads or add to smoothies.",
    inStock: true,
  },
  {
    id: "sunflower-seeds",
    name: "Sunflower Seeds",
    nameTamil: "சூரியகாந்தி விதைகள்",
    price: 95,
    unit: "250g",
    category: "nuts-seeds",
    image: "/product-images/Sunflower seeds.webp",
    description:
      "Light and crunchy sunflower seeds. A satisfying natural snack or salad topping.",
    inStock: true,
  },
  {
    id: "melon-seeds",
    name: "Melon Seeds",
    nameTamil: "முலாம்பழ விதைகள்",
    price: 230,
    unit: "250g",
    category: "nuts-seeds",
    image: "/product-images/Melon seeds.webp",
    description:
      "Delicate melon seeds with a mild, nutty taste. Versatile for snacking or adding to recipes.",
    inStock: true,
  },
  {
    id: "badam-gum",
    name: "Badam Gum",
    nameTamil: "பாதாம் பிசின்",
    price: 160,
    unit: "250g",
    category: "nuts-seeds",
    image: "/product-images/Badam Gum.webp",
    description:
      "Natural badam gum (Badam Pisin), traditionally used in refreshing drinks, desserts and cooling health tonics.",
    inStock: true,
  },
  {
    id: "makhanna",
    name: "Makhanna",
    nameTamil: "தாமரை விதை (மக்கானா)",
    price: 200,
    unit: "100g",
    category: "nuts-seeds",
    image: "/product-images/Makhanna.webp",
    description:
      "Premium crunchy Fox Nuts (Makhanna / Lotus Seeds). A light, protein-rich, low-calorie wholesome snack.",
    inStock: true,
  },

  // ── Natural Powders ───────────────────────────────────────────────────────
  {
    id: "amla-powder",
    name: "Amla Powder",
    nameTamil: "நெல்லிக்காய் பொடி",
    price: 99,
    unit: "100g",
    category: "premium-products",
    image: "/product-images/Amla Powder.webp",
    description:
      "Pure organic Amla (Indian Gooseberry) powder. Rich in vitamin C and powerful antioxidants.",
    inStock: true,
  },
  {
    id: "curry-leaves-powder",
    name: "Curry Leaves Powder",
    nameTamil: "கருவேப்பிலை பொடி",
    price: 99,
    unit: "100g",
    category: "premium-products",
    image: "/product-images/Curry Leaves Powder.webp",
    description:
      "Naturally dehydrated and ground curry leaves powder. Excellent for hair health and digestion.",
    inStock: true,
  },
  {
    id: "onion-powder",
    name: "Onion Powder",
    nameTamil: "வெங்காய பொடி",
    price: 149,
    unit: "100g",
    category: "premium-products",
    image: "/product-images/Onion Powder.webp",
    description:
      "Dehydrated pure onion powder. Perfect seasoning for gravies, curries and snacks without peeling.",
    inStock: true,
  },
  {
    id: "garlic-powder",
    name: "Garlic Powder",
    nameTamil: "பூண்டு பொடி",
    price: 149,
    unit: "100g",
    category: "premium-products",
    image: "/product-images/Garlic Powder.webp",
    description:
      "Aromatic pure garlic powder. Adds rich flavour to culinary dishes and supports heart health.",
    inStock: true,
  },
  {
    id: "coconut-powder",
    name: "Coconut Powder",
    nameTamil: "தேங்காய் பொடி",
    price: 49,
    unit: "100g",
    category: "premium-products",
    image: "/product-images/Coconut Powder.webp",
    description:
      "Finely grated and dried coconut powder. Convenient for instant chutneys, sweets and baking.",
    inStock: true,
  },
  {
    id: "health-mix-powder",
    name: "Health Mix Powder",
    nameTamil: "சத்து மாவு",
    price: 199,
    unit: "100g",
    category: "premium-products",
    image: "/product-images/Health Mix Powder.webp",
    variantType: "weight",
    variants: [
      { id: "health-mix-powder-100g", unit: "100g", price: 199 },
      { id: "health-mix-powder-250g", unit: "250g", price: 459 },
    ],
    description:
      "Traditional multigrain Sathu Maavu (Health Mix) made with sprouted grains, pulses, and nuts.",
    inStock: true,
  },

  // ── Seasonal & Exotic Fruits ─────────────────────────────────────────────
  {
    id: "dragon-fruit",
    name: "Dragon Fruit",
    nameTamil: "டிராகன் பழம்",
    price: 99,
    unit: "1 Pack",
    category: "seasonal-exotic-fruits",
    image: "/product-images/Dragon Fruit.webp",
    description:
      "Fresh exotic dragon fruit with striking pink skin and nutrient-dense, subtly sweet flesh.",
    inStock: true,
  },
  {
    id: "rambutan",
    name: "Rambutan",
    nameTamil: "ரம்புட்டான்",
    price: 139,
    unit: "1 Pack",
    category: "seasonal-exotic-fruits",
    image: "/product-images/Rambutan.webp",
    description:
      "Juicy, sweet and floral tropical rambutan fruits. Packed fresh and full of natural goodness.",
    inStock: true,
  },
  {
    id: "avocado",
    name: "Avocado",
    nameTamil: "அவகேடோ (வெண்ணெய் பழம்)",
    price: 139,
    unit: "1 Pack",
    category: "seasonal-exotic-fruits",
    image: "/product-images/Avocado.webp",
    description:
      "Creamy, nutrient-rich fresh avocados. Loaded with healthy monounsaturated fats and vitamins.",
    inStock: true,
  },
  {
    id: "custard-apple",
    name: "Custard Apple",
    nameTamil: "சீதாப்பழம்",
    price: 179,
    unit: "1 Pack",
    category: "seasonal-exotic-fruits",
    image: "/product-images/Custard Apple.webp",
    description:
      "Sweet, creamy and fragrant seasonal custard apples (Seethapazham). Rich in vitamin C and magnesium.",
    inStock: true,
  },
  {
    id: "pears",
    name: "Pears",
    nameTamil: "பேரிக்காய்",
    price: 99,
    unit: "1 Pack",
    category: "seasonal-exotic-fruits",
    image: "/product-images/Pears.webp",
    description:
      "Crisp and juicy fresh pears. Naturally sweet, high in dietary fibre and deeply refreshing.",
    inStock: true,
  },
  {
    id: "kiwi",
    name: "Kiwi",
    nameTamil: "கிவி பழம்",
    price: 119,
    unit: "1 Pack",
    category: "seasonal-exotic-fruits",
    image: "/product-images/Kiwi.webp",
    description:
      "Zesty and sweet fresh kiwi fruits. Packed with immune-boosting vitamin C and digestive enzymes.",
    inStock: true,
  },

  // ── Healthy Snacks ───────────────────────────────────────────────────────
  {
    id: "thattai-murukku",
    name: "Thattai Murukku",
    nameTamil: "தட்டை முறுக்கு",
    price: 179,
    unit: "250g",
    note: "Made with Coconut Oil",
    category: "healthy-snacks",
    image: "/product-images/Thattai Murukku.webp",
    variantType: "weight",
    variants: [
      { id: "thattai-murukku-250g", unit: "250g", price: 179 },
      { id: "thattai-murukku-300g", unit: "300g", price: 349 },
    ],
    description:
      "Crunchy traditional Thattai Murukku crafted using pure unrefined coconut oil. Crispy and delicious.",
    inStock: true,
  },
  {
    id: "ellu-vadai",
    name: "Ellu Vadai",
    nameTamil: "எள்ளு வடை",
    price: 199,
    unit: "250g",
    note: "Made with Brown Sugar",
    category: "healthy-snacks",
    image: "/product-images/Ellu Vadai.webp",
    variantType: "weight",
    variants: [
      { id: "ellu-vadai-250g", unit: "250g", price: 199 },
      { id: "ellu-vadai-500g", unit: "500g", price: 389 },
    ],
    description:
      "Traditional sweet sesame patties (Ellu Vadai) made with nutritious brown sugar and sesame seeds.",
    inStock: true,
  },

  // ── Mushrooms ────────────────────────────────────────────────────────────
  {
    id: "button-mushroom",
    name: "Button Mushroom",
    nameTamil: "பட்டன் காளான்",
    price: 59,
    unit: "200g",
    category: "mushrooms",
    image: "/product-images/Button Mushroom.webp",
    description:
      "Plump, fresh white button mushrooms. Tender, versatile and rich in vitamin D and minerals.",
    inStock: true,
  },
  {
    id: "oyster-mushroom",
    name: "Oyster Mushroom",
    nameTamil: "சிப்பி காளான்",
    price: 59,
    unit: "200g",
    category: "mushrooms",
    image: "/product-images/Oyster Mushroom.webp",
    description:
      "Delicate and velvety fresh oyster mushrooms. High in protein, fibre and savoury umami flavour.",
    inStock: true,
  },

  // ── Cold Pressed Oil ─────────────────────────────────────────────────────
  {
    id: "cold-pressed-coconut-oil",
    name: "Coconut Oil",
    nameTamil: "மரச்செக்கு தேங்காய் எண்ணெய்",
    price: 189,
    unit: "500ml",
    category: "cold-pressed-oil",
    image: "/product-images/Coconut Oil.webp",
    variantType: "weight",
    variants: [
      { id: "cold-pressed-coconut-oil-500ml", unit: "500ml", price: 189 },
      { id: "cold-pressed-coconut-oil-1l", unit: "1L", price: 369 },
    ],
    description:
      "100% pure cold pressed (Marachekku) coconut oil. Unrefined, unbleached, and naturally aromatic.",
    inStock: true,
  },
  {
    id: "cold-pressed-sesame-oil",
    name: "Sesame Oil",
    nameTamil: "மரச்செக்கு நல்லெண்ணெய்",
    price: 229,
    unit: "500ml",
    category: "cold-pressed-oil",
    image: "/product-images/Sesame Oil.webp",
    variantType: "weight",
    variants: [
      { id: "cold-pressed-sesame-oil-500ml", unit: "500ml", price: 229 },
      { id: "cold-pressed-sesame-oil-1l", unit: "1L", price: 439 },
    ],
    description:
      "Traditional cold pressed sesame (gingelly) oil extracted with palm jaggery. Rich aroma and flavour.",
    inStock: true,
  },
  {
    id: "cold-pressed-groundnut-oil",
    name: "Groundnut Oil",
    nameTamil: "மரச்செக்கு கடலை எண்ணெய்",
    price: 139,
    unit: "500ml",
    category: "cold-pressed-oil",
    image: "/product-images/Groundnut Oil.webp",
    variantType: "weight",
    variants: [
      { id: "cold-pressed-groundnut-oil-500ml", unit: "500ml", price: 139 },
      { id: "cold-pressed-groundnut-oil-1l", unit: "1L", price: 269 },
    ],
    description:
      "Pure cold pressed groundnut (peanut) oil. High smoke point, heart-healthy and free of chemicals.",
    inStock: true,
  },
];

export function getProductsByCategory(category: ProductCategory | string): Product[] {
  return PRODUCTS.filter((p) => p.category === category || p.secondaryCategory === category);
}

export function getProductById(id: string): Product | undefined {
  const direct = PRODUCTS.find((p) => p.id === id);
  if (direct) return direct;

  // Check if id matches any variant id
  const parent = PRODUCTS.find((p) => p.variants?.some((v) => v.id === id));
  if (parent && parent.variants) {
    const variant = parent.variants.find((v) => v.id === id);
    if (variant) {
      return getVariantProduct(parent, variant);
    }
  }

  return undefined;
}

export function searchProducts(query: string): Product[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return PRODUCTS.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.nameTamil && p.nameTamil.toLowerCase().includes(q)) ||
      p.category.toLowerCase().includes(q) ||
      p.unit.toLowerCase().includes(q) ||
      (p.note && p.note.toLowerCase().includes(q)) ||
      p.variants?.some((v) => v.unit.toLowerCase().includes(q))
  );
}
