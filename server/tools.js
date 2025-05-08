import { z } from 'zod';
import { parseStringPromise } from 'xml2js';
import { createPost } from './mcp.tool.js';

/*
 Register all tools with the MCP server
 @param {McpServer} server - The MCP server instance

 List of tools:

 1) Print Menu            | Prints what can the MCP server do with the available tools (apart from printing this menu)
 2) News by Topic         | Fetches recent news headlines for a given topic using Google News
 3) Wikipedia Search      | Search Wikipedia and return the summary of the top result
 4) GitHub Repo Info      | Fetch information about a public GitHub repository
 5) X/Twitter Post        | Create and post a tweet on X (formerly Twitter)

 */

 export function registerTools(server) {

    const FORMAT = {
        RESET:  '\x1b[0m',
        BOLD:   '\x1b[1m',
        GREEN:  '\x1b[32m',
        CYAN:   '\x1b[36m',
        HYPERLINK: (url, text) => `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`
    };

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
                .map((item, index) => `${FORMAT.BOLD}(${index + 1})${FORMAT.RESET} ${FORMAT.CYAN}${item}${FORMAT.RESET}`)
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

    // Tool: News by Topic
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

                const formattedNews = items.map((item, index) => {
                    const title = item.title[0];
                    const link = item.link[0];
                    return `${FORMAT.BOLD}[${index + 1}]${FORMAT.RESET} ${title} ${FORMAT.GREEN}${FORMAT.HYPERLINK(link, "Read more")}${FORMAT.RESET}`;
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

    // Tool: Adder
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
                    text: `${FORMAT.GREEN}Result:${FORMAT.RESET} The sum of ${FORMAT.BOLD}${a}${FORMAT.RESET} and ${FORMAT.BOLD}${b}${FORMAT.RESET} is ${FORMAT.CYAN}${a + b}${FORMAT.RESET}.\n`
                }
                ]
            };
        }
    );

    // Tool: Twitter/X Post
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
                    text: `${FORMAT.GREEN}${FORMAT.BOLD}Tweet created successfully:${FORMAT.RESET} ${result.content[0].text}\n`
                }
                ]
            };
        }
    );

    // Tool: Wikipedia Search
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
                            text: `Error: Failed to fetch Wikipedia summary for "${query}".\n`
                        }]
                    };
                }

                const data = await response.json();
                const articleUrl = data.content_urls.desktop.page;
                
                return {
                    content: [{
                        type: 'text',
                        text: `${FORMAT.GREEN}${FORMAT.BOLD}${data.title}${FORMAT.RESET}\n\n` +
                              `${data.extract}\n\n` +
                              `${FORMAT.HYPERLINK(articleUrl, "Read more on Wikipedia")}`
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

    // Tool: GitHub Repo Info
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
                            `${FORMAT.GREEN}${FORMAT.BOLD}📦 Repository Name:${FORMAT.RESET} ${FORMAT.CYAN}${data.full_name}${FORMAT.RESET}\n\n` +
                            `${FORMAT.GREEN}📝 Description:${FORMAT.RESET} ${data.description || 'No description'}\n` +
                            `${FORMAT.GREEN}⭐ Stars:${FORMAT.RESET} ${data.stargazers_count}\n` +
                            `${FORMAT.GREEN}🍴 Forks:${FORMAT.RESET} ${data.forks_count}\n` +
                            `${FORMAT.GREEN}🚩 Open Issues:${FORMAT.RESET} ${data.open_issues_count}\n` +
                            `${FORMAT.GREEN}🔗 Repository Link:${FORMAT.RESET} ${FORMAT.HYPERLINK(data.html_url, data.html_url)}`
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
}