"use client";

import ReactMarkdown from "react-markdown";

type MarkdownContentProps = {
  children: string;
  className?: string;
};

/**
 * Renders AI-generated markdown content (bold, lists, headings, etc.)
 * instead of displaying raw `**`, `#`, `-` symbols as plain text.
 */
export function MarkdownContent({ children, className = "" }: MarkdownContentProps) {
  return (
    <div className={`prose prose-sm prose-slate dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        components={{
          // Headings
          h1: ({ children }) => (
            <h1 className="mb-3 mt-4 text-lg font-bold text-slate-900 dark:text-slate-100 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2.5 mt-3.5 text-base font-bold text-slate-900 dark:text-slate-100 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-3 text-sm font-bold text-slate-900 dark:text-slate-100 first:mt-0">{children}</h3>
          ),
          // Paragraphs
          p: ({ children }) => (
            <p className="mb-2.5 text-base leading-8 text-slate-800 last:mb-0 dark:text-slate-200">{children}</p>
          ),
          // Bold & italic
          strong: ({ children }) => (
            <strong className="font-bold text-slate-900 dark:text-slate-100">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="text-slate-700 dark:text-slate-300">{children}</em>
          ),
          // Lists
          ul: ({ children }) => (
            <ul className="mb-3 ml-1 list-inside list-disc space-y-1.5 text-slate-800 dark:text-slate-200">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 ml-1 list-inside list-decimal space-y-1.5 text-slate-800 dark:text-slate-200">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-base leading-7 text-slate-800 dark:text-slate-200">{children}</li>
          ),
          // Code
          code: ({ children, className }) => {
            const isInline = !className;
            return isInline ? (
              <code className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[13px] font-mono text-indigo-700 dark:bg-slate-800 dark:text-indigo-300">
                {children}
              </code>
            ) : (
              <code className={`${className ?? ""} text-[13px]`}>{children}</code>
            );
          },
          pre: ({ children }) => (
            <pre className="mb-3 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
              {children}
            </pre>
          ),
          // Blockquote
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-4 border-indigo-200 pl-4 text-slate-600 dark:border-indigo-800 dark:text-slate-400">
              {children}
            </blockquote>
          ),
          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-indigo-600 underline decoration-indigo-300 transition hover:text-indigo-800 dark:text-indigo-400 dark:decoration-indigo-700 dark:hover:text-indigo-200"
            >
              {children}
            </a>
          ),
          // Horizontal rule
          hr: () => (
            <hr className="my-4 border-slate-200 dark:border-slate-700" />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
