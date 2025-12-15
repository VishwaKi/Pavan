# AI Chat Assistant - ChatGPT/DeepSeek UI Clone

A beautiful, modern Next.js frontend that replicates the ChatGPT and DeepSeek user interface with a premium dark theme design.

## Features

✨ **Modern UI/UX**
- Dark theme with carefully crafted color palette
- Smooth animations and transitions
- Responsive design for mobile and desktop
- Glass morphism effects

💬 **Chat Interface**
- Real-time message display
- Typing indicators
- Message history with sidebar
- Auto-scrolling to latest messages
- Scroll-to-bottom button

📝 **Rich Text Support**
- Full Markdown rendering
- Syntax highlighting for code blocks
- Copy code functionality
- Support for lists, blockquotes, and more

🎨 **Premium Design**
- Custom Inter font from Google Fonts
- Gradient accents and hover effects
- Micro-animations for better UX
- Customizable color scheme via CSS variables

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
frontend/
├── app/
│   ├── components/
│   │   ├── Sidebar.tsx          # Chat history sidebar
│   │   ├── Sidebar.module.css
│   │   ├── ChatMessage.tsx      # Individual message component
│   │   ├── ChatMessage.module.css
│   │   ├── ChatInput.tsx        # Message input with suggestions
│   │   └── ChatInput.module.css
│   ├── globals.css              # Global styles and design system
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Main chat page
│   └── page.module.css
├── package.json
├── next.config.js
└── tsconfig.json
```

## Customization

### Colors

Edit the CSS variables in `app/globals.css` to customize the color scheme:

```css
:root {
  --bg-primary: #0f0f0f;
  --accent-primary: #10a37f;
  /* ... more variables */
}
```

### AI Integration

Currently, the app uses mock responses. To integrate with a real AI backend:

1. Replace the `generateAIResponse` function in `app/page.tsx`
2. Add API calls to your backend endpoint
3. Handle streaming responses if needed

Example:
```typescript
const handleSendMessage = async (content: string) => {
  // ... existing code ...
  
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: content })
  });
  
  const data = await response.json();
  // Handle response...
}
```

## Technologies Used

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **React Markdown** - Markdown rendering
- **React Syntax Highlighter** - Code syntax highlighting
- **CSS Modules** - Scoped styling

## Build for Production

```bash
npm run build
npm start
```

## Features to Add

- [ ] User authentication
- [ ] Chat persistence (localStorage/database)
- [ ] Real AI API integration
- [ ] File upload support
- [ ] Voice input
- [ ] Export chat history
- [ ] Theme customization
- [ ] Multiple AI model selection

## License

MIT

## Acknowledgments

Inspired by ChatGPT and DeepSeek interfaces, built with modern web technologies for a premium user experience.
