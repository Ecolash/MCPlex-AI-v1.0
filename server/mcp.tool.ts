import dotenv from 'dotenv';
import { TwitterApi } from 'twitter-api-v2';

dotenv.config();

// Define types for the Twitter client
const twitterClient = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY as string,
    appSecret: process.env.TWITTER_API_SECRET as string,
    accessToken: process.env.TWITTER_ACCESS_TOKEN as string,
    accessSecret: process.env.TWITTER_ACCESS_SECRET as string,
});

// Define the response type according to the SDK requirements
interface TextContent {
    type: "text";
    text: string;
}

interface ToolResponse {
    content: TextContent[];
    [key: string]: unknown;
}

export async function createPost(status: string): Promise<ToolResponse> {
    try {
        const tweet = await twitterClient.v2.tweet(status);
        console.log('Tweet sent successfully:', tweet);

        return {
            content: [
                {
                    type: 'text' as const,
                    text: `Tweet sent successfully: ${tweet.data.id}`,
                },
            ],
        };
    }
    catch (error: any) {
        console.error('Error sending tweet:', error);

        return {
            content: [
                {
                    type: 'text' as const,
                    text: `Error sending tweet: ${error.message}`,
                },
            ],
        };
    }
}
