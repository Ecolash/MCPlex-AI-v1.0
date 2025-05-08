import { z } from 'zod';

/*
 Register all tools with the MCP server
 @param {McpServer} server - The MCP server instance

 List of Basic Tools:

 1) Adder       | Add two numbers together
 */

export function registerTools(server) {

    const FORMAT = {
        RESET:  '\x1b[0m',
        BOLD:   '\x1b[1m',
        GREEN:  '\x1b[32m',
        CYAN:   '\x1b[36m',
        HYPERLINK: (url, text) => `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`
    };

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

}

