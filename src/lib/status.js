import { GameDig } from 'gamedig';

export async function getServerStatus() {
    try {
        const host = process.env.PZ_SERVER_IP;
        const port = parseInt(process.env.PZ_SERVER_PORT) || 16261;

        if (!host) {
            console.warn('[ServerStatus] PZ_SERVER_IP is not configured.');
            return {
                state: 'offline',
                label: 'Offline (No IP Configured)',
                players: 0,
                maxPlayers: 0,
                map: 'N/A',
                name: 'Server'
            };
        }

        let attempt = 0;
        let lastError = null;
        while (attempt < 2) {
            try {
                const query = await GameDig.query({
                    type: 'projectzomboid',
                    host,
                    port,
                    listenport: port,
                    givenPortOnly: true,
                    attemptTimeout: 4000
                });

                return {
                    state: 'running',
                    label: 'Running',
                    players: query.players ? query.players.length : 0,
                    maxPlayers: query.maxplayers || 0,
                    map: query.map || 'Knox Country',
                    name: query.name || 'Project Zomboid Server'
                };
            } catch (err) {
                lastError = err;
                attempt++;
                if (attempt < 2) {
                    await new Promise(res => setTimeout(res, 1500));
                }
            }
        }

        return {
            state: 'offline',
            label: 'Offline',
            players: 0,
            maxPlayers: 0,
            map: 'N/A',
            name: 'Server',
            error: lastError?.message
        };
    } catch (error) {
        return {
            state: 'offline',
            label: 'Offline',
            players: 0,
            maxPlayers: 0,
            map: 'N/A',
            name: 'Server'
        };
    }
}
