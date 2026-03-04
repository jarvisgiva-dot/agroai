'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable } from '@/components/admin/DataTable'
import { AddRecordModal, FieldConfig } from '@/components/admin/AddRecordModal'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MODALIDADES } from "@/constants"

interface ClientWrapperProps {
    data: {
        produtividade: any[]
        contratos: any[]
        estoqueInsumos: any[]
        estoqueGraos: any[]
        marketPrices: any[]
    }
}

export function ClientWrapper({ data }: ClientWrapperProps) {
    const [activeTab, setActiveTab] = useState('produtividade')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingRecord, setEditingRecord] = useState<any>(null)
    const [searchTerm, setSearchTerm] = useState("")

    // --- FILTERING LOGIC (Copied from InventoryList) ---
    const filterByModalidade = (modalidade: keyof typeof MODALIDADES, items: any[]) => {
        let filtered = []
        if (modalidade === 'sementes') {
            filtered = items.filter(item =>
                item.categoria_linha?.toLowerCase().includes('semente') ||
                item.nome_produto?.toLowerCase().includes('semente')
            )
        } else if (modalidade === 'graos_colhidos') {
            const graosKeywords = ['soja', 'milho', 'feijão', 'feijao', 'grão', 'grao']
            filtered = items.filter(item => {
                const isSemente = item.categoria_linha?.toLowerCase().includes('semente')
                const isGrao = graosKeywords.some(k =>
                    item.categoria_linha?.toLowerCase().includes(k) ||
                    item.nome_produto?.toLowerCase().includes(k)
                )
                return isGrao && !isSemente
            })
        } else {
            const keywords = MODALIDADES[modalidade]
            filtered = items.filter(item =>
                keywords.some(k =>
                    item.categoria_linha?.toLowerCase().includes(k.toLowerCase()) ||
                    item.nome_produto?.toLowerCase().includes(k.toLowerCase())
                )
            )
        }
        return filtered
    }

    const sementesItems = filterByModalidade('sementes', data.estoqueInsumos)
    const graosItems = filterByModalidade('graos_colhidos', data.estoqueInsumos)
    const combustiveisItems = filterByModalidade('combustiveis', data.estoqueInsumos)
    const quimicosItems = filterByModalidade('quimicos', data.estoqueInsumos)
    const fertilizantesItems = filterByModalidade('fertilizantes', data.estoqueInsumos)

    // 1. PRODUTIVIDADE
    const colunasProdutividade = [
        { header: 'Fazenda', accessorKey: 'fazenda_lavoura' },
        { header: 'Talhão', accessorKey: 'talhao' },
        { header: 'Cultura', accessorKey: 'cultura' },
        { header: 'Variedade', accessorKey: 'variedade' },
        { header: 'Safra', accessorKey: 'safra' },
        { header: 'Área (ha)', accessorKey: 'area_colhida_ha' },
        { header: 'Produção (scs)', accessorKey: 'producao_liquida_sacas' },
        { header: 'Produtividade (sc/ha)', accessorKey: 'produtividade_liquida_scs_ha' },
    ]
    const camposProdutividade: FieldConfig[] = [
        { name: 'fazenda_lavoura', label: 'Fazenda', type: 'text', placeholder: 'Ex: FAZENDA CRISTALINA', required: true },
        { name: 'talhao', label: 'Talhão', type: 'text', placeholder: 'Ex: 1A', required: true },
        { name: 'cultura', label: 'Cultura', type: 'text', placeholder: 'SOJA ou MILHO', required: true },
        { name: 'variedade', label: 'Variedade', type: 'text', placeholder: 'Ex: DKB 360', required: true },
        { name: 'safra', label: 'Safra', type: 'text', placeholder: 'Ex: 2024/2025', required: true },
        { name: 'area_colhida_ha', label: 'Área (ha)', type: 'number', required: true },
        { name: 'producao_liquida_sacas', label: 'Produção (scs)', type: 'number', required: true },
        { name: 'produtividade_liquida_scs_ha', label: 'Produtividade (sc/ha)', type: 'number', required: true },
    ]

    // 2. CONTRATOS
    const colunasContratos = [
        { header: 'Contrato', accessorKey: 'numero_contrato' },
        { header: 'Cliente', accessorKey: 'cliente_comprador' },
        { header: 'Cultura', accessorKey: 'cultura' },
        { header: 'Safra', accessorKey: 'safra' },
        { header: 'Qtd (scs)', accessorKey: 'qtd_contrato_sacas' },
        { header: 'Preço (R$)', accessorKey: 'preco_por_saca', format: (v: any) => `R$ ${Number(v).toFixed(2)}` },
        { header: 'Vencimento', accessorKey: 'data_vencimento' },
    ]
    const camposContratos: FieldConfig[] = [
        { name: 'numero_contrato', label: 'Nº Contrato', type: 'text', required: true },
        { name: 'cliente_comprador', label: 'Cliente', type: 'text', required: true },
        { name: 'cultura', label: 'Cultura', type: 'text', required: true },
        { name: 'safra', label: 'Safra', type: 'text', required: true },
        { name: 'qtd_contrato_sacas', label: 'Qtd (scs)', type: 'number', required: true },
        { name: 'preco_por_saca', label: 'Preço (R$)', type: 'number', required: true },
        { name: 'data_vencimento', label: 'Vencimento', type: 'date', required: true },
    ]

    // 3. ESTOQUE (SHARED CONFIG FOR ALL INVENTORY TYPES)
    const colunasEstoque = [
        { header: 'Produto', accessorKey: 'nome_produto' },
        { header: 'Categoria', accessorKey: 'categoria_linha' },
        { header: 'Local', accessorKey: 'local_armazenagem' },
        { header: 'Qtd', accessorKey: 'quantidade_estoque' },
        { header: 'Unidade', accessorKey: 'unidade_medida' },
        { header: 'Valor Total', accessorKey: 'valor_total_estoque', format: (v: any) => `R$ ${Number(v).toFixed(2)}` },
    ]
    const camposEstoque: FieldConfig[] = [
        { name: 'nome_produto', label: 'Produto', type: 'text', required: true },
        { name: 'codigo_produto', label: 'Código', type: 'text', required: true },
        { name: 'categoria_linha', label: 'Categoria', type: 'text' },
        { name: 'local_armazenagem', label: 'Local', type: 'text', required: true },
        { name: 'quantidade_estoque', label: 'Quantidade', type: 'number', required: true },
        { name: 'unidade_medida', label: 'Unidade', type: 'text', required: true },
        { name: 'valor_total_estoque', label: 'Valor Total (R$)', type: 'number', required: true },
    ]

    // 4. MERCADO (MARKET PRICES)
    const colunasMercado = [
        { header: 'Data', accessorKey: 'date_reference', format: (v: any) => new Date(v).toLocaleDateString('pt-BR') },
        { header: 'Produto', accessorKey: 'product' },
        { header: 'Preço', accessorKey: 'price', format: (v: any) => Number(v).toFixed(2) },
        { header: 'Moeda', accessorKey: 'currency' },
        { header: 'Unidade', accessorKey: 'unit' },
        { header: 'Fonte', accessorKey: 'source_type' },
    ]
    const camposMercado: FieldConfig[] = [
        { name: 'date_reference', label: 'Data', type: 'date', required: true },
        { name: 'product', label: 'Produto', type: 'text', placeholder: 'Ex: SOJA, MILHO, UREIA', required: true },
        { name: 'price', label: 'Preço', type: 'number', required: true },
        { name: 'currency', label: 'Moeda', type: 'text', placeholder: 'BRL ou USD', required: true },
        { name: 'unit', label: 'Unidade', type: 'text', placeholder: 'sc_60kg ou ton', required: true },
        { name: 'source_type', label: 'Fonte', type: 'text', placeholder: 'MANUAL', required: true },
    ]

    // --- HELPER PARA OBTER CONFIGURAÇÃO ATUAL ---
    const getCurrentConfig = () => {
        switch (activeTab) {
            case 'produtividade':
                return {
                    columns: colunasProdutividade,
                    fields: camposProdutividade,
                    tableName: 'produtividade_colheita',
                    title: 'Novo Registro de Produtividade'
                }
            case 'contratos':
                return {
                    columns: colunasContratos,
                    fields: camposContratos,
                    tableName: 'contratos_venda',
                    title: 'Novo Contrato'
                }
            case 'mercado':
                return {
                    columns: colunasMercado,
                    fields: camposMercado,
                    tableName: 'market_prices',
                    title: 'Novo Preço de Mercado'
                }
            // All inventory tabs use the same config
            case 'sementes':
            case 'graos':
            case 'combustiveis':
            case 'quimicos':
            case 'fertilizantes':
                return {
                    columns: colunasEstoque,
                    fields: camposEstoque,
                    tableName: 'estoque_insumos',
                    title: 'Novo Item de Estoque'
                }
            default:
                return { columns: [], fields: [], tableName: '', title: '' }
        }
    }

    const config = getCurrentConfig()

    const handleEdit = (row: any) => {
        setEditingRecord(row)
        setIsModalOpen(true)
    }

    const handleAdd = () => {
        setEditingRecord(null)
        setIsModalOpen(true)
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Produtividade
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.produtividade.length}</div>
                        <p className="text-xs text-muted-foreground">Registros de colheita</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Contratos
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.contratos.length}</div>
                        <p className="text-xs text-muted-foreground">Contratos de venda</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Mercado
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.marketPrices.length}</div>
                        <p className="text-xs text-muted-foreground">Cotações registradas</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Outros Insumos
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {sementesItems.length + combustiveisItems.length + quimicosItems.length + fertilizantesItems.length}
                        </div>
                        <p className="text-xs text-muted-foreground">Sementes, Químicos, etc.</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardContent className="p-6">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-8 mb-6">
                            <TabsTrigger value="produtividade">
                                Produtividade ({data.produtividade.length})
                            </TabsTrigger>
                            <TabsTrigger value="contratos">
                                Contratos ({data.contratos.length})
                            </TabsTrigger>
                            <TabsTrigger value="mercado">
                                Mercado ({data.marketPrices.length})
                            </TabsTrigger>
                            <TabsTrigger value="sementes">
                                Sementes ({sementesItems.length})
                            </TabsTrigger>
                            <TabsTrigger value="graos">
                                Grãos ({graosItems.length})
                            </TabsTrigger>
                            <TabsTrigger value="combustiveis">
                                Combustíveis ({combustiveisItems.length})
                            </TabsTrigger>
                            <TabsTrigger value="quimicos">
                                Químicos ({quimicosItems.length})
                            </TabsTrigger>
                            <TabsTrigger value="fertilizantes">
                                Fertilizantes ({fertilizantesItems.length})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="produtividade" className="mt-0">
                            <DataTable
                                data={data.produtividade}
                                columns={colunasProdutividade}
                                tableName="produtividade_colheita"
                                onAdd={handleAdd}
                                onEdit={handleEdit}
                            />
                        </TabsContent>
                        <TabsContent value="contratos" className="mt-0">
                            <DataTable
                                data={data.contratos}
                                columns={colunasContratos}
                                tableName="contratos_venda"
                                onAdd={handleAdd}
                                onEdit={handleEdit}
                            />
                        </TabsContent>
                        <TabsContent value="mercado" className="mt-0">
                            <div className="flex justify-end mb-4">
                                <Button
                                    variant="outline"
                                    onClick={async () => {
                                        try {
                                            const res = await fetch('/api/market/fill-gaps', { method: 'POST' });
                                            const result = await res.json();
                                            if (result.success) {
                                                alert(`Sucesso! ${result.count} registros foram criados.`);
                                                window.location.reload();
                                            } else {
                                                alert('Erro ao preencher lacunas: ' + result.error);
                                            }
                                        } catch (e) {
                                            alert('Erro de conexão.');
                                        }
                                    }}
                                >
                                    Preencher Lacunas (Média)
                                </Button>
                            </div>
                            <DataTable
                                data={data.marketPrices}
                                columns={colunasMercado}
                                tableName="market_prices"
                                onAdd={handleAdd}
                                onEdit={handleEdit}
                            />
                        </TabsContent>

                        {/* Inventory Tabs */}
                        <TabsContent value="sementes" className="mt-0">
                            <DataTable
                                data={sementesItems}
                                columns={colunasEstoque}
                                tableName="estoque_insumos"
                                onAdd={handleAdd}
                                onEdit={handleEdit}
                            />
                        </TabsContent>
                        <TabsContent value="graos" className="mt-0">
                            <DataTable
                                data={graosItems}
                                columns={colunasEstoque}
                                tableName="estoque_insumos"
                                onAdd={handleAdd}
                                onEdit={handleEdit}
                            />
                        </TabsContent>
                        <TabsContent value="combustiveis" className="mt-0">
                            <DataTable
                                data={combustiveisItems}
                                columns={colunasEstoque}
                                tableName="estoque_insumos"
                                onAdd={handleAdd}
                                onEdit={handleEdit}
                            />
                        </TabsContent>
                        <TabsContent value="quimicos" className="mt-0">
                            <DataTable
                                data={quimicosItems}
                                columns={colunasEstoque}
                                tableName="estoque_insumos"
                                onAdd={handleAdd}
                                onEdit={handleEdit}
                            />
                        </TabsContent>
                        <TabsContent value="fertilizantes" className="mt-0">
                            <DataTable
                                data={fertilizantesItems}
                                columns={colunasEstoque}
                                tableName="estoque_insumos"
                                onAdd={handleAdd}
                                onEdit={handleEdit}
                            />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <AddRecordModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                tableName={config.tableName}
                fields={config.fields}
                title={editingRecord ? 'Editar Registro' : config.title}
                initialData={editingRecord}
                recordId={editingRecord?.id}
            />
        </div>
    )
}
