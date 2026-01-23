const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://supabase.poscalfx.com';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqlbS-PHK5vqusbcbo7X36Yt4Q';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function listTables() {
  try {
    const { data, error } = await supabase.rpc('list_tables', {}, {
      count: 'exact',
    }).catch(() => null);

    // Fallback: use direct query
    const query = `
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name
    `;

    const { data: tables, error: queryError } = await supabase.from('any_table').select('*').limit(0);
    
    console.log('Attempting direct query...');
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

listTables();
