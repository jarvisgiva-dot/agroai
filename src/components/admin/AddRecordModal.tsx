'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createRecord, updateRecord } from '@/app/actions/admin'
import { useToast } from '@/components/ui/use-toast'

export interface FieldConfig {
    name: string
    label: string
    type: 'text' | 'number' | 'date'
    placeholder?: string
    required?: boolean
}

interface AddRecordModalProps {
    isOpen: boolean
    onClose: () => void
    tableName: string
    fields: FieldConfig[]
    title: string
    initialData?: any
    recordId?: number | null
}

export function AddRecordModal({ isOpen, onClose, tableName, fields, title, initialData, recordId }: AddRecordModalProps) {
    const [formData, setFormData] = useState<Record<string, any>>({})
    const [isSubmitting, setIsSubmitting] = useState(false)
    const { toast } = useToast()

    useEffect(() => {
        if (isOpen && initialData) {
            setFormData(initialData)
        } else if (isOpen && !initialData) {
            setFormData({})
        }
    }, [isOpen, initialData])

    const handleChange = (name: string, value: string) => {
        setFormData((prev) => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)

        // Convert number fields
        const processedData = { ...formData }
        fields.forEach(field => {
            if (field.type === 'number' && processedData[field.name]) {
                processedData[field.name] = Number(processedData[field.name])
            }
        })

        let result
        if (recordId) {
            result = await updateRecord(tableName, recordId, processedData)
        } else {
            result = await createRecord(tableName, processedData)
        }

        setIsSubmitting(false)

        if (result.success) {
            toast({
                title: 'Sucesso',
                description: result.message,
            })
            setFormData({})
            onClose()
        } else {
            toast({
                title: 'Erro',
                description: result.message,
                variant: 'destructive',
            })
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-full max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-sm">
                <DialogHeader>
                    <DialogTitle>{recordId ? 'Editar Registro' : title}</DialogTitle>
                    <DialogDescription>
                        {recordId ? 'Edite os dados do registro abaixo.' : 'Preencha os dados abaixo para adicionar um novo registro.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    {fields.map((field) => (
                        <div key={field.name} className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor={field.name} className="text-right">
                                {field.label}
                            </Label>
                            <Input
                                id={field.name}
                                type={field.type}
                                placeholder={field.placeholder}
                                value={formData[field.name] || ''}
                                onChange={(e) => handleChange(field.name, e.target.value)}
                                className="col-span-3"
                                required={field.required}
                            />
                        </div>
                    ))}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white">
                            {isSubmitting ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
