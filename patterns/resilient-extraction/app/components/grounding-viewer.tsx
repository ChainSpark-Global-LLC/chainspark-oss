"use client";

import { useMemo, useState } from "react";

/**
 * Represents a span of text in the source document.
 */
export interface EvidenceSpan {
    text: string;
    startOffset: number;
    endOffset: number;
}

/**
 * A highlight to render in the source text.
 */
interface Highlight {
    id: string;
    span: EvidenceSpan;
    color: string;
    label: string;
}

interface GroundingViewerProps {
    /** The original source text. */
    sourceText: string;
    /** List of highlights to render. */
    highlights: Highlight[];
    /** Currently selected highlight ID. */
    selectedId?: string;
    /** Callback when a highlight is clicked. */
    onHighlightClick?: (id: string) => void;
}

/**
 * GroundingViewer
 * 
 * Renders source text with highlighted evidence spans. Users can click
 * on a highlight to select it, and the corresponding extracted item
 * can be shown in a linked panel.
 * 
 * @example
 * ```tsx
 * <GroundingViewer
 *   sourceText={invoiceText}
 *   highlights={[
 *     { id: "item-1", span: { text: "$6,000.00", startOffset: 342, endOffset: 351 }, color: "yellow", label: "Total" },
 *   ]}
 *   selectedId={selectedItem}
 *   onHighlightClick={setSelectedItem}
 * />
 * ```
 */
export function GroundingViewer({
    sourceText,
    highlights,
    selectedId,
    onHighlightClick,
}: GroundingViewerProps) {
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    // Sort highlights by start offset and merge overlapping spans
    const sortedHighlights = useMemo(() => {
        return [...highlights].sort((a, b) => a.span.startOffset - b.span.startOffset);
    }, [highlights]);

    // Build the rendered segments
    const segments = useMemo(() => {
        const result: Array<{ text: string; highlight?: Highlight }> = [];
        let cursor = 0;

        for (const highlight of sortedHighlights) {
            const { startOffset, endOffset } = highlight.span;

            // Validate offsets
            if (startOffset < cursor || endOffset > sourceText.length) {
                continue; // Skip invalid or overlapping highlights
            }

            // Add text before this highlight
            if (startOffset > cursor) {
                result.push({ text: sourceText.slice(cursor, startOffset) });
            }

            // Add the highlighted segment
            result.push({
                text: sourceText.slice(startOffset, endOffset),
                highlight,
            });

            cursor = endOffset;
        }

        // Add remaining text
        if (cursor < sourceText.length) {
            result.push({ text: sourceText.slice(cursor) });
        }

        return result;
    }, [sourceText, sortedHighlights]);

    return (
        <div className="font-mono text-sm whitespace-pre-wrap bg-gray-50 p-4 rounded-lg border border-gray-200 overflow-auto max-h-[500px]">
            {segments.map((segment, index) => {
                if (!segment.highlight) {
                    return <span key={index}>{segment.text}</span>;
                }

                const { id, color, label } = segment.highlight;
                const isSelected = id === selectedId;
                const isHovered = id === hoveredId;

                const bgColor = {
                    yellow: isSelected ? "bg-yellow-300" : isHovered ? "bg-yellow-200" : "bg-yellow-100",
                    green: isSelected ? "bg-green-300" : isHovered ? "bg-green-200" : "bg-green-100",
                    blue: isSelected ? "bg-blue-300" : isHovered ? "bg-blue-200" : "bg-blue-100",
                    red: isSelected ? "bg-red-300" : isHovered ? "bg-red-200" : "bg-red-100",
                }[color] || "bg-gray-100";

                return (
                    <span
                        key={index}
                        className={`${bgColor} cursor-pointer rounded px-0.5 transition-colors relative group`}
                        onClick={() => onHighlightClick?.(id)}
                        onMouseEnter={() => setHoveredId(id)}
                        onMouseLeave={() => setHoveredId(null)}
                        title={label}
                    >
                        {segment.text}
                        {isHovered && (
                            <span className="absolute -top-6 left-0 bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                                {label}
                            </span>
                        )}
                    </span>
                );
            })}
        </div>
    );
}

export default GroundingViewer;
