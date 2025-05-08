import dotenv from 'dotenv';
import { TwitterApi } from 'twitter-api-v2';

dotenv.config();

const twitterClient = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
})

export async function createPost(status) {
    try {
        const tweet = await twitterClient.v2.tweet(status);
        console.log('Tweet sent successfully:', tweet);

        return {
            content: [
                {
                    type: 'text',
                    text: `Tweet sent successfully: ${tweet.data.id}`,
                },
            ],
        };
    }
    catch (error) {
        console.error('Error sending tweet:', error);

        return {
            content: [
                {
                    type: 'text',
                    text: `Error sending tweet: ${error.message}`,
                },
            ],
        };
    }
}