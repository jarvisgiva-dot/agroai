import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bdcddbpxoahntgbhqzwg.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkY2RkYnB4b2FobnRnYmhxendnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MDIxODIsImV4cCI6MjA4ODE3ODE4Mn0.vaJOb4gTKDOMAyyna53Y0MwxyU4NwYKQoN3aq98Akyo' // anon key

async function testInsert() {
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data, error } = await supabase.from('app_settings').upsert({
        key: 'test_key',
        value: 'test_value'
    }, { onConflict: 'key' })

    if (error) {
        console.error("Erro no upsert:", error)
    } else {
        console.log("Upsert com anon key funcionou!", data)
    }
}

testInsert()
