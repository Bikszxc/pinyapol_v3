/**
 * n8n webhook integration — HTTP calls for RAG query and document ingestion.
 */

/**
 * Ask the knowledge base a question via n8n RAG webhook.
 * @param {object} config - Guild knowledge config (contains n8n URLs + auth key)
 * @param {string} question - The user's question
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<{response: string}>}
 */
export async function askQuestion(config, question, guildId) {
    if (!config?.n8n_ask_url) throw new Error('n8n ask URL not configured');

    const res = await fetch(config.n8n_ask_url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(config.n8n_auth_key ? { 'X-Api-Key': config.n8n_auth_key } : {}),
        },
        body: JSON.stringify({ question, guild_id: guildId }),
    });

    if (!res.ok) throw new Error(`n8n ask webhook failed: ${res.status}`);

    const data = await res.json();
    // Q&A Chain returns array with {response} or {text}
    if (Array.isArray(data)) return data[0];
    return data;
}

/**
 * Ingest an approved document into the knowledge base via n8n.
 * @param {object} config - Guild knowledge config
 * @param {object} doc - Document to ingest
 * @returns {Promise<object>}
 */
export async function ingestDocument(config, doc) {
    if (!config?.n8n_ingest_url) throw new Error('n8n ingest URL not configured');

    const res = await fetch(config.n8n_ingest_url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(config.n8n_auth_key ? { 'X-Api-Key': config.n8n_auth_key } : {}),
        },
        body: JSON.stringify({
            title: doc.title,
            content: doc.content,
            category: doc.category,
            contributor_id: doc.contributor_id,
            guild_id: doc.guild_id,
        }),
    });

    if (!res.ok) throw new Error(`n8n ingest webhook failed: ${res.status}`);

    return res.json();
}
