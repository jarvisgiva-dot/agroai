
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

console.log('Keys:', Object.keys(process.env).filter(k => k.includes('URL') || k.includes('KEY')));
