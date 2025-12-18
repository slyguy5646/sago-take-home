"use client";

import { Mail, ExternalLink } from "lucide-react";

interface EmailRecord {
  id: string;
  messageId: string;
  from: string;
  subject: string;
  body: string;
  receivedAt: Date;
}

export function EmailRow({ email }: { email: EmailRecord }) {
  const truncateBody = (text: string, length: number = 100) => {
    return text.length > length ? text.substring(0, length) + "..." : text;
  };

  const senderName = email.from.split("<")[0].trim() || email.from;

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="flex items-start gap-3 py-3 px-3 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer group">
      <Mail className="size-5 text-neutral-400 shrink-0 mt-0.5" />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-neutral-900 truncate">
              {email.subject || "(No subject)"}
            </p>
            <p className="text-xs text-neutral-500 mt-1">From: {senderName}</p>
          </div>
          <time className="text-xs text-neutral-400 shrink-0 whitespace-nowrap">
            {formatDate(email.receivedAt)}
          </time>
        </div>

        <p className="text-xs text-neutral-600 mt-2 line-clamp-2">
          {truncateBody(email.body)}
        </p>
      </div>

      <ExternalLink className="size-4 text-neutral-300 shrink-0 group-hover:text-neutral-500 transition-colors" />
    </div>
  );
}
