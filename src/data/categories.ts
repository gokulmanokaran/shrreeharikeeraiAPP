import { ProductCategory } from "./products";

export interface Category {
  id: ProductCategory;
  name: string;
  emoji: string;
  description: string;
  color: string;
  image?: string;
  sortOrder?: number;
  active?: boolean;
}

export const CATEGORIES: Category[] = [
  {
    id: "new-arrivals",
    name: "New Arrivals",
    emoji: "✨",
    description: "Freshly added new products & seasonal arrivals",
    color: "#FEF3C7",
    image: "https://res.cloudinary.com/kil3rfap/image/upload/v1788403323/ChatGPT_Image_Sep_3_2026_08_11_20_AM.png",
    sortOrder: 0,
    active: true,
  },
  {
    id: "vegetables",
    name: "Vegetables",
    emoji: "🧅",
    description: "Ready-to-use fresh vegetables",
    color: "#FFF8E7",
    image: "/product-images/Carrot (Sliced).png",
  },
  {
    id: "sprouts",
    name: "Sprouts",
    emoji: "🫘",
    description: "Fresh & nutritious sprouts",
    color: "#F0FFF4",
    image: "/product-images/Mixed Sprouts.png",
  },
  {
    id: "keerai",
    name: "Greens (Keerai)",
    emoji: "🌿",
    description: "Fresh leafy greens",
    color: "#EAF8F0",
    image: "/product-images/dwarf-copper-leaves.jpg",
  },
  {
    id: "microgreens",
    name: "Microgreens",
    emoji: "🌱",
    description: "Nutrient-packed microgreens",
    color: "#E8F5E9",
    image: "/product-images/sunflower-microgreens.jpg",
  },
  {
    id: "premium-products",
    name: "Healthy Choices",
    emoji: "✨",
    description: "Pure natural herbal powders & health mixes",
    color: "#FAF0FF",
    image: "/product-images/Health Mix Powder.png",
  },
  {
    id: "nuts-seeds",
    name: "Nuts & Seeds",
    emoji: "🥜",
    description: "Nutritious whole almonds, cashews & seeds",
    color: "#FFF5E6",
    image: "/product-images/Almond.png",
  },
  {
    id: "cut-fruits",
    name: "Cut Fruits",
    emoji: "🍓",
    description: "Fresh cut fruits & salads",
    color: "#FFF0F5",
    image: "/product-images/Fruits Mix Salad.png",
  },
  {
    id: "fresh-juices",
    name: "Fresh Juices",
    emoji: "🥤",
    description: "Freshly squeezed natural juices",
    color: "#FFFBE6",
    image: "/product-images/ABC juice.png",
  },
  {
    id: "healthy-snacks",
    name: "Healthy Snacks",
    emoji: "🍿",
    description: "Guilt-free healthy snacks",
    color: "#F5FCF8",
    image: "/product-images/Thattai Murukku.png",
  },
  {
    id: "seasonal-exotic-fruits",
    name: "Seasonal Fruits",
    emoji: "🍍",
    description: "Seasonal & exotic whole fruits",
    color: "#FFF8EE",
    image: "/product-images/Dragon Fruit.png",
  },
  {
    id: "mushrooms",
    name: "Mushrooms",
    emoji: "🍄",
    description: "Fresh button & oyster mushrooms",
    color: "#F5F0FF",
    image: "/product-images/Button Mushroom.png",
  },
  {
    id: "cold-pressed-oil",
    name: "Cold Pressed Oil",
    emoji: "🫙",
    description: "Pure wood-pressed natural oils",
    color: "#FFFAEB",
    image: "/product-images/Coconut Oil.png",
  },
];
