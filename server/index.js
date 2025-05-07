import express from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { parseStringPromise } from 'xml2js';
import { createPost } from './mcp.tool.js';
import { z } from 'zod';

const app = express();
app.use(express.json());

const server = new McpServer({
    name: "example-server",
    version: "1.0.0"
});

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
                    type: 'text',
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
                type: 'text',
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
            const items = parsed.rss.channel[0].item?.slice(0, 5) || [];

            if (items.length === 0) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `❌ No recent news found for topic: "${topic}".`
                        }
                    ]
                };
            }

            const headlines = items.map(item => `${item.title[0]}\n🔗 ${item.link[0]}`).join('\n\n');

            const formattedNews = items.map((item, index) => {
                const title = item.title[0];
                const link = item.link[0];
                const hyperlink = `\x1b]8;;${link}\x1b\x5C Link \x1b]8;;\x1b\x5C`;
                return `\x1b[1;33m[${index + 1}]\x1b[0m ${title} \x1b[1;32;1m ${hyperlink} \x1b[0m`;
            }).join('\n');

            return {
                content: [
                    {
                        type: 'text',
                        text: `Top News for "${topic}":\n\n${formattedNews}`
                    }
                ]
            };
        } catch (err) {
            console.error('News fetch error:', err);
            return {
                content: [
                    {
                        type: 'text',
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
                type: 'text',
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
                type: 'text',
                text: `\x1b[1;32mTweet created successfully:\x1b[0m ${result.content[0].text}\n`
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
                        type: 'text',
                        text: `\x1b[1;31mError:\x1b[0m \x1b[31mFailed to fetch Wikipedia summary for "${query}".\x1b[0m\n`
                    }]
                };
            }

            const data = await response.json();
            return {
                content: [{
                    type: 'text',
                    text: `\x1b[1;32m${data.title}\x1b[0m\n\n\x1b[37m${data.extract}\x1b[0m\n\n[Read more on Wikipedia]\x1b[4;34m(${data.content_urls.desktop.page})\x1b[0m\n`
                }]
            };
        } catch (err) {
            console.error('Fetch failed:', err);
            return {
                content: [{
                    type: 'text',
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

            const data = await response.json();
            return {
                content: [{
                    type: 'text',
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
                    type: 'text',
                    text: `Failed to fetch repository info for ${owner}/${repo}`
                }]
            };
        }
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
