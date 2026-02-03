// import * as BUI from "@thatopen/ui";
// import * as OBC from "@thatopen/components";
// import { BimChatbot } from "@/utils/bimchatbot";
// import type { Locale } from "@/shared/ai-schemas";

// export interface ChatbotPanelState {
//   components: OBC.Components;
//   world?: OBC.World;
// }

// interface ChatMessage {
//   id: string;
//   content: string;
//   isUser: boolean;
//   timestamp: Date;
// }

// // Simple module-level state
// let chatbot: BimChatbot | null = null;
// let messages: ChatMessage[] = [];
// let isInitializing = false;
// let isLoading = false;
// let currentTranslate: ((key: string) => string) | null = null;

// const initializeMessages = () => {
//   if (messages.length === 0) {
//     messages = [
//       {
//         id: "welcome",
//         content: "welcome-message",
//         isUser: false,
//         timestamp: new Date(),
//       },
//     ];
//   }
// };

// const addMessage = (content: string, isUser: boolean = false) => {
//   const message: ChatMessage = {
//     id: Math.random().toString(36).substring(7),
//     content,
//     isUser,
//     timestamp: new Date(),
//   };
//   messages.push(message);

//   // Force re-render by updating DOM directly
//   setTimeout(() => {
//     const chatContainer = document.querySelector(
//       ".flex-1.overflow-y-auto.p-3.border-b.border-gray-200.bg-gray-50.mb-3.min-h-\\[180px\\]",
//     );
//     if (chatContainer) {
//       updateChatHistory();
//       chatContainer.scrollTop = chatContainer.scrollHeight;
//     }
//   }, 50);
// };

// const updateChatHistory = () => {
//   const chatContainer = document.querySelector(
//     ".flex-1.overflow-y-auto.p-3.border-b.border-gray-200.bg-gray-50.mb-3.min-h-\\[180px\\]",
//   );
//   if (!chatContainer) return;

//   chatContainer.innerHTML = messages
//     .map(
//       (message) => `
//       <div class="mb-4">
//         ${
//           message.isUser
//             ? `
//           <div class="p-2 px-3 rounded-lg rounded-br-sm mb-2 ml-5 border border-gray-100" style="background-color: #e4ebf7;">
//             <div class="text-xs font-bold mb-1 text-gray-800">${"you"}</div>
//             <div class="text-sm leading-relaxed whitespace-pre-wrap text-gray-600 break-words">${
//               message.content
//             }</div>
//           </div>
//         `
//             : `
//           <div class="bg-white p-2 px-3 rounded-lg rounded-bl-sm mr-5 border border-gray-200">
//             <div class="text-xs font-bold mb-1 text-gray-500">${"assistant"}</div>
//             <div class="text-sm leading-relaxed whitespace-pre-wrap text-gray-600 break-words">${
//               message.content
//             }</div>
//           </div>
//         `
//         }
//       </div>
//     `,
//     )
//     .join("");
// };

// export const chatbotPanelTemplate: BUI.StatefullComponent<ChatbotPanelState> = (
//   state,
// ) => {
//   const { components } = state;

//   // Initialize messages with translation
//   initializeMessages();

//   // Track collapsible panel state
//   let isChatExpanded = false;

//   const toggleChatPanel = () => {
//     isChatExpanded = !isChatExpanded;
//     // Force re-render to update the UI
//     const panel = document.querySelector(".chatbot-panel");
//     if (panel) {
//       const content = panel.querySelector(".chat-panel-content") as HTMLElement;
//       const icon = panel.querySelector(".chat-toggle-icon") as HTMLElement;

//       if (content && icon) {
//         content.style.display = isChatExpanded ? "flex" : "none";
//         icon.style.transform = isChatExpanded
//           ? "rotate(180deg)"
//           : "rotate(0deg)";
//       }
//     }
//   };

//   // Initialize chatbot with server-side AI
//   const initializeChatbot = async () => {
//     if (chatbot || isInitializing) return;

//     // Check if any models are loaded
//     const fragments = components.get(OBC.FragmentsManager);
//     const models = Array.from(fragments.list.values());

//     if (models.length === 0) {
//       addMessage("load-model-first", false);
//       return;
//     }

//     isInitializing = true;
//     const initButton = document.querySelector(
//       ".bg-primary.text-white.px-4.py-2.border-none.rounded-lg",
//     ) as HTMLButtonElement;
//     if (initButton) {
//       initButton.disabled = true;
//       initButton.textContent = "initializing";
//     }

//     try {
//       // Determine locale from URL
//       const locale: Locale = window.location.pathname.includes("/ja/")
//         ? "ja"
//         : "en";

//       // Initialize with server-side AI (no API key needed on client)
//       chatbot = new BimChatbot(components, locale);
//       const welcomeMessage = await chatbot.initialize();
//       console.log("BimChatbot initialized successfully with server-side AI");

//       isInitializing = false;

//       // Add welcome message
//       addMessage(welcomeMessage, false);

//       // Hide init button
//       if (initButton) {
//         initButton.style.display = "none";
//       }
//     } catch (error) {
//       console.error("Failed to initialize chatbot:", error);
//       isInitializing = false;
//       if (initButton) {
//         initButton.disabled = false;
//         initButton.textContent = "initialize";
//       }
//       addMessage("chatbot-init-failed", false);
//     }
//   };

//   const handleSendMessage = async (e: Event) => {
//     e.preventDefault();
//     const input = document.querySelector(
//       ".flex-1.p-3.border.border-gray-200.rounded-lg.text-sm",
//     ) as HTMLTextAreaElement;
//     if (!input || !input.value.trim()) return;

//     const userMessage = input.value.trim();
//     input.value = "";

//     // Check if chatbot is initialized
//     if (!chatbot) {
//       addMessage("initialize-first", false);
//       return;
//     }

//     // Add user message
//     addMessage(userMessage, true);

//     // Show loading
//     isLoading = true;
//     const sendButton = document.querySelector(
//       ".rounded-lg.bg-primary.text-white.px-4.py-3",
//     ) as HTMLButtonElement;
//     if (sendButton) {
//       sendButton.disabled = true;
//       sendButton.textContent = "processing";
//     }

//     // Add a temporary progress message that we'll update
//     const progressId = Math.random().toString(36).substring(7);
//     messages.push({
//       id: progressId,
//       content: "processing-request",
//       isUser: false,
//       timestamp: new Date(),
//     });
//     updateChatHistory();

//     try {
//       // Process message with chatbot using streaming with progress
//       const response = await chatbot.processQueryWithProgress(
//         userMessage,
//         (progress: {
//           step: string;
//           message: string;
//           progress: number;
//           total: number;
//         }) => {
//           // Update the progress message in real-time
//           const progressMessage = messages.find((m) => m.id === progressId);
//           if (progressMessage) {
//             let progressText = "";
//             const isJapanese = window.location.pathname.includes("/ja/");

//             switch (progress.step) {
//               case "validation":
//                 progressText =
//                   progress.message ||
//                   (isJapanese ? "validating-query" : "validating-query");
//                 break;
//               case "extraction":
//                 progressText =
//                   progress.message ||
//                   (isJapanese ? "extracting-elements" : "extracting-elements");
//                 break;
//               case "building":
//                 progressText =
//                   progress.message ||
//                   (isJapanese ? "building-selection" : "building-selection");
//                 break;
//               default:
//                 progressText = progress.message || "processing-request";
//             }

//             // Add step indicator
//             progressMessage.content = `(${progress.progress}/${progress.total}) ${progressText}`;
//             updateChatHistory();
//           }
//         },
//       );

//       // Remove progress message
//       messages = messages.filter((m) => m.id !== progressId);

//       // Add final response
//       addMessage(response, false);
//     } catch (error) {
//       // Remove progress message
//       messages = messages.filter((m) => m.id !== progressId);
//       addMessage("error-processing", false);
//       console.error("Chatbot error:", error);
//     }

//     // Reset loading state
//     isLoading = false;
//     if (sendButton) {
//       sendButton.disabled = false;
//       sendButton.textContent = "send";
//     }
//   };

//   const onKeyPress = (e: KeyboardEvent) => {
//     if (e.key === "Enter" && !e.shiftKey) {
//       e.preventDefault();
//       handleSendMessage(e);
//     }
//   };

//   // Initialize chat history on first render
//   setTimeout(() => {
//     updateChatHistory();
//   }, 100);

//   return BUI.html`
//   <div class="chatbot-panel rounded-b-lg overflow-hidden mb-0 border border-gray-200">
//     <!-- Collapsible Header -->
//     <div @click=${toggleChatPanel} class="flex items-center p-3 bg-white border-b border-gray-200 cursor-pointer select-none transition-colors duration-200 ease-in-out hover:bg-gray-50">
//       <span class="material-icons mr-2 text-xl text-gray-800">smart_toy</span>

//       <span class="flex-1 text-sm font-medium text-gray-800">${"ai-assistant"}</span>

//       <span class="material-icons chat-toggle-icon text-xl text-gray-800 transition-transform duration-200 ease-in-out">keyboard_arrow_down</span>
//     </div>

//     <!-- Collapsible Content -->
//     <div class="chat-panel-content hidden flex-col max-h-[400px]">

//       <div class="flex flex-col h-[300px] p-0 font-sans bg-white">
//         <!-- Chat History -->
//         <div class="flex-1 overflow-y-auto p-3 border-b border-gray-200 bg-gray-50 mb-3 min-h-[180px]">
//           <!-- Messages will be populated via DOM manipulation -->
//         </div>

//         <!-- Input Area -->
//         <div class="flex gap-2 mb-2 mx-2">
//           <textarea
//             class="flex-1 p-3 border border-gray-200 rounded-lg text-sm outline-none transition-all duration-200 bg-gray-50 text-gray-800 resize-none min-h-[20px] max-h-[80px] focus:border-primary focus:shadow-sm focus:shadow-primary/10"
//             placeholder=${"search"}
//             @keypress=${onKeyPress}
//             rows="1"
//           ></textarea>
//           <button class="rounded-lg bg-primary text-white px-4 py-3 border border-primary cursor-pointer text-sm font-normal transition-all duration-200 hover:bg-blue-700 hover:border-blue-700 disabled:opacity-50 disabled:cursor-not-allowed" @click=${handleSendMessage} ?disabled=${isLoading}>
//             ${isLoading ? "processing" : "send"}
//           </button>
//           ${
//             !chatbot
//               ? BUI.html`
//             <button class="bg-primary text-white px-4 py-2 border-none rounded-lg cursor-pointer text-sm transition-all duration-200 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed" @click=${initializeChatbot} ?disabled=${isInitializing}>
//               ${isInitializing ? "initializing" : "initialize"}
//             </button>
//           `
//               : ""
//           }
//         </div>

//         <!-- Quick Actions -->
//         <div class="flex gap-1.5 flex-wrap justify-center mb-3">
//           <button class="px-3 py-1.5 border border-gray-200 rounded-lg bg-white text-xs cursor-pointer text-gray-600 transition-all duration-200 hover:bg-gray-50 hover:border-gray-300" @click=${async () => {
//             if (!chatbot) {
//               addMessage("initialize-first", false);
//               return;
//             }

//             // Add user message to show what was requested
//             addMessage("selection-summary", true);
//             addMessage("processing-request", false);

//             try {
//               // Use the new selection summary method that gets current selection
//               const response = await chatbot.requestSelectionSummary();
//               addMessage(response, false);
//             } catch (err) {
//               addMessage("error-processing", false);
//               console.error("Selection summary error:", err);
//             }
//           }}>
//             ${"selection-summary"}
//           </button>
//           <button class="px-3 py-1.5 border border-gray-200 rounded-lg bg-white text-xs cursor-pointer text-gray-600 transition-all duration-200 hover:bg-gray-50 hover:border-gray-300" @click=${async () => {
//             if (!chatbot) {
//               addMessage("initialize-first", false);
//               return;
//             }

//             // Add user message to show what was requested
//             addMessage("model-overview", true);
//             addMessage("generating-overview", false);

//             try {
//               // Use direct summary generation instead of processQuery
//               const response = await chatbot.requestModelSummary();
//               addMessage(response, false);
//             } catch (err) {
//               addMessage("error-processing", false);
//               console.error("Model overview error:", err);
//             }
//           }}>
//             ${"model-overview"}
//           </button>
//         </div>
//       </div>
//     </div>
//   </div>
// `;
// };
