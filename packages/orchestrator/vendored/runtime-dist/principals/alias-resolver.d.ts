/**
 * Principal alias resolver.
 *
 * Maps strings observed in the wild (WhatsApp push_name, GitHub commit
 * author, email From, meeting transcript renderings) to a canonical
 * principal_id by matching against `principals.identifiers` (jsonb array).
 *
 * Why this exists: the per-person zoom-in surfaced that one human can have
 * 4+ different name spellings across systems (Yitzchak / Yitchak Shaul Levin
 * / Issac Brown / Epikaai / yy@upvlu.com). Without alias resolution, every
 * message from that person has actor_id=null — losing a key dimension for
 * downstream L2/L3 fusion.
 *
 * The resolver does:
 *   1. Exact match against any string in identifiers[]
 *   2. Case-insensitive match
 *   3. (Optional) substring containment for two-word names
 *
 * It does NOT do fuzzy / Levenshtein matching — that's risky for false
 * positives. If a name doesn't match any alias, return null and log it so
 * an operator can extend identifiers[] for that principal.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
export interface PrincipalAliasMatch {
    principal_id: string;
    canonical_id: string;
    display_name: string;
    matched_alias: string;
    match_type: 'exact' | 'case_insensitive' | 'contains';
}
export declare function resolveAlias(db: SupabaseClient, args: {
    tenantId: string;
    raw: string | null | undefined;
    allowContains?: boolean;
}): Promise<PrincipalAliasMatch | null>;
/** Force-refresh the cache for a tenant — useful after bulk identifier updates. */
export declare function invalidateAliasCache(tenantId?: string): void;
//# sourceMappingURL=alias-resolver.d.ts.map