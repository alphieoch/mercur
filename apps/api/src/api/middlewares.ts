import { defineMiddlewares } from "@medusajs/medusa";
import { adminReviewsMiddlewares } from "./admin/reviews/middlewares";
import { vendorReviewsMiddlewares } from "./vendor/reviews/middlewares";
import { storeReviewMiddlewares } from "./store/reviews/middlewares";
import { storeWishlistMiddlewares } from "./store/wishlist/middlewares";
import { meilisearchStoreMiddlewares } from "./store/meilisearch/products/search/middlewares";
import { productImportExportMiddlewares } from "./vendor/products/middlewares";

export default defineMiddlewares({
  routes: [
    ...adminReviewsMiddlewares,
    ...vendorReviewsMiddlewares,
    ...storeReviewMiddlewares,
    ...storeWishlistMiddlewares,
    ...meilisearchStoreMiddlewares,
    ...productImportExportMiddlewares,
  ],
});
