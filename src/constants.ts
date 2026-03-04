import { Wheat, TrendingUp } from "lucide-react"

// Mapeamento de categorias para modalidades de estoque
// Centralizado para garantir que Dashboard e Estoque usem as mesmas regras
export const MODALIDADES = {
    sementes: ['Semente'],  // Apenas produtos com "semente" explicitamente
    graos_colhidos: ['Soja Colhida', 'Milho Colhido', 'Feijão Colhido', 'Grão Armazenado'],
    combustiveis: ['Combustível', 'Combustíveis', 'Diesel', 'Óleo Diesel', 'Gasolina'],
    quimicos: ['Herbicida', 'Fungicida', 'Dessecante', 'Inseticida', 'Químico'],
    fertilizantes: ['Fertilizante', 'Adubo', 'KCL', 'NPK', 'Ureia'],
}

// Paleta de cores pastéis suaves e modernas para gráficos
export const CHART_COLORS = [
    '#C7B8EA', '#B8E6D5', '#FFE5B4', '#B4D7F1', '#F5C2D5',
    '#D4C5F9', '#C9E4CA', '#FFD9B3', '#D5E5F5', '#F0D9E7',
]

// Configurações de Cultura (Ícones e Cores)
export const CULTURA_CONFIG: Record<string, { color: string, icon: any }> = {
    'soja': { color: 'green', icon: Wheat },
    'milho': { color: 'amber', icon: Wheat },
    'feijão': { color: 'red', icon: Wheat },
    'feijao': { color: 'red', icon: Wheat },
    'default': { color: 'blue', icon: TrendingUp }
}
