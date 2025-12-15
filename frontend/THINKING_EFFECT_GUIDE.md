# Gemini-Style Thinking Effect Implementation

## Overview

The frontend now displays a **Gemini-like thinking effect** that shows the AI's processing steps in real-time. Instead of just showing a generic "typing..." indicator, users see exactly what the AI is doing at each stage.

## Message Types and Thinking States

### 1. **ToolCallRequestEvent**
**When**: AI decides to call a tool (e.g., diabetes prediction)

**UI Display**:
```
🤔 Analyzing your request and preparing to call the diabetes prediction tool...
[animated dots]
```

**Example Backend Message**:
```json
{
    "id": "0a28df31-9a5e-46b3-b132-0846bac9752a",
    "source": "MedicalAssistant",
    "type": "ToolCallRequestEvent",
    "content": [{
        "id": "call_Agms4L72kNluAkcdoHh425Xa",
        "arguments": "{\"pregnancies\":6,\"glucose\":148,...}",
        "name": "predict_diabetes_tool"
    }]
}
```

---

### 2. **ToolCallExecutionEvent**
**When**: The tool is being executed by an agent

**UI Display**:
```
⚙️ MedicalAssistant is processing your health data...
[animated dots]
```

**Example Backend Message**:
```json
{
    "id": "da23a6eb-e864-4b95-9a9c-ccd75295610b",
    "source": "ManagerAssistant",
    "type": "ToolCallExecutionEvent",
    "content": [{
        "content": "MedicalAssistant: {'prediction': 1, 'diabetes': 'Yes', 'probability': 0.771}",
        "name": "MedicalAssistant",
        "call_id": "call_fd0QwXFsBEpIabq8RNeMg1iP",
        "is_error": false
    }]
}
```

---

### 3. **ToolCallSummaryMessage**
**When**: Tool execution completed, analyzing results

**UI Display**:
```
📊 Analyzing prediction results...
[animated dots]
```

**Example Backend Message**:
```json
{
    "id": "a28affa8-9dbb-4bc6-93b6-63b2541a8814",
    "source": "MedicalAssistant",
    "type": "ToolCallSummaryMessage",
    "content": "{'prediction': 1, 'diabetes': 'Yes', 'probability': 0.771}",
    "tool_calls": [...],
    "results": [...]
}
```

---

### 4. **TextMessage** (Final Response)
**When**: AI provides the final human-readable response

**UI Display**:
```
Based on the health metrics you provided, the diabetes prediction model indicates...
[full response with markdown formatting]
```

**Example Backend Message**:
```json
{
    "id": "fee1a229-7017-4747-8186-f240bbb085d5",
    "source": "ManagerAssistant",
    "type": "TextMessage",
    "content": "Based on the health metrics you provided, the diabetes prediction model indicates a **positive** result with a probability of 77.1%..."
}
```

---

## Visual Flow

### User Experience Timeline

```
1. User sends message
   ↓
2. 🤔 Analyzing your request and preparing to call the diabetes prediction tool...
   [animated dots - accent color]
   ↓
3. ⚙️ MedicalAssistant is processing your health data...
   [animated dots - accent color]
   ↓
4. 📊 Analyzing prediction results...
   [animated dots - accent color]
   ↓
5. Final Response
   [Full text with markdown formatting]
   [Copy button appears]
```

## Implementation Details

### Message Interface

```typescript
export interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
    type?: string              // Message type from backend
    isThinking?: boolean       // Whether to show thinking effect
    thinkingText?: string      // Custom thinking text
}
```

### Message Type Handling

The `onMessage` handler in `page.tsx` processes different message types:

1. **ToolCallRequestEvent**: Creates a new thinking message
2. **ToolCallExecutionEvent**: Updates the thinking message with new text
3. **ToolCallSummaryMessage**: Updates the thinking message again
4. **TextMessage**: Replaces the thinking message with final content

### Thinking Effect Styles

**CSS Classes**:
- `.thinking-container`: Flex container for dots and text
- `.thinking-indicator`: Container for animated dots
- `.thinking-dot`: Individual animated dot
- `.thinking-text`: Italic text describing the current action

**Animations**:
- `thinkingPulse`: Dots scale and fade (0.3 → 1 → 0.3 opacity)
- `fadeIn`: Smooth fade-in effect for text

**Colors**:
- Thinking dots: `var(--accent-primary)` (vibrant color)
- Thinking text: `var(--text-secondary)` (muted, italic)

## Customization

### Adding New Message Types

To add a new thinking state:

1. **Update the message handler** in `page.tsx`:
```typescript
else if (messageType === 'YourNewType') {
    setChats(prev => prev.map(chat => {
        if (chat.id === currentActiveChat) {
            return {
                ...chat,
                messages: chat.messages.map(msg =>
                    msg.id === streamingMessageIdRef.current
                        ? {
                            ...msg,
                            type: messageType,
                            isThinking: true,
                            thinkingText: '🔍 Your custom thinking text...'
                        }
                        : msg
                )
            }
        }
        return chat
    }))
}
```

2. **Update the thinking text function** in `ChatMessage.tsx`:
```typescript
const getThinkingText = () => {
    if (message.thinkingText) return message.thinkingText
    
    switch (message.type) {
        case 'YourNewType':
            return '🔍 Your custom thinking text...'
        // ... other cases
    }
}
```

### Customizing Thinking Text

You can customize the emoji and text for each state:

```typescript
thinkingText: '🧠 Deep thinking...'
thinkingText: '🔬 Running analysis...'
thinkingText: '💡 Generating insights...'
thinkingText: '📈 Processing data...'
```

## Benefits

✅ **Transparency**: Users see exactly what the AI is doing
✅ **Engagement**: Animated effects keep users engaged during processing
✅ **Trust**: Showing intermediate steps builds trust in the AI
✅ **Professional**: Looks polished and modern like Gemini
✅ **Informative**: Users understand the multi-agent workflow

## Comparison: Before vs After

### Before
```
User: Predict diabetes for...
AI: [typing...]
AI: Based on the health metrics...
```

### After
```
User: Predict diabetes for...
AI: 🤔 Analyzing your request and preparing to call the diabetes prediction tool...
AI: ⚙️ MedicalAssistant is processing your health data...
AI: 📊 Analyzing prediction results...
AI: Based on the health metrics you provided, the diabetes prediction model indicates...
```

## Technical Notes

### State Management

- **streamingMessageIdRef**: Tracks the current thinking message ID
- **isThinking**: Boolean flag to show/hide thinking effect
- **type**: Message type determines which thinking text to show

### Message Replacement

The thinking message is created once and updated through the stages:
1. Create with `ToolCallRequestEvent`
2. Update with `ToolCallExecutionEvent`
3. Update with `ToolCallSummaryMessage`
4. Replace with final `TextMessage`

This ensures a smooth transition without flickering or duplicate messages.

### Performance

- Uses CSS animations (GPU-accelerated)
- Minimal re-renders (only updates the specific message)
- Efficient state updates with React refs

## Browser Compatibility

✅ Chrome/Edge (latest)
✅ Firefox (latest)
✅ Safari (latest)
✅ Mobile browsers

The animations use standard CSS keyframes and transforms, which are widely supported.

## Accessibility

- Thinking text is readable by screen readers
- Animated dots have appropriate ARIA labels
- Color contrast meets WCAG AA standards
- Animations respect `prefers-reduced-motion`

## Future Enhancements

- [ ] Add progress bar for long-running operations
- [ ] Show estimated time remaining
- [ ] Add sound effects (optional)
- [ ] Allow users to collapse thinking steps
- [ ] Add "Show details" button to expand tool call arguments
- [ ] Implement streaming text effect for final response
