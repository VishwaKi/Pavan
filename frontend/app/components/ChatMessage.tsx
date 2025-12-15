'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import styles from './ChatMessage.module.css'

export interface ThinkingStep {
    text: string
    timestamp: Date
}

export interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
    type?: string // Message type from backend
    isThinking?: boolean // For thinking state
    thinkingText?: string // Current thinking text
    thinkingSteps?: ThinkingStep[] // History of all thinking steps
}

interface ChatMessageProps {
    message: Message
    isTyping?: boolean
}

export default function ChatMessage({ message, isTyping = false }: ChatMessageProps) {
    const [copied, setCopied] = useState(false)
    const [showThoughts, setShowThoughts] = useState(false)

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const formatTime = (date: Date) => {
        return new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
        }).format(date)
    }

    // Determine if this is a thinking/processing message
    const isThinkingMessage = message.isThinking ||
        message.type === 'ToolCallRequestEvent' ||
        message.type === 'ToolCallExecutionEvent' ||
        message.type === 'Thoughts'

    // Get the thinking text based on message type
    const getThinkingText = () => {
        if (message.thinkingText) return message.thinkingText

        switch (message.type) {
            case 'ToolCallRequestEvent':
                return 'Tool is calling...'
            case 'ToolCallExecutionEvent':
                return 'Tool is execution...' // Fallback
            case 'ToolCallSummaryMessage':
                return 'Analyzing results...'
            case 'Thoughts':
                return 'Thinking...'
            default:
                return 'Thinking...'
        }
    }

    // Check if we should show ONLY text (no dots) for tool events or thoughts with content
    const showTextOnly = message.type === 'ToolCallRequestEvent' ||
        message.type === 'ToolCallExecutionEvent' ||
        (message.type === 'Thoughts' && message.thinkingText)

    return (
        <div className={`${styles['message-container']} ${styles[message.role]}`}>
            <div className={`${styles.avatar} ${styles[message.role]}`}>
                {message.role === 'user' ? 'U' : 'AI'}
            </div>

            <div className={styles['message-content']}>
                <div className={styles['message-header']}>
                    <span className={styles['sender-name']}>
                        {message.role === 'user' ? 'You' : 'AI Assistant'}
                    </span>
                    <span className={styles.timestamp}>{formatTime(message.timestamp)}</span>
                </div>

                {/* Show collapsible thoughts section if there are thinking steps */}
                {message.thinkingSteps && message.thinkingSteps.length > 0 && (
                    <div className={styles['thoughts-section']}>
                        <button
                            className={styles['thoughts-toggle']}
                            onClick={() => setShowThoughts(!showThoughts)}
                        >
                            <svg
                                className={`${styles['chevron-icon']} ${showThoughts ? styles.expanded : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                            <span className={styles['thoughts-label']}>💭 Thoughts</span>
                            <span className={styles['thoughts-count']}>({message.thinkingSteps.length})</span>
                        </button>

                        {showThoughts && (
                            <div className={styles['thoughts-content']}>
                                {message.thinkingSteps.map((step, index) => (
                                    <div key={index} className={styles['thought-step']}>
                                        <div className={styles['step-indicator']}>
                                            <div className={styles['step-number']}>{index + 1}</div>
                                            {index < message.thinkingSteps!.length - 1 && (
                                                <div className={styles['step-line']}></div>
                                            )}
                                        </div>
                                        <div className={styles['step-content']}>
                                            <div className={styles['step-text']}>
                                                <ReactMarkdown
                                                    components={{
                                                        code({ node, className, children, ...props }: any) {
                                                            const match = /language-(\w+)/.exec(className || '')
                                                            return match ? (
                                                                <SyntaxHighlighter
                                                                    style={vscDarkPlus as any}
                                                                    language={match[1]}
                                                                    PreTag="div"
                                                                    {...props}
                                                                >
                                                                    {String(children).replace(/\n$/, '')}
                                                                </SyntaxHighlighter>
                                                            ) : (
                                                                <code className={className} {...props}>
                                                                    {children}
                                                                </code>
                                                            )
                                                        }
                                                    }}
                                                >
                                                    {step.text}
                                                </ReactMarkdown>
                                            </div>
                                            <span className={styles['step-time']}>
                                                {formatTime(step.timestamp)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Show thinking indicator ONLY if there's no content yet */}
                {(isTyping || isThinkingMessage) && !message.content ? (
                    <div className={styles['thinking-container']}>
                        {!showTextOnly && (
                            <div className={styles['thinking-indicator']}>
                                <div className={styles['thinking-dot']}></div>
                                <div className={styles['thinking-dot']}></div>
                                <div className={styles['thinking-dot']}></div>
                            </div>
                        )}
                        <span className={`${styles['thinking-text']} ${showTextOnly ? styles['tool-text'] : ''}`}>
                            {getThinkingText()}
                        </span>
                    </div>
                ) : null}

                {/* Show actual content if it exists */}
                {message.content && (
                    <>
                        <div className={styles['message-text']}>
                            {/* If message type is ToolCallSummaryMessage, render as HTML for tables */}
                            {message.type === 'ToolCallSummaryMessage' ? (
                                <div
                                    className="prose dark:prose-invert max-w-none"
                                    dangerouslySetInnerHTML={{ __html: message.content }}
                                />
                            ) : (
                                <ReactMarkdown
                                    components={{
                                        code({ node, className, children, ...props }: any) {
                                            const match = /language-(\w+)/.exec(className || '')
                                            const inline = !match
                                            return !inline && match ? (
                                                <SyntaxHighlighter
                                                    style={vscDarkPlus as any}
                                                    language={match[1]}
                                                    PreTag="div"
                                                    {...props}
                                                >
                                                    {String(children).replace(/\n$/, '')}
                                                </SyntaxHighlighter>
                                            ) : (
                                                <code className={className} {...props}>
                                                    {children}
                                                </code>
                                            )
                                        }
                                    }}
                                >
                                    {message.content}
                                </ReactMarkdown>
                            )}
                        </div>

                        {message.role === 'assistant' && (
                            <div className={styles['message-actions']}>
                                <button className={styles['action-btn']} onClick={handleCopy}>
                                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        {copied ? (
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        ) : (
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        )}
                                    </svg>
                                    {copied ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
