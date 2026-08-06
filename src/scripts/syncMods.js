import dotenv from 'dotenv';
import { syncModsSilent } from '../features/workshopTracker/index.js';

dotenv.config();

async function main() {
    console.log('🚀 Starting silent force sync of all workshop mods...');
    try {
        const result = await syncModsSilent();
        console.log(`✅ Done! Force-synced ${result.updated}/${result.total} mod(s) in database without sending Discord messages.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to force sync mods:', error);
        process.exit(1);
    }
}

main();
