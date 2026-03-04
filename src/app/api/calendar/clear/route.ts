import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        console.log('=== CALENDAR CLEANUP STARTED ===');
        const { accessToken } = await req.json();

        if (!accessToken) {
            return NextResponse.json({ error: 'No access token provided' }, { status: 401 });
        }

        // Initialize Google Calendar
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        oauth2Client.setCredentials({ access_token: accessToken });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        // Find all events with our contract identification tag
        console.log('Fetching contract events from calendar...');

        // Get events from 1 year ago to 3 years in the future
        const timeMin = new Date();
        timeMin.setFullYear(timeMin.getFullYear() - 1);
        const timeMax = new Date();
        timeMax.setFullYear(timeMax.getFullYear() + 3);

        // Fetch ALL events in the range (we'll filter manually to catch legacy events)
        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
            maxResults: 2500,
            singleEvents: true,
        });

        const allEvents = response.data.items || [];
        console.log(`Fetched ${allEvents.length} total events from calendar`);

        // Filter events that look like our contract events
        const contractEvents = allEvents.filter(event => {
            const title = event.summary || '';
            const description = event.description || '';

            // Check for our specific tag (new events)
            const hasTag = event.extendedProperties?.private?.['contractEventId'] === 'agromind_contract';

            // Check for title patterns (legacy events)
            const isRecebimento = title.includes('Recebimento de R$') && title.includes('PARA') && title.includes('DE');
            const isPagamento = title.includes('Pagamento:') || title.includes('💰 Pagamento:');
            const hasContractDetails = description.includes('Detalhes do Contrato') || description.includes('Informações Financeiras');

            return hasTag || isRecebimento || isPagamento || hasContractDetails;
        });

        console.log(`Found ${contractEvents.length} contract-related events to delete`);

        if (contractEvents.length === 0) {
            return NextResponse.json({
                success: true,
                count: 0,
                message: 'No contract events found to delete'
            });
        }

        const deletedEvents: any[] = [];
        const errors: any[] = [];

        // Delete each event
        for (const event of contractEvents) {
            try {
                if (event.id) {
                    await calendar.events.delete({
                        calendarId: 'primary',
                        eventId: event.id,
                    });

                    deletedEvents.push({
                        eventId: event.id,
                        title: event.summary,
                        date: event.start?.date || event.start?.dateTime,
                    });

                    console.log(`✓ Deleted event: ${event.summary}`);
                }
            } catch (deleteError: any) {
                console.error(`Failed to delete event ${event.id}:`, deleteError);
                errors.push({
                    eventId: event.id,
                    title: event.summary,
                    error: deleteError.message,
                });
            }
        }

        console.log(`Successfully deleted ${deletedEvents.length} events`);

        return NextResponse.json({
            success: true,
            count: deletedEvents.length,
            deleted: deletedEvents,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error: any) {
        console.error('Calendar cleanup error:', error);
        return NextResponse.json({
            error: 'Failed to cleanup calendar',
            details: error.message,
        }, { status: 500 });
    }
}
