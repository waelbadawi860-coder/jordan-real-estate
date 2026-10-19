-- =============================================================================
-- Fix: functions in the public schema were still executable by PUBLIC (which
-- includes anon), so get_listing_contact() and expire_listings() could be
-- called by anyone through the API.
--
-- Cause: PostgreSQL ignores "ALTER DEFAULT PRIVILEGES ... IN SCHEMA ... REVOKE
-- ... FROM PUBLIC" for functions — the PUBLIC execute default can only be
-- removed globally (without IN SCHEMA).
--
-- After this migration only the explicit grants made in earlier migrations
-- remain (anon/authenticated on the policy helpers and user actions;
-- service_role on everything).
-- =============================================================================

-- Future functions: no execute for PUBLIC unless granted explicitly.
alter default privileges for role postgres revoke execute on functions from public;

-- Existing functions.
revoke execute on all functions in schema public from public;
