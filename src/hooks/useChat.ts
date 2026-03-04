import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useToast } from '@/components/ui/use-toast'

export interface Message {
    role: 'user' | 'assistant'
    content: string
}

export function useChat() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const { toast } = useToast()
    const queryClient = useQueryClient()

    // Load history from session storage on mount
    useEffect(() => {
        const savedHistory = sessionStorage.getItem('agromind_chat_history')
        if (savedHistory) {
            setMessages(JSON.parse(savedHistory))
        } else {
            setMessages([{ role: 'assistant', content: 'Olá! Sou o MyAgroAI. Tenho acesso a todos os seus dados de produção, custos, estoque e contratos. Como posso ajudar você hoje?' }])
        }
    }, [])

    // Save history to session storage on change
    useEffect(() => {
        if (messages.length > 0) {
            sessionStorage.setItem('agromind_chat_history', JSON.stringify(messages))
        }
    }, [messages])

    const sendMessageMutation = useMutation({
        mutationFn: async (userMessage: string) => {
            const systemPrompt = localStorage.getItem("agromind_system_prompt") || ""

            // Prepare history for API (exclude initial welcome message if it's from assistant)
            const apiHistory = messages
                .filter((_, index) => index > 0 || messages[0].role !== 'assistant')
                .map(m => ({ role: m.role, content: m.content }))

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    history: apiHistory,
                    systemPrompt: systemPrompt,
                    // No context passed implies "General Chat" - backend will fetch all data
                })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.details || data.error || `Erro ${response.status}`)
            }

            if (data.error) throw new Error(data.error)

            return data.response
        },
        onSuccess: (response) => {
            setMessages(prev => [...prev, { role: 'assistant', content: response }])
        },
        onError: (error: any) => {
            console.error('Error sending message:', error)
            const errorMessage = error.message || 'Desculpe, tive um problema ao processar sua mensagem.'
            setMessages(prev => [...prev, { role: 'assistant', content: `❌ Erro: ${errorMessage}` }])
            toast({
                title: "❌ Erro no Chat",
                description: errorMessage,
                variant: "destructive",
                duration: 5000,
            })
        }
    })

    const handleSend = () => {
        if (!input.trim()) return

        const userMessage = input
        setMessages(prev => [...prev, { role: 'user', content: userMessage }])
        setInput('')
        sendMessageMutation.mutate(userMessage)
    }

    const clearHistory = () => {
        setMessages([{
            role: 'assistant',
            content: 'Olá! Sou o MyAgroAI. Tenho acesso a todos os seus dados de produção, custos, estoque e contratos. Como posso ajudar você hoje?'
        }])
        sessionStorage.removeItem('agromind_chat_history')
        toast({
            title: "🗑️ Histórico Limpo",
            description: "O histórico do chat foi removido.",
            duration: 3000,
        })
    }

    return {
        messages,
        input,
        setInput,
        handleSend,
        clearHistory,
        isLoading: sendMessageMutation.isPending
    }
}
