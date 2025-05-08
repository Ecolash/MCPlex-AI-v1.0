import { z } from 'zod';
import { parseStringPromise } from 'xml2js';
import { createPost } from './mcp.tool.js';

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

/*
 Register all tools with the MCP server
 @param {McpServer} server - The MCP server instance

 List of tools:

 1) Print Menu            | Prints what can the MCP server do with the available tools (apart from printing this menu)
 2) News by Topic         | Fetches recent news headlines for a given topic using Google News
 3) Wikipedia Search      | Search Wikipedia and return the summary of the top result
 4) GitHub Repo Info      | Fetch information about a public GitHub repository
 5) X/Twitter Post        | Create and post a tweet on X (formerly Twitter)
 6) Movie Ratings         | Get ratings and information for movies or TV shows from various sources
 7) Local File Search     | Find files on the local system based on name/extension/content
 8) Truth Table Generator | Generate the truth table of a boolean expression (e.g., A && !B || C)
 9) Define Word           | Get the definition and example usage of a word

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
        'Prints what can the MCP server do with the available tools, gives description of tools (apart from printing this menu)',
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

    // Tool: Movie Ratings
    server.tool(
        'movie-ratings',
        'Get ratings and information for movies or TV shows from various sources',
        {
            title: z.string().describe('The title of the movie or TV show to search for'),
            year: z.number().optional().describe('Optional: Release year to narrow down search results'),
            plot: z.enum(['short', 'full']).default('short').optional().describe('Optional: Length of plot summary (short or full)')
        },
        async (arg) => {
            const { title, year, plot } = arg;
            const API_KEY = process.env.OMDB_API_KEY; 

            let queryUrl = `http://www.omdbapi.com/?apikey=${API_KEY}&t=${encodeURIComponent(title)}&plot=${plot || 'short'}`;
            if (year) queryUrl += `&y=${year}`;
            
            try {
                const response = await fetch(queryUrl);
                if (!response.ok) {
                    throw new Error(`API error: ${response.status} ${response.statusText}`);
                }
                
                const data = await response.json();
                
                if (data.Response === "False") {
                    return {
                        content: [{
                            type: 'text',
                            text: `${FORMAT.BOLD}${FORMAT.RESET} Sorry, couldn't find information for "${title}"${year ? ` (${year})` : ''}.`
                        }]
                    };
                }
                
                let resultText = `${FORMAT.BOLD}${FORMAT.GREEN}🎬 ${data.Title} (${data.Year})${FORMAT.RESET}\n\n`;
                
                resultText += `${FORMAT.BOLD}Genre:${FORMAT.RESET} ${data.Genre}\n`;
                resultText += `${FORMAT.BOLD}Director:${FORMAT.RESET} ${data.Director}\n`;
                resultText += `${FORMAT.BOLD}Starring:${FORMAT.RESET} ${data.Actors}\n`;
                resultText += `${FORMAT.BOLD}Runtime:${FORMAT.RESET} ${data.Runtime}\n\n`;
                resultText += `${FORMAT.BOLD}${FORMAT.CYAN}⭐ RATINGS${FORMAT.RESET}\n\n`;
                
                if (data.imdbRating) {
                    const imdbStars = '⭐'.repeat(Math.round(parseFloat(data.imdbRating)));
                    resultText += `${FORMAT.BOLD}IMDB:${FORMAT.RESET} ${data.imdbRating}/10 ${imdbStars} (${data.imdbVotes} votes)\n`;
                }
                
                if (data.Ratings && data.Ratings.length > 0) {
                    data.Ratings.forEach(rating => {
                        if (rating.Source !== "Internet Movie Database") { 
                            resultText += `${FORMAT.BOLD}${rating.Source}:${FORMAT.RESET} ${rating.Value}\n`;
                        }
                    });
                }
                
                resultText += `\n${FORMAT.BOLD}${FORMAT.CYAN} PLOT: ${FORMAT.RESET}`;
                resultText += `${data.Plot}\n\n`;
                
                resultText += `${FORMAT.BOLD}${FORMAT.CYAN} ADDITIONAL INFO${FORMAT.RESET}\n\n`;
                if (data.Rated) resultText += `${FORMAT.BOLD}Rated:${FORMAT.RESET} ${data.Rated}\n`;
                if (data.Released) resultText += `${FORMAT.BOLD}Released:${FORMAT.RESET} ${data.Released}\n`;
                if (data.Awards && data.Awards !== "N/A") resultText += `${FORMAT.BOLD}Awards:${FORMAT.RESET} ${data.Awards}\n`;
                if (data.BoxOffice && data.BoxOffice !== "N/A") resultText += `${FORMAT.BOLD}Box Office:${FORMAT.RESET} ${data.BoxOffice}\n`;
                
                if (data.imdbID) {
                    const imdbUrl = `https://www.imdb.com/title/${data.imdbID}`;
                    resultText += `\n${FORMAT.HYPERLINK(imdbUrl, "View on IMDB")}`;
                }
                
                return {
                    content: [{
                        type: 'text',
                        text: resultText
                    }]
                };
            } catch (err) {
                console.error('Movie ratings fetch error:', err);
                return {
                    content: [{
                        type: 'text',
                        text: `⚠️ Failed to retrieve movie information. Please try again later.`
                    }]
                };
            }
        }
    );

    server.tool(
        'local-file-search',
        'Find files on the local system based on name/extension/content',
        {
            searchTerm: z.string().describe('Term to search for in filenames or content'),
            directory: z.string().default('./').describe('Directory to search in (defaults to current directory)'),
            fileType: z.enum(['all', 'name', 'extension', 'content']).default('all').describe('Type of search')
        },
        async (arg) => {
            const { searchTerm, directory, fileType } = arg;
            const readFile = promisify(fs.readFile);
            
            const timestamp = new Date().toISOString().replace('T', ' ').substr(0, 19);
            console.log(`[${timestamp}] User ${process.env.USER || 'unknown'} searching for "${searchTerm}" in ${directory}`);
            
            try {
                const stats = fs.statSync(directory);
                if (!stats.isDirectory()) {
                    return {
                        content: [{
                            type: 'text',
                            text: `❌ Error: "${directory}" is not a valid directory.`
                        }]
                    };
                }
            } catch (err) {
                return {
                    content: [{
                        type: 'text',
                        text: `❌ Error: Directory "${directory}" not found or inaccessible.`
                    }]
                };
            }
            
            const results = [];
            let scannedFiles = 0;
            let matchedFiles = 0;
            
            async function scanDirectory(dir) {
                const files = fs.readdirSync(dir, { withFileTypes: true });
                
                for (const file of files) {
                    const fullPath = path.join(dir, file.name);
                    
                    if (file.isDirectory()) {
                        if (file.name !== 'node_modules' && file.name !== '.git') {
                            await scanDirectory(fullPath);
                        }
                    } else {
                        scannedFiles++;
                        let isMatch = false;
                        const fileExtension = path.extname(file.name).toLowerCase();
                        
                        if (fileType === 'all' || fileType === 'name') {
                            if (file.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                                isMatch = true;
                            }
                        }
                        
                        if ((fileType === 'all' || fileType === 'extension') && !isMatch) {
                            const extWithoutDot = fileExtension.slice(1).toLowerCase();
                            if (extWithoutDot === searchTerm.toLowerCase() || 
                                fileExtension.toLowerCase() === searchTerm.toLowerCase()) {
                                isMatch = true;
                            }
                        }
                        
                        if ((fileType === 'all' || fileType === 'content') && !isMatch) {
                            try {
                                const textExtensions = ['.txt', '.js', '.json', '.html', '.css', '.md', '.csv', '.xml', '.log'];
                                if (textExtensions.includes(fileExtension)) {
                                    const content = await readFile(fullPath, 'utf8');
                                    if (content.toLowerCase().includes(searchTerm.toLowerCase())) {
                                        isMatch = true;
                                    }
                                }
                            } catch (err) {
                                console.error(`Error reading file: ${fullPath}`, err);
                            }
                        }
                        
                        if (isMatch) {
                            matchedFiles++;
                            let stats;
                            try {
                                stats = fs.statSync(fullPath);
                            } catch (err) {
                                stats = { size: 0, mtime: new Date(0) };
                            }
                            
                            results.push({
                                name: file.name,
                                path: fullPath,
                                size: stats.size,
                                lastModified: stats.mtime
                            });
                        }
                    }
                    if (results.length >= 20) {
                        break;
                    }
                }
            }
            
            try {
                console.log(`Starting search in ${directory}...`);
                await scanDirectory(directory);
                
                if (results.length === 0) {
                    return {
                        content: [{
                            type: 'text',
                            text: `${FORMAT.CYAN}${FORMAT.BOLD}File Search Results${FORMAT.RESET}\n\n` +
                                `No files found matching "${searchTerm}" in ${directory}\n` +
                                `Search type: ${fileType}\n` +
                                `Files scanned: ${scannedFiles}`
                        }]
                    };
                }
                
                results.sort((a, b) => b.lastModified - a.lastModified);
                const formatFileSize = (bytes) => {
                    if (bytes === 0) return '0 B';
                    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(1024));
                    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
                };
                
                let resultText = `${FORMAT.CYAN}${FORMAT.BOLD}File Search Results${FORMAT.RESET}\n\n`;
                resultText += `Search term: "${searchTerm}"\n`;
                resultText += `Directory: ${directory}\n`;
                resultText += `Search type: ${fileType}\n`;
                resultText += `Files scanned: ${scannedFiles}\n`;
                resultText += `Matches found: ${matchedFiles}${results.length < matchedFiles ? ` (showing first ${results.length})` : ''}\n\n`;
                
                resultText += `${FORMAT.BOLD}Filename${' '.repeat(22)}Size${' '.repeat(10)}Last Modified${FORMAT.RESET}\n`;
                resultText += `${'─'.repeat(80)}\n`;
                
                results.forEach((file, index) => {
                    const fileName = file.name.length > 25 ? file.name.substring(0, 20) + '...' : file.name;
                    const padding = ' '.repeat(Math.max(1, 25 - fileName.length));
                    const size = formatFileSize(file.size);
                    const sizePadding = ' '.repeat(Math.max(1, 12 - size.length));
                    const lastModified = file.lastModified.toISOString().replace('T', ' ').substr(0, 19);
                    
                    const indexStr = (index + 1).toString().padStart(2, ' ');
                    resultText += `${FORMAT.BOLD}${indexStr})${FORMAT.RESET} ${FORMAT.GREEN}${FORMAT.BOLD}${fileName}${FORMAT.RESET}${padding}${size}${sizePadding}${lastModified}\n`;
                });
                
                return {
                    content: [{
                        type: 'text',
                        text: resultText
                    }]
                };
                
            } catch (err) {
                console.error('Error during file search:', err);
                return {
                    content: [{
                        type: 'text',
                        text: `⚠️ An error occurred during the file search: ${err.message}`
                    }]
                };
            }
        }
    );

     // Tool: Truth Table Generator
    server.tool(
        'truth_table',
        'Generate the truth table of a boolean expression (e.g., A && !B || C)',
        {
            expression: z.string().describe('Boolean expression using variables like A, B, C and operators like &&, ||, !')
        },
        async ({ expression }) => {
            const extractVariables = expr => {
                const matches = expr.match(/\b[A-Z]\b/g);
                return [...new Set(matches)].sort();
            };

            const generateCombinations = vars => {
                const n = vars.length;
                const rows = [];
                for (let i = 0; i < (1 << n); i++) {
                    const row = {};
                    vars.forEach((v, j) => {
                        row[v] = Boolean((i >> (n - j - 1)) & 1);
                    });
                    rows.push(row);
                }
                return rows;
            };

            const evaluate = (expr, assignment) => {
                const scopedExpr = expr.replace(/\b([A-Z])\b/g, (_, v) => assignment[v]);
                return eval(scopedExpr);
            };

            try {
                const vars = extractVariables(expression);
                const combinations = generateCombinations(vars);
                const table = combinations.map(row => {
                    const result = evaluate(expression, row);
                    return { ...row, result };
                });

                // Format result
                const header = `${vars.join(' | ')} | Result\n${'-'.repeat(vars.length * 4 + 10)}\n`;
                const body = table.map(row =>
                    `${vars.map(v => row[v] ? 'T' : 'F').join('   ')} |   ${row.result ? 'T' : 'F'}`
                ).join('\n');

                return {
                    content: [
                        {
                            type: 'text',
                            text: `${FORMAT.GREEN}Truth Table:${FORMAT.RESET}\n${FORMAT.BOLD}${header}${body}${FORMAT.RESET}\n`
                        }
                    ]
                };
            } catch (e) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `${FORMAT.BOLD}Error:${FORMAT.RESET} Invalid boolean expression. ${e.message}`
                        }
                    ]
                };
            }
        }
    );

    server.tool(
        'define_word',
        'Get the definition and example usage of a word',
        {
            word: z.string().describe('Word to define')
        },
        async ({ word }) => {
            const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
            
            if (!res.ok) {
            return {
                content: [
                { type: 'text', text: `❌ No definition found for "${word}".` }
                ]
            };
            }

            const [entry] = await res.json();
            const definition = entry.meanings[0]?.definitions[0]?.definition ?? 'No definition available.';
            const example = entry.meanings[0]?.definitions[0]?.example ?? 'No example provided.';

            return {
            content: [
                { type: 'text', text: `📖 Definition of ${word}: ${definition}` },
                { type: 'text', text: `💡 Example: ${example}` }
            ]
            };
        }
    );    
}

