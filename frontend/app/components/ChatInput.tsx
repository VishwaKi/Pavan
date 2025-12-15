'use client'

import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react'
import styles from './ChatInput.module.css'
import { ingestData } from '../lib/api'

interface ChatInputProps {
    onSendMessage: (message: string) => void
    onStop?: () => void
    disabled?: boolean
    isTyping?: boolean
}

export default function ChatInput({ onSendMessage, onStop, disabled = false, isTyping = false }: ChatInputProps) {
    const [message, setMessage] = useState('')
    const [showIngestModal, setShowIngestModal] = useState(false)
    const [ingestText, setIngestText] = useState('')
    const [ingestFile, setIngestFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
        }
    }, [message])

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault()
        if (disabled) return // allow typing even when disabled but block sending

        if (message.trim()) {
            onSendMessage(message.trim())
            setMessage('')
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto'
            }
        }
    }

    const resetIngestState = () => {
        setIngestText('')
        setIngestFile(null)
        setUploadStatus(null)
    }

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        setIngestFile(file || null)
        setUploadStatus(null)
    }

    const handleIngest = async () => {
        setUploadStatus(null)

        if (!ingestText.trim() && !ingestFile) {
            setUploadStatus({ type: 'error', message: 'Add text or choose a PDF to upload.' })
            return
        }

        try {
            setIsUploading(true)
            const result = await ingestData({
                text: ingestText,
                pdf: ingestFile ?? undefined
            })
            setUploadStatus({
                type: 'success',
                message: `Uploaded successfully. Document ID: ${result.document_id}`
            })
            setIngestText('')
            setIngestFile(null)
        } catch (error: any) {
            setUploadStatus({
                type: 'error',
                message: error?.message || 'Upload failed. Please try again.'
            })
        } finally {
            setIsUploading(false)
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
                        <button
                            className={`${styles.iconButton} ${styles.plusButton}`}
                            type="button"
                            aria-label="Upload PDF or paste text"
                            onClick={() => {
                                resetIngestState()
                                setShowIngestModal(true)
                            }}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12h14" />
                            </svg>
                        </button>

                        {isTyping && onStop ? (
                            <button
                                className={`${styles.iconButton} ${styles.stopButton}`}
                                type="button"
                                aria-label="Stop response"
                                onClick={onStop}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6h12v12H6z" />
                                </svg>
                            </button>
                        ) : (
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
                        )}
                    </div>
                </div>
            </div>

            <div className={styles.disclaimer}>
                AI can make mistakes. Consider checking important information.
            </div>

            {showIngestModal && (
                <div className={styles.ingestOverlay} onClick={() => setShowIngestModal(false)}>
                    <div className={styles.ingestModal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <p className={styles.modalEyebrow}>Knowledge upload</p>
                                <h3>Upload a PDF or paste text</h3>
                            </div>
                            <button
                                className={styles.closeButton}
                                aria-label="Close upload modal"
                                onClick={() => setShowIngestModal(false)}
                            >
                                ✕
                            </button>
                        </div>

                        <div className={styles.modalBody}>
                            <label className={styles.label} htmlFor="pdf-upload">Upload a PDF</label>
                            <input
                                id="pdf-upload"
                                type="file"
                                accept="application/pdf"
                                onChange={handleFileChange}
                                className={styles.fileInput}
                            />
                            {ingestFile && (
                                <p className={styles.helperText}>Selected: {ingestFile.name}</p>
                            )}

                            <label className={styles.label} htmlFor="text-upload">Or paste text</label>
                            <textarea
                                id="text-upload"
                                className={styles.textUpload}
                                placeholder="Paste any text you want to ingest..."
                                rows={5}
                                value={ingestText}
                                onChange={(e) => setIngestText(e.target.value)}
                            />
                        </div>

                        {uploadStatus && (
                            <div className={uploadStatus.type === 'success' ? styles.statusSuccess : styles.statusError}>
                                {uploadStatus.message}
                            </div>
                        )}

                        <div className={styles.modalActions}>
                            <button
                                className={styles.secondaryButton}
                                type="button"
                                onClick={() => {
                                    resetIngestState()
                                    setShowIngestModal(false)
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className={`${styles.primaryButton} ${isUploading ? styles.disabled : ''}`}
                                type="button"
                                onClick={handleIngest}
                                disabled={isUploading}
                            >
                                {isUploading ? 'Uploading...' : 'Upload'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
