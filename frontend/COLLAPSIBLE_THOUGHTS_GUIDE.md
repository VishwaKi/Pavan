# Collapsible Thoughts Feature

## Overview

The frontend now displays thinking steps in a **collapsible "Thoughts" section** similar to Claude and Gemini. This provides transparency into the AI's reasoning process while keeping the UI clean.

## User Experience

### **While Thinking** (Processing)
The AI shows the current thinking state with animated dots:

```
AI Assistant  10:22 AM
● ● ●  🤔 Analyzing your request and preparing to call the diabetes prediction tool...
```

As processing continues, the text updates in place:

```
AI Assistant  10:22 AM
● ● ●  ⚙️ MedicalAssistant is processing your health data...
```

Then:

```
AI Assistant  10:22 AM
● ● ●  📊 Analyzing prediction results...
```

### **After Completion** (Final Response)
The thinking indicator disappears and is replaced with:

1. **Collapsible Thoughts Section** (above the response)
```
┌─────────────────────────────────────┐
│ ▼  💭 Thoughts (3)                  │
└─────────────────────────────────────┘
```

2. **Final Response** (markdown formatted)
```
Based on the health metrics you provided, the diabetes 
prediction model indicates a positive result...

[Copy button]
```

### **Expanded Thoughts** (On Click)
When the user clicks the "💭 Thoughts" button:

```
┌─────────────────────────────────────────────────────────┐
│ ▲  💭 Thoughts (3)                                      │
├─────────────────────────────────────────────────────────┤
│  ①  🤔 Analyzing your request and preparing to call    │
│  │   the diabetes prediction tool...                   │
│  │   10:22 AM                                          │
│  │                                                      │
│  ②  ⚙️ MedicalAssistant is processing your health     │
│  │   data...                                           │
│  │   10:22 AM                                          │
│  │                                                      │
│  ③  📊 Analyzing prediction results...                 │
│      10:22 AM                                          │
└─────────────────────────────────────────────────────────┘
```

## Implementation Details

### **Data Structure**

#### ThinkingStep Interface
```typescript
export interface ThinkingStep {
    text: string        // The thinking text
    timestamp: Date     // When this step occurred
}
```

#### Message Interface (Updated)
```typescript
export interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
    type?: string
    isThinking?: boolean           // Currently thinking?
    thinkingText?: string          // Current thinking text
    thinkingSteps?: ThinkingStep[] // History of all steps
}
```

### **Message Flow**

#### 1. ToolCallRequestEvent
- Creates a new message with `isThinking: true`
- Initializes `thinkingSteps` array with first step
- Shows animated dots + thinking text

```typescript
{
    id: 'thinking-123',
    role: 'assistant',
    content: '...',
    isThinking: true,
    thinkingText: '🤔 Analyzing your request...',
    thinkingSteps: [
        { text: '🤔 Analyzing your request...', timestamp: Date }
    ]
}
```

#### 2. ToolCallExecutionEvent
- Updates the SAME message
- Adds new step to `thinkingSteps` array
- Updates `thinkingText` to show current state

```typescript
{
    id: 'thinking-123',
    role: 'assistant',
    content: '...',
    isThinking: true,
    thinkingText: '⚙️ MedicalAssistant is processing...',
    thinkingSteps: [
        { text: '🤔 Analyzing your request...', timestamp: Date },
        { text: '⚙️ MedicalAssistant is processing...', timestamp: Date }
    ]
}
```

#### 3. ToolCallSummaryMessage
- Updates the SAME message
- Adds another step to `thinkingSteps` array
- Updates `thinkingText` again

```typescript
{
    id: 'thinking-123',
    role: 'assistant',
    content: '...',
    isThinking: true,
    thinkingText: '📊 Analyzing prediction results...',
    thinkingSteps: [
        { text: '🤔 Analyzing your request...', timestamp: Date },
        { text: '⚙️ MedicalAssistant is processing...', timestamp: Date },
        { text: '📊 Analyzing prediction results...', timestamp: Date }
    ]
}
```

#### 4. TextMessage (Final)
- Updates the SAME message
- Sets `isThinking: false` (stops showing animated dots)
- Clears `thinkingText` (no current thinking text)
- **KEEPS `thinkingSteps`** (for collapsible section)
- Updates `content` with final response

```typescript
{
    id: 'thinking-123',
    role: 'assistant',
    content: 'Based on the health metrics you provided...',
    isThinking: false,
    thinkingText: undefined,
    thinkingSteps: [
        { text: '🤔 Analyzing your request...', timestamp: Date },
        { text: '⚙️ MedicalAssistant is processing...', timestamp: Date },
        { text: '📊 Analyzing prediction results...', timestamp: Date }
    ]
}
```

## UI Components

### **Thoughts Toggle Button**
```tsx
<button className={styles['thoughts-toggle']} onClick={() => setShowThoughts(!showThoughts)}>
    <svg className={`${styles['chevron-icon']} ${showThoughts ? styles.expanded : ''}`}>
        {/* Chevron icon that rotates when expanded */}
    </svg>
    <span className={styles['thoughts-label']}>💭 Thoughts</span>
    <span className={styles['thoughts-count']}>(3)</span>
</button>
```

### **Thoughts Content (Expanded)**
```tsx
<div className={styles['thoughts-content']}>
    {message.thinkingSteps.map((step, index) => (
        <div key={index} className={styles['thought-step']}>
            <div className={styles['step-indicator']}>
                <div className={styles['step-number']}>{index + 1}</div>
                {/* Vertical line connecting steps */}
                {index < message.thinkingSteps.length - 1 && (
                    <div className={styles['step-line']}></div>
                )}
            </div>
            <div className={styles['step-content']}>
                <p className={styles['step-text']}>{step.text}</p>
                <span className={styles['step-time']}>{formatTime(step.timestamp)}</span>
            </div>
        </div>
    ))}
</div>
```

## Styling

### **Key CSS Classes**

- `.thoughts-section`: Container with border and background
- `.thoughts-toggle`: Button with hover effect
- `.chevron-icon`: Rotates 180° when expanded
- `.thoughts-content`: Expandable content area
- `.thought-step`: Individual step with timeline layout
- `.step-indicator`: Numbered circle + vertical line
- `.step-number`: Circular badge with step number
- `.step-line`: Vertical line connecting steps
- `.step-content`: Text content of the step
- `.step-text`: Main thinking text
- `.step-time`: Timestamp

### **Visual Design**

- **Timeline Layout**: Vertical line connects numbered steps
- **Numbered Steps**: Circular badges (1, 2, 3) in accent color
- **Hover Effects**: Button highlights on hover
- **Smooth Animations**: Chevron rotation, content fade-in
- **Responsive**: Works on all screen sizes

## Benefits

✅ **Transparency**: Users see exactly what the AI is doing
✅ **Clean UI**: Thoughts are hidden by default
✅ **Informative**: Users can expand to see the process
✅ **Professional**: Looks like Claude/Gemini
✅ **Debugging**: Helps understand the agent workflow
✅ **Educational**: Users learn how multi-agent systems work

## Comparison: Before vs After

### Before
```
AI: [typing...]
AI: [typing...]
AI: [typing...]
AI: Based on the health metrics...
```

### After (Collapsed)
```
AI: ▼ 💭 Thoughts (3)
    Based on the health metrics...
```

### After (Expanded)
```
AI: ▲ 💭 Thoughts (3)
    ┌─────────────────────────────────┐
    │ ① 🤔 Analyzing your request...  │
    │ ② ⚙️ MedicalAssistant working... │
    │ ③ 📊 Analyzing results...        │
    └─────────────────────────────────┘
    Based on the health metrics...
```

## Customization

### Adding New Thinking States

To add a new thinking state, update the message handler in `page.tsx`:

```typescript
} else if (messageType === 'YourNewType') {
    const thinkingText = '🔍 Your custom thinking text...'
    
    setChats(prev => prev.map(chat => {
        if (chat.id === currentActiveChat) {
            return {
                ...chat,
                messages: chat.messages.map(msg =>
                    msg.id === streamingMessageIdRef.current
                        ? {
                            ...msg,
                            thinkingText: thinkingText,
                            thinkingSteps: [
                                ...(msg.thinkingSteps || []),
                                { text: thinkingText, timestamp: new Date() }
                            ]
                        }
                        : msg
                )
            }
        }
        return chat
    }))
}
```

### Customizing Appearance

Edit `ChatMessage.module.css`:

```css
/* Change step number color */
.step-number {
    background: #your-color;
}

/* Change timeline line color */
.step-line {
    background: #your-color;
}

/* Change thoughts section background */
.thoughts-section {
    background: #your-color;
}
```

## Future Enhancements

- [ ] Add icons for different step types
- [ ] Show duration for each step
- [ ] Add progress bar
- [ ] Allow copying individual steps
- [ ] Add "Show raw data" option
- [ ] Syntax highlighting for tool arguments
- [ ] Collapsible sub-steps for complex operations
- [ ] Export thoughts as JSON/text
