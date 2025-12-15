'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import styles from './ChatInput.module.css'

interface ChatInputProps {
    onSendMessage: (message: string) => void
    disabled?: boolean
}

export default function ChatInput({ onSendMessage, disabled = false }: ChatInputProps) {
    const [message, setMessage] = useState('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
        }
    }, [message])

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault()
        if (message.trim() && !disabled) {
            onSendMessage(message.trim())
            setMessage('')
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto'
            }
        }
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
        }
    }

    return (
        <div className={styles.container}>
            <div className={styles.inputBox}>
                <textarea
                    ref={textareaRef}
                    className={styles.textarea}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Message OpenMind"
                    rows={1}
                    disabled={disabled}
                />

                <div className={styles.controls}>
                    <div className={styles.leftControls}>
                        <button className={styles.pillButton} type="button" aria-label="DeepThink">
                            <span className={styles.icon}>⚡</span>
                            DeepThink
                        </button>
                        <button className={styles.pillButton} type="button" aria-label="Search">
                            <span className={styles.icon}>🌐</span>
                            Search
                        </button>
                    </div>
                    <div className={styles.rightControls}>
                        <button className={styles.iconButton} type="button" aria-label="Attach file">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                        </button>
                        <button
                            className={`${styles.iconButton} ${styles.sendButton} ${message.trim() ? styles.active : ''}`}
                            onClick={handleSubmit}
                            disabled={disabled || !message.trim()}
                            aria-label="Send message"
                        >
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <div className={styles.disclaimer}>
                AI can make mistakes. Consider checking important information.
            </div>
        </div>
    )
}
