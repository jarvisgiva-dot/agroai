import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function createAdmin() {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log("Creating user...")
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: 'jarvisgiva@gmail.com',
        password: 'admin',
        email_confirm: true,
        user_metadata: { full_name: 'Stark Admin' }
    })

    if (authError) {
        console.error("Auth error:", authError.message)
        // If user already exists, let's fetch it
        const { data: usersData } = await supabase.auth.admin.listUsers()
        const user = usersData?.users?.find(u => u.email === 'jarvisgiva@gmail.com')
        if (user) {
            console.log("User already exists, updating role...")
            await supabase.from('user_profiles').upsert({ id: user.id, email: user.email, role: 'admin', approved: true })
        }
        return
    }

    const user = authData.user
    if (!user) return;
    console.log("User created:", user.id)

    console.log("Assigning admin role...")
    const { error: profileError } = await supabase.from('user_profiles').upsert({
        id: user.id,
        email: user.email,
        role: 'admin',
        approved: true,
        full_name: 'Stark Admin'
    })

    if (profileError) {
        console.error("Profile error:", profileError.message)
    } else {
        console.log("Admin account created successfully!")
    }
}

createAdmin()
