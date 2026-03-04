import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function confirmEmail() {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log("Buscando usuário...")
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers()

    if (listError) {
        console.error("Erro ao listar usuários:", listError.message)
        return
    }

    const user = usersData.users.find(u => u.email === 'jarvisgiva@gmail.com')

    if (!user) {
        console.log("Usuário não encontrado.")
        return
    }

    console.log(`Usuário encontrado: ${user.id}. Confirmando email...`)

    const { error: updateError } = await supabase.auth.admin.updateUserById(
        user.id,
        { email_confirm: true }
    )

    if (updateError) {
        console.error("Erro ao confirmar email:", updateError.message)
    } else {
        console.log("✅ Email confirmado com sucesso! O usuário já pode logar.")
    }
}

confirmEmail()
