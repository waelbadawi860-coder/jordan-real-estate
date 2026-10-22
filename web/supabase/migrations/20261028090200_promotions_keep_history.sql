-- Like the listing status history, the promotion record must survive the
-- deletion of its listing (and must not block it), so it no longer has a
-- foreign key to the listing.
alter table public.listing_promotions drop constraint listing_promotions_listing_id_fkey;
