import { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { MiddlewareRoute } from "@medusajs/medusa";

/**
 * Fix for seller visibility filter: the core plugin's storeProductsMiddlewares
 * adds `seller` to filterableFields which causes `Product.seller` query errors
 * because the Product entity doesn't have a seller column (it's a link).
 *
 * This middleware runs after the core middleware and replaces the invalid
 * `seller` filter with proper `id` filtering by querying open sellers via
 * the product_seller link.
 */
async function fixSellerVisibilityFilter(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const filterableFields = req.filterableFields as Record<string, any>;
  if (!filterableFields?.seller) {
    return next();
  }

  delete filterableFields.seller;

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const now = new Date();

  try {
    // Find sellers that are OPEN and not in a closure window
    const { data: sellers } = await query.graph(
      {
        entity: "seller",
        fields: ["id"],
        filters: {
          status: "open",
          $and: [
            { $or: [{ closed_from: null }, { closed_from: { $gt: now } }] },
            { $or: [{ closed_to: null }, { closed_to: { $lt: now } }] },
          ],
        },
      },
      { throwOnError: false }
    );

    if (!sellers?.length) {
      // No open sellers — return empty result
      filterableFields.id = [];
      return next();
    }

    const sellerIds = sellers.map((s: any) => s.id);

    // Find product IDs linked to these sellers
    const { data: links } = await query.graph(
      {
        entity: "product_seller",
        fields: ["product_id"],
        filters: { seller_id: sellerIds },
      },
      { throwOnError: false }
    );

    if (!links?.length) {
      filterableFields.id = [];
      return next();
    }

    const productIds = links.map((l: any) => l.product_id);

    // Merge with any existing ID filter
    if (filterableFields.id) {
      const existingIds = Array.isArray(filterableFields.id)
        ? filterableFields.id
        : [filterableFields.id];
      filterableFields.id = existingIds.filter((id: string) =>
        productIds.includes(id)
      );
      if (filterableFields.id.length === 0) {
        filterableFields.id = [];
      }
    } else {
      filterableFields.id = productIds;
    }
  } catch {
    // If anything fails, just remove the seller filter so the query doesn't crash
    // and products still show up
  }

  next();
}

export const storeProductsFixMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/products",
    middlewares: [fixSellerVisibilityFilter],
  },
  {
    method: ["GET"],
    matcher: "/store/products/:id",
    middlewares: [fixSellerVisibilityFilter],
  },
];
