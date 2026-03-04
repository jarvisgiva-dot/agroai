'use client'

import { Component, ReactNode } from 'react'
import { Button } from './ui/button'
import { AlertTriangle } from 'lucide-react'

interface Props {
    children: ReactNode
}

interface State {
    hasError: boolean
    error?: Error
}

/**
 * Error Boundary Component
 * Catches React errors and displays a fallback UI
 * Prevents the entire app from crashing
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo)
        // TODO: Log to error tracking service (Sentry, etc.)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-8">
                    <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center">
                        <div className="mb-6 flex justify-center">
                            <div className="p-4 bg-red-100 rounded-full">
                                <AlertTriangle className="h-12 w-12 text-red-600" />
                            </div>
                        </div>

                        <h2 className="text-2xl font-bold text-gray-800 mb-2">
                            Algo deu errado!
                        </h2>

                        <p className="text-gray-600 mb-6">
                            Ocorreu um erro inesperado. Nossa equipe foi notificada e está trabalhando para resolver o problema.
                        </p>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <div className="mb-6 p-4 bg-gray-100 rounded-lg text-left">
                                <p className="text-xs font-mono text-gray-700 break-all">
                                    {this.state.error.message}
                                </p>
                            </div>
                        )}

                        <Button
                            onClick={() => {
                                this.setState({ hasError: false, error: undefined })
                                window.location.reload()
                            }}
                            className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600"
                        >
                            Recarregar Página
                        </Button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
