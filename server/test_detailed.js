import { findDetailedResponsesByCandidateId } from './src/models/Result.js';

async function test() {
    try {
        const rows = await findDetailedResponsesByCandidateId(24); // Use candidate 24 from earlier
        console.log(rows[0]);
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
test();
