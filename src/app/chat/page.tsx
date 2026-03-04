"use client"

import { useRef, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard/DashboardLayout"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Bot, User, Loader2, Sparkles, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useChat } from "@/hooks/useChat"

export default function ChatPage() {
    const { messages, input, setInput, handleSend, clearHistory, isLoading } = useChat()
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages])

    const suggestions = [
        "Como está meu estoque de sementes?",
        "Tenho contratos vencidos?",
        "Qual foi minha produtividade total de soja?",
        "Analise meus custos de fertilizantes"
    ]

    return (
        <DashboardLayout>
            <div className="flex flex-col h-[calc(100vh-2rem)] max-w-5xl mx-auto p-4">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
                            <Sparkles className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Assistente Inteligente</h1>
                            <p className="text-sm text-gray-500">Conectado aos seus dados do MyAgroAI</p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={clearHistory} className="gap-2">
                        <Trash2 className="h-4 w-4" />
                        Limpar Chat
                    </Button>
                </div>

                <Card className="flex-1 flex flex-col overflow-hidden bg-white/80 backdrop-blur border-gray-200 shadow-xl rounded-3xl">
                    <ScrollArea className="flex-1 p-6">
                        <div className="space-y-6">
                            {messages.map((message, index) => (
                                <div key={index} className={cn("flex gap-4 max-w-[80%]", message.role === 'user' ? "ml-auto flex-row-reverse" : "")}>
                                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm", message.role === 'user' ? "bg-blue-100" : "bg-indigo-100")}>
                                        {message.role === 'user' ? <User className="h-5 w-5 text-blue-600" /> : <Bot className="h-5 w-5 text-indigo-600" />}
                                    </div>
                                    <div className={cn("p-4 rounded-2xl text-sm leading-relaxed shadow-sm", message.role === 'user' ? "bg-blue-600 text-white rounded-tr-none" : "bg-white border border-gray-100 text-gray-700 rounded-tl-none")}>
                                        {message.content.split('\n').map((line, i) => (
                                            <p key={i} className="mb-1 last:mb-0">{line}</p>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex gap-4 max-w-[80%]">
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                        <Loader2 className="h-5 w-5 text-indigo-600 animate-spin" />
                                    </div>
                                    <div className="p-4 rounded-2xl bg-white border border-gray-100 text-gray-500 text-sm rounded-tl-none">
                                        Analisando dados...
                                    </div>
                                </div>
                            )}
                            <div ref={scrollRef} />
                        </div>
                    </ScrollArea>

                    <div className="p-4 bg-gray-50/50 border-t border-gray-100">
                        {messages.length === 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-4 mb-2 scrollbar-hide">
                                {suggestions.map((s, i) => (
                                    <button key={i} onClick={() => setInput(s)} className="whitespace-nowrap px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-colors shadow-sm">
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-3">
                            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Digite sua pergunta sobre a fazenda..." className="flex-1 bg-white border-gray-200 rounded-xl focus-visible:ring-indigo-500" disabled={isLoading} />
                            <Button type="submit" disabled={isLoading || !input.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6">
                                <Send className="h-5 w-5" />
                            </Button>
                        </form>
                    </div>
                </Card>
            </div>
        </DashboardLayout>
    )
}
