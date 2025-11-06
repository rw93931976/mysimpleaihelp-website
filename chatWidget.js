// chatWidget.js
document.addEventListener('DOMContentLoaded', () => {
    // Helper function to get element and log if not found
    function getElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.error(`Archie Chat Widget Error: Element with ID "${id}" not found.`);
        }
        return element;
    }

    const chatToggleButton = getElement('chat-toggle-button');
    const chatContainer = getElement('chat-container');
    const closeChatButton = getElement('close-chat-button');
    const chatInput = getElement('chat-input');
    const chatSendButton = getElement('chat-send-button');
    const chatBody = getElement('chat-body');

    // IMPORTANT: Add checks before using elements to prevent errors from undefined
    if (!chatToggleButton || !chatContainer || !closeChatButton || !chatInput || !chatSendButton || !chatBody) {
        console.error("Archie Chat Widget: Essential elements are missing. Widget functionality disabled.");
        return; // Stop execution if critical elements are missing
    }

    const API_ENDPOINT = '/api/chat';
    const AUTO_OPEN_DELAY = 7000;

    let threadId = localStorage.getItem('archieThreadId');

    function appendMessage(sender, text) {
        const messageBubble = document.createElement('div');
        messageBubble.classList.add('message-bubble', sender);
        messageBubble.textContent = text;
        chatBody.appendChild(messageBubble);
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    function toggleChat(open) {
        if (open) {
            chatContainer.classList.add('open');
            // Check if chatToggleButton exists before trying to access its style
            if (chatToggleButton) chatToggleButton.style.display = 'none';
            chatInput.focus();
        } else {
            chatContainer.classList.remove('open');
            // Check if chatToggleButton exists before trying to access its style
            if (chatToggleButton) chatToggleButton.style.display = 'flex';
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
        chatInput.value = '';

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

            chatBody.removeChild(typingIndicator);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to get response from Archie');
            }

            const data = await response.json();
            appendMessage('assistant', data.reply);

            if (data.threadId && data.threadId !== threadId) {
                threadId = data.threadId;
                localStorage.setItem('archieThreadId', threadId);
            }

        } catch (error) {
            console.error('Archie Chat Error:', error);
            if (chatBody.contains(typingIndicator)) {
                 chatBody.removeChild(typingIndicator);
            }
            appendMessage('assistant', 'Oops! Archie seems to be having a bit of trouble right now. Please try again in a moment or refresh the page.');
        }
    });

    // Auto-open logic DISABLED for debugging
    // const hasOpenedManually = sessionStorage.getItem('archieOpenedManually');
    // if (!hasOpenedManually) {
    //     setTimeout(() => {
    //         if (!chatContainer.classList.contains('open')) {
    //             toggleChat(true);
    //         }
    //     }, AUTO_OPEN_DELAY);
    // }

    chatToggleButton.addEventListener('click', () => {
        sessionStorage.setItem('archieOpenedManually', 'true');
    });

    chatInput.addEventListener('focus', () => {
        sessionStorage.setItem('archieOpenedManually', 'true');
    });

    if (sessionStorage.getItem('archieChatOpen') === 'true') {
        toggleChat(true);
    }

    window.addEventListener('beforeunload', () => {
        if (chatContainer.classList.contains('open')) {
            sessionStorage.setItem('archieChatOpen', 'true');
        } else {
            sessionStorage.removeItem('archieChatOpen');
        }
    });
});