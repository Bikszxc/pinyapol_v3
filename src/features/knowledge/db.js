import { supabase } from '../../lib/supabase.js';

// ═══════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════

export async function getKnowledgeConfig(guildId) {
    const { data, error } = await supabase
        .from('dcbot_knowledge_config')
        .select('*')
        .eq('guild_id', guildId)
        .single();

    if (error && error.code !== 'PGRST116') console.error('[Knowledge] Config fetch error:', error);
    return data;
}

export async function upsertKnowledgeConfig(guildId, updates) {
    const { data, error } = await supabase
        .from('dcbot_knowledge_config')
        .upsert({ guild_id: guildId, ...updates }, { onConflict: 'guild_id' })
        .select()
        .single();

    if (error) console.error('[Knowledge] Config upsert error:', error);
    return data;
}

export async function getCategories(guildId) {
    const config = await getKnowledgeConfig(guildId);
    return config?.categories || ['gameplay', 'rules', 'mods', 'tips', 'general'];
}

export async function addCategory(guildId, name, emoji) {
    const config = await getKnowledgeConfig(guildId);
    const categories = config?.categories || ['gameplay', 'rules', 'mods', 'tips', 'general'];
    const entry = { name, emoji };

    if (categories.some(c => (typeof c === 'string' ? c : c.name) === name)) {
        return { error: 'Category already exists' };
    }

    categories.push(entry);
    return upsertKnowledgeConfig(guildId, { categories });
}

export async function removeCategory(guildId, name) {
    const config = await getKnowledgeConfig(guildId);
    const categories = config?.categories || [];
    const filtered = categories.filter(c => (typeof c === 'string' ? c : c.name) !== name);

    if (filtered.length === categories.length) {
        return { error: 'Category not found' };
    }

    return upsertKnowledgeConfig(guildId, { categories: filtered });
}

// ═══════════════════════════════════════════
//  ROLE MANAGEMENT
// ═══════════════════════════════════════════

export async function addRoleToList(guildId, listKey, roleId) {
    const config = await getKnowledgeConfig(guildId);
    const roles = config?.[listKey] || [];

    if (roles.includes(roleId)) return { error: 'Role already in list' };

    roles.push(roleId);
    return upsertKnowledgeConfig(guildId, { [listKey]: roles });
}

export async function removeRoleFromList(guildId, listKey, roleId) {
    const config = await getKnowledgeConfig(guildId);
    const roles = config?.[listKey] || [];
    const filtered = roles.filter(r => r !== roleId);

    if (filtered.length === roles.length) return { error: 'Role not in list' };

    return upsertKnowledgeConfig(guildId, { [listKey]: filtered });
}

// ═══════════════════════════════════════════
//  PENDING CONTRIBUTIONS
// ═══════════════════════════════════════════

export async function createPending(data) {
    const { data: row, error } = await supabase
        .from('dcbot_knowledge_pending')
        .insert(data)
        .select()
        .single();

    if (error) console.error('[Knowledge] Create pending error:', error);
    return row;
}

export async function getNextPending(guildId) {
    const { data, error } = await supabase
        .from('dcbot_knowledge_pending')
        .select('*')
        .eq('guild_id', guildId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') console.error('[Knowledge] Get pending error:', error);
    return data;
}

export async function updatePending(id, updates) {
    const { data, error } = await supabase
        .from('dcbot_knowledge_pending')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) console.error('[Knowledge] Update pending error:', error);
    return data;
}

export async function countUserPending(guildId, userId) {
    const { count, error } = await supabase
        .from('dcbot_knowledge_pending')
        .select('*', { count: 'exact', head: true })
        .eq('guild_id', guildId)
        .eq('contributor_id', userId)
        .eq('status', 'pending');

    if (error) console.error('[Knowledge] Count pending error:', error);
    return count || 0;
}

export async function getPendingCount(guildId) {
    const { count, error } = await supabase
        .from('dcbot_knowledge_pending')
        .select('*', { count: 'exact', head: true })
        .eq('guild_id', guildId)
        .eq('status', 'pending');

    if (error) console.error('[Knowledge] Pending count error:', error);
    return count || 0;
}

// ═══════════════════════════════════════════
//  KNOWLEDGE DOCS (for source attribution)
// ═══════════════════════════════════════════

export async function searchDocsByTitle(guildId, query) {
    const { data, error } = await supabase
        .from('dcbot_knowledge_docs')
        .select('id, content, metadata')
        .filter('metadata->>guild_id', 'eq', guildId)
        .filter('metadata->>status', 'eq', 'approved')
        .textSearch('content', query, { type: 'websearch' })
        .limit(10);

    if (error) console.error('[Knowledge] Search error:', error);
    return data || [];
}

export async function getRecentDocs(guildId, limit = 5) {
    const { data, error } = await supabase
        .from('dcbot_knowledge_docs')
        .select('id, content, metadata, created_at')
        .filter('metadata->>guild_id', 'eq', guildId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) console.error('[Knowledge] Recent docs error:', error);
    return data || [];
}

/**
 * Get unique contributor IDs from knowledge docs for a guild.
 */
export async function getContributorIds(guildId) {
    const { data, error } = await supabase
        .from('dcbot_knowledge_docs')
        .select('metadata')
        .filter('metadata->>guild_id', 'eq', guildId)
        .filter('metadata->>status', 'eq', 'approved')
        .not('metadata->>contributor_id', 'is', null);

    if (error) console.error('[Knowledge] Contributors error:', error);
    if (!data) return [];

    const ids = [...new Set(data.map(d => d.metadata?.contributor_id).filter(Boolean))];
    return ids;
}
