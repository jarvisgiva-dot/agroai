"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { logError } from '@/lib/logger'

export function ConnectionTest() {
    const [status, setStatus] = useState<string>('Testando conexão...')

    useEffect(() => {
        async function checkConnection() {
            const url = process.env.NEXT_PUBLIC_SUPABASE_URL
            const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

            if (!url || !key) {
                setStatus('Erro: Variáveis de ambiente não encontradas.')
                logError('ConnectionTest', 'Missing env vars')
                return
            }

            if (url.includes('placeholder') || key.includes('placeholder')) {
                setStatus('Erro: Configuração inválida (Placeholder detectado). Verifique .env.local')
                logError('ConnectionTest', 'Placeholder config detected')
                return
            }

            if (!url.startsWith('https://')) {
                setStatus('Erro: URL do Supabase inválida (deve começar com https://)')
                logError('ConnectionTest', 'Invalid Supabase URL protocol')
                return
            }

            try {
                // Log configuration (masked)
                console.log('Supabase Config:', {
                    url: url ? `${url.substring(0, 15)}...` : 'MISSING',
                    hasKey: !!key
                })

                // Updated table name to 'contratos_venda'
                const { data, error } = await supabase.from('contratos_venda').select('count', { count: 'exact', head: true })

                if (error) {
                    logError('Supabase Connection', error)
                    setStatus(`Erro: ${error.message || error.code || JSON.stringify(error) || 'Erro desconhecido'}`)
                } else {
                    setStatus('Conectado ao Supabase com sucesso!')
                }
            } catch (err: any) {
                logError('Connection Exception', err)
                const message = err.message || 'Erro desconhecido'
                if (message.includes('Failed to fetch')) {
                    setStatus('Erro de Conexão: Verifique se algum AdBlock ou extensão está bloqueando o Supabase.')
                } else {
                    setStatus(`Erro Crítico: ${message}`)
                }
            }
        }

        checkConnection()
    }, [])

    return (
        <div className="fixed bottom-4 right-4 bg-black text-white p-2 rounded text-xs opacity-70 hover:opacity-100 transition-opacity">
            {status}
        </div>
    )
}
