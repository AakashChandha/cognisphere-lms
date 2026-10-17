import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { QueryAuthorRoleBadge } from "@/components/queries/query-badges";
import { cn } from "@/lib/utils";
import { formatDateTime, formatRelativeTime } from "@/lib/utils/format";
import type { QueryMessage } from "@/types/query";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return `${first}${last}`.toUpperCase();
}

/**
 * The conversation itself, oldest first. The caller's own messages sit to the
 * right in the primary tint; everyone else's sit to the left on the card
 * surface, labelled with who they are.
 */
export function QueryMessageList({ messages }: { messages: QueryMessage[] }) {
  return (
    <ol className="space-y-4">
      {messages.map((message) => (
        <li
          key={message.id}
          className={cn("flex items-start gap-3", message.isMine && "flex-row-reverse")}
        >
          <Avatar size="sm" className="mt-0.5">
            <AvatarFallback className={message.isMine ? "bg-primary/10 text-primary" : undefined}>
              {initialsOf(message.authorName)}
            </AvatarFallback>
          </Avatar>

          <div className={cn("min-w-0 max-w-[48rem] flex-1 space-y-1", message.isMine && "items-end text-right")}>
            <div
              className={cn(
                "flex flex-wrap items-center gap-x-2 gap-y-1",
                message.isMine && "justify-end",
              )}
            >
              <span className="text-sm font-medium text-foreground">
                {message.isMine ? "You" : message.authorName}
              </span>
              <QueryAuthorRoleBadge role={message.authorRole} />
              <time
                dateTime={message.createdAt}
                title={formatDateTime(message.createdAt)}
                className="text-xs text-muted-foreground"
              >
                {formatRelativeTime(message.createdAt)}
              </time>
            </div>

            <div
              className={cn(
                "inline-block w-full rounded-xl border px-3.5 py-2.5 text-left text-sm whitespace-pre-line",
                message.isMine
                  ? "border-primary/20 bg-primary/5 text-foreground"
                  : "border-border bg-card text-foreground",
              )}
            >
              {message.body}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
