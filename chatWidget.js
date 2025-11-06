// chatWidget.js
document.addEventListener('DOMContentLoaded', () => {
    const chatToggleButton = document.getElementById('chat-toggle-button');
    const chatContainer = document.getElementById('chat-container');
    const closeChatButton = document.getElementById('close-chat-button');
    const chatInput = document.getElementById('chat-input');
    const chatSendButton = document.getElementById('chat-send-button');
    const chatBody = document.getElementById('chat-body');

    const API_ENDPOINT = '/api/chat'; // Your Vercel serverless function endpoint
    const AUTO_OPEN_DELAY = 7000; // 7 seconds

    let threadId = localStorage.getItem('archieThreadId'); // Load thread_id from localStorage

    // --- Helper Functions ---
    function appendMessage(sender, text) {
        const messageBubble = document.createElement('div');
        messageBubble.classList.add('message-bubble', sender);
        messageBubble.textContent = text;
        chatBody.appendChild(messageBubble);
        chatBody.scrollTop = chatBody.scrollHeight; // Auto-scroll to bottom
    }

    function toggleChat(open) {
        if (open) {
            chatContainer.classList.add('open');
            chatToggleButton.style.display = 'none';
            chatInput.focus();
        } else {
            chatContainer.classList.remove('open');
            chatToggleButton.style.display = 'flex';
        }
    }

    // --- Event Listeners ---
    chatToggleButton.addEventListener('click', () => toggleChat(true));
    closeChatButton.addEventListener('click', () => toggleChat(false));

    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            chatSendButton.click();
        }
    });

    chatSendButton.addEventListener('click', async () => {
        const userMessage = chatInput.value.trim();
        if (!userMessage) return;

        appendMessage('user', userMessage);
        chatInput.value = ''; // Clear input

        // Add a typing indicator for a better UX
        const typingIndicator = document.createElement('div');
        typingIndicator.classList.add('message-bubble', 'assistant', 'typing-indicator');
        typingIndicator.textContent = 'Archie is typing...';
        chatBody.appendChild(typingIndicator);
        chatBody.scrollTop = chatBody.scrollHeight;

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: userMessage, threadId: threadId }),
            });

            // Remove typing indicator
            chatBody.removeChild(typingIndicator);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to get response from Archie');
            }

            const data = await response.json();
            appendMessage('assistant', data.reply);

            // Save new threadId if it's updated or new
            if (data.threadId && data.threadId !== threadId) {
                threadId = data.threadId;
                localStorage.setItem('archieThreadId', threadId);
            }

        } catch (error) {
            console.error('Archie Chat Error:', error);
            // Remove typing indicator if it's still there
            if (chatBody.contains(typingIndicator)) {
                 chatBody.removeChild(typingIndicator);
            }
            appendMessage('assistant', 'Oops! Archie seems to be having a bit of trouble right now. Please try again in a moment or refresh the page.');
        }
    });

    // Auto-open logic (only if not opened manually by user this session)
    const hasOpenedManually = sessionStorage.getItem('archieOpenedManually');
    if (!hasOpenedManually) {
        setTimeout(() => {
            if (!chatContainer.classList.contains('open')) { // Only auto-open if not already open
                toggleChat(true);
            }
        }, AUTO_OPEN_DELAY);
    }

    // Mark as opened manually if user clicks the toggle button
    chatToggleButton.addEventListener('click', () => {
        sessionStorage.setItem('archieOpenedManually', 'true');
    });

    // Mark as opened manually if user clicks the chat input (after auto-open)
    chatInput.addEventListener('focus', () => {
        sessionStorage.setItem('archieOpenedManually', 'true');
    });

    // If chat was open on previous session, reopen it
    if (sessionStorage.getItem('archieChatOpen') === 'true') {
        toggleChat(true);
    }

    // Persist chat open state across refreshes (within session)
    window.addEventListener('beforeunload', () => {
        if (chatContainer.classList.contains('open')) {
            sessionStorage.setItem('archieChatOpen', 'true');
        } else {
            sessionStorage.removeItem('archieChatOpen');
        }
    });
});