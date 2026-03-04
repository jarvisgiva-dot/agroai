"use client"

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Leaf, AlertCircle } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

export default function LoginPage() {
    const [isSignUp, setIsSignUp] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const { signIn, signUp } = useAuth()
    const { toast } = useToast()

    async function handleAuth(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            if (isSignUp) {
                await signUp(email, password, fullName)
                toast({
                    title: '✅ Conta criada!',
                    description: 'Aguarde a aprovação do administrador.',
                })
            } else {
                await signIn(email, password)
                toast({
                    title: '✅ Login realizado!',
                    description: 'Bem-vindo ao MyAgroAI',
                })
            }
        } catch (err: any) {
            const errorMessage = err.message || 'Erro na autenticação'
            setError(errorMessage)
            toast({
                title: '❌ Erro',
                description: errorMessage,
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-2xl">
                <CardHeader className="space-y-3 text-center">
                    <div className="flex justify-center">
                        <div className="p-3 bg-green-100 rounded-2xl">
                            <Leaf className="h-12 w-12 text-green-600" />
                        </div>
                    </div>
                    <CardTitle className="text-3xl font-bold text-gray-800">
                        MyAgroAI
                    </CardTitle>
                    <CardDescription className="text-base">
                        {isSignUp ? 'Crie sua conta para começar' : 'Plataforma Inteligente de Gestão Agrícola'}
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleAuth} className="space-y-4">
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        )}

                        {isSignUp && (
                            <div className="space-y-2">
                                <Label htmlFor="fullName">Nome Completo</Label>
                                <Input
                                    id="fullName"
                                    type="text"
                                    placeholder="Seu nome"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    required={isSignUp}
                                    disabled={loading}
                                    className="h-11"
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="seu@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={loading}
                                className="h-11"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Senha</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={loading}
                                className="h-11"
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-11 bg-green-600 hover:bg-green-700 text-white"
                            disabled={loading}
                        >
                            {loading ? 'Processando...' : (isSignUp ? 'Cadastrar' : 'Entrar')}
                        </Button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="text-sm text-green-600 hover:text-green-700 font-medium hover:underline"
                            type="button"
                        >
                            {isSignUp ? 'Já tem uma conta? Faça login' : 'Não tem uma conta? Cadastre-se'}
                        </button>
                    </div>

                    <div className="mt-8 text-center space-y-2">
                        <p className="text-sm text-gray-500 font-medium">
                            "Cultivando o futuro com inteligência."
                        </p>
                        <p className="text-xs text-gray-400">
                            © 2024 MyAgroAI - Gestão Agrícola
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
