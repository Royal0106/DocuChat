"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const CITATION_PATTERN = /\[(E\d+)\]/g;

function linkifyCitations(text: string): string {
  return text.replace(CITATION_PATTERN, (match, evidenceId) => `[${match}](#cite-${evidenceId})`);
}

interface MarkdownProps {
  content: string;
  /** Maps an evidence id (e.g. "E1") to the DOM element id of its evidence card. */
  citationTargets?: Map<string, string>;
}

const baseComponents: Components = {
  a: () => null,
};

export function Markdown({ content, citationTargets }: MarkdownProps) {
  const components: Components = {
    ...baseComponents,
    a({ href, children }) {
      if (href?.startsWith("#cite-")) {
        const evidenceId = href.slice("#cite-".length);
        const targetId = citationTargets?.get(evidenceId);
        return (
          <button
            type="button"
            onClick={() => {
              if (!targetId) return;
              document.getElementById(targetId)?.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
            }}
            className="mx-0.5 rounded bg-neutral-900/90 px-1 py-0.5 align-baseline font-mono text-[0.7rem] font-semibold text-white transition-colors hover:bg-neutral-700 disabled:cursor-default disabled:opacity-60 dark:bg-neutral-100/90 dark:text-neutral-900 dark:hover:bg-neutral-300"
            disabled={!targetId}
            aria-label={`Jump to source ${evidenceId}`}
          >
            {children}
          </button>
        );
      }
      return (
        <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
          {children}
        </a>
      );
    },
  };

  return (
    <div className="prose prose-sm prose-neutral max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:bg-neutral-900 prose-pre:text-neutral-100">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {linkifyCitations(content)}
      </ReactMarkdown>
    </div>
  );
}
