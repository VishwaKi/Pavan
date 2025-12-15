# Message Flow for Purchase Requisition System

## Overview

This document explains how the frontend handles the WebSocket message flow for your Purchase Requisition (PR) and RFQ system.

## Message Types Handled

### 1. **TextMessage** (User/Agent)
- **From User**: User's input messages
- **From Agent**: Final responses from agents (rare in your system)

### 2. **ToolCallRequestEvent**
- **When**: Agent decides to call a tool
- **Source**: `create_pr_agent`, `RFQ_Agent`, `PR_Fetcher_Agent`, etc.
- **Content**: Array with tool call details (id, arguments, name)
- **UI**: Shows thinking indicator with agent name and tool name

### 3. **ToolCallExecutionEvent**
- **When**: Tool is being executed
- **Source**: Agent that called the tool
- **Content**: Array with execution results
- **UI**: Updates thinking text to show execution status

### 4. **ToolCallSummaryMessage**
- **When**: Tool execution completed
- **Source**: Agent that called the tool
- **Content**: Final result (often HTML tables or formatted text)
- **UI**: **This is treated as the final response** - shows the content and stops thinking

### 5. **UserInputRequestedEvent**
- **When**: Agent needs user input to continue
- **Source**: `user_proxy`
- **Content**: Empty string
- **UI**: Clears thinking state, waits for user input

### 6. **task_completed**
- **When**: Entire task is finished
- **Source**: `system`
- **Content**: Completion message
- **UI**: Can be used to show completion status

## Example Flow: Creating a Purchase Requisition

### User: "I want steel sheets"

#### Step 1: ToolCallRequestEvent
```json
{
  "source": "create_pr_agent",
  "type": "ToolCallRequestEvent",
  "content": [{
    "id": "call_y07Ku7RmtIKB7Nz7y5Dtg0oz",
    "arguments": "{\"user_message\":\"I want steel sheets\"}",
    "name": "create_open_pr"
  }]
}
```
**UI Shows**: `🤔 create_pr_agent is preparing to call create_open_pr...`

---

#### Step 2: ToolCallExecutionEvent
```json
{
  "source": "create_pr_agent",
  "type": "ToolCallExecutionEvent",
  "content": [{
    "content": "<div><h6>Matching Products for Steel Sheets</h6>...</div>",
    "name": "create_open_pr",
    "call_id": "call_y07Ku7RmtIKB7Nz7y5Dtg0oz"
  }]
}
```
**UI Shows**: `⚙️ create_pr_agent is executing create_open_pr...`

---

#### Step 3: ToolCallSummaryMessage (FINAL RESPONSE)
```json
{
  "source": "create_pr_agent",
  "type": "ToolCallSummaryMessage",
  "content": "<div><h6>Matching Products for Steel Sheets</h6><table>...</table></div>"
}
```
**UI Shows**: 
- Thinking stops
- HTML table is rendered
- "💭 Thoughts (2)" appears above the response
- User can click to see thinking steps

---

#### Step 4: UserInputRequestedEvent
```json
{
  "source": "user_proxy",
  "type": "UserInputRequestedEvent",
  "content": "",
  "request_id": "8d3286d3-2aaf-4324-8be2-0360f6750a61"
}
```
**UI Shows**: 
- Clears thinking state
- Waits for user input

---

### User: "Select all and deliver in 45 days with 100 qty"

The cycle repeats with new ToolCallRequestEvent → ToolCallExecutionEvent → ToolCallSummaryMessage...

---

## Multi-Agent Flow Example

### User: "Create RFQ"

This triggers multiple agents in sequence:

#### Agent 1: PR_Fetcher_Agent
```
ToolCallRequestEvent → get_open_prs
ToolCallExecutionEvent → Fetching PRs...
ToolCallSummaryMessage → Retrieved 5 open PR items
```

#### Agent 2: RFQ_Agent
```
ToolCallRequestEvent → get_recommended_suppliers
ToolCallExecutionEvent → Finding suppliers...
ToolCallSummaryMessage → Retrieved 5 suppliers

ToolCallRequestEvent → create_rfq
ToolCallExecutionEvent → Creating RFQ...
ToolCallSummaryMessage → Successfully created RFQ R0877
```

**UI Shows**:
```
💭 Thoughts (6)  ← Click to expand

Successfully created RFQ R0877 for PR PR0350 with 5 suppliers

[Copy button]
```

**Expanded Thoughts**:
```
┌─────────────────────────────────────────────────────┐
│ ▲  💭 Thoughts (6)                                  │
├─────────────────────────────────────────────────────┤
│  ① 🤔 PR_Fetcher_Agent is preparing to call        │
│  │  get_open_prs...                                │
│  │                                                  │
│  ② ⚙️ PR_Fetcher_Agent is executing get_open_prs...│
│  │                                                  │
│  ③ 🤔 RFQ_Agent is preparing to call               │
│  │  get_recommended_suppliers...                   │
│  │                                                  │
│  ④ ⚙️ RFQ_Agent is executing                       │
│  │  get_recommended_suppliers...                   │
│  │                                                  │
│  ⑤ 🤔 RFQ_Agent is preparing to call create_rfq... │
│  │                                                  │
│  ⑥ ⚙️ RFQ_Agent is executing create_rfq...         │
└─────────────────────────────────────────────────────┘
```

## Key Differences from Original Implementation

### Original (Diabetes Prediction)
- Single agent: `MedicalAssistant`
- Final response: Separate `TextMessage` after `ToolCallSummaryMessage`
- Hardcoded thinking text

### New (PR/RFQ System)
- Multiple agents: `create_pr_agent`, `RFQ_Agent`, `PR_Fetcher_Agent`
- Final response: **ToolCallSummaryMessage itself** (no separate TextMessage)
- Dynamic thinking text based on agent name and tool name
- Handles `UserInputRequestedEvent` for interactive workflows

## Implementation Details

### Dynamic Thinking Text

```typescript
// ToolCallRequestEvent
const agentName = message.source || 'AI'
const toolName = message.content[0]?.name || 'tool'
const thinkingText = `🤔 ${agentName} is preparing to call ${toolName}...`

// ToolCallExecutionEvent
const thinkingText = `⚙️ ${agentName} is executing ${toolName}...`
```

### Handling Multiple Agents

The code checks if a thinking message already exists:
- **First ToolCallRequestEvent**: Creates new thinking message
- **Subsequent ToolCallRequestEvents**: Updates existing thinking message
- **All events**: Add to `thinkingSteps` array

This allows multiple agents to contribute to the same thinking message!

### ToolCallSummaryMessage as Final Response

```typescript
if (messageType === 'ToolCallSummaryMessage') {
    // This is the final result - show it as the response
    setChats(prev => prev.map(chat => {
        // Update message with content
        // Set isThinking: false
        // Keep thinkingSteps for collapsible section
    }))
    // Reset streaming message ID
    streamingMessageIdRef.current = null
}
```

### UserInputRequestedEvent

```typescript
if (messageType === 'UserInputRequestedEvent') {
    // Clear thinking state
    streamingMessageIdRef.current = null
}
```

This ensures the thinking message is finalized before the user provides input.

## HTML Content Rendering

Your backend sends HTML content in `ToolCallSummaryMessage`:

```html
<div>
  <h6>Matching Products for Steel Sheets</h6>
  <table border="1.5">
    <thead><tr><th>Material ID</th><th>Material Description</th></tr></thead>
    <tbody>
      <tr><td>1000290</td><td>Steel sheets</td></tr>
      ...
    </tbody>
  </table>
</div>
```

The `ReactMarkdown` component will render this HTML properly because it supports HTML by default.

## Testing Your System

### Test Case 1: Simple PR Creation
```
User: "I want steel sheets"
Expected:
- Thinking: "🤔 create_pr_agent is preparing to call create_open_pr..."
- Thinking: "⚙️ create_pr_agent is executing create_open_pr..."
- Response: HTML table with matching products
- Thoughts: 2 steps
```

### Test Case 2: Multi-Agent RFQ Creation
```
User: "Create RFQ"
Expected:
- Multiple thinking steps from different agents
- Final response: "Successfully created RFQ R0877..."
- Thoughts: 6+ steps showing entire workflow
```

### Test Case 3: Interactive Flow
```
User: "I want steel sheets"
Agent: Shows products
User: "Select all and deliver in 45 days with 100 qty"
Agent: Shows line items
User: "Confirm"
Agent: "PR Created Successfully"

Expected:
- Each response has its own thinking steps
- UserInputRequestedEvent clears thinking state between interactions
```

## Troubleshooting

### Issue: Thinking message not showing
**Check**: Is `ToolCallRequestEvent` being received?
**Solution**: Open console and look for `📨 Received message` logs

### Issue: Multiple thinking messages instead of one
**Check**: Is `streamingMessageIdRef.current` being reset properly?
**Solution**: Ensure `UserInputRequestedEvent` clears the ref

### Issue: Final response not showing
**Check**: Is `ToolCallSummaryMessage` content empty?
**Solution**: Log the content and check if it's HTML or text

### Issue: HTML not rendering
**Check**: Is `ReactMarkdown` configured to allow HTML?
**Solution**: ReactMarkdown allows HTML by default, but check for any security settings

## Future Enhancements

- [ ] Add agent-specific icons (📋 for PR_Fetcher, 📧 for RFQ_Agent)
- [ ] Show tool arguments in expanded thoughts
- [ ] Add "Show raw JSON" option for debugging
- [ ] Highlight errors in tool execution
- [ ] Add progress bar for long-running operations
- [ ] Support for streaming responses (if backend implements it)
