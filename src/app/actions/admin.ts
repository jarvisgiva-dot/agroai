'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

// Initialize Supabase client with Service Role Key for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables for admin actions')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function deleteRecords(table: string, ids: number[]) {
    try {
        const { error } = await supabase
            .from(table)
            .delete()
            .in('id', ids)

        if (error) throw error

        revalidatePath('/gerenciamento')
        return { success: true, message: 'Registros excluídos com sucesso!' }
    } catch (error: any) {
        console.error('Error deleting records:', error)
        return { success: false, message: 'Erro ao excluir registros: ' + error.message }
    }
}

export async function createRecord(table: string, data: any) {
    try {
        const { error } = await supabase
            .from(table)
            .insert(data)

        if (error) throw error

        revalidatePath('/gerenciamento')
        return { success: true, message: 'Registro criado com sucesso!' }
    } catch (error: any) {
        console.error('Error creating record:', error)
        return { success: false, message: 'Erro ao criar registro: ' + error.message }
    }
}

export async function updateRecord(table: string, id: number, data: any) {
    try {
        const { error } = await supabase
            .from(table)
            .update(data)
            .eq('id', id)

        if (error) throw error

        revalidatePath('/gerenciamento')
        return { success: true, message: 'Registro atualizado com sucesso!' }
    } catch (error: any) {
        console.error('Error updating record:', error)
        return { success: false, message: 'Erro ao atualizar registro: ' + error.message }
    }
}
