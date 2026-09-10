-- Flowers & Gifts: sample content so both the storefront and admin panel
-- render with real data. Swap the Unsplash placeholder images for real
-- product photography via the admin uploader (Phase 5).

insert into categories (name, slug, image, position) values
  ('Flower Arrangements', 'flower-arrangements',
   'https://images.unsplash.com/photo-1487070183336-b863922373d4?q=80&w=1200&auto=format&fit=crop', 1),
  ('Indoor Plants', 'indoor-plants',
   'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?q=80&w=1200&auto=format&fit=crop', 2);

insert into products (
  category_id, name, slug, short_description, details, base_price,
  discount_type, discount_value, sale_start, sale_end, vat_rate, status, tags
) values
  (
    (select id from categories where slug = 'flower-arrangements'),
    'Emerald Rose Bouquet', 'emerald-rose-bouquet',
    'Fresh garden roses in emerald and blush, hand-tied for reception desks.',
    '[{"label":"Size","value":"Medium"},{"label":"Stems","value":"24"},{"label":"Vase","value":"Included"}]',
    280.00, 'percent', 15, now() - interval '2 days', now() + interval '28 days',
    5, 'active', array['bestseller', 'roses']
  ),
  (
    (select id from categories where slug = 'flower-arrangements'),
    'Orchid Elegance Vase', 'orchid-elegance-vase',
    'White phalaenopsis orchids in a tall glass vase for lobbies and boardrooms.',
    '[{"label":"Size","value":"Large"},{"label":"Stems","value":"3 Branch"},{"label":"Vase","value":"Included"}]',
    450.00, null, null, null, null,
    5, 'active', array['orchids', 'lobby']
  ),
  (
    (select id from categories where slug = 'flower-arrangements'),
    'White Lily Centerpiece', 'white-lily-centerpiece',
    'Fragrant white lilies arranged low for meeting-room tables.',
    '[{"label":"Size","value":"Small"},{"label":"Stems","value":"12"},{"label":"Fragrance","value":"Light"}]',
    195.00, 'flat', 25, now() - interval '1 days', now() + interval '14 days',
    5, 'active', array['lilies', 'meeting-room']
  ),
  (
    (select id from categories where slug = 'flower-arrangements'),
    'Reception Desk Arrangement', 'reception-desk-arrangement',
    'Seasonal mixed blooms sized for a standard reception counter, refreshed weekly.',
    '[{"label":"Size","value":"Medium"},{"label":"Refresh","value":"Weekly"},{"label":"Setup","value":"Included"}]',
    320.00, null, null, null, null,
    5, 'active', array['recurring', 'reception']
  ),
  (
    (select id from categories where slug = 'indoor-plants'),
    'Fiddle Leaf Fig', 'fiddle-leaf-fig',
    'Statement floor plant with broad glossy leaves for corners and lobbies.',
    '[{"label":"Height","value":"150 cm"},{"label":"Care","value":"Medium"},{"label":"Planter","value":"Included"}]',
    390.00, null, null, null, null,
    5, 'active', array['statement', 'floor-plant']
  ),
  (
    (select id from categories where slug = 'indoor-plants'),
    'ZZ Plant Office Set', 'zz-plant-office-set',
    'Set of three low-maintenance ZZ plants, ideal for desks with little natural light.',
    '[{"label":"Size","value":"Small x3"},{"label":"Care","value":"Low"},{"label":"Light","value":"Low-Medium"}]',
    260.00, 'percent', 10, now() - interval '3 days', now() + interval '10 days',
    5, 'active', array['low-light', 'desk']
  ),
  (
    (select id from categories where slug = 'indoor-plants'),
    'Snake Plant Trio', 'snake-plant-trio',
    'Air-purifying snake plants in matching ceramic planters for open-plan floors.',
    '[{"label":"Size","value":"Medium x3"},{"label":"Care","value":"Very Low"},{"label":"Air Purifying","value":"Yes"}]',
    240.00, null, null, null, null,
    5, 'active', array['air-purifying']
  ),
  (
    (select id from categories where slug = 'indoor-plants'),
    'Peace Lily Planter', 'peace-lily-planter',
    'Peace lily in a woven planter, brings flowering greenery to meeting rooms.',
    '[{"label":"Height","value":"70 cm"},{"label":"Care","value":"Medium"},{"label":"Flowers","value":"Seasonal"}]',
    210.00, null, null, null, null,
    5, 'draft', array['flowering']
  );

insert into product_images (product_id, url, alt, position, is_primary) values
  ((select id from products where slug = 'emerald-rose-bouquet'),
   'https://images.unsplash.com/photo-1487070183336-b863922373d4?q=80&w=1200&auto=format&fit=crop',
   'Emerald and blush rose bouquet in a glass vase', 0, true),
  ((select id from products where slug = 'orchid-elegance-vase'),
   'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?q=80&w=1200&auto=format&fit=crop',
   'White phalaenopsis orchids in a tall glass vase', 0, true),
  ((select id from products where slug = 'white-lily-centerpiece'),
   'https://images.unsplash.com/photo-1462530260150-162092dbf011?q=80&w=1200&auto=format&fit=crop',
   'White lily centerpiece on a meeting-room table', 0, true),
  ((select id from products where slug = 'reception-desk-arrangement'),
   'https://images.unsplash.com/photo-1587049352846-4a222e784d38?q=80&w=1200&auto=format&fit=crop',
   'Mixed seasonal bloom arrangement on a reception desk', 0, true),
  ((select id from products where slug = 'fiddle-leaf-fig'),
   'https://images.unsplash.com/photo-1463320726281-696a485928c7?q=80&w=1200&auto=format&fit=crop',
   'Fiddle leaf fig floor plant in an office corner', 0, true),
  ((select id from products where slug = 'zz-plant-office-set'),
   'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?q=80&w=1200&auto=format&fit=crop',
   'Set of three ZZ plants on a desk', 0, true),
  ((select id from products where slug = 'snake-plant-trio'),
   'https://images.unsplash.com/photo-1520412099551-62b6bafeb5bb?q=80&w=1200&auto=format&fit=crop',
   'Three snake plants in matching ceramic planters', 0, true),
  ((select id from products where slug = 'peace-lily-planter'),
   'https://images.unsplash.com/photo-1485955900006-10f4d324d411?q=80&w=1200&auto=format&fit=crop',
   'Peace lily in a woven planter', 0, true);

insert into offers (title, type, value, code, scope, starts, ends, active) values
  ('Corporate Welcome — 10% Off First Order', 'percent', 10, 'CORP10', 'all',
   now() - interval '5 days', now() + interval '55 days', true),
  ('Plant Fit-Out Bundle — AED 150 Off', 'flat', 150, 'FITOUT150', 'all',
   now() - interval '2 days', now() + interval '28 days', true);

insert into blog_posts (
  title, slug, cover, excerpt, body, category, tags, status, published_at, seo_title, seo_description
) values
  (
    '5 Indoor Plants That Thrive in UAE Office Lighting',
    '5-indoor-plants-that-thrive-in-uae-office-lighting',
    'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?q=80&w=1200&auto=format&fit=crop',
    'Low-light, low-maintenance plants that hold up well under fluorescent office lighting and AC airflow.',
    'Fluorescent lighting and constant air conditioning make most offices a tough environment for plants. Here are five species — ZZ plant, snake plant, pothos, peace lily and fiddle leaf fig — that consistently perform well in UAE office fit-outs, with care notes for each.',
    'Plant Care', array['indoor-plants', 'office-design'], 'published',
    now() - interval '10 days',
    '5 Indoor Plants That Thrive in UAE Office Lighting | Flowers & Gifts',
    'Low-light, low-maintenance indoor plants that hold up in UAE offices — picks and care notes from our plant fit-out team.'
  ),
  (
    'How to Plan a Recurring Flower Program for Your Office',
    'how-to-plan-a-recurring-flower-program-for-your-office',
    'https://images.unsplash.com/photo-1487070183336-b863922373d4?q=80&w=1200&auto=format&fit=crop',
    'What to decide before signing up for weekly or bi-weekly office flower delivery — budget, placement and cadence.',
    'A recurring flower program keeps reception and meeting rooms consistently fresh without ad-hoc ordering. This guide walks office managers through setting a budget per visit, choosing a cadence, picking placements, and what to expect from a corporate florist on day one.',
    'Corporate Guides', array['recurring-service', 'corporate'], 'published',
    now() - interval '4 days',
    'Planning a Recurring Office Flower Program | Flowers & Gifts',
    'A practical guide for office managers setting up recurring flower delivery — budget, cadence and placement.'
  );
