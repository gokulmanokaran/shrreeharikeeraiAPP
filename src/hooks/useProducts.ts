import { useState, useMemo } from "react";
import { Product, ProductCategory } from "../data/products";
import { useProductCatalog } from "../store/ProductContext";

export function useProducts(initialCategory?: ProductCategory | "all") {
  const { products: allProducts, getProductById, searchProducts } = useProductCatalog();
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | "all">(
    initialCategory || "all"
  );
  const [searchQuery, setSearchQuery] = useState("");

  const products = useMemo(() => {
    let list: Product[] = allProducts;
    if (selectedCategory && selectedCategory !== "all") {
      list = allProducts.filter((p) => p.category === selectedCategory || p.secondaryCategory === selectedCategory);
    }
    if (searchQuery.trim()) {
      list = searchProducts(searchQuery);
    }
    return list;
  }, [allProducts, selectedCategory, searchQuery, searchProducts]);

  return {
    products,
    allProducts,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    getProductById,
  };
}
