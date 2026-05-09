import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils";

const FARM_CATEGORIES = [
  {
    name: "Produce",
    description: "Fresh fruits and vegetables",
    handle: "produce",
    is_internal: false,
    is_active: true,
    rank: 0,
    children: [
      { name: "Vegetables", handle: "vegetables", rank: 0, children: [
        { name: "Leafy Greens", handle: "leafy-greens", rank: 0 },
        { name: "Root Vegetables", handle: "root-vegetables", rank: 1 },
        { name: "Squashes", handle: "squashes", rank: 2 },
        { name: "Tomatoes & Peppers", handle: "tomatoes-peppers", rank: 3 },
        { name: "Alliums", handle: "alliums", rank: 4 },
        { name: "Brassicas", handle: "brassicas", rank: 5 },
      ]},
      { name: "Fruits", handle: "fruits", rank: 1, children: [
        { name: "Berries", handle: "berries", rank: 0 },
        { name: "Tree Fruits", handle: "tree-fruits", rank: 1 },
        { name: "Citrus", handle: "citrus", rank: 2 },
        { name: "Melons", handle: "melons", rank: 3 },
      ]},
    ],
  },
  {
    name: "Dairy & Eggs",
    description: "Milk, cheese, eggs and more",
    handle: "dairy-eggs",
    is_internal: false,
    is_active: true,
    rank: 1,
    children: [
      { name: "Milk", handle: "milk", rank: 0 },
      { name: "Cheese", handle: "cheese", rank: 1 },
      { name: "Butter & Cream", handle: "butter-cream", rank: 2 },
      { name: "Yogurt", handle: "yogurt", rank: 3 },
      { name: "Eggs", handle: "eggs", rank: 4 },
    ],
  },
  {
    name: "Meat & Poultry",
    description: "Fresh and frozen meats",
    handle: "meat-poultry",
    is_internal: false,
    is_active: true,
    rank: 2,
    children: [
      { name: "Beef", handle: "beef", rank: 0 },
      { name: "Pork", handle: "pork", rank: 1 },
      { name: "Lamb", handle: "lamb", rank: 2 },
      { name: "Chicken", handle: "chicken", rank: 3 },
      { name: "Turkey", handle: "turkey", rank: 4 },
      { name: "Duck", handle: "duck", rank: 5 },
    ],
  },
  {
    name: "Pantry",
    description: "Preserves, baked goods, and dry goods",
    handle: "pantry",
    is_internal: false,
    is_active: true,
    rank: 3,
    children: [
      { name: "Honey", handle: "honey", rank: 0 },
      { name: "Jams & Preserves", handle: "jams-preserves", rank: 1 },
      { name: "Oils & Vinegars", handle: "oils-vinegars", rank: 2 },
      { name: "Baked Goods", handle: "baked-goods", rank: 3 },
      { name: "Dried Goods", handle: "dried-goods", rank: 4 },
    ],
  },
  {
    name: "Plants & Seeds",
    description: "Seedlings, seeds, and flowers",
    handle: "plants-seeds",
    is_internal: false,
    is_active: true,
    rank: 4,
    children: [
      { name: "Seedlings", handle: "seedlings", rank: 0 },
      { name: "Seeds", handle: "seeds", rank: 1 },
      { name: "Cut Flowers", handle: "cut-flowers", rank: 2 },
      { name: "Herbs", handle: "herbs", rank: 3 },
    ],
  },
];

const FARM_PRODUCT_TYPES = [
  "Organic", "Conventional", "Certified Organic", "Biodynamic",
  "Grass-Fed", "Grain-Fed", "Pasture-Raised", "Free-Range", "Cage-Free",
  "Heirloom", "Heritage", "GMO-Free", "Raw", "Pasteurized", "Aged",
];

const B2B_CUSTOMER_GROUPS = [
  { name: "Wholesale", metadata: { type: "b2b_wholesale" } },
  { name: "Restaurant", metadata: { type: "b2b_restaurant" } },
  { name: "Grocer", metadata: { type: "b2b_grocer" } },
];

async function createCategoryTree(productModule: any, categories: any[], parentId?: string) {
  const results: any[] = [];
  for (const cat of categories) {
    const { children, ...categoryData } = cat;
    const input = { ...categoryData, parent_category_id: parentId };
    const created = await productModule.createProductCategories([input]);
    results.push(...created);
    if (children?.length) {
      const childResults = await createCategoryTree(productModule, children, created[0].id);
      results.push(...childResults);
    }
  }
  return results;
}

async function seedFarmData(req: MedusaRequest) {
  const container = req.scope;
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const productModule = container.resolve(Modules.PRODUCT);
  const customerModule = container.resolve(Modules.CUSTOMER);
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL);

  logger.info("=== Seeding Farm Marketplace Data ===");

  // Categories
  const existingCats = await productModule.listProductCategories({});
  if (existingCats.length <= 4) {
    await createCategoryTree(productModule, FARM_CATEGORIES);
    logger.info("Farm categories created.");
  }

  // Product Types
  const existingTypes = await productModule.listProductTypes({});
  const existingTypeValues = new Set(existingTypes.map((t: any) => t.value));
  const typesToCreate = FARM_PRODUCT_TYPES.filter((t) => !existingTypeValues.has(t));
  if (typesToCreate.length) {
    await productModule.createProductTypes(typesToCreate.map((t) => ({ value: t })));
  }

  // B2B Customer Groups
  const existingGroups = await customerModule.listCustomerGroups({});
  const existingGroupNames = new Set(existingGroups.map((g: any) => g.name));
  const groupsToCreate = B2B_CUSTOMER_GROUPS.filter((g) => !existingGroupNames.has(g.name));
  if (groupsToCreate.length) {
    await customerModule.createCustomerGroups(groupsToCreate);
  }

  // Farm Attributes (via module service if available)
  let attributeModuleService: any;
  try {
    attributeModuleService = container.resolve("attribute" as any);
  } catch { /* not available */ }

  if (attributeModuleService) {
    const categories = await productModule.listProductCategories({});
    const vegCat = categories.find((c: any) => c.handle === "vegetables");
    const fruitCat = categories.find((c: any) => c.handle === "fruits");
    const dairyCat = categories.find((c: any) => c.handle === "dairy-eggs");
    const meatCat = categories.find((c: any) => c.handle === "meat-poultry");
    const produceCats = [vegCat?.id, fruitCat?.id].filter(Boolean) as string[];
    const perishableCats = [vegCat?.id, fruitCat?.id, dairyCat?.id, meatCat?.id].filter(Boolean) as string[];

    const attributeInputs = [
      { name: "Harvest Date", handle: "harvest-date", ui_component: "text_area", is_required: false, is_filterable: false, product_category_ids: produceCats },
      { name: "Best Before Date", handle: "best-before-date", ui_component: "text_area", is_required: false, is_filterable: false, product_category_ids: perishableCats },
      { name: "Unit of Measure", handle: "unit-of-measure", ui_component: "select", is_required: true, is_filterable: true, possible_values: [{ value: "lb", rank: 0 }, { value: "oz", rank: 1 }, { value: "kg", rank: 2 }, { value: "bunch", rank: 3 }, { value: "dozen", rank: 4 }, { value: "each", rank: 5 }, { value: "gallon", rank: 6 }, { value: "quart", rank: 7 }, { value: "case", rank: 8 }] },
      { name: "Certifications", handle: "certifications", ui_component: "multivalue", is_required: false, is_filterable: true, possible_values: [{ value: "USDA Organic", rank: 0 }, { value: "Non-GMO Project Verified", rank: 1 }, { value: "Animal Welfare Approved", rank: 2 }, { value: "Certified Humane", rank: 3 }, { value: "Biodynamic", rank: 4 }, { value: "Fair Trade", rank: 5 }, { value: "GAP Certified", rank: 6 }] },
      { name: "Growing Practice", handle: "growing-practice", ui_component: "select", is_required: false, is_filterable: true, possible_values: [{ value: "Organic", rank: 0 }, { value: "Conventional", rank: 1 }, { value: "Hydroponic", rank: 2 }, { value: "Greenhouse", rank: 3 }, { value: "Regenerative", rank: 4 }, { value: "Permaculture", rank: 5 }], product_category_ids: produceCats },
      { name: "Allergens", handle: "allergens", ui_component: "multivalue", is_required: false, is_filterable: true, possible_values: [{ value: "None", rank: 0 }, { value: "Dairy", rank: 1 }, { value: "Eggs", rank: 2 }, { value: "Wheat/Gluten", rank: 3 }, { value: "Soy", rank: 4 }, { value: "Tree Nuts", rank: 5 }, { value: "Peanuts", rank: 6 }] },
      { name: "Minimum Order Quantity", handle: "minimum-order-quantity", ui_component: "text_area", is_required: false, is_filterable: false },
      { name: "Case Size", handle: "case-size", ui_component: "text_area", is_required: false, is_filterable: false },
      { name: "Farm Location", handle: "farm-location", ui_component: "text_area", is_required: false, is_filterable: true },
    ];

    const existingAttributes = await attributeModuleService.listAttributes({});
    const existingAttrHandles = new Set(existingAttributes.map((a: any) => a.handle));
    const newAttributes = attributeInputs.filter((a) => !existingAttrHandles.has(a.handle));
    for (const attr of newAttributes) {
      await attributeModuleService.createAttributes([attr]);
    }
    logger.info(`Created ${newAttributes.length} farm attributes.`);
  }

  // Demo Farm Sellers
  const existingSellers = await query.graph({ entity: "seller", fields: ["id", "handle"] });
  if (existingSellers.data.length <= 1) {
    const sellerService = container.resolve("seller" as any);
    const demoSellers = [
      { name: "Green Acres Farm", handle: "green-acres-farm", email: "hello@greenacres.farm", phone: "555-0101", description: "Family-owned organic vegetable farm since 1985." },
      { name: "Sunset Valley Dairy", handle: "sunset-valley-dairy", email: "orders@sunsetvalleydairy.com", phone: "555-0102", description: "Grass-fed dairy farm producing raw milk and artisan cheeses." },
      { name: "Heritage Meat Co.", handle: "heritage-meat-co", email: "sales@heritagemeat.co", phone: "555-0103", description: "Ethically raised heritage breed pork and grass-fed beef." },
    ];
    for (const seller of demoSellers) {
      try { await sellerService.createSellers([seller]); } catch { /* may exist */ }
    }
  }

  // Demo Farm Products
  const salesChannels = await salesChannelModule.listSalesChannels({});
  const defaultSalesChannel = salesChannels[0];
  const allCats = await productModule.listProductCategories({});
  const allTypes = await productModule.listProductTypes({});
  const sellers = await query.graph({ entity: "seller", fields: ["id", "handle"] });
  const existingProducts = await productModule.listProducts({});
  const existingProdHandles = new Set(existingProducts.map((p: any) => p.handle));

  const demoProducts = [
    { title: "Organic Heirloom Tomatoes", handle: "organic-heirloom-tomatoes", description: "Mixed variety heirloom tomatoes, vine-ripened.", category_handle: "tomatoes-peppers", type_value: "Heirloom", seller_handle: "green-acres-farm", price: 450, unit: "lb", image: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800" },
    { title: "Fresh Mixed Salad Greens", handle: "fresh-mixed-salad-greens", description: "A blend of baby lettuce, arugula, spinach.", category_handle: "leafy-greens", type_value: "Organic", seller_handle: "green-acres-farm", price: 600, unit: "bunch", image: "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?w=800" },
    { title: "Raw Whole Milk", handle: "raw-whole-milk", description: "Creamy raw milk from grass-fed Jersey cows.", category_handle: "milk", type_value: "Raw", seller_handle: "sunset-valley-dairy", price: 800, unit: "gallon", image: "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=800" },
    { title: "Farm Fresh Eggs", handle: "farm-fresh-eggs", description: "Pasture-raised eggs from happy hens.", category_handle: "eggs", type_value: "Pasture-Raised", seller_handle: "sunset-valley-dairy", price: 650, unit: "dozen", image: "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=800" },
    { title: "Grass-Fed Ground Beef", handle: "grass-fed-ground-beef", description: "85% lean ground beef from grass-fed cattle.", category_handle: "beef", type_value: "Grass-Fed", seller_handle: "heritage-meat-co", price: 950, unit: "lb", image: "https://images.unsplash.com/photo-1603048297172-c92544798d5e?w=800" },
    { title: "Heritage Breed Pork Chops", handle: "heritage-breed-pork-chops", description: "Bone-in pork chops from Berkshire hogs.", category_handle: "pork", type_value: "Heritage", seller_handle: "heritage-meat-co", price: 1200, unit: "lb", image: "https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=800" },
  ];

  const productsToCreate = demoProducts.filter((p) => !existingProdHandles.has(p.handle));
  if (productsToCreate.length && defaultSalesChannel) {
    for (const p of productsToCreate) {
      const cat = allCats.find((c: any) => c.handle === p.category_handle);
      const type = allTypes.find((t: any) => t.value === p.type_value);
      const seller = sellers.data.find((s: any) => s.handle === p.seller_handle);
      try {
        await productModule.createProducts([{
          title: p.title, handle: p.handle, description: p.description, status: ProductStatus.PUBLISHED,
          category_ids: cat ? [cat.id] : [], type_id: type?.id,
          images: p.image ? [{ url: p.image }] : [],
          variants: [{ title: p.unit, sku: p.handle.toUpperCase().replace(/-/g, "_"), prices: [{ amount: p.price, currency_code: "usd" }], options: {} }],
          sales_channels: [{ id: defaultSalesChannel.id }],
          metadata: { seller_id: seller?.id, unit_of_measure: p.unit },
        }]);
      } catch { /* may exist */ }
    }
  }

  // Create publishable API key for storefront
  const apiKeyModule = container.resolve(Modules.API_KEY);
  const existingKeys = await apiKeyModule.listApiKeys({ type: "publishable" });
  if (!existingKeys.length) {
    const key = await apiKeyModule.createApiKeys([{
      type: "publishable",
      title: "Storefront Key",
      created_by: "",
    }]);
    logger.info(`Created publishable API key: ${key[0].token}`);
  }

  logger.info("=== Farm Marketplace Seed Complete ===");
  return { success: true, message: "Farm data seeded successfully" };
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const result = await seedFarmData(req);
    res.json(result);
  } catch (error: any) {
    console.error("SEED ERROR:", error);
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const result = await seedFarmData(req);
    res.json(result);
  } catch (error: any) {
    console.error("SEED ERROR:", error);
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
}
