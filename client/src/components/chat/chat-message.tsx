"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type MessageProps = {
  message: string;
  isUser: boolean;
  timestamp?: string;
};

export function ChatMessage({ message, isUser, timestamp }: MessageProps) {
  // Function to format GitHub repository info
  const formatRepoInfo = (message: string) => {
    if (message.includes('Repository Name:') && message.includes('Stars:')) {
      const lines = message.split('\n');
      return (
        <div className="flex flex-col gap-3">
          {lines.map((line, index) => {
            // Repository name (with emoji)
            if (line.includes('Repository Name:')) {
              const parts = line.split('Repository Name:');
              const repoName = parts[1]?.trim() || '';
              return (
                <div key={index} className="font-bold text-amber-500 text-lg">
                  📦 Repository Name: {repoName}
                </div>
              );
            }

            // Description
            if (line.includes('Description:')) {
              const parts = line.split('Description:');
              const description = parts[1]?.trim() || '';
              return (
                <div key={index} className="text-white">
                  📝 Description: {description}
                </div>
              );
            }

            // Stars
            if (line.includes('Stars:')) {
              const parts = line.split('Stars:');
              const stars = parts[1]?.trim() || '';
              return (
                <div key={index} className="text-yellow-400">
                  ⭐ Stars: {stars}
                </div>
              );
            }

            // Forks
            if (line.includes('Forks:')) {
              const parts = line.split('Forks:');
              const forks = parts[1]?.trim() || '';
              return (
                <div key={index} className="text-gray-400">
                  🍴 Forks: {forks}
                </div>
              );
            }

            // Open Issues
            if (line.includes('Open Issues:')) {
              const parts = line.split('Open Issues:');
              const issues = parts[1]?.trim() || '';
              return (
                <div key={index} className="text-red-500">
                  🚩 Open Issues: {issues}
                </div>
              );
            }

            // Repository Link
            if (line.includes('Repository Link:')) {
              const parts = line.split('Repository Link:');
              const link = parts[1]?.trim() || '';
              return (
                <div key={index} className="text-blue-500">
                  🔗 Repository Link:
                  <a href={link} target="_blank" rel="noopener noreferrer" className="underline ml-1">
                    {link}
                  </a>
                </div>
              );
            }

            return <div key={index}>{line}</div>;
          })}
        </div>
      );
    }

    // Format tweet messages (success or error)
    if (message.includes('Tweet created successfully:') ||
        message.includes('Tweet sent successfully:') ||
        message.includes('Error posting to Twitter:')) {

      // Check if it's an error message
      if (message.includes('Error posting to Twitter:')) {
        return (
          <div className="flex flex-col gap-2">
            <div className="text-red-500 font-medium">
              {message}
            </div>
            <div className="text-gray-400 text-sm">
              Please check your Twitter API credentials in the server/.env file.
            </div>
          </div>
        );
      }

      // Handle success message
      const lines = message.split('\n');
      const tweetIdLine = lines[0];
      const contentLine = lines[1] || '';

      // Extract the tweet ID
      const tweetIdMatch = tweetIdLine.match(/Tweet sent successfully: (\d+)/);
      const tweetId = tweetIdMatch ? tweetIdMatch[1] : '';

      // Extract the content
      const contentMatch = contentLine.match(/Content: "(.+)"/);
      const content = contentMatch ? contentMatch[1] : '';

      return (
        <div className="flex flex-col gap-2">
          <div className="text-green-500 font-medium">
            Tweet created successfully: {tweetId}
          </div>
          {content && (
            <div className="text-white">
              Content: "{content}"
            </div>
          )}
          <div className="text-blue-400 text-sm">
            <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(content)}`}
               target="_blank" rel="noopener noreferrer" className="underline">
              Click here to manually post this tweet if automatic posting failed
            </a>
          </div>
        </div>
      );
    }

    // Default formatting for regular messages
    return <p className="text-sm whitespace-pre-wrap">{message}</p>;
  };

  return (
    <div
      className={cn(
        "flex w-full items-start gap-2 p-4",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <Avatar className="h-8 w-8">
          <AvatarImage src="/bot-avatar.png" alt="AI" />
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "flex max-w-[80%] flex-col gap-2 rounded-lg p-4",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        {formatRepoInfo(message)}
        {timestamp && (
          <span className="text-xs opacity-70">{timestamp}</span>
        )}
      </div>
      {isUser && (
        <Avatar className="h-8 w-8">
          <AvatarImage src="/user-avatar.png" alt="User" />
          <AvatarFallback>You</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
