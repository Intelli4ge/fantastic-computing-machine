import { NextRequest, NextResponse } from 'next/server';
import http from 'http';

// Increase body size limit to 10MB
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};

// Type definitions
interface UploadLyricsRequest {
    text: string;
    metadata?: {
        confidence?: number;
        language?: string;
        timestamp?: string;
        [key: string]: any;
    };
}

interface RemoteBackendResponse {
    success: boolean;
    message?: string;
    [key: string]: any;
}

/**
 * POST /api/upload-lyrics
 * Secure serverless proxy that forwards OCR-extracted lyrics to remote HTTP backend
 */
export async function POST(request: NextRequest) {
    try {
        // 1. Validate API Key from header
        // const apiKey = request.headers.get('x-api-key');
        // const expectedKey = process.env.UPLOAD_API_SECRET;

        // if (!expectedKey || apiKey !== expectedKey) {
        //     console.error('[Proxy] Unauthorized request - invalid API key');
        //     return NextResponse.json(
        //         { error: 'Unauthorized - Invalid API key' },
        //         { status: 401 }
        //     );
        // }

        // 2. Parse and validate request body
        let body: UploadLyricsRequest;
        try {
            body = await request.json();
        } catch (parseError) {
            console.error('[Proxy] Failed to parse JSON body:', parseError);
            return NextResponse.json(
                { error: 'Invalid JSON body' },
                { status: 400 }
            );
        }

        // Validate required fields
        if (!body.text || typeof body.text !== 'string') {
            console.error('[Proxy] Missing or invalid "text" field');
            return NextResponse.json(
                { error: 'Missing required field: text (string)' },
                { status: 400 }
            );
        }

        // 3. Get remote backend URL from environment
        const backendUrl = process.env.REMOTE_BACKEND_URL;
        if (!backendUrl) {
            console.error('[Proxy] REMOTE_BACKEND_URL not configured');
            return NextResponse.json(
                { error: 'Backend configuration error' },
                { status: 500 }
            );
        }

        console.log('[Proxy] Forwarding request to remote backend...');
        console.log(`[Proxy] Text length: ${body.text.length} characters`);
        console.log(`[Proxy] Metadata:`, body.metadata);

        // 4. Forward the request to remote backend using HTTP
        const remoteResponse = await forwardToRemoteBackend(backendUrl, body);

        console.log('[Proxy] Successfully forwarded to backend');
        console.log('[Proxy] Response status:', remoteResponse.status);

        // 5. Return the remote server's response to client
        return NextResponse.json(remoteResponse.data, {
            status: remoteResponse.status,
        });

    } catch (error) {
        console.error('[Proxy] Error processing request:', error);
        return NextResponse.json(
            {
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

/**
 * Forward request to remote HTTP backend (IPv6 support)
 */
function forwardToRemoteBackend(
    urlString: string,
    payload: UploadLyricsRequest
): Promise<{ status: number; data: any }> {
    return new Promise((resolve, reject) => {
        try {
            // Parse URL (supports IPv6 in brackets: http://[2001:db8::1]:8080/path)
            const url = new URL(urlString);

            const postData = JSON.stringify(payload);

            const options: http.RequestOptions = {
                hostname: url.hostname, // IPv6 addresses are automatically handled
                port: url.port || 80,
                path: url.pathname + url.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                    'User-Agent': 'NextJS-OCR-Proxy/1.0',
                },
                // Enable IPv6 support
                family: 0, // 0 = both IPv4 and IPv6, 6 = IPv6 only
            };

            console.log('[Proxy] HTTP Request options:', {
                hostname: options.hostname,
                port: options.port,
                path: options.path,
                method: options.method,
            });

            const req = http.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const parsedData = data ? JSON.parse(data) : {};
                        resolve({
                            status: res.statusCode || 200,
                            data: parsedData,
                        });
                    } catch (parseError) {
                        // If response is not JSON, return as plain text
                        resolve({
                            status: res.statusCode || 200,
                            data: { message: data || 'Success' },
                        });
                    }
                });
            });

            req.on('error', (error) => {
                console.error('[Proxy] HTTP request failed:', error);
                reject(new Error(`Failed to connect to remote backend: ${error.message}`));
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request to remote backend timed out'));
            });

            // Set timeout (30 seconds)
            req.setTimeout(30000);

            // Send the request
            req.write(postData);
            req.end();

        } catch (error) {
            reject(error);
        }
    });
}

// Only allow POST requests
export async function GET() {
    return NextResponse.json(
        { error: 'Method not allowed. Use POST.' },
        { status: 405 }
    );
}
