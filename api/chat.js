// api/chat.js
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { message, threadId } = req.body;

  if (!message) {
    return res.status(400).json({ message: 'Message is required' });
  }

  let currentThreadId = threadId;

  try {
    // 1. Ensure a thread exists
    if (!currentThreadId) {
      const thread = await openai.beta.threads.create();
      currentThreadId = thread.id;
    }

    // 2. Add the user's message to the thread
    await openai.beta.threads.messages.create(
      currentThreadId,
      {
        role: "user",
        content: message,
      }
    );

    // 3. Run the Assistant
    const run = await openai.beta.threads.runs.create(
      currentThreadId,
      {
        assistant_id: process.env.OPENAI_ASSISTANT_ID,
      }
    );

    // 4. Periodically retrieve the Run to check its status
    let runStatus = await openai.beta.threads.runs.retrieve(
      currentThreadId,
      run.id
    );

    while (runStatus.status !== 'completed') {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second
      runStatus = await openai.beta.threads.runs.retrieve(
        currentThreadId,
        run.id
      );

      if (runStatus.status === 'failed' || runStatus.status === 'cancelled') {
        throw new Error(`Run failed with status: ${runStatus.status}`);
      }

      // Handle tool_outputs if necessary (e.g., for support tickets)
      if (runStatus.status === 'requires_action' && runStatus.required_action) {
        const toolOutputs = [];
        for (const toolCall of runStatus.required_action.submit_tool_outputs.tool_calls) {
          if (toolCall.function.name === 'create_support_ticket') {
            const args = JSON.parse(toolCall.function.arguments);
            const { error } = await supabase.from('support_tickets').insert([
              {
                user_thread_id: currentThreadId,
                issue_summary: args.issue_summary,
                user_email: args.user_email || null,
              }
            ]);
            if (error) {
              console.error('Supabase error inserting ticket:', error);
              toolOutputs.push({
                tool_call_id: toolCall.id,
                output: JSON.stringify({ success: false, error: error.message }),
              });
            } else {
              toolOutputs.push({
                tool_call_id: toolCall.id,
                output: JSON.stringify({ success: true, ticket_id: 'generated_id_placeholder' }),
              });
            }
          }
        }
        // Submit tool outputs and continue the run
        await openai.beta.threads.runs.submitToolOutputs(
          currentThreadId,
          run.id,
          { tool_outputs: toolOutputs }
        );
         // Re-fetch run status after submitting tool outputs
        runStatus = await openai.beta.threads.runs.retrieve(
          currentThreadId,
          run.id
        );
      }
    }

    // 5. Retrieve the last message from the assistant
    const messages = await openai.beta.threads.messages.list(
      currentThreadId,
      { order: 'desc', limit: 1 }
    );

    const lastAssistantMessage = messages.data.find(msg => msg.role === 'assistant');

    let assistantResponse = "An error occurred while fetching the response.";
    if (lastAssistantMessage && lastAssistantMessage.content && lastAssistantMessage.content.length > 0) {
      const textContent = lastAssistantMessage.content.find(
        contentItem => contentItem.type === 'text'
      );
      if (textContent) {
        assistantResponse = textContent.text.value;
      }
    }

    res.status(200).json({ reply: assistantResponse, threadId: currentThreadId });

  } catch (error) {
    console.error('Error in chat API:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}