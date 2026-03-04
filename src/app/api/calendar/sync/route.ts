import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        console.log('=== CALENDAR SYNC STARTED ===');
        const { accessToken } = await req.json();
        console.log('Access token received:', accessToken ? 'YES' : 'NO');

        if (!accessToken) {
            console.log('ERROR: No access token');
            return NextResponse.json({ error: 'No access token provided' }, { status: 401 });
        }

        // Initialize Google Calendar
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        oauth2Client.setCredentials({ access_token: accessToken });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        // Initialize Supabase safely
        const { supabaseService: supabase } = require('@/lib/supabase-service');

        console.log('Fetching contracts from database...');
        const { data: allContracts, error } = await supabase
            .from('contratos_venda')
            .select('*')
            .not('data_recebimento', 'is', null);

        if (error) {
            console.error('Supabase error:', error);
            return NextResponse.json({
                error: 'Failed to fetch contracts',
                details: error.message
            }, { status: 500 });
        }

        // Filter in memory to be case-insensitive and robust
        const contracts = allContracts?.filter((c: any) => {
            const cultura = c.cultura?.toUpperCase() || '';
            return cultura.includes('SOJA') || cultura.includes('MILHO');
        }) || [];

        console.log(`Found ${allContracts?.length || 0} total contracts, ${contracts.length} matched SOJA/MILHO`);

        if (!contracts || contracts.length === 0) {
            return NextResponse.json({
                success: true,
                count: 0,
                message: 'No contracts with payment dates found',
                debug: {
                    totalFound: allContracts?.length || 0,
                    firstContract: allContracts?.[0] || 'None',
                    env: {
                        hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
                        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
                    }
                }
            });
        }

        const createdEvents: any[] = [];
        const errors: any[] = [];

        // Create calendar events for each contract
        for (const contract of contracts) {
            try {
                // Format values
                const valorTotal = (contract.qtd_contrato_sacas || 0) * (contract.preco_por_saca || 0);
                const valorTotalFormatado = valorTotal.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                });
                const precoFormatado = (contract.preco_por_saca || 0).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
                const qtdFormatada = (contract.qtd_contrato_sacas || 0).toLocaleString('pt-BR');

                // CORRECTION: empresa_vendedora is the FARMER/SELLER (e.g., ALCEU PEDRINHO BORGO)
                // cliente_comprador is the BUYER/CLIENT (e.g., AMAGGI EXPORTAÇÃO)
                const vendedor = contract.empresa_vendedora || contract.nome_vendedor || 'Vendedor Desconhecido';
                const comprador = contract.cliente_comprador || contract.nome_comprador || 'Comprador Desconhecido';
                const cultura = (contract.cultura || 'GRÃO').toUpperCase();

                // Format event title following the user's example:
                // "Recebimento de R$ 2.600.000,00 PARA ALCEU PEDRINHO BORGO DE AMAGGI EXPORTAÇÃO DE MILHO VENDIDO A 50 REAIS A SACA EM TOTAL DE 52000 SACAS"
                // PARA [vendedor/empresa] DE [comprador/cliente] DE [cultura]
                const eventTitle = `Recebimento de ${valorTotalFormatado} PARA ${vendedor} DE ${comprador} DE ${cultura} VENDIDO A ${precoFormatado} REAIS A SACA EM TOTAL DE ${qtdFormatada} SACAS`;

                // Detailed description
                const eventDescription = `
📋 **Detalhes do Contrato ${contract.numero_contrato}**

💰 **Informações Financeiras:**
- Valor Total: ${valorTotalFormatado}
- Preço por Saca: R$ ${precoFormatado}
- Quantidade: ${qtdFormatada} sacas

🌾 **Informações do Produto:**
- Cultura: ${cultura}
- Safra: ${contract.safra || 'N/A'}

👥 **Partes Envolvidas:**
- Vendedor (Produtor): ${vendedor}
- Comprador (Cliente): ${comprador}

📦 **Logística:**
- Tipo de Frete: ${contract.tipo_frete || 'N/A'}
- Situação: ${contract.situacao_embarque || 'N/A'}
                `.trim();

                // Create event with identification tag for deletion
                const event = {
                    summary: eventTitle,
                    description: eventDescription,
                    start: {
                        date: contract.data_recebimento,
                        timeZone: 'America/Sao_Paulo',
                    },
                    end: {
                        date: contract.data_recebimento,
                        timeZone: 'America/Sao_Paulo',
                    },
                    reminders: {
                        useDefault: false,
                        overrides: [
                            { method: 'email', minutes: 24 * 60 * 3 }, // 3 days before
                            { method: 'popup', minutes: 24 * 60 },      // 1 day before
                            { method: 'popup', minutes: 60 },            // 1 hour before
                        ],
                    },
                    // Color: Green for SOJA (10), Yellow for MILHO (5)
                    colorId: contract.cultura?.toLowerCase() === 'soja' ? '10' : '5',
                    // Extended properties to identify contract events for deletion
                    extendedProperties: {
                        private: {
                            contractEventId: 'agromind_contract',
                            contractNumber: contract.numero_contrato,
                            contractId: contract.id?.toString() || '',
                        }
                    }
                };

                console.log(`Creating event for contract ${contract.numero_contrato}...`);
                const response = await calendar.events.insert({
                    calendarId: 'primary',
                    requestBody: event,
                });

                createdEvents.push({
                    contractId: contract.id,
                    eventId: response.data.id,
                    eventLink: response.data.htmlLink,
                    contract: contract.numero_contrato,
                    date: contract.data_recebimento,
                });

                console.log(`✓ Event created for ${contract.numero_contrato}`);
            } catch (eventError: any) {
                console.error(`Failed to create event for contract ${contract.numero_contrato}:`, eventError);
                errors.push({
                    contract: contract.numero_contrato,
                    error: eventError.message,
                });
            }
        }

        console.log(`Successfully created ${createdEvents.length} events`);

        return NextResponse.json({
            success: true,
            count: createdEvents.length,
            events: createdEvents,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error: any) {
        console.error('Calendar sync error:', error);
        return NextResponse.json({
            error: 'Failed to sync calendar',
            details: error.message,
        }, { status: 500 });
    }
}
