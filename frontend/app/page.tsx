'use client'

import { useState, useRef, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ChatMessage, { Message } from './components/ChatMessage'
import ChatInput from './components/ChatInput'
import { ChatWebSocket, WebSocketMessage } from './lib/websocket'
import styles from './page.module.css'

interface Chat {
    id: string
    title: string
    timestamp: Date
    messages: Message[]
}

// WebSocket URL - update if your backend runs on a different port
const WS_URL = 'ws://localhost:8003/ws/chat'

export default function Home() {
    const [chats, setChats] = useState<Chat[]>([])
    const [activeChat, setActiveChat] = useState<string | null>(null)
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [isTyping, setIsTyping] = useState(false)
    const [showScrollButton, setShowScrollButton] = useState(false)
    const [isConnected, setIsConnected] = useState(false)
    const [connectionError, setConnectionError] = useState<string | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const messagesContainerRef = useRef<HTMLDivElement>(null)
    const wsRef = useRef<ChatWebSocket | null>(null)
    const isUnmountingRef = useRef(false) // Track unmounting state
    const currentStreamingMessageRef = useRef<string>('')
    const streamingMessageIdRef = useRef<string | null>(null)
    const activeChatRef = useRef<string | null>(null)
    const rootAgentRef = useRef<string | null>(null) // Track the agent that started the interaction

    const currentChat = chats.find(chat => chat.id === activeChat)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [currentChat?.messages, isTyping])

    useEffect(() => {
        const container = messagesContainerRef.current
        if (!container) return

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
            setShowScrollButton(!isNearBottom && scrollHeight > clientHeight)
        }

        container.addEventListener('scroll', handleScroll)
        return () => container.removeEventListener('scroll', handleScroll)
    }, [])

    // Keep activeChatRef in sync with activeChat state
    useEffect(() => {
        activeChatRef.current = activeChat
    }, [activeChat])

    // Create a default chat on component mount
    useEffect(() => {
        if (chats.length === 0) {
            const defaultChat: Chat = {
                id: Date.now().toString(),
                title: 'New Chat',
                timestamp: new Date(),
                messages: []
            }
            setChats([defaultChat])
            setActiveChat(defaultChat.id)
        }
    }, []) // Run only once on mount

    // Initialize WebSocket connection ONCE on mount
    useEffect(() => {
        console.log('Initializing WebSocket connection...')
        const ws = new ChatWebSocket({
            url: WS_URL,
            onConnect: () => {
                if (isUnmountingRef.current) return
                console.log('✅ Connected to WebSocket')
                setIsConnected(true)
                setConnectionError(null)
            },
            onDisconnect: () => {
                if (isUnmountingRef.current) return
                console.log('❌ Disconnected from WebSocket')
                setIsConnected(false)
            },
            onMessage: (message: WebSocketMessage) => {
                console.log('📨 Received message:', message)

                const currentActiveChat = activeChatRef.current
                if (!currentActiveChat) return

                const messageType = message.type || 'TextMessage'
                const messageId = message.id || `msg-${Date.now()}`

                // Extract content based on message type and structure
                let content = ''
                if (typeof message.content === 'string') {
                    content = message.content
                } else if (Array.isArray(message.content)) {
                    // For ToolCallRequestEvent and similar, stringify the array
                    content = JSON.stringify(message.content, null, 2)
                } else if (message.content && typeof message.content === 'object') {
                    // For objects, stringify them
                    content = JSON.stringify(message.content, null, 2)
                } else {
                    content = String(message.content || '')
                }

                console.log('📝 Extracted content:', content)
                console.log('📋 Message type:', messageType)


                // Handle different message types
                // Handle different message types
                if (messageType === 'ToolCallRequestEvent') {
                    // Start of a tool call
                    const agentName = message.source ? message.source.replace(/_/g, ' ') : 'AI'

                    // IF this is the start of a new turn (no active thinking message), set the root agent
                    if (!streamingMessageIdRef.current) {
                        rootAgentRef.current = message.source || null
                        console.log('📌 Root agent set to:', rootAgentRef.current)
                    }

                    // Parse arguments to get tool name and arguments
                    let toolName = 'tool'
                    let toolArgs = ''
                    try {
                        const contentObj = Array.isArray(message.content) ? message.content[0] : message.content
                        if (contentObj && typeof contentObj === 'object') {
                            if ('name' in contentObj) toolName = contentObj.name
                            if ('arguments' in contentObj) {
                                // pretty print the JSON arguments
                                try {
                                    const parsedArgs = JSON.parse(contentObj.arguments)
                                    toolArgs = JSON.stringify(parsedArgs, null, 2)
                                } catch {
                                    toolArgs = contentObj.arguments
                                }
                            }
                        }
                    } catch (e) {
                        // fallback
                    }

                    // Update: User requested specific message "this tool is calling"
                    const thinkingText = `${toolName} is calling...`
                    const argsBlock = toolArgs ? `\n\`\`\`json\n${toolArgs}\n\`\`\`` : ''
                    const fullStepText = `${thinkingText}\n${argsBlock}`

                    // Common update logic for thinking state
                    const updateThinkingState = (prevChats: Chat[]) => prevChats.map(chat => {
                        if (chat.id !== currentActiveChat) return chat

                        // Check if we have an active streaming message
                        if (streamingMessageIdRef.current) {
                            return {
                                ...chat,
                                messages: chat.messages.map(msg =>
                                    msg.id === streamingMessageIdRef.current
                                        ? {
                                            ...msg,
                                            thinkingText: thinkingText, // Update the displayed text
                                            thinkingSteps: [
                                                ...(msg.thinkingSteps || []),
                                                { text: fullStepText, timestamp: new Date() }
                                            ]
                                        }
                                        : msg
                                )
                            }
                        } else {
                            // Create new one
                            const thinkingMessageId = `thinking-${Date.now()}`
                            streamingMessageIdRef.current = thinkingMessageId
                            return {
                                ...chat,
                                messages: [...chat.messages, {
                                    id: thinkingMessageId,
                                    role: 'assistant' as const,
                                    content: '', // No content yet, just thinking
                                    timestamp: new Date(),
                                    type: messageType,
                                    isThinking: true,
                                    thinkingText: thinkingText,
                                    thinkingSteps: [{ text: fullStepText, timestamp: new Date() }]
                                }]
                            }
                        }
                    })

                    setChats(prev => updateThinkingState(prev))

                } else if (messageType === 'ToolCallExecutionEvent') {
                    // Tool is executing / has executed
                    const agentName = message.source ? message.source.replace(/_/g, ' ') : 'AI'
                    let toolName = 'tool'
                    let toolResult = ''

                    // Try to extract tool name and result
                    try {
                        const contentObj = Array.isArray(message.content) ? message.content[0] : message.content
                        if (contentObj && typeof contentObj === 'object') {
                            if ('name' in contentObj) toolName = contentObj.name
                            // The result is usually in 'content' field of the execution event item
                            if ('content' in contentObj) {
                                toolResult = typeof contentObj.content === 'object'
                                    ? JSON.stringify(contentObj.content, null, 2)
                                    : String(contentObj.content)
                            }
                        }
                    } catch (e) { }

                    // Update: User requested "this tool is execution" (assuming they meant "executing" or literally "execution", 
                    // I will use "is executing" as it is more grammatical but close to request, or strict "execution" if preferred.
                    // User said: "make a message this tool is calling and toocall execution event type mention this tool is execution"
                    // Strict interpretation: "this tool is execution"
                    const thinkingText = `${toolName} is execution`
                    const resultBlock = toolResult ? `\n\`\`\`json\n${toolResult}\n\`\`\`` : ''
                    const fullStepText = `${thinkingText}\n${resultBlock}`

                    setChats(prev => prev.map(chat => {
                        if (chat.id !== currentActiveChat) return chat

                        if (streamingMessageIdRef.current) {
                            return {
                                ...chat,
                                messages: chat.messages.map(msg =>
                                    msg.id === streamingMessageIdRef.current
                                        ? {
                                            ...msg,
                                            thinkingText: thinkingText,
                                            thinkingSteps: [...(msg.thinkingSteps || []), { text: fullStepText, timestamp: new Date() }]
                                        }
                                        : msg
                                )
                            }
                        }
                        return chat
                    }))

                } else if (messageType === 'ToolCallSummaryMessage') {
                    // The tool has finished and produced a result (often HTML)
                    console.log('🎯 ToolCallSummaryMessage received')

                    // The content here is the result summary, likely HTML table
                    // We treat this as a finalized message part, but we might want to keep "thinking" 
                    // if we expect more text. However, usually Summary is the result.
                    // Let's finalize this specific block.

                    if (streamingMessageIdRef.current) {
                        setChats(prev => prev.map(chat => {
                            if (chat.id !== currentActiveChat) return chat
                            return {
                                ...chat,
                                messages: chat.messages.map(msg =>
                                    msg.id === streamingMessageIdRef.current
                                        ? {
                                            ...msg,
                                            content: content, // This contains the HTML table
                                            type: messageType,
                                            isThinking: false, // Done thinking for this step
                                            thinkingText: undefined
                                        }
                                        : msg
                                )
                            }
                        }))
                        // Reset streaming ID to allow next message to start fresh if needed
                        // OR keep it if we want to append? 
                        // For tables, it's usually a standalone block. Let's reset.
                        streamingMessageIdRef.current = null
                    } else {
                        // If no thinking message existed, create new message with the table
                        const newMessageId = `summary-${Date.now()}`
                        setChats(prev => prev.map(chat => {
                            if (chat.id !== currentActiveChat) return chat
                            return {
                                ...chat,
                                messages: [...chat.messages, {
                                    id: newMessageId,
                                    role: 'assistant',
                                    content: content,
                                    timestamp: new Date(),
                                    type: messageType,
                                    isThinking: false
                                }]
                            }
                        }))
                    }

                } else if (messageType === 'UserInputRequestedEvent') {
                    // User input requested - clear thinking state
                    console.log('👤 User input requested')
                    if (streamingMessageIdRef.current) {
                        // We might want to show a "Waiting for input..." state?
                        // For now, just finalize the thought process.
                        streamingMessageIdRef.current = null
                    }


                } else if (messageType === 'TextMessage' && message.source !== 'user') {
                    // Final response - replace thinking message with actual content
                    console.log('🎯 Final TextMessage received, content length:', content.length)

                    // Skip empty messages
                    if (!content || content.trim() === '') {
                        console.warn('⚠️ Received empty TextMessage, skipping...')
                        return
                    }

                    if (streamingMessageIdRef.current) {
                        // Update existing thinking message with final content
                        console.log('🔄 Updating existing thinking message with final content')
                        setChats(prev => prev.map(chat => {
                            if (chat.id === currentActiveChat) {
                                const messageExists = chat.messages.some(msg => msg.id === streamingMessageIdRef.current)

                                if (messageExists) {
                                    return {
                                        ...chat,
                                        messages: chat.messages.map(msg =>
                                            msg.id === streamingMessageIdRef.current
                                                ? {
                                                    ...msg,
                                                    content: content,
                                                    type: messageType,
                                                    isThinking: false, // Turn off thinking state
                                                    thinkingText: undefined, // Clear current thinking text
                                                    // Keep thinkingSteps so they can be shown in collapsible section
                                                }
                                                : msg
                                        )
                                    }
                                } else {
                                    // Create new message if it doesn't exist
                                    console.log('➕ Creating new message (thinking message not found)')
                                    return {
                                        ...chat,
                                        messages: [
                                            ...chat.messages,
                                            {
                                                id: messageId,
                                                role: 'assistant' as const,
                                                content: content,
                                                timestamp: new Date(),
                                                type: messageType,
                                                isThinking: false
                                            }
                                        ]
                                    }
                                }
                            }
                            return chat
                        }))
                    } else {
                        // No existing thinking message, create new one
                        console.log('➕ Creating new message (no thinking message)')
                        streamingMessageIdRef.current = messageId
                        setChats(prev => prev.map(chat => {
                            if (chat.id === currentActiveChat) {
                                return {
                                    ...chat,
                                    messages: [
                                        ...chat.messages,
                                        {
                                            id: messageId,
                                            role: 'assistant' as const,
                                            content: content,
                                            timestamp: new Date(),
                                            type: messageType,
                                            isThinking: false
                                        }
                                    ]
                                }
                            }
                            return chat
                        }))
                    }
                }
            },
            onComplete: () => {
                console.log('✅ Message stream completed')
                setIsTyping(false)
                currentStreamingMessageRef.current = ''
                streamingMessageIdRef.current = null
            },
            onError: (error: Error) => {
                console.error('❌ WebSocket error:', error)
                setConnectionError(error.message)
                setIsTyping(false)

                // Add error message to chat using ref
                const currentActiveChat = activeChatRef.current
                if (currentActiveChat) {
                    const errorMessage: Message = {
                        id: Date.now().toString(),
                        role: 'assistant',
                        content: `⚠️ **Error**: ${error.message}\n\nPlease make sure the backend server is running on port 8003.`,
                        timestamp: new Date()
                    }

                    setChats(prev => prev.map(chat =>
                        chat.id === currentActiveChat
                            ? { ...chat, messages: [...chat.messages, errorMessage] }
                            : chat
                    ))
                }
            }
        })

        ws.connect()
        wsRef.current = ws

        // Cleanup ONLY on component unmount
        return () => {
            console.log('🧹 Cleaning up WebSocket connection')
            isUnmountingRef.current = true
            ws.disconnect()
        }
    }, []) // Empty dependency array - only run once!

    const createNewChat = () => {
        const newChat: Chat = {
            id: Date.now().toString(),
            title: 'New Chat',
            timestamp: new Date(),
            messages: []
        }
        setChats(prev => [newChat, ...prev])
        setActiveChat(newChat.id)
    }

    const handleSendMessage = async (content: string) => {
        // If no active chat exists, this shouldn't happen now due to default chat creation
        // but we'll handle it gracefully
        if (!activeChat) {
            console.warn('No active chat found, creating one...')
            const newChat: Chat = {
                id: Date.now().toString(),
                title: content.slice(0, 50),
                timestamp: new Date(),
                messages: []
            }
            setChats(prev => [newChat, ...prev])
            setActiveChat(newChat.id)
            // We'll need to wait for the state to update, so we'll return and let the user send again
            return
        }

        if (!wsRef.current?.isConnected()) {
            setConnectionError('Not connected to server. Please wait...')
            return
        }

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content,
            timestamp: new Date()
        }

        // Add user message to the current chat
        setChats(prev => prev.map(chat =>
            chat.id === activeChat
                ? {
                    ...chat,
                    messages: [...chat.messages, userMessage],
                    title: chat.messages.length === 0 ? content.slice(0, 50) : chat.title
                }
                : chat
        ))

        // Reset streaming state for new AI response
        currentStreamingMessageRef.current = ''
        streamingMessageIdRef.current = `ai-${Date.now()}`
        setIsTyping(true)

        // Send message via WebSocket
        try {
            wsRef.current.sendMessage(content)
        } catch (error) {
            console.error('Error sending message:', error)
            setIsTyping(false)
            setConnectionError('Failed to send message')
        }
    }

    return (
        <div className={styles['main-container']}>
            <Sidebar
                chats={chats}
                activeChat={activeChat}
                onNewChat={createNewChat}
                onSelectChat={setActiveChat}
                isOpen={isSidebarOpen}
                onToggle={setIsSidebarOpen}
            />

            <div
                className={`${styles['chat-area']} ${isSidebarOpen ? styles['sidebar-open'] : ''}`}
            >
                <div className={styles['messages-container']} ref={messagesContainerRef}>
                    {!currentChat || currentChat.messages.length === 0 ? (
                        <div className={styles['welcome-screen']}>
                            <div className={styles['welcome-content']}>
                                {/* AI Icon and Title */}
                                <div className={styles['welcome-header']}>
                                    <div className={styles['welcome-icon']}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                        </svg>
                                    </div>
                                    <h1 className={styles['welcome-title']}>How can I help you?</h1>
                                </div>

                                {/* Suggested Prompts */}
                                <div className={styles['suggested-prompts']}>
                                    <button
                                        className={styles['prompt-card']}
                                        onClick={() => handleSendMessage("Predict diabetes for: Pregnancies: 6, Glucose: 148, BloodPressure: 72, SkinThickness: 35, Insulin: 0, BMI: 33.6, DiabetesPedigreeFunction: 0.627, Age: 50")}
                                    >
                                        <div className={styles['prompt-icon']}>🩺</div>
                                        <div className={styles['prompt-content']}>
                                            <h3 className={styles['prompt-title']}>Predict Diabetes Risk</h3>
                                            <p className={styles['prompt-description']}>Get diabetes prediction based on health metrics like glucose, BMI, and age</p>
                                        </div>
                                    </button>

                                    <button
                                        className={styles['prompt-card']}
                                        onClick={() => handleSendMessage("What factors are most important for diabetes prediction?")}
                                    >
                                        <div className={styles['prompt-icon']}>📊</div>
                                        <div className={styles['prompt-content']}>
                                            <h3 className={styles['prompt-title']}>Key Health Factors</h3>
                                            <p className={styles['prompt-description']}>Learn which health metrics matter most for diabetes risk</p>
                                        </div>
                                    </button>

                                    <button
                                        className={styles['prompt-card']}
                                        onClick={() => handleSendMessage("Explain how diabetes prediction models work")}
                                    >
                                        <div className={styles['prompt-icon']}>🧠</div>
                                        <div className={styles['prompt-content']}>
                                            <h3 className={styles['prompt-title']}>How It Works</h3>
                                            <p className={styles['prompt-description']}>Understand the science behind diabetes prediction AI</p>
                                        </div>
                                    </button>

                                    <button
                                        className={styles['prompt-card']}
                                        onClick={() => handleSendMessage("What are healthy glucose and BMI levels?")}
                                    >
                                        <div className={styles['prompt-icon']}>💡</div>
                                        <div className={styles['prompt-content']}>
                                            <h3 className={styles['prompt-title']}>Healthy Ranges</h3>
                                            <p className={styles['prompt-description']}>Find out what normal glucose and BMI levels should be</p>
                                        </div>
                                    </button>
                                </div>

                                {/* Connection Error */}
                                {connectionError && (
                                    <div className={styles['connection-error']}>
                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <div>
                                            <strong>Connection Error</strong>
                                            <p>{connectionError}</p>
                                            <p className={styles['error-hint']}>Make sure the backend server is running on port 8003</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <>
                            {currentChat.messages.map((message) => (
                                <ChatMessage key={message.id} message={message} />
                            ))}
                            {isTyping && (
                                <ChatMessage
                                    message={{
                                        id: 'typing',
                                        role: 'assistant',
                                        content: '',
                                        timestamp: new Date()
                                    }}
                                    isTyping={true}
                                />
                            )}
                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                <button
                    className={`${styles['scroll-to-bottom']} ${showScrollButton ? styles.visible : ''}`}
                    onClick={scrollToBottom}
                    aria-label="Scroll to bottom"
                >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                </button>

                <ChatInput
                    onSendMessage={handleSendMessage}
                    disabled={isTyping || !isConnected}
                />
            </div>
        </div>
    )
}
