# WebSocket Persistent Connection Fix

## Problem

The WebSocket connection was disconnecting and reconnecting between chat sessions, causing:
- Unnecessary reconnection attempts
- Potential message loss
- Poor user experience
- Connection instability

## Root Cause

The WebSocket implementation had automatic reconnection logic that would trigger even on manual disconnections, and there was insufficient logging to debug connection issues.

## Solution

### 1. **Added Manual Disconnect Flag**

Added a `manualDisconnect` flag to distinguish between:
- **Manual disconnections**: User closes the app or intentionally disconnects
- **Unexpected disconnections**: Network issues, server errors, etc.

```typescript
private manualDisconnect = false
```

### 2. **Improved Disconnect Logic**

Updated the `onclose` handler to check the flag before attempting reconnection:

```typescript
this.ws.onclose = (event) => {
    console.log(`🔌 WebSocket closed. Code: ${event.code}, Reason: ${event.reason || 'No reason provided'}, Clean: ${event.wasClean}`)
    this.options.onDisconnect?.()
    
    // Only attempt reconnect if it wasn't a manual disconnect
    if (!this.manualDisconnect) {
        console.log('🔄 Connection closed unexpectedly, attempting to reconnect...')
        this.attemptReconnect()
    } else {
        console.log('👋 Manual disconnect - not reconnecting')
    }
}
```

### 3. **Enhanced Logging**

Added comprehensive emoji-based logging for better debugging:

- 🔌 Connection events (connecting, closing)
- ✅ Success events (connected, task completed)
- ❌ Error events (connection errors, parsing errors)
- 📤 Outgoing messages
- 📨 Incoming messages
- 🔄 Reconnection attempts
- 👋 Manual disconnections

### 4. **Updated disconnect() Method**

The `disconnect()` method now sets the flag before closing:

```typescript
disconnect() {
    console.log('👋 Manually disconnecting WebSocket...')
    this.manualDisconnect = true // Set flag to prevent reconnection
    if (this.ws) {
        this.ws.close()
        this.ws = null
    }
}
```

### 5. **Reset Flag on Connect**

When connecting (or reconnecting), the flag is reset:

```typescript
connect() {
    console.log('🔌 Attempting to connect to WebSocket...')
    this.manualDisconnect = false // Reset flag when connecting
    // ... rest of connection logic
}
```

## How It Works Now

### Normal Operation Flow

1. **Page Load**:
   ```
   🔌 Attempting to connect to WebSocket...
   ✅ WebSocket connected successfully
   ```

2. **Sending Message**:
   ```
   📤 Sending message: {type: "TextMessage", source: "user", content: "..."}
   ```

3. **Receiving Response**:
   ```
   📨 Received message: {content: "...", source: "assistant"}
   ✅ Task completed signal received
   ```

4. **Connection Stays Open**: The WebSocket remains connected for the next message

### Unexpected Disconnection Flow

1. **Connection Lost**:
   ```
   🔌 WebSocket closed. Code: 1006, Reason: No reason provided, Clean: false
   🔄 Connection closed unexpectedly, attempting to reconnect...
   🔄 Attempting to reconnect (1/5) in 1000ms...
   ```

2. **Reconnection Success**:
   ```
   🔌 Attempting to connect to WebSocket...
   ✅ WebSocket connected successfully
   ```

### Manual Disconnection Flow

1. **User Closes App**:
   ```
   👋 Manually disconnecting WebSocket...
   🔌 WebSocket closed. Code: 1000, Reason: No reason provided, Clean: true
   👋 Manual disconnect - not reconnecting
   ```

## WebSocket Close Codes

The enhanced logging now shows WebSocket close codes:

- **1000**: Normal closure (clean disconnect)
- **1001**: Going away (page navigation)
- **1006**: Abnormal closure (connection lost)
- **1008**: Policy violation
- **1011**: Server error

## Backend Compatibility

The backend maintains a persistent connection with a `while True` loop:

```python
@app.websocket("/ws/chat")
async def chat_ws(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket connected")
    
    try:
        while True:  # ← Keeps connection alive
            # Receive user message
            data = await websocket.receive_json()
            user_msg = TextMessage.model_validate(data)
            
            # Process and stream response
            async for message in assistant.run_stream(task=user_msg.content):
                await send_json_datetime(websocket, message.model_dump())
            
            # Send completion signal
            await send_json_datetime(websocket, {
                "type": "task_completed",
                "source": "system",
                "content": "Diabetes prediction completed."
            })
            # Loop continues, waiting for next message
    
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
```

## Debugging WebSocket Issues

### Check Browser Console

Look for these log patterns:

**Healthy Connection**:
```
🔌 Attempting to connect to WebSocket...
✅ WebSocket connected successfully
📤 Sending message: {...}
📨 Received message: {...}
✅ Task completed signal received
```

**Connection Issues**:
```
❌ WebSocket error event: ...
🔌 WebSocket closed. Code: 1006, ...
🔄 Attempting to reconnect (1/5) in 1000ms...
```

**Backend Not Running**:
```
🔌 Attempting to connect to WebSocket...
❌ WebSocket error event: ...
🔌 WebSocket closed. Code: 1006, Reason: No reason provided, Clean: false
🔄 Attempting to reconnect (1/5) in 1000ms...
```

### Check Backend Logs

Look for these patterns:

**Healthy Connection**:
```
INFO:     WebSocket connected
INFO:     User input: Predict diabetes for...
INFO:     WebSocket disconnected
```

**Backend Errors**:
```
ERROR:    Unexpected error
Traceback (most recent call last):
  ...
```

### Common Issues and Solutions

| Issue | Symptom | Solution |
|-------|---------|----------|
| Backend not running | Continuous reconnection attempts | Start backend: `python app1.py` |
| Port conflict | Connection refused | Check if port 8003 is available |
| CORS issues | Connection blocked | Verify CORS middleware in backend |
| Network issues | Code 1006 disconnections | Check firewall/network settings |
| Backend crash | Unexpected disconnection | Check backend logs for errors |

## Testing the Fix

### Test 1: Send Multiple Messages
1. Open the frontend
2. Send a message
3. Wait for response
4. Send another message
5. **Expected**: No reconnection logs between messages

### Test 2: Backend Restart
1. Send a message
2. Stop the backend server
3. **Expected**: See reconnection attempts
4. Restart backend
5. **Expected**: Automatic reconnection success

### Test 3: Page Refresh
1. Refresh the page
2. **Expected**: Clean disconnect, then new connection

## Configuration

### Reconnection Settings

You can adjust these in `websocket.ts`:

```typescript
private maxReconnectAttempts = 5  // Max reconnection attempts
private reconnectDelay = 1000      // Base delay in ms (increases with each attempt)
```

### Reconnection Delay Pattern

- Attempt 1: 1000ms (1 second)
- Attempt 2: 2000ms (2 seconds)
- Attempt 3: 3000ms (3 seconds)
- Attempt 4: 4000ms (4 seconds)
- Attempt 5: 5000ms (5 seconds)

After 5 failed attempts, shows error: "Failed to reconnect to server"

## Benefits

✅ **Persistent Connection**: WebSocket stays connected across multiple messages
✅ **Smart Reconnection**: Only reconnects on unexpected disconnections
✅ **Better Debugging**: Comprehensive logging with emojis for easy identification
✅ **Improved UX**: No unnecessary reconnections or interruptions
✅ **Error Transparency**: Clear close codes and reasons
✅ **Automatic Recovery**: Handles network issues gracefully

## Files Modified

- `frontend/app/lib/websocket.ts`: Added manual disconnect flag and enhanced logging
- Backend (`app1.py`): No changes needed - already supports persistent connections

## Next Steps

If you still experience disconnection issues:

1. **Check browser console** for detailed logs
2. **Check backend logs** for server-side errors
3. **Verify network stability** (try localhost vs IP address)
4. **Check for backend exceptions** that might close the connection
5. **Monitor close codes** to identify the root cause
