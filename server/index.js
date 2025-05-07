import express from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createPost } from './mcp.tool.js';
import { z } from 'zod';

const app = express();
app.use(express.json());

const server = new McpServer({
    name: "example-server",
    version: "1.0.0"
});

server.tool(
    'adder',
    'Adds two numbers together',
    {
        a: z.number().describe('The first number'),
        b: z.number().describe('The second number')
    },
    async (arg) => {
        const { a, b } = arg;
        if (typeof a !== 'number') console.error('a is not a number');
        if (typeof b !== 'number') console.error('b is not a number');
        console.log(`Adding ${a} and ${b}...`);

        return {
            content: [
            {
                type: 'text',
                text: `The sum of ${a} and ${b} is ${a + b}.\n`
            }]
        };
    }
);

server.tool(
    'twitter-X-post',
    'Create and post a tweet on X formally known as Twitter',
    {
        status: z.string().describe('The content of the tweet')
    }, 
    async (arg) => {
        const { status } = arg;
        console.log(`Creating tweet with status: ${status}`);
        const result = await createPost(status);
        console.log('Tweet result:', result);

        return {
            content: [
                {
                    type: 'text',
                    text: `Tweet created successfully: ${result.content[0].text}\n`
                }
            ]
        };
    }
);


const transports = {};

app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    let transport;

    if (sessionId && transports[sessionId]) transport = transports[sessionId];
    else if (!sessionId && isInitializeRequest(req.body)) 
    {
        transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sid) => {
                transports[sid] = transport;
            }
        });

        transport.onclose = () => {
            if (transport.sessionId) {
                delete transports[transport.sessionId];
            }
        };

        await server.connect(transport); 
    } else {
        res.status(400).json({
            jsonrpc: '2.0',
            error: {
                code: -32000,
                message: 'Bad Request: No valid session ID provided',
            },
            id: null,
        });
        return;
    }

    await transport.handleRequest(req, res, req.body);
});

const handleSessionRequest = async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID');
        return;
    }

    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
};

app.get('/mcp', handleSessionRequest);
app.delete('/mcp', handleSessionRequest);

app.listen(3001, () => {
    console.log('Server is running on http://localhost:3001');
});
