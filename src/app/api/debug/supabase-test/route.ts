import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const configStatus = {
        url: supabaseUrl ? `${supabaseUrl.substring(0, 15)}...` : 'MISSING',
        hasKey: !!supabaseKey,
        isPlaceholder: supabaseUrl?.includes('placeholder') || supabaseKey?.includes('placeholder')
    }

    if (!supabaseUrl || !supabaseKey) {
        return NextResponse.json({
            success: false,
            message: 'Missing environment variables',
            config: configStatus
        }, { status: 500 })
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Try to fetch a single row or count to verify connection
        const { data, error } = await supabase.from('contratos_venda').select('count', { count: 'exact', head: true })

        if (error) {
            return NextResponse.json({
                success: false,
                message: 'Supabase connection failed',
                error: error,
                config: configStatus
            }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            message: 'Supabase connection successful',
            config: configStatus
        })

    } catch (err: any) {
        return NextResponse.json({
            success: false,
            message: 'Unexpected error during connection test',
            error: {
                message: err.message,
                name: err.name,
                stack: err.stack
            },
            config: configStatus
        }, { status: 500 })
    }
}
