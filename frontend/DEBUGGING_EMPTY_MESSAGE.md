# Debugging Empty Message Issue

## Problem
The thinking effect shows correctly, but the final response appears empty (only showing the Copy button).

## Debugging Steps

### 1. Open Browser Console
Open your browser's developer console (F12) and look for these logs:

### 2. Check Message Flow

When you send a diabetes prediction request, you should see:

```
📨 Received message: {type: "ToolCallRequestEvent", ...}
📝 Extracted content: [...]
📋 Message type: ToolCallRequestEvent

📨 Received message: {type: "ToolCallExecutionEvent", ...}
📝 Extracted content: [...]
📋 Message type: ToolCallExecutionEvent

📨 Received message: {type: "ToolCallSummaryMessage", ...}
📝 Extracted content: [...]
📋 Message type: ToolCallSummaryMessage

📨 Received message: {type: "TextMessage", source: "ManagerAssistant", ...}
📝 Extracted content: "Based on the health metrics..."
📋 Message type: TextMessage
🎯 Final TextMessage received, content length: 234
🔄 Updating existing thinking message with final content
```

### 3. Check for Issues

#### Issue A: Empty Content
If you see:
```
⚠️ Received empty TextMessage, skipping...
```

**Problem**: The backend is sending a TextMessage with no content.

**Solution**: Check the backend logs to see what's being sent. The issue might be in the backend's message serialization.

#### Issue B: Wrong Message Type
If the final message has `type: "ToolCallSummaryMessage"` instead of `type: "TextMessage"`:

**Problem**: The backend might not be sending a final TextMessage.

**Solution**: Check if the backend is sending a proper TextMessage after the tool calls complete.

#### Issue C: Content is Not a String
If you see:
```
📝 Extracted content: {"some": "object"}
```

**Problem**: The content is being stringified as JSON instead of being plain text.

**Solution**: The backend might be sending the content as an object. We need to extract the actual text from it.

### 4. Backend Message Format

The backend should send messages in this sequence:

1. **ToolCallRequestEvent** (thinking: "Analyzing...")
```json
{
    "id": "...",
    "type": "ToolCallRequestEvent",
    "source": "MedicalAssistant",
    "content": [{"id": "...", "name": "predict_diabetes_tool", "arguments": "..."}]
}
```

2. **ToolCallExecutionEvent** (thinking: "Processing...")
```json
{
    "id": "...",
    "type": "ToolCallExecutionEvent",
    "source": "ManagerAssistant",
    "content": [{"content": "MedicalAssistant: {...}", "name": "MedicalAssistant"}]
}
```

3. **ToolCallSummaryMessage** (thinking: "Analyzing results...")
```json
{
    "id": "...",
    "type": "ToolCallSummaryMessage",
    "source": "MedicalAssistant",
    "content": "{'prediction': 1, 'diabetes': 'Yes', 'probability': 0.771}"
}
```

4. **TextMessage** (final response - THIS IS CRITICAL!)
```json
{
    "id": "...",
    "type": "TextMessage",
    "source": "ManagerAssistant",
    "content": "Based on the health metrics you provided, the diabetes prediction model indicates a positive result with a probability of 77.1%. This suggests an elevated risk of diabetes..."
}
```

### 5. Common Fixes

#### Fix 1: Backend Not Sending Final TextMessage

If the backend is not sending a final TextMessage, you need to update the backend to send one after processing.

Check `app1.py` around line 120-130:

```python
# After streaming all messages
async for message in assistant.run_stream(task=user_msg.content):
    await send_json_datetime(websocket, message.model_dump())

# Make sure a final TextMessage is sent if needed
```

#### Fix 2: Content Field is Wrong

If the content is in a different field (like `text` or `message`), update the content extraction:

```typescript
// In page.tsx, update content extraction
let content = ''
if (typeof message.content === 'string') {
    content = message.content
} else if (message.text) {  // Try alternative fields
    content = message.text
} else if (message.message) {
    content = message.message
} else if (Array.isArray(message.content)) {
    content = JSON.stringify(message.content, null, 2)
}
```

#### Fix 3: Message Source Filter

The code filters for `message.source !== 'user'`. Make sure the backend is setting the correct source:

```typescript
// Current filter
else if (messageType === 'TextMessage' && message.source !== 'user') {
```

If the backend sends `source: "assistant"` or `source: "ManagerAssistant"`, this should work.

### 6. Quick Test

To test if the issue is with message handling, temporarily add this code:

```typescript
// Add this right after the content extraction (line ~115)
if (messageType === 'TextMessage' && message.source !== 'user') {
    console.log('🔍 DEBUG - Full message:', JSON.stringify(message, null, 2))
    console.log('🔍 DEBUG - Content:', content)
    console.log('🔍 DEBUG - Content type:', typeof content)
    console.log('🔍 DEBUG - Content length:', content?.length)
}
```

This will show you exactly what's in the final message.

### 7. Expected Console Output

For a successful flow, you should see:

```
🔌 Attempting to connect to WebSocket...
✅ WebSocket connected successfully
📤 Sending message: {type: "TextMessage", source: "user", content: "Predict diabetes..."}
📨 Received message: {type: "ToolCallRequestEvent", ...}
📝 Extracted content: [...]
📋 Message type: ToolCallRequestEvent
📨 Received message: {type: "ToolCallExecutionEvent", ...}
📝 Extracted content: [...]
📋 Message type: ToolCallExecutionEvent
📨 Received message: {type: "ToolCallSummaryMessage", ...}
📝 Extracted content: {...}
📋 Message type: ToolCallSummaryMessage
📨 Received message: {type: "TextMessage", source: "ManagerAssistant", content: "Based on..."}
📝 Extracted content: Based on the health metrics you provided...
📋 Message type: TextMessage
🎯 Final TextMessage received, content length: 234
🔄 Updating existing thinking message with final content
✅ Task completed signal received
```

### 8. Next Steps

1. **Open browser console** and send a test message
2. **Copy all the console logs** and review them
3. **Look for the final TextMessage** - is it being received?
4. **Check the content** - is it empty or does it have text?
5. **Share the logs** if you need help debugging further

## Quick Fix

If the backend is not sending a final TextMessage, you can modify the `ToolCallSummaryMessage` handler to also show the content:

```typescript
} else if (messageType === 'ToolCallSummaryMessage') {
    // Show both thinking and content
    setChats(prev => prev.map(chat => {
        if (chat.id === currentActiveChat) {
            return {
                ...chat,
                messages: chat.messages.map(msg =>
                    msg.id === streamingMessageIdRef.current
                        ? {
                            ...msg,
                            content: content,  // Add this line
                            type: messageType,
                            isThinking: false,  // Change to false to show content
                            thinkingText: undefined  // Remove thinking text
                        }
                        : msg
                )
            }
        }
        return chat
    }))
}
```

This will make the ToolCallSummaryMessage display its content instead of showing thinking effect.
