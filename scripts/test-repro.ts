import { Product } from "../src/data/products";
import { CartItem, CartValidationReport } from "../src/services/cartService";
import { findProductById } from "../src/services/productService";

function fixedValidateCartWithLiveCatalog(
  currentItems: CartItem[],
  catalog: Product[]
): CartValidationReport {
  if (!catalog || catalog.length === 0 || !currentItems || currentItems.length === 0) {
    const verifiedSubtotal = currentItems.reduce(
      (sum, i) => sum + i.product.price * i.quantity,
      0
    );
    return {
      items: currentItems,
      hasChanges: false,
      hasPriceChange: false,
      hasOutOfStock: false,
      hasStockExceeded: false,
      verifiedSubtotal,
    };
  }

  let hasChanges = false;
  let hasPriceChange = false;
  let hasOutOfStock = false;
  let hasStockExceeded = false;
  let verifiedSubtotal = 0;

  const updatedItems: CartItem[] = currentItems.map((item) => {
    const live = findProductById(catalog, item.product.id);

    // 1. Product Deleted or Inactive in Catalog
    if (!live || live.active === false) {
      const wasInactive = item.isInactive === true;
      const wasOos = item.isOutOfStock === true;
      if (!wasInactive || !wasOos) {
        hasChanges = true;
      }
      hasOutOfStock = true;
      return {
        ...item,
        isInactive: true,
        isOutOfStock: true,
      };
    }

    // 2. Out of Stock Check
    const isLiveInStock =
      live.inStock !== false &&
      (live.stockQuantity === undefined || live.stockQuantity > 0);

    if (!isLiveInStock) {
      hasOutOfStock = true;
    }

    // 3. Stock Limit Check
    const availableStock = live.stockQuantity;
    const isStockExceeded =
      availableStock !== undefined && item.quantity > availableStock;

    if (isStockExceeded) {
      hasStockExceeded = true;
    }

    // 4. Price Change Check: compare live price against the price when added
    const recordedPrice = item.addedPrice ?? item.product.price;
    const isPriceChanged = live.price !== recordedPrice;
    if (isPriceChanged) {
      hasPriceChange = true;
    }

    // 5. Detect if in-memory item state actually needs an update
    const needsUpdate =
      item.product.price !== live.price ||
      item.product.mrp !== live.mrp ||
      item.product.inStock !== live.inStock ||
      item.product.stockQuantity !== live.stockQuantity ||
      item.product.name !== live.name ||
      item.product.unit !== live.unit ||
      item.product.image !== live.image ||
      Boolean(item.isOutOfStock) !== !isLiveInStock ||
      Boolean(item.stockExceeded) !== isStockExceeded ||
      item.availableStock !== availableStock ||
      Boolean(item.priceChanged) !== isPriceChanged ||
      item.addedPrice !== recordedPrice ||
      Boolean(item.isInactive);

    if (needsUpdate) {
      hasChanges = true;
    }

    // Always use the latest live price for subtotal calculation
    verifiedSubtotal += live.price * item.quantity;

    return {
      product: {
        ...item.product,
        ...live,
      },
      quantity: item.quantity,
      addedPrice: recordedPrice,
      priceChanged: isPriceChanged,
      previousPrice: isPriceChanged ? recordedPrice : undefined,
      isOutOfStock: !isLiveInStock,
      stockExceeded: isStockExceeded,
      availableStock,
      isInactive: false,
    };
  });

  return {
    items: updatedItems,
    hasChanges,
    hasPriceChange,
    hasOutOfStock,
    hasStockExceeded,
    verifiedSubtotal,
  };
}

const catalog: any[] = [
  {
    id: "p1",
    name: "Almonds",
    price: 249, // Updated price in catalog
    inStock: true,
    active: true,
    category: "nuts",
    image: "",
    unit: "250g",
  },
];

let items: any[] = [
  {
    product: {
      id: "p1",
      name: "Almonds",
      price: 199, // Old price when added
      inStock: true,
      active: true,
      category: "nuts",
      image: "",
      unit: "250g",
    },
    quantity: 1,
    addedPrice: 199,
  },
];

console.log("--- Testing fixed validation function ---");
for (let step = 1; step <= 5; step++) {
  const result = fixedValidateCartWithLiveCatalog(items, catalog);
  console.log(`Step ${step}: hasChanges = ${result.hasChanges}, hasPriceChange = ${result.hasPriceChange}, verifiedSubtotal = ${result.verifiedSubtotal}`);
  items = result.items;
}
