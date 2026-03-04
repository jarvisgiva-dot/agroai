const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(process.cwd(), '.env.local');

console.log('Checking .env.local at:', envPath);

if (fs.existsSync(envPath)) {
    console.log('File exists.');
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    console.log('Keys found:', Object.keys(envConfig));

    if (envConfig.POSTGRES_URL) {
        console.log('POSTGRES_URL is present.');
    } else {
        console.log('POSTGRES_URL is MISSING.');
    }
} else {
    console.log('File does NOT exist.');
}
