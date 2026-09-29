// Single source of truth for the product columns the storefront and admin read.
export const PRODUCT_SELECT =
  "id, category_id, name, name_ar, slug, short_description, short_description_ar, details, base_price, discount_type, discount_value, sale_start, sale_end, vat_rate, min_order_qty, min_order_value, allows_vessel, vessel_price, vessel_deposit, is_rental, rental_monthly_price, rental_min_months, rental_deposit, status, tags, product_images(id, url, alt, position, is_primary), categories(name, name_ar, slug)";
