import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// Boot up your connection using your secret envelope keys
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

console.log("🎮 Melody Markets Backend is awake and connecting to Supabase...");

async function testConnection() {
    // Check if Supabase can talk back
    const { data, error } = await supabase.from('players').select('*').limit(1).maybeSingle();

    if (error) {
        console.log("❌ Connection failed. Check your keys in the .env file!", error.message);
    } else {
        console.log("🎉 SUCCESS! Your server is successfully connected to Supabase!");
    }
}

testConnection();