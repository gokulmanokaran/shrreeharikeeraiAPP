export interface ProductVariant {
  id: string;
  name?: string;
  unit: string;
  price: number;
  inStock?: boolean;
}

export interface Product {
  id: string;
  name: string;
  nameTamil?: string;
  tamilName?: string;
  price: number;
  mrp?: number;
  unit: string;
  quantity?: string;
  category: string;
  secondaryCategory?: string;
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

export interface Category {
  id: string;
  name: string;
  emoji: string;
  description: string;
  color: string;
  image?: string;
  sortOrder?: number;
  active?: boolean;
}

export interface AdminSession {
  token: string;
  role: string;
  storeName: string;
  issuedAt: string;
}
