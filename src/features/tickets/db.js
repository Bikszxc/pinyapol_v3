import { supabase } from '../../lib/supabase.js';

// ═══════════════════════════════════════════
//  DEFAULT CATEGORIES
// ═══════════════════════════════════════════

export const DEFAULT_CATEGORIES = [
    { key: 'bug', label: 'Bug Report', emoji: '🐛', color: '#E74C3C', description: 'Report in-game/website bugs or glitches' },
    { key: 'server', label: 'Server Issue', emoji: '🎮', color: '#E67E22', description: 'Connection, lag, crashes' },
    { key: 'player_report', label: 'Player Report', emoji: '👤', color: '#9B59B6', description: 'Rule violations, griefing' },
    { key: 'donation', label: 'Donation Inquiry', emoji: '💰', color: '#2ECC71', description: 'Donation questions and verification' },
    { key: 'general', label: 'General Help', emoji: '❓', color: '#3498DB', description: 'Everything else' },
];

// ═══════════════════════════════════════════
//  CONFIG CRUD (dcbot_ticket_config)
// ═══════════════════════════════════════════

/**
 * Get the ticket config for a guild. Returns null if not set up yet.
 */
export async function getConfig(guildId) {
    const { data, error } = await supabase
        .from('dcbot_ticket_config')
        .select('*')
        .eq('guild_id', guildId)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        console.error('[TicketDB] Error fetching config:', error);
    }
    return data || null;
}

/**
 * Create or update the ticket config for a guild (upsert).
 */
export async function upsertConfig(guildId, updates) {
    const { data, error } = await supabase
        .from('dcbot_ticket_config')
        .upsert(
            { guild_id: guildId, ...updates },
            { onConflict: 'guild_id' }
        )
        .select()
        .single();

    if (error) {
        console.error('[TicketDB] Error upserting config:', error);
        throw error;
    }
    return data;
}

/**
 * Get categories for a guild. Falls back to defaults if not configured.
 */
export async function getCategories(guildId) {
    const config = await getConfig(guildId);
    if (config?.categories && config.categories.length > 0) {
        return config.categories;
    }
    return DEFAULT_CATEGORIES;
}

/**
 * Add a category to the guild's config.
 */
export async function addCategory(guildId, category) {
    const categories = await getCategories(guildId);
    const exists = categories.find(c => c.key === category.key);
    if (exists) throw new Error(`Category "${category.key}" already exists.`);

    categories.push(category);
    return upsertConfig(guildId, { categories });
}

/**
 * Remove a category from the guild's config.
 */
export async function removeCategory(guildId, key) {
    const categories = await getCategories(guildId);
    const filtered = categories.filter(c => c.key !== key);
    if (filtered.length === categories.length) throw new Error(`Category "${key}" not found.`);

    return upsertConfig(guildId, { categories: filtered });
}

// ═══════════════════════════════════════════
//  TICKET CRUD (dcbot_tickets)
// ═══════════════════════════════════════════

/**
 * Get the next ticket number for a guild (atomic increment).
 */
export async function getNextTicketNumber(guildId) {
    // Fetch current counter
    const config = await getConfig(guildId);
    const nextNumber = (config?.ticket_counter || 0) + 1;

    // Update counter
    await upsertConfig(guildId, { ticket_counter: nextNumber });
    return nextNumber;
}

/**
 * Create a new ticket record.
 */
export async function createTicket(ticketData) {
    const { data, error } = await supabase
        .from('dcbot_tickets')
        .insert(ticketData)
        .select()
        .single();

    if (error) {
        console.error('[TicketDB] Error creating ticket:', error);
        throw error;
    }
    return data;
}

/**
 * Get a ticket by its channel ID.
 */
export async function getTicketByChannel(channelId) {
    const { data, error } = await supabase
        .from('dcbot_tickets')
        .select('*')
        .eq('channel_id', channelId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('[TicketDB] Error fetching ticket:', error);
    }
    return data || null;
}

/**
 * Update a ticket record.
 */
export async function updateTicket(ticketId, updates) {
    const { data, error } = await supabase
        .from('dcbot_tickets')
        .update(updates)
        .eq('id', ticketId)
        .select()
        .single();

    if (error) {
        console.error('[TicketDB] Error updating ticket:', error);
        throw error;
    }
    return data;
}

/**
 * Get all active (non-closed) tickets for a guild.
 */
export async function getActiveTickets(guildId) {
    const { data, error } = await supabase
        .from('dcbot_tickets')
        .select('*')
        .eq('guild_id', guildId)
        .neq('status', 'closed')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[TicketDB] Error fetching active tickets:', error);
        return [];
    }
    return data || [];
}

/**
 * Count open tickets for a specific user in a guild.
 */
export async function countUserOpenTickets(guildId, userId) {
    const { count, error } = await supabase
        .from('dcbot_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .neq('status', 'closed');

    if (error) {
        console.error('[TicketDB] Error counting user tickets:', error);
        return 0;
    }
    return count || 0;
}

/**
 * Save feedback for a closed ticket.
 */
export async function saveFeedback(ticketId, rating, feedback) {
    return updateTicket(ticketId, { rating, feedback });
}
