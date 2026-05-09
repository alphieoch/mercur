import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";

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

async function createCategoryTree(
  productModule: any,
  categories: any[],
  parentId?: string
) {
  const results: any[] = [];
  for (const cat of categories) {
    const { children, ...categoryData } = cat;
    const input = {
      ...categoryData,
      parent_category_id: parentId,
    };
    const created = await productModule.createProductCategories([input]);
    results.push(...created);
    if (children?.length) {
      const childResults = await createCategoryTree(productModule, children, created[0].id);
      results.push(...childResults);
    }
  }
  return results;
}

export default async function seedFarmData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const productModule = container.resolve(Modules.PRODUCT);
  const customerModule = container.resolve(Modules.CUSTOMER);
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL);
  let attributeModuleService: any;
  try {
    attributeModuleService = container.resolve("ATTRIBUTE_MODULE" as any);
  } catch {
    logger.warn("ATTRIBUTE_MODULE not available in exec context. Attributes will be skipped.");
  }

  logger.info("=== Seeding Farm Marketplace Data ===");

  // ─── 1. Product Categories ───
  logger.info("Checking existing categories...");
  const existingCats = await productModule.listProductCategories({});
  if (existingCats.length > 4) {
    logger.info(`Found ${existingCats.length} categories, skipping category seed.`);
  } else {
    logger.info("Creating farm product categories...");
    await createCategoryTree(productModule, FARM_CATEGORIES);
    logger.info("Farm categories created.");
  }

  // ─── 2. Product Types ───
  logger.info("Creating farm product types...");
  const existingTypes = await productModule.listProductTypes({});
  const existingTypeValues = new Set(existingTypes.map((t: any) => t.value));
  const typesToCreate = FARM_PRODUCT_TYPES.filter((t) => !existingTypeValues.has(t));
  if (typesToCreate.length) {
    await productModule.createProductTypes(typesToCreate.map((t) => ({ value: t })));
    logger.info(`Created ${typesToCreate.length} product types.`);
  } else {
    logger.info("Product types already exist, skipping.");
  }

  // ─── 3. B2B Customer Groups ───
  logger.info("Creating B2B customer groups...");
  const existingGroups = await customerModule.listCustomerGroups({});
  const existingGroupNames = new Set(existingGroups.map((g: any) => g.name));
  const groupsToCreate = B2B_CUSTOMER_GROUPS.filter((g) => !existingGroupNames.has(g.name));
  if (groupsToCreate.length) {
    await customerModule.createCustomerGroups(groupsToCreate);
    logger.info(`Created ${groupsToCreate.length} B2B customer groups.`);
  } else {
    logger.info("Customer groups already exist, skipping.");
  }

  // ─── 4. Farm Attributes ───
  logger.info("Creating farm attributes...");
  const categories = await productModule.listProductCategories({});
  const vegCat = categories.find((c: any) => c.handle === "vegetables");
  const fruitCat = categories.find((c: any) => c.handle === "fruits");
  const dairyCat = categories.find((c: any) => c.handle === "dairy-eggs");
  const meatCat = categories.find((c: any) => c.handle === "meat-poultry");
  const produceCats = [vegCat?.id, fruitCat?.id].filter(Boolean) as string[];
  const perishableCats = [vegCat?.id, fruitCat?.id, dairyCat?.id, meatCat?.id].filter(Boolean) as string[];

  const attributeInputs = [
    {
      name: "Harvest Date",
      handle: "harvest-date",
      description: "Date the product was harvested",
      ui_component: "text_area",
      is_required: false,
      is_filterable: false,
      product_category_ids: produceCats,
    },
    {
      name: "Best Before Date",
      handle: "best-before-date",
      description: "Recommended consumption date",
      ui_component: "text_area",
      is_required: false,
      is_filterable: false,
      product_category_ids: perishableCats,
    },
    {
      name: "Unit of Measure",
      handle: "unit-of-measure",
      description: "How the product is sold",
      ui_component: "select",
      is_required: true,
      is_filterable: true,
      possible_values: [
        { value: "lb", rank: 0 },
        { value: "oz", rank: 1 },
        { value: "kg", rank: 2 },
        { value: "bunch", rank: 3 },
        { value: "dozen", rank: 4 },
        { value: "each", rank: 5 },
        { value: "gallon", rank: 6 },
        { value: "quart", rank: 7 },
        { value: "case", rank: 8 },
      ],
    },
    {
      name: "Certifications",
      handle: "certifications",
      description: "Farm and product certifications",
      ui_component: "multivalue",
      is_required: false,
      is_filterable: true,
      possible_values: [
        { value: "USDA Organic", rank: 0 },
        { value: "Non-GMO Project Verified", rank: 1 },
        { value: "Animal Welfare Approved", rank: 2 },
        { value: "Certified Humane", rank: 3 },
        { value: "Biodynamic", rank: 4 },
        { value: "Fair Trade", rank: 5 },
        { value: "GAP Certified", rank: 6 },
      ],
    },
    {
      name: "Growing Practice",
      handle: "growing-practice",
      description: "How the product was grown or raised",
      ui_component: "select",
      is_required: false,
      is_filterable: true,
      possible_values: [
        { value: "Organic", rank: 0 },
        { value: "Conventional", rank: 1 },
        { value: "Hydroponic", rank: 2 },
        { value: "Greenhouse", rank: 3 },
        { value: "Regenerative", rank: 4 },
        { value: "Permaculture", rank: 5 },
      ],
      product_category_ids: produceCats,
    },
    {
      name: "Allergens",
      handle: "allergens",
      description: "Common allergens present",
      ui_component: "multivalue",
      is_required: false,
      is_filterable: true,
      possible_values: [
        { value: "None", rank: 0 },
        { value: "Dairy", rank: 1 },
        { value: "Eggs", rank: 2 },
        { value: "Wheat/Gluten", rank: 3 },
        { value: "Soy", rank: 4 },
        { value: "Tree Nuts", rank: 5 },
        { value: "Peanuts", rank: 6 },
      ],
    },
    {
      name: "Minimum Order Quantity",
      handle: "minimum-order-quantity",
      description: "Minimum units required per order (B2B)",
      ui_component: "text_area",
      is_required: false,
      is_filterable: false,
    },
    {
      name: "Case Size",
      handle: "case-size",
      description: "Number of units per case (B2B wholesale)",
      ui_component: "text_area",
      is_required: false,
      is_filterable: false,
    },
    {
      name: "Farm Location",
      handle: "farm-location",
      description: "City/State of the farm",
      ui_component: "text_area",
      is_required: false,
      is_filterable: true,
    },
  ];

  if (attributeModuleService) {
    const existingAttributes = await attributeModuleService.listAttributes({});
    const existingAttrHandles = new Set(existingAttributes.map((a: any) => a.handle));
    const newAttributes = attributeInputs.filter((a) => !existingAttrHandles.has(a.handle));

    if (newAttributes.length) {
      for (const attr of newAttributes) {
        await attributeModuleService.createAttributes([attr]);
      }
      logger.info(`Created ${newAttributes.length} farm attributes.`);
    } else {
      logger.info("Farm attributes already exist, skipping.");
    }
  }

  // ─── 5. Demo Farm Sellers ───
  logger.info("Creating demo farm sellers...");
  const existingSellers = await query.graph({
    entity: "seller",
    fields: ["id", "handle"],
  });
  if (existingSellers.data.length > 1) {
    logger.info(`${existingSellers.data.length} sellers exist, skipping demo sellers.`);
  } else {
    const sellerService = container.resolve("SELLER_MODULE" as any);
    const demoSellers = [
      {
        name: "Green Acres Farm",
        handle: "green-acres-farm",
        email: "hello@greenacres.farm",
        phone: "555-0101",
        description: "Family-owned organic vegetable farm since 1985. We grow over 40 varieties of seasonal produce using regenerative farming practices.",
      },
      {
        name: "Sunset Valley Dairy",
        handle: "sunset-valley-dairy",
        email: "orders@sunsetvalleydairy.com",
        phone: "555-0102",
        description: "Grass-fed dairy farm producing raw milk, artisan cheeses, and farm-fresh eggs from our pasture-raised hens.",
      },
      {
        name: "Heritage Meat Co.",
        handle: "heritage-meat-co",
        email: "sales@heritagemeat.co",
        phone: "555-0103",
        description: "Ethically raised heritage breed pork, grass-fed beef, and pasture-raised poultry. Animal Welfare Approved.",
      },
    ];
    for (const seller of demoSellers) {
      try {
        await sellerService.createSellers([seller]);
        logger.info(`Created seller: ${seller.name}`);
      } catch (e: any) {
        logger.warn(`Seller ${seller.handle} may already exist: ${e.message}`);
      }
    }
  }

  // ─── 6. Demo Farm Products ───
  logger.info("Creating demo farm products...");
  const salesChannels = await salesChannelModule.listSalesChannels({});
  const defaultSalesChannel = salesChannels[0];

  const allCats = await productModule.listProductCategories({});
  const findCat = (handle: string) => allCats.find((c: any) => c.handle === handle);

  const allTypes = await productModule.listProductTypes({});
  const findType = (value: string) => allTypes.find((t: any) => t.value === value);

  const sellers = await query.graph({ entity: "seller", fields: ["id", "handle"] });

  const demoProducts = [
    {
      title: "Organic Heirloom Tomatoes",
      handle: "organic-heirloom-tomatoes",
      description: "Mixed variety heirloom tomatoes, vine-ripened and harvested daily. Perfect for salads, sauces, or eating fresh.",
      category_handle: "tomatoes-peppers",
      type_value: "Heirloom",
      seller_handle: "green-acres-farm",
      price: 450,
      unit: "lb",
      image: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800",
    },
    {
      title: "Fresh Mixed Salad Greens",
      handle: "fresh-mixed-salad-greens",
      description: "A blend of baby lettuce, arugula, spinach, and mustard greens. Washed and ready to eat.",
      category_handle: "leafy-greens",
      type_value: "Organic",
      seller_handle: "green-acres-farm",
      price: 600,
      unit: "bunch",
      image: "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?w=800",
    },
    {
      title: "Raw Whole Milk",
      handle: "raw-whole-milk",
      description: "Creamy, nutrient-rich raw milk from our grass-fed Jersey cows. Unpasteurized and non-homogenized.",
      category_handle: "milk",
      type_value: "Raw",
      seller_handle: "sunset-valley-dairy",
      price: 800,
      unit: "gallon",
      image: "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=800",
    },
    {
      title: "Farm Fresh Eggs",
      handle: "farm-fresh-eggs",
      description: "Pasture-raised eggs from happy hens. Rich orange yolks and firm whites. Available in mixed colors.",
      category_handle: "eggs",
      type_value: "Pasture-Raised",
      seller_handle: "sunset-valley-dairy",
      price: 650,
      unit: "dozen",
      image: "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=800",
    },
    {
      title: "Grass-Fed Ground Beef",
      handle: "grass-fed-ground-beef",
      description: "85% lean ground beef from 100% grass-fed Angus cattle. No antibiotics, no hormones.",
      category_handle: "beef",
      type_value: "Grass-Fed",
      seller_handle: "heritage-meat-co",
      price: 950,
      unit: "lb",
      image: "https://images.unsplash.com/photo-1603048297172-c92544798d5e?w=800",
    },
    {
      title: "Heritage Breed Pork Chops",
      handle: "heritage-breed-pork-chops",
      description: "Bone-in pork chops from Berkshire hogs raised on pasture. Exceptionally marbled and flavorful.",
      category_handle: "pork",
      type_value: "Heritage",
      seller_handle: "heritage-meat-co",
      price: 1200,
      unit: "lb",
      image: "https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=800",
    },
  ];

  const existingProducts = await productModule.listProducts({});
  const existingProdHandles = new Set(existingProducts.map((p: any) => p.handle));
  const productsToCreate = demoProducts.filter((p) => !existingProdHandles.has(p.handle));

  if (productsToCreate.length && defaultSalesChannel) {
    for (const p of productsToCreate) {
      const cat = findCat(p.category_handle);
      const type = findType(p.type_value);
      const seller = sellers.data.find((s: any) => s.handle === p.seller_handle);
      try {
        await productModule.createProducts([
          {
            title: p.title,
            handle: p.handle,
            description: p.description,
            status: ProductStatus.PUBLISHED,
            category_ids: cat ? [cat.id] : [],
            type_id: type?.id,
            images: p.image ? [{ url: p.image }] : [],
            variants: [
              {
                title: p.unit,
                sku: p.handle.toUpperCase().replace(/-/g, "_"),
                prices: [
                  {
                    amount: p.price,
                    currency_code: "usd",
                  },
                ],
                options: {},
              },
            ],
            sales_channels: [{ id: defaultSalesChannel.id }],
            metadata: {
              seller_id: seller?.id,
              unit_of_measure: p.unit,
            },
          },
        ]);
        logger.info(`Created product: ${p.title}`);
      } catch (e: any) {
        logger.warn(`Failed to create product ${p.handle}: ${e.message}`);
      }
    }
  } else {
    logger.info("Demo products already exist or no sales channel found, skipping.");
  }

  logger.info("=== Farm Marketplace Seed Complete ===");
}
