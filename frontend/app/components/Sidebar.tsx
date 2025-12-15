'use client'

import { useState, useMemo } from 'react'
import styles from './Sidebar.module.css'

interface Chat {
    id: string
    title: string
    timestamp: Date
}

interface SidebarProps {
    chats: Chat[]
    activeChat: string | null
    onNewChat: () => void
    onSelectChat: (chatId: string) => void
    isOpen: boolean
    onToggle: (isOpen: boolean) => void
}

type GroupedChats = {
    [key: string]: Chat[]
}

export default function Sidebar({ chats, activeChat, onNewChat, onSelectChat, isOpen, onToggle }: SidebarProps) {
    // Internal state removed in favor of props


    const groupedChats = useMemo(() => {
        const groups: GroupedChats = {
            'Today': [],
            'Yesterday': [],
            'Previous 7 Days': [],
            'Earlier': []
        }

        const today = new Date()
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        const sevenDaysAgo = new Date(today)
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        chats.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

        chats.forEach(chat => {
            const chatDate = new Date(chat.timestamp)

            if (chatDate.toDateString() === today.toDateString()) {
                groups['Today'].push(chat)
            } else if (chatDate.toDateString() === yesterday.toDateString()) {
                groups['Yesterday'].push(chat)
            } else if (chatDate > sevenDaysAgo) {
                groups['Previous 7 Days'].push(chat)
            } else {
                groups['Earlier'].push(chat)
            }
        })

        return groups
    }, [chats])

    return (
        <>
            {/* Mobile Toggle - Only visible when sidebar is closed on mobile */}
            <button
                className={`${styles['toggle-sidebar-btn']} ${isOpen ? styles.hidden : ''}`}
                onClick={() => onToggle(true)}
                aria-label="Open sidebar"
            >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            </button>

            {/* Backdrop for mobile */}
            {isOpen && (
                <div
                    className={styles['sidebar-backdrop']}
                    onClick={() => onToggle(false)}
                />
            )}

            <aside className={`${styles.sidebar} ${isOpen ? styles.open : styles.closed}`}>
                <div className={styles['sidebar-header']}>
                    <div className={styles['logo-container']}>
                        <div className={styles['logo-icon']}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                        </div>
                        <span className={styles['logo-text']}>OpenMind</span>
                    </div>
                    <button
                        className={styles['collapse-btn']}
                        onClick={() => onToggle(false)}
                        aria-label="Collapse sidebar"
                    >
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 12H5m0 0l7 7m-7-7l7-7" />
                        </svg>
                    </button>
                </div>

                <div className={styles['new-chat-section']}>
                    <button className={styles['new-chat-btn']} onClick={onNewChat}>
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        New chat
                    </button>
                </div>

                <div className={styles['chat-history']}>
                    {Object.entries(groupedChats).map(([group, groupChats]) => (
                        groupChats.length > 0 && (
                            <div key={group} className={styles['history-group']}>
                                <div className={styles['group-title']}>{group}</div>
                                {groupChats.map((chat) => (
                                    <div
                                        key={chat.id}
                                        className={`${styles['chat-history-item']} ${activeChat === chat.id ? styles.active : ''}`}
                                        onClick={() => {
                                            onSelectChat(chat.id)
                                            // Optional: Close sidebar on mobile when selecting a chat
                                            if (window.innerWidth <= 768) onToggle(false)
                                        }}
                                    >
                                        <span className={styles['chat-title']}>{chat.title}</span>
                                        {activeChat === chat.id && (
                                            <div className={styles['chat-actions']}>
                                                <button className={styles['action-btn']} aria-label="Edit title">
                                                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                    </svg>
                                                </button>
                                                <button className={styles['action-btn']} aria-label="Delete chat">
                                                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )
                    ))}

                    {chats.length === 0 && (
                        <div className={styles['empty-state']}>
                            <p>No chat history</p>
                        </div>
                    )}
                </div>

                <div className={styles['sidebar-footer']}>
                    <div className={styles['user-profile']}>
                        <div className={styles['user-avatar']}>
                            <img src="https://ui-avatars.com/api/?name=User&background=random" alt="User" />
                        </div>
                        <div className={styles['user-info']}>
                            <div className={styles['user-name']}>Vishwa L</div>
                        </div>
                        <button className={styles['settings-btn']}>
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </aside>
        </>
    )
}
