// Forced update
document.addEventListener('DOMContentLoaded', () => {
    const chatWidget = document.getElementById('archie-chat-widget');
    const chatToggle = document.getElementById('archie-chat-toggle');
    const chatClose = document.getElementById('archie-chat-close');
    const chatMinimize = document.getElementById('archie-chat-minimize'); // New minimize button
    const chatBubbleMinimized = document.querySelector('.chat-bubble-minimized');
    const chatMessages = document.querySelector('.chat-messages');
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.getElementById('chat-send');

    // State management in sessionStorage for tab-specific persistence
    let archieOpened = sessionStorage.getItem('archieOpened') === 'true';
    let archieMinimized = sessionStorage.getItem('archieMinimized') === 'true';
    let archieGreeted = sessionStorage.getItem('archieGreeted') === 'true';
    let archieUserInteracted = sessionStorage.getItem('archieUserInteracted') === 'true'; // Track if user has explicitly opened/closed/minimized

    // Use localStorage for thread ID to persist across tabs/sessions
    let archieThreadId = localStorage.getItem('archieThreadId');

    // Function to open the chat window
    function openChat() {
        chatWidget.classList.add('open');
        chatBubbleMinimized.style.display = 'none'; // Hide minimized bubble when chat is open
        archieOpened = true;
        archieMinimized = false; // When opened, it's not minimized
        sessionStorage.setItem('archieOpened', 'true');
        sessionStorage.setItem('archieMinimized', 'false');
        sessionStorage.setItem('archieUserInteracted', 'true'); // User has interacted
        scrollToBottom();
        if (!archieGreeted) {
            greetOnce();
        }
    }

    // Function to close the chat window (full close, goes back to minimized icon state)
    function closeChat() {
        chatWidget.classList.remove('open');
        chatBubbleMinimized.style.display = 'flex'; // Show minimized bubble when chat is closed
        archieOpened = false;
        archieMinimized = true; // When closed, it implies it's now minimized to the icon
        sessionStorage.setItem('archieOpened', 'false');
        sessionStorage.setItem('archieMinimized', 'true');
        sessionStorage.setItem('archieUserInteracted', 'true'); // User has interacted
    }

    // Function to toggle minimize/maximize state
    function toggleMinimize() {
        if (chatWidget.classList.contains('open')) {
            // If currently open, minimize it
            chatWidget.classList.remove('open');
            chatBubbleMinimized.style.display = 'flex'; // Show minimized bubble
            archieMinimized = true;
            archieOpened = false;
            sessionStorage.setItem('archieMinimized', 'true');
            sessionStorage.setItem('archieOpened', 'false');
            sessionStorage.setItem('archieUserInteracted', 'true');
        } else {
            // If currently minimized, open it
            openChat();
        }
    }

    // Add event listeners for new buttons
    if (chatToggle) {
        chatToggle.addEventListener('click', openChat); // This opens from the initial invisible state or from a truly closed (not just minimized) state
    }
    if (chatClose) {
        chatClose.addEventListener('click', closeChat); // This now effectively minimizes the chat to the icon
    }
    if (chatMinimize) {
        chatMinimize.addEventListener('click', toggleMinimize); // This specifically handles minimize/maximize
    }
    // The minimized chat bubble itself can also toggle (open) the chat
    if (chatBubbleMinimized) {
        chatBubbleMinimized.addEventListener('click', openChat);
    }

    // Initial state setup
    // Hide minimized icon by default on load, only show if chat is not open and user hasn't interacted, or if it was explicitly minimized
    if (archieOpened && !archieMinimized) {
        openChat();
    } else if (archieMinimized) {
        chatWidget.classList.remove('open'); // Ensure main widget is closed
        chatBubbleMinimized.style.display = 'flex'; // Show the minimized bubble
    } else {
        // Default: widget starts closed and minimized icon is hidden until auto-open or user interaction
        chatWidget.classList.remove('open');
        chatBubbleMinimized.style.display = 'none';
    }


    // Auto-open logic (only if not already opened or minimized by user interaction in current session)
    if (!archieOpened && !archieUserInteracted && !archieMinimized) {
        setTimeout(() => {
            // Check again in case user interacted while waiting
            if (!sessionStorage.getItem('archieOpened') && !sessionStorage.getItem('archieUserInteracted')) {
                openChat();
                // We're now setting archieUserInteracted to true in openChat, so it won't auto-open again.
            }
        }, 7000); // 7-second delay
    }

    // Existing functions (send message, scroll, greet)
    async function sendMessage() {
        const messageText = chatInput.value.trim();
        if (messageText === '') return;

        appendMessage(messageText, 'user-message');
        chatInput.value = '';
        scrollToBottom();

        try {
            const response = await fetch('https://chat-api.mysimpleaihelp.com/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: messageText,
                    thread_id: archieThreadId,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                appendMessage(data.response, 'bot-message');
                // Store new thread ID if it's the first message or if it changed
                if (data.thread_id && data.thread_id !== archieThreadId) {
                    archieThreadId = data.thread_id;
                    localStorage.setItem('archieThreadId', archieThreadId);
                }
            } else {
                appendMessage(`Error: ${data.detail || 'Could not get a response from Archie.'}`, 'bot-message');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            appendMessage('Apologies, I encountered an error. Please try again.', 'bot-message');
        }
        scrollToBottom();
    }

    function appendMessage(text, type) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message', type);
        messageElement.textContent = text;
        chatMessages.appendChild(messageElement);
        scrollToBottom();
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function greetOnce() {
        if (!archieGreeted) {
            appendMessage("Hello! I'm Archie, your AI assistant. How can I help you today?", 'bot-message');
            archieGreeted = true;
            sessionStorage.setItem('archieGreeted', 'true');
        }
    }

    chatSend.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Handle initial greeting if chat is opened on load and not yet greeted
    if (archieOpened && !archieGreeted) {
        greetOnce();
    }
});
