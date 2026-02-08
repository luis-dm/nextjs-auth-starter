import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { BimChatbot } from "@/utils/bimchatbot";

export interface ChatbotPanelState {
  components: OBC.Components;
  world?: OBC.World;
  facilityId?: string;
}

interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

// Simple module-level state
let messages: ChatMessage[] = [];
let isLoading = false;
let bimChatbotInstance: BimChatbot | null = null;
let currentFacilityId: string | null = null;

const initializeMessages = () => {
  if (messages.length === 0) {
    messages = [
      {
        id: "welcome",
        content:
          "Hi! I'm your BIM assistant. Ask me anything about your model.",
        isUser: false,
        timestamp: new Date(),
      },
    ];
  }
};

const addMessage = (content: string, isUser: boolean = false) => {
  const message: ChatMessage = {
    id: Math.random().toString(36).substring(7),
    content,
    isUser,
    timestamp: new Date(),
  };
  messages.push(message);

  // Force re-render by updating DOM directly
  setTimeout(() => {
    const chatContainer = document.querySelector(
      ".flex-1.overflow-y-auto.p-3.border-b.border-gray-200.bg-gray-50.mb-3.min-h-\\[180px\\]",
    );
    if (chatContainer) {
      updateChatHistory();
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }, 50);
};

const updateChatHistory = () => {
  const chatContainer = document.querySelector(
    ".flex-1.overflow-y-auto.p-3.border-b.border-gray-200.bg-gray-50.mb-3.min-h-\\[180px\\]",
  );
  if (!chatContainer) return;

  chatContainer.innerHTML = messages
    .map(
      (message) => `
      <div class="mb-4">
        ${
          message.isUser
            ? `
          <div class="p-2 px-3 rounded-lg rounded-br-sm mb-2 ml-5 border border-gray-100 bg-gray-100">
            <div class="text-xs font-bold mb-1 text-gray-800">You</div>
            <div class="text-sm leading-relaxed whitespace-pre-wrap text-gray-600 wrap-break-word">${
              message.content
            }</div>
          </div>
        `
            : message.content === "typing"
              ? `
          <div class="bg-white p-2 px-3 rounded-lg rounded-bl-sm mr-5 border border-gray-200">
            <div class="text-xs font-bold mb-1 text-gray-500">Assistant</div>
            <div class="flex items-center gap-1">
              <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
              <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
              <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
            </div>
          </div>
        `
              : `
          <div class="bg-white p-2 px-3 rounded-lg rounded-bl-sm mr-5 border border-gray-200">
            <div class="text-xs font-bold mb-1 text-gray-500">Assistant</div>
            <div class="text-sm leading-relaxed whitespace-pre-wrap text-gray-600 wrap-break-word">${
              message.content
            }</div>
          </div>
        `
        }
      </div>
    `,
    )
    .join("");
};

// Export function to load spatial structure after model is loaded
export const loadSpatialStructureAfterModel = async (facilityId: string) => {
  // Store the facilityId for later use in sendMessage
  currentFacilityId = facilityId;
  
  if (bimChatbotInstance) {
    try {
      console.log("Loading spatial structure after model load...");
      await bimChatbotInstance.getDetailedSpatialStructure(facilityId);
    } catch (error) {
      console.error("Failed to load spatial structure:", error);
    }
  } else {
    console.warn("BimChatbot instance not initialized yet");
  }
};

export const chatbotPanelTemplate: BUI.StatefullComponent<ChatbotPanelState> = (
  state,
) => {
  const { components } = state;

  // Initialize messages with translation
  initializeMessages();

  // Track collapsible panel state
  let isChatExpanded = false;

  const toggleChatPanel = () => {
    isChatExpanded = !isChatExpanded;
    // Force re-render to update the UI
    const panel = document.querySelector(".chatbot-panel");
    if (panel) {
      const content = panel.querySelector(".chat-panel-content") as HTMLElement;
      const icon = panel.querySelector(".chat-toggle-icon") as HTMLElement;

      if (content && icon) {
        content.style.display = isChatExpanded ? "flex" : "none";
        icon.style.transform = isChatExpanded
          ? "rotate(180deg)"
          : "rotate(0deg)";
      }
    }
  };

  // Initialize chatbot
  const initializeChatbot = async () => {
    // Add welcome message
    messages = [
      {
        id: "welcome",
        content:
          "Hi! I'm your BIM assistant. Ask me anything about your model.",
        isUser: false,
        timestamp: new Date(),
      },
    ];
    updateChatHistory();

    // Initialize BimChatbot instance (but don't load structure yet)
    bimChatbotInstance = new BimChatbot(components);
  };

  const handleSendMessage = async (e: Event) => {
    e.preventDefault();
    const input = document.querySelector(
      ".flex-1.p-3.border.border-gray-200.rounded-lg.text-sm",
    ) as HTMLTextAreaElement;
    if (!input || !input.value.trim()) return;

    const userMessage = input.value.trim();
    input.value = "";

    // Add user message
    addMessage(userMessage, true);

    // Show loading state with typing indicator
    isLoading = true;
    const loadingMessageId = Math.random().toString(36).substring(7);
    const loadingMessage: ChatMessage = {
      id: loadingMessageId,
      content: "typing",
      isUser: false,
      timestamp: new Date(),
    };
    messages.push(loadingMessage);
    updateChatHistory();

    try {
      // Use the BIM chatbot to send message to Mastra agent
      if (bimChatbotInstance && currentFacilityId) {
        const response = await bimChatbotInstance.sendMessage(userMessage, currentFacilityId);

        // Remove loading message and add actual response
        messages = messages.filter((m) => m.id !== loadingMessageId);
        addMessage(response, false);
      } else {
        messages = messages.filter((m) => m.id !== loadingMessageId);
        addMessage(
          currentFacilityId 
            ? "Chatbot is still initializing. Please wait..." 
            : "Please load a facility first.",
          false
        );
      }
    } catch (error) {
      console.error("Error sending message:", error);
      messages = messages.filter((m) => m.id !== loadingMessageId);
      addMessage(
        "Sorry, an error occurred while processing your message.",
        false,
      );
    } finally {
      isLoading = false;
    }
  };

  const onKeyPress = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // Initialize chat history on first render
  setTimeout(() => {
    initializeChatbot();
  }, 100);

  return BUI.html`
  <div class="chatbot-panel rounded-b-lg overflow-hidden mb-0 border border-gray-200">
    <!-- Collapsible Header -->
    <div @click=${toggleChatPanel} class="flex items-center p-3 bg-white border-b border-gray-200 cursor-pointer select-none transition-colors duration-200 ease-in-out hover:bg-gray-50">
      <span class="material-icons mr-2 text-xl text-gray-800">smart_toy</span>

      <span class="flex-1 text-sm font-medium text-gray-800">AI Assistant</span>

      <span class="material-icons chat-toggle-icon text-xl text-gray-800 transition-transform duration-200 ease-in-out">keyboard_arrow_down</span>
    </div>

    <!-- Collapsible Content -->
    <div class="chat-panel-content hidden flex-col max-h-[400px]">

      <div class="flex flex-col h-[300px] p-0 font-sans bg-white">
        <!-- Chat History -->
        <div class="flex-1 overflow-y-auto p-3 border-b border-gray-200 bg-gray-50 mb-3 min-h-[180px]">
          <!-- Messages will be populated via DOM manipulation -->
        </div>

        <!-- Input Area -->
        <div class="flex gap-2 mb-2 mx-2">
          <textarea
            class="flex-1 p-3 border border-gray-200 rounded-lg text-sm outline-none transition-all duration-200 bg-gray-50 text-gray-800 resize-none min-h-5 max-h-20 focus:border-gray-800 focus:shadow-sm focus:shadow-gray-500/10"
            placeholder="Type your message..."
            @keypress=${onKeyPress}
            rows="1"
          ></textarea>
          <button class="rounded-lg text-white px-4 py-3 border border-gray-800 cursor-pointer text-sm font-normal transition-all duration-200 bg-gray-800 hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed" @click=${handleSendMessage} ?disabled=${isLoading}>
            ${isLoading ? "Processing..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  </div>
`;
};
