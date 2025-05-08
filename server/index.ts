import express, { type Request, type Response } from "express";
import { randomUUID } from 'node:crypto';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { parseStringPromise } from 'xml2js';
import { createPost } from './mcp.tool';
import { z } from 'zod';
import cors from 'cors';

console.log(process.env.TWITTER_API_KEY)

// Define interfaces for the application
interface NewsItem {
    title: string[];
    link: string[];
    [key: string]: any;
}

interface WikipediaResponse {
    title: string;
    extract: string;
    content_urls: {
        desktop: {
            page: string;
        };
    };
}

interface GitHubRepoResponse {
    full_name: string;
    description: string | null;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    html_url: string;
}

// Create Express app
const app = express();
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'MCP-Session-ID'],
    exposedHeaders: ['MCP-Session-ID'],
    credentials: true
}));
app.use(express.json());

// Create MCP server
const server = new McpServer({
    name: "example-server",
    version: "1.0.0"
});

// Define tools
server.tool(
    'print-menu',
    'Prints what can the MCP server do with the available tools (apart from printing this menu)',
    {
        title: z.string().optional().describe('Optional title for the menu'),
        items: z.array(z.string()).describe('List of tool descriptions to display')
    },
    async (arg) => {
        const { title, items } = arg;

        if (!Array.isArray(items) || items.some(item => typeof item !== 'string')) {
            console.error('Invalid items array');
            return {
                content: [{
                    type: "text" as const,
                    text: 'Error: Menu items must be an array of strings.\n'
                }]
            };
        }

        const header = title ? `${title}\n\n` : '\n\n';
        const menuText = items
            .map((item, index) => `\x1b[1;33m(${index + 1})\x1b[0m \x1b[1;36m${item}\x1b[0m`)
            .join('\n');

        console.log(`${header}${menuText}`);

        return {
            content: [{
                type: "text" as const,
                text: `${header}${menuText}`
            }]
        };
    }
);

server.tool(
    'news-by-topic',
    'Fetches recent news headlines for a given topic using Google News',
    {
        topic: z.string().describe('The topic to search news for (e.g., AI, economy, cricket)')
    },
    async ({ topic }) => {
        const query = encodeURIComponent(topic);
        const rssUrl = `https://news.google.com/rss/search?q=${query}`;

        try {
            const response = await fetch(rssUrl);
            const xml = await response.text();

            const parsed = await parseStringPromise(xml);
            const items = (parsed.rss.channel[0].item?.slice(0, 5) || []) as NewsItem[];

            if (items.length === 0) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `❌ No recent news found for topic: "${topic}".`
                        }
                    ]
                };
            }

            // Format the news items for display
            const formattedNews = items.map((item, index) => {
                const title = item.title[0];
                const link = item.link[0];
                const hyperlink = `\x1b]8;;${link}\x1b\x5C Link \x1b]8;;\x1b\x5C`;
                return `\x1b[1;33m[${index + 1}]\x1b[0m ${title} \x1b[1;32;1m ${hyperlink} \x1b[0m`;
            }).join('\n');

            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Top News for "${topic}":\n\n${formattedNews}`
                    }
                ]
            };
        } catch (err) {
            console.error('News fetch error:', err);
            return {
                content: [
                    {
                        type: "text" as const,
                        text: '⚠️ Failed to retrieve news. Please try again later.'
                    }
                ]
            };
        }
    }
);

server.tool(
    'adder',
    'Add two numbers together',
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
                type: "text" as const,
                text: `\x1b[1;32mResult:\x1b[0m The sum of \x1b[1;33m${a}\x1b[0m and \x1b[1;33m${b}\x1b[0m is \x1b[1;36m${a + b}\x1b[0m.\n`
            }
            ]
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
                type: "text" as const,
                text: `\x1b[1;32mTweet created successfully:\x1b[0m ${result.content[0]?.text || 'Tweet sent'}\n`
            }
            ]
        };
    }
);

server.tool(
    'wikipedia-search',
    'Search Wikipedia and return the summary of the top result',
    {
        query: z.string().describe('The search term for Wikipedia')
    },
    async (arg) => {
        const { query } = arg;
        console.log(`Searching Wikipedia for: ${query}`);
        const encodedQuery = encodeURIComponent(query);
        const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodedQuery}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.error(`Wikipedia API error: ${response.statusText}`);
                return {
                    content: [{
                        type: "text" as const,
                        text: `\x1b[1;31mError:\x1b[0m \x1b[31mFailed to fetch Wikipedia summary for "${query}".\x1b[0m\n`
                    }]
                };
            }

            const data = await response.json() as WikipediaResponse;
            return {
                content: [{
                    type: "text" as const,
                    text: `\x1b[1;32m${data.title}\x1b[0m\n\n\x1b[37m${data.extract}\x1b[0m\n\n[Read more on Wikipedia]\x1b[4;34m(${data.content_urls.desktop.page})\x1b[0m\n`
                }]
            };
        } catch (err) {
            console.error('Fetch failed:', err);
            return {
                content: [{
                    type: "text" as const,
                    text: 'An error occurred while trying to fetch Wikipedia data.'
                }]
            };
        }
    }
);

server.tool(
    'github-repo-info',
    'Fetch information about a public GitHub repository',
    {
        owner: z.string().describe('GitHub username or organization'),
        repo: z.string().describe('Repository name')
    },
    async (arg) => {
        const { owner, repo } = arg;
        const url = `https://api.github.com/repos/${owner}/${repo}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as GitHubRepoResponse;
            return {
                content: [{
                    type: "text" as const,
                    text:
                        `\x1b[1;32m📦 Repository Name:\x1b[0m \x1b[1;33m${data.full_name}\x1b[0m\n\n` +
                        `\x1b[1;32m📝 Description:\x1b[0m ${data.description || 'No description'}\n` +
                        `\x1b[1;32m⭐ Stars:\x1b[0m ${data.stargazers_count}\n` +
                        `\x1b[1;32m🍴 Forks:\x1b[0m ${data.forks_count}\n` +
                        `\x1b[1;32m🚩 Open Issues:\x1b[0m ${data.open_issues_count}\n` +
                        `\x1b[1;32m🔗 Repository Link:\x1b[0m \x1b[4;34m${data.html_url}\x1b[0m`
                }]
            };
        } catch (err) {
            console.error('GitHub fetch error:', err);
            return {
                content: [{
                    type: "text" as const,
                    text: `Failed to fetch repository info for ${owner}/${repo}`
                }]
            };
        }
    }
);

// Define transports map
interface TransportMap {
    [key: string]: StreamableHTTPServerTransport;
}

const transports: TransportMap = {};

// Handle MCP POST requests
app.post('/mcp', async (req: Request, res: Response) => {
    console.log('Received MCP request:', {
        headers: req.headers,
        body: req.body,
        method: req.method,
        url: req.url
    });

    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
        console.log('Using existing transport for session:', sessionId);
        transport = transports[sessionId];
    } else if (!sessionId && req.body && req.body.method === 'initialize') {
        console.log('Initializing new transport for client');
        transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sid: string) => {
                console.log('Session initialized with ID:', sid);
                transports[sid] = transport;
            }
        });

        transport.onclose = () => {
            if (transport.sessionId) {
                console.log('Closing transport for session:', transport.sessionId);
                delete transports[transport.sessionId];
            }
        };

        await server.connect(transport);
        console.log('Connected transport to MCP server');

        // Set the session ID in the response headers
        if (transport.sessionId) {
            console.log('Setting session ID in response headers:', transport.sessionId);
            res.setHeader('MCP-Session-ID', transport.sessionId);
            res.setHeader('Access-Control-Expose-Headers', 'MCP-Session-ID');
        }
    } else {
        console.error('Invalid request - no session ID or not an initialize request');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        console.log('Session ID:', sessionId);

        res.status(400).json({
            jsonrpc: '2.0',
            error: {
                code: -32000,
                message: 'Bad Request: No valid session ID provided',
            },
            id: req.body?.id || null,
        });
        return;
    }

    try {
        // Let the transport handle the request
        await transport.handleRequest(req, res, req.body);

        // For initialize requests, log the session ID
        if (req.body && req.body.method === 'initialize' && transport.sessionId) {
            console.log('Initialize request handled with session ID:', transport.sessionId);
        } else {
            console.log('Request handled successfully');
        }
    } catch (error) {
        console.error('Error handling request:', error);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: 'Internal server error',
                },
                id: req.body?.id || null,
            });
        }
    }
});

// Handle session requests
const handleSessionRequest = async (req: Request, res: Response) => {
    console.log('Received session request:', {
        headers: req.headers,
        method: req.method,
        url: req.url
    });

    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
        console.error('Invalid or missing session ID:', sessionId);
        console.log('Available sessions:', Object.keys(transports));
        res.status(400).send('Invalid or missing session ID');
        return;
    }

    console.log('Using transport for session:', sessionId);
    const transport = transports[sessionId];

    try {
        await transport.handleRequest(req, res);
        console.log('Session request handled successfully');
    } catch (error) {
        console.error('Error handling session request:', error);
        if (!res.headersSent) {
            res.status(500).send('Internal server error');
        }
    }
};

// Set up routes
app.get('/mcp', handleSessionRequest);
app.delete('/mcp', handleSessionRequest);

// Start server
app.listen(3001, () => {
    console.log('Server is running on http://localhost:3001');
});
