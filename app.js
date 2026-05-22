/* ==========================================================================
   TERRA AI APPLICATION CONTROLLER (VANILLA JS - MODEL-SPECIFIC, NO MODALS)
   ========================================================================== */

// Helper: Escape HTML strings to prevent XSS in code blocks
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Single active target model config
const TARGET_MODEL = {
  id: 'openai/gpt-oss-120b:free',
  name: 'OpenAI: gpt-oss-120b (free)',
  pricing: { prompt: "0.0", completion: "0.0" },
  context_length: 131072,
  description: "OpenAI's state-of-the-art 120B parameter Mixture-of-Experts (MoE) model."
};

// Hardcoded OpenRouter API Key
const OPENROUTER_API_KEY = "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";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDh9cpgXnldh9WriC8fg08scKn8llgPUiU",
  authDomain: "sriyanchatbot.firebaseapp.com",
  projectId: "sriyanchatbot",
  storageBucket: "sriyanchatbot.firebasestorage.app",
  messagingSenderId: "295787860335",
  appId: "1:295787860335:web:f4dc1d9ce4e5591052189a",
  measurementId: "G-RSPFTN10QK"
}; 

class TerraApp {
  constructor() {
    // 1. Core State Definition (Fixed to target model only)
    this.customPhotoDataUrl = null;
    this.apiKey = (OPENROUTER_API_KEY && OPENROUTER_API_KEY !== 'PASTE_YOUR_API_KEY_HERE')
      ? OPENROUTER_API_KEY
      : (localStorage.getItem('aether_api_key') || '');
    this.systemPrompt = localStorage.getItem('aether_system_prompt') || 'You are Terra AI, an expert AI assistant. Answer queries comprehensively, write highly structured code, and format outputs cleanly.';
    this.temperature = parseFloat(localStorage.getItem('aether_temperature') || '0.7');
    this.maxTokens = localStorage.getItem('aether_max_tokens') ? parseInt(localStorage.getItem('aether_max_tokens')) : null;
    
    this.models = [TARGET_MODEL];
    this.selectedModel = TARGET_MODEL.id;
    
    this.conversations = JSON.parse(localStorage.getItem('aether_conversations')) || [];
    this.activeConversationId = localStorage.getItem('aether_active_conv_id') || null;
    
    this.activeCost = parseFloat(localStorage.getItem('aether_session_cost') || '0.0');
    
    this.isStreaming = false;
    this.abortController = null;

    // Authentication States
    this.user = JSON.parse(localStorage.getItem('aether_user')) || null;
    this.firebaseConfig = (FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey)
      ? FIREBASE_CONFIG
      : (JSON.parse(localStorage.getItem('aether_firebase_config')) || null);

    // 2. Configure Marked library with premium custom code blocks
    this.setupMarkdownCompiler();

    // 3. Cache DOM Elements
    this.initElements();

    // 4. Bind Action Listeners
    this.bindEvents();

    // 5. Initial App Bootstrap
    this.bootstrap();
  }

  // --- CONFIGURATION METHODS ---
  setupMarkdownCompiler() {
    if (typeof marked !== 'undefined') {
      const renderer = new marked.Renderer();
      
      // Override default code block styling to embed language header and custom copy action
      renderer.code = (code, language) => {
        const lang = language || 'text';
        const uniqueId = 'code-' + Math.random().toString(36).substring(2, 11);
        
        return `
          <div class="code-container">
            <div class="code-header">
              <span class="code-lang">${lang}</span>
              <button class="copy-code-btn" data-target="${uniqueId}">
                <i data-lucide="copy" style="width:12px;height:12px;"></i>
                <span>Copy Code</span>
              </button>
            </div>
            <pre><code id="${uniqueId}" class="language-${lang}">${escapeHtml(code)}</code></pre>
          </div>
        `;
      };
      
      marked.setOptions({
        renderer: renderer,
        gfm: true,
        breaks: true,
        sanitize: false
      });
    }
  }

  initElements() {
    // Layout and Nav elements
    this.sidebar = document.getElementById('sidebar');
    this.toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
    this.closeSidebarBtn = document.getElementById('closeSidebarBtn');
    this.newChatBtn = document.getElementById('newChatBtn');
    this.chatList = document.getElementById('chatList');
    this.sidebarClearBtn = document.getElementById('sidebarClearBtn');
    
    // Header controls
    this.activeThreadTitle = document.getElementById('activeThreadTitle');
    this.exportChatBtn = document.getElementById('exportChatBtn');
    
    // Sidebar Accordion Settings Panel (Replaces Modal)
    this.sidebarSettingsPanel = document.getElementById('sidebarSettingsPanel');
    this.settingsToggleBtn = document.getElementById('settingsToggleBtn');
    this.settingsContent = document.getElementById('settingsContent');
    this.saveSettingsBtn = document.getElementById('saveSettingsBtn');
    this.settingsLogoutBtn = document.getElementById('settingsLogoutBtn');
    
    // Settings Form Inputs
    this.profileNameInput = document.getElementById('profileNameInput');
    this.profileEmailInput = document.getElementById('profileEmailInput');
    this.profileAvatarSeedInput = document.getElementById('profileAvatarSeedInput');
    this.profilePhotoFileInput = document.getElementById('profilePhotoFileInput');
    this.settingsPhotoPreview = document.getElementById('settingsPhotoPreview');
    this.photoUploadTrigger = document.getElementById('photoUploadTrigger');
    this.btnUploadPhoto = document.getElementById('btnUploadPhoto');
    this.btnRemovePhoto = document.getElementById('btnRemovePhoto');
    
    // Main Workspace
    this.messagesContainer = document.getElementById('messagesContainer');
    this.messagesList = document.getElementById('messagesList');
    this.welcomeScreen = document.getElementById('welcomeScreen');
    this.scrollAnchor = document.getElementById('scrollAnchor');
    
    // Input Bar
    this.chatInput = document.getElementById('chatInput');
    this.sendBtn = document.getElementById('sendBtn');
    this.clearCurrentChatBtn = document.getElementById('clearCurrentChatBtn');
    this.activeModelBadge = document.getElementById('activeModelBadge');
    this.inputCounter = document.getElementById('inputCounter');
    this.systemStatus = document.getElementById('systemStatus');
    
    // Stats Block
    this.apiKeyStatus = document.getElementById('apiKeyStatus');
    this.sessionCost = document.getElementById('sessionCost');

    // Auth screen components
    this.authOverlay = document.getElementById('authOverlay');
    this.btnGoogleLogin = document.getElementById('btnGoogleLogin');
    this.btnGithubLogin = document.getElementById('btnGithubLogin');
    this.emailLoginForm = document.getElementById('emailLoginForm');
    this.loginEmailInput = document.getElementById('loginEmail');
    this.loginPasswordInput = document.getElementById('loginPassword');
    this.loginPasswordVisibilityBtn = document.getElementById('loginPasswordVisibilityBtn');
    this.loginSubmitBtn = document.getElementById('loginSubmitBtn');
    this.loginSpinner = document.getElementById('loginSpinner');
    this.signUpLink = document.getElementById('signUpLink');

    // Sidebar User Profile components
    this.sidebarProfileCard = document.getElementById('sidebarProfileCard');
    this.profileAvatar = document.getElementById('profileAvatar');
    this.profileDisplayName = document.getElementById('profileDisplayName');
    this.profileDisplayEmail = document.getElementById('profileDisplayEmail');
    this.profileLogoutBtn = document.getElementById('profileLogoutBtn');
  }

  bindEvents() {
    // Sidebar responsive controls
    this.toggleSidebarBtn.addEventListener('click', () => this.sidebar.classList.add('active'));
    this.closeSidebarBtn.addEventListener('click', () => this.sidebar.classList.remove('active'));
    this.newChatBtn.addEventListener('click', () => this.createNewConversation());
    if (this.sidebarClearBtn) {
      this.sidebarClearBtn.addEventListener('click', () => this.clearAllConversations());
    }

    // Sidebar Accordion Settings toggle
    this.settingsToggleBtn.addEventListener('click', () => {
      this.sidebarSettingsPanel.classList.toggle('expanded');
    });

    // Save Settings Event
    this.saveSettingsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.saveSettings();
    });
    
    // Settings Logout Event
    if (this.settingsLogoutBtn) {
      this.settingsLogoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleLogout();
      });
    }

    // Profile Photo File Picker Trigger
    if (this.photoUploadTrigger && this.profilePhotoFileInput) {
      this.photoUploadTrigger.addEventListener('click', () => {
        this.profilePhotoFileInput.click();
      });
    }
    if (this.btnUploadPhoto && this.profilePhotoFileInput) {
      this.btnUploadPhoto.addEventListener('click', () => {
        this.profilePhotoFileInput.click();
      });
    }

    // File selection change event
    if (this.profilePhotoFileInput) {
      this.profilePhotoFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          if (file.size > 2 * 1024 * 1024) { // 2MB limit
            alert('Please select an image smaller than 2MB.');
            return;
          }
          const reader = new FileReader();
          reader.onload = (event) => {
            this.customPhotoDataUrl = event.target.result;
            if (this.settingsPhotoPreview) {
              this.settingsPhotoPreview.src = this.customPhotoDataUrl;
            }
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Remove photo reset event
    if (this.btnRemovePhoto) {
      this.btnRemovePhoto.addEventListener('click', () => {
        this.customPhotoDataUrl = null;
        if (this.profilePhotoFileInput) {
          this.profilePhotoFileInput.value = '';
        }
        const seed = this.profileAvatarSeedInput ? this.profileAvatarSeedInput.value.trim() : 'Terra';
        const dicebearUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed || 'Terra')}`;
        if (this.settingsPhotoPreview) {
          this.settingsPhotoPreview.src = dicebearUrl;
        }
      });
    }

    // Custom seed change updates the Dicebear preview dynamically (only when no custom file is uploaded)
    if (this.profileAvatarSeedInput) {
      this.profileAvatarSeedInput.addEventListener('input', () => {
        if (!this.customPhotoDataUrl) {
          const seed = this.profileAvatarSeedInput.value.trim() || 'Terra';
          const dicebearUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}`;
          if (this.settingsPhotoPreview) {
            this.settingsPhotoPreview.src = dicebearUrl;
          }
        }
      });
    }


    // Textarea input control auto grow
    this.chatInput.addEventListener('input', () => {
      this.chatInput.style.height = 'auto';
      this.chatInput.style.height = (this.chatInput.scrollHeight - 6) + 'px';
      this.inputCounter.textContent = `${this.chatInput.value.length} characters`;
    });

    // Send handlers
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleMessageSend();
      }
    });
    this.sendBtn.addEventListener('click', () => this.handleMessageSend());
    this.clearCurrentChatBtn.addEventListener('click', () => this.clearCurrentChatMessages());

    // Suggestion Quick Prompt cards
    document.querySelectorAll('.prompt-card').forEach(card => {
      card.addEventListener('click', () => {
        const text = card.getAttribute('data-prompt');
        this.chatInput.value = text;
        this.chatInput.dispatchEvent(new Event('input'));
        this.handleMessageSend();
      });
    });

    // Export Handler
    this.exportChatBtn.addEventListener('click', () => this.exportCurrentChat());

    // --- AUTHENTICATION BINDINGS ---
    // Google & GitHub sign-in clicks
    if (this.btnGoogleLogin) {
      this.btnGoogleLogin.addEventListener('click', () => this.handleSocialLogin('google'));
    }
    if (this.btnGithubLogin) {
      this.btnGithubLogin.addEventListener('click', () => this.handleSocialLogin('github'));
    }

    // Email sign-in submit
    if (this.emailLoginForm) {
      this.emailLoginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = this.loginEmailInput.value.trim();
        const password = this.loginPasswordInput.value;
        this.handleEmailLogin(email, password);
      });
    }

    // Password visibility toggle on login form
    if (this.loginPasswordVisibilityBtn) {
      this.loginPasswordVisibilityBtn.addEventListener('click', () => {
        const type = this.loginPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        this.loginPasswordInput.setAttribute('type', type);
        const icon = this.loginPasswordVisibilityBtn.querySelector('i');
        if (icon) {
          icon.setAttribute('data-lucide', type === 'password' ? 'eye' : 'eye-off');
          lucide.createIcons();
        }
      });
    }

    // Mock account creation trigger link
    if (this.signUpLink) {
      this.signUpLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.showStatus('Creating simulated account...', 'info');
        setTimeout(() => {
          this.handleEmailLogin('explorer@aether.chat', 'password123');
        }, 600);
      });
    }

    // Logout click
    if (this.profileLogoutBtn) {
      this.profileLogoutBtn.addEventListener('click', () => this.handleLogout());
    }
  }

  // --- BOOTSTRAP INIT ---
  async bootstrap() {
    this.initAuth();
    this.updateApiKeyIndicator();
    this.updateSessionCostDisplay();
    
    // Load conversations list from state
    this.renderConversationList();

    // Rehydrate active conversation
    if (this.activeConversationId) {
      this.loadConversation(this.activeConversationId);
    } else if (this.conversations.length > 0) {
      this.loadConversation(this.conversations[0].id);
    } else {
      this.showWelcomeScreen();
    }

    // Refresh Icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // --- SETTINGS CONTROLLER ---
  saveSettings() {
    if (!this.user) {
      this.showStatus('No active user session to update.', 'error');
      return;
    }

    const name = this.profileNameInput ? this.profileNameInput.value.trim() : '';
    const email = this.profileEmailInput ? this.profileEmailInput.value.trim() : '';
    const seed = this.profileAvatarSeedInput ? this.profileAvatarSeedInput.value.trim() : 'Terra';

    if (!name || !email) {
      alert('Display Name and Email Address are required.');
      return;
    }

    // Update user properties
    this.user.displayName = name;
    this.user.email = email;
    
    if (this.customPhotoDataUrl) {
      this.user.photoURL = this.customPhotoDataUrl;
    } else {
      this.user.photoURL = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}`;
    }

    localStorage.setItem('aether_user', JSON.stringify(this.user));

    // Firebase live update integration
    if (!this.user.isMock && typeof firebase !== 'undefined' && firebase.auth().currentUser) {
      const currentUser = firebase.auth().currentUser;
      currentUser.updateProfile({
        displayName: this.user.displayName,
        photoURL: this.user.photoURL
      }).then(() => {
        console.log("Firebase Auth profile synced.");
      }).catch(err => {
        console.error("Firebase updateProfile failed:", err);
      });

      if (this.user.email !== currentUser.email) {
        currentUser.updateEmail(this.user.email).then(() => {
          console.log("Firebase Auth email synced.");
        }).catch(err => {
          console.warn("Firebase updateEmail failed:", err);
        });
      }
    }

    // Dynamic UI refresh
    this.updateAuthStateUI();

    // Collapse settings panel after successful save
    this.sidebarSettingsPanel.classList.remove('expanded');

    this.showStatus('Profile updated successfully.', 'success');
  }

  updateApiKeyIndicator() {
    if (!this.apiKeyStatus) return;
    if (this.apiKey) {
      this.apiKeyStatus.textContent = 'Configured';
      this.apiKeyStatus.className = 'stat-value badge badge-success';
    } else {
      this.apiKeyStatus.textContent = 'Not Configured';
      this.apiKeyStatus.className = 'stat-value badge badge-error';
    }
  }

  updateSessionCostDisplay() {
    if (this.sessionCost) {
      this.sessionCost.textContent = `$${this.activeCost.toFixed(5)}`;
    }
  }

  showStatus(message, type = 'info') {
    this.systemStatus.textContent = message;
    
    if (type === 'success') {
      this.systemStatus.style.color = 'var(--success)';
    } else if (type === 'error') {
      this.systemStatus.style.color = 'var(--error)';
    } else if (type === 'warning') {
      this.systemStatus.style.color = 'var(--warning)';
    } else {
      this.systemStatus.style.color = 'var(--text-dark)';
    }

    setTimeout(() => {
      this.systemStatus.textContent = 'Ready to chat. Adjust settings in the sidebar panel.';
      this.systemStatus.style.color = 'var(--text-dark)';
    }, 4000);
  }

  // --- CONVERSATION THREAD MANAGER ---
  getActiveConversation() {
    return this.conversations.find(c => c.id === this.activeConversationId);
  }

  saveConversationsToStorage() {
    localStorage.setItem('aether_conversations', JSON.stringify(this.conversations));
  }

  createNewConversation() {
    const threadId = 'conv-' + Date.now();
    const newConv = {
      id: threadId,
      title: 'New Conversation',
      model: TARGET_MODEL.id,
      systemPrompt: this.systemPrompt,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      messages: [],
      created_at: new Date().toISOString()
    };

    this.conversations.unshift(newConv);
    this.saveConversationsToStorage();

    this.activeConversationId = threadId;
    localStorage.setItem('aether_active_conv_id', this.activeConversationId);
    
    this.renderConversationList();
    this.loadConversation(threadId);
    
    this.chatInput.focus();
  }

  renderConversationList() {
    this.chatList.innerHTML = '';
    
    if (this.conversations.length === 0) {
      this.chatList.innerHTML = '<div class="chat-list-empty">No conversations yet</div>';
      return;
    }

    this.conversations.forEach(conv => {
      const item = document.createElement('div');
      item.className = 'chat-thread-item';
      if (conv.id === this.activeConversationId) {
        item.classList.add('active');
      }
      
      const formattedDate = new Date(conv.created_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      });

      item.innerHTML = `
        <div class="thread-info">
          <i data-lucide="message-square" class="thread-icon"></i>
          <div class="thread-title-container">
            <span class="thread-title">${escapeHtml(conv.title)}</span>
            <span class="thread-meta">${formattedDate}</span>
          </div>
        </div>
        <div class="thread-actions">
          <button class="thread-action-btn rename-btn" title="Rename Conversation">
            <i data-lucide="edit-2" style="width:12px;height:12px;"></i>
          </button>
          <button class="thread-action-btn delete-btn" title="Delete Thread">
            <i data-lucide="trash-2" style="width:12px;height:12px;"></i>
          </button>
        </div>
      `;

      // Event listeners
      item.addEventListener('click', (e) => {
        // Prevent loading trigger if clicking list buttons
        if (e.target.closest('.thread-action-btn')) return;
        this.loadConversation(conv.id);
      });

      // Rename button handler
      item.querySelector('.rename-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.renameConversation(conv.id);
      });

      // Delete button handler
      item.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteConversation(conv.id);
      });

      this.chatList.appendChild(item);
    });

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  loadConversation(id) {
    this.activeConversationId = id;
    localStorage.setItem('aether_active_conv_id', id);
    
    // Highlight list selection
    this.renderConversationList();

    const conv = this.getActiveConversation();
    if (!conv) {
      this.showWelcomeScreen();
      return;
    }

    this.activeThreadTitle.textContent = conv.title;
    this.activeModelBadge.textContent = TARGET_MODEL.id;
    
    // Render existing messages feed
    this.messagesList.innerHTML = '';
    
    if (conv.messages.length === 0) {
      this.showWelcomeScreen();
    } else {
      this.welcomeScreen.style.display = 'none';
      this.messagesList.style.display = 'flex';
      
      conv.messages.forEach(msg => {
        this.appendMessageToFeed(msg.role, msg.content);
      });
      this.scrollToBottom();
    }
  }

  showWelcomeScreen() {
    this.messagesList.style.display = 'none';
    this.welcomeScreen.style.display = 'flex';
    this.activeThreadTitle.textContent = 'New Conversation';
  }

  renameConversation(id) {
    const conv = this.conversations.find(c => c.id === id);
    if (!conv) return;

    const newTitle = prompt('Enter a new title for this conversation:', conv.title);
    if (newTitle && newTitle.trim()) {
      conv.title = newTitle.trim();
      this.saveConversationsToStorage();
      this.renderConversationList();
      
      if (id === this.activeConversationId) {
        this.activeThreadTitle.textContent = conv.title;
      }
    }
  }

  deleteConversation(id) {
    if (!confirm('Are you sure you want to delete this conversation thread?')) return;

    this.conversations = this.conversations.filter(c => c.id !== id);
    this.saveConversationsToStorage();

    if (id === this.activeConversationId) {
      this.activeConversationId = this.conversations.length > 0 ? this.conversations[0].id : null;
      localStorage.setItem('aether_active_conv_id', this.activeConversationId);
    }

    this.bootstrap();
  }

  clearAllConversations() {
    if (!confirm('CAUTION: This will delete ALL stored conversations from this browser. Do you wish to proceed?')) return;

    this.conversations = [];
    this.activeConversationId = null;
    this.activeCost = 0.0;
    
    localStorage.removeItem('aether_conversations');
    localStorage.removeItem('aether_active_conv_id');
    localStorage.setItem('aether_session_cost', '0.0');

    this.bootstrap();
  }

  clearCurrentChatMessages() {
    const conv = this.getActiveConversation();
    if (!conv) return;

    if (!confirm('Clear all messages from this session feed?')) return;

    conv.messages = [];
    this.saveConversationsToStorage();
    this.loadConversation(conv.id);
  }

  // --- STREAMING CLIENT COMPLETION ---
  async handleMessageSend() {
    // 1. Validate input is not empty
    const input = this.chatInput.value.trim();
    if (!input) return;

    // Check for image generation prompt
    const imagePrompt = this.extractImagePrompt(input);
    if (imagePrompt) {
      this.handleImageGeneration(input, imagePrompt);
      return;
    }

    // 2. Check API Key
    if (!this.apiKey) {
      alert('OpenRouter API Key required. Please paste your API key in the codebase at app.js (line 25: const OPENROUTER_API_KEY = "your-key").');
      return;
    }

    // 3. Stop streaming if active
    if (this.isStreaming) {
      this.cancelGeneration();
      return;
    }

    // 4. Create conversation thread if not present
    let currentConv = this.getActiveConversation();
    if (!currentConv) {
      this.createNewConversation();
      currentConv = this.getActiveConversation();
    }

    // Adjust title if it is the first user prompt
    if (currentConv.messages.length === 0) {
      currentConv.title = input.length > 30 ? input.substring(0, 28) + '...' : input;
      this.activeThreadTitle.textContent = currentConv.title;
    }

    // Add user message to state
    const userMsg = { role: 'user', content: input };
    currentConv.messages.push(userMsg);
    this.saveConversationsToStorage();

    // Render message immediately
    if (this.welcomeScreen.style.display !== 'none') {
      this.welcomeScreen.style.display = 'none';
      this.messagesList.style.display = 'flex';
    }
    
    this.appendMessageToFeed('user', input);
    this.chatInput.value = '';
    this.chatInput.dispatchEvent(new Event('input'));
    this.scrollToBottom();

    // Model is free so session costs increments by 0
    this.accumulateSessionCost(0);

    // Call dynamic completion stream
    await this.fetchStreamCompletions(currentConv);
  }

  async fetchStreamCompletions(conversation) {
    this.isStreaming = true;
    this.setSendButtonState(true);
    
    // Add custom typing node/bubble in DOM
    const bubbleId = 'ai-typing-' + Date.now();
    this.appendAIMessageWrapperPlaceholder(bubbleId);
    this.scrollToBottom();

    this.abortController = new AbortController();

    const requestMessages = conversation.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Inject System Instruction as starting context
    if (conversation.systemPrompt) {
      requestMessages.unshift({
        role: 'system',
        content: conversation.systemPrompt
      });
    }

    const payload = {
      model: TARGET_MODEL.id,
      messages: requestMessages,
      temperature: conversation.temperature,
      stream: true
    };

    if (conversation.maxTokens) {
      payload.max_tokens = conversation.maxTokens;
    }

    const responseBubble = document.getElementById(bubbleId).querySelector('.message-bubble');
    let responseAccumulated = '';

    try {
      this.showStatus('Connecting to OpenAI stream...', 'info');

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://terra.antigravity.hub', 
          'X-Title': 'Terra AI Client Hub'
        },
        body: JSON.stringify(payload),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `Server responded with status ${response.status}`);
      }

      this.showStatus('Receiving generated stream...', 'info');

      // Setup body parser stream reader
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Save the last partial line back to the buffer
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.substring(6);
            if (dataStr === '[DONE]') {
              break;
            }
            
            try {
              const parsed = JSON.parse(dataStr);
              const deltaContent = parsed.choices?.[0]?.delta?.content || '';
              if (deltaContent) {
                responseAccumulated += deltaContent;
                // Render streaming markdown
                if (typeof marked !== 'undefined') {
                  responseBubble.innerHTML = marked.parse(responseAccumulated);
                } else {
                  responseBubble.textContent = responseAccumulated;
                }
                
                // Real-time syntax highlight code blocks and rebuild Lucide icons
                this.highlightAndFormatDynamicElements(responseBubble);
                this.scrollToBottom();
              }
            } catch (errJson) {
              // Ignore standard parse anomalies for SSE metadata lines
            }
          }
        }
      }

      // Finish streaming cleanly
      this.showStatus('Stream completed.', 'success');
      
      // Save AI answer
      conversation.messages.push({
        role: 'assistant',
        content: responseAccumulated
      });
      
      // Model is free so session costs increments by 0
      this.accumulateSessionCost(0);

    } catch (error) {
      if (error.name === 'AbortError') {
        this.showStatus('Generation stopped by user.', 'warning');
        
        // Save whatever was accumulated up to stop
        if (responseAccumulated) {
          conversation.messages.push({
            role: 'assistant',
            content: responseAccumulated + ' *(Generation stopped)*'
          });
        }
      } else {
        console.error('Streaming retrieval anomaly:', error);
        this.showStatus('Streaming connection failed.', 'error');
        responseBubble.innerHTML = `<span style="color:var(--error); font-weight:600;"><i data-lucide="alert-circle" style="display:inline-block; vertical-align:middle; width:16px; margin-right:6px;"></i> Error: Failed to generate response.</span><p style="font-size:0.8rem; color:var(--text-muted); margin-top:8px;">Reason: ${error.message}</p>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }
    } finally {
      this.isStreaming = false;
      this.setSendButtonState(false);
      this.abortController = null;
      
      // Swap unique placeholder ID out, finalize listing
      const node = document.getElementById(bubbleId);
      if (node) node.removeAttribute('id');
      
      this.saveConversationsToStorage();
      this.renderConversationList();
    }
  }

  cancelGeneration() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  accumulateSessionCost(amt) {
    if (isNaN(amt)) return;
    this.activeCost += amt;
    localStorage.setItem('aether_session_cost', this.activeCost.toString());
    this.updateSessionCostDisplay();
  }

  setSendButtonState(active) {
    if (active) {
      this.sendBtn.classList.add('streaming-active');
      this.sendBtn.innerHTML = '<i data-lucide="square" style="width:16px;height:16px;"></i>';
      this.chatInput.placeholder = 'Generating response... (Click Stop to halt)';
    } else {
      this.sendBtn.classList.remove('streaming-active');
      this.sendBtn.innerHTML = '<i data-lucide="arrow-up"></i>';
      this.chatInput.placeholder = 'Message Terra AI... (Press Enter to send, Shift+Enter for new line)';
    }
    
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // --- RENDERING / TRANSITION HELPERS ---
  appendMessageToFeed(role, text) {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${role === 'user' ? 'user' : 'ai'}`;

    const avatarInitial = role === 'user' ? 'U' : '▲';
    
    // Parse Markdown text if assistant
    let displayHtml = escapeHtml(text);
    if (role === 'ai' && typeof marked !== 'undefined') {
      displayHtml = marked.parse(text);
    } else if (role === 'user') {
      // Format users text with clean safe breaks
      displayHtml = `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
    }

    wrapper.innerHTML = `
      <div class="avatar">${avatarInitial}</div>
      <div class="message-bubble">${displayHtml}</div>
    `;

    this.messagesList.appendChild(wrapper);
    
    // Highlight elements post load
    if (role === 'ai') {
      this.highlightAndFormatDynamicElements(wrapper.querySelector('.message-bubble'));
    }
  }

  appendAIMessageWrapperPlaceholder(elementId) {
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper ai';
    wrapper.id = elementId;

    wrapper.innerHTML = `
      <div class="avatar">▲</div>
      <div class="message-bubble">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    `;

    this.messagesList.appendChild(wrapper);
  }

  highlightAndFormatDynamicElements(container) {
    // 1. syntax highlight all code blocks via Prism autoloader
    if (typeof Prism !== 'undefined') {
      container.querySelectorAll('pre code').forEach((block) => {
        Prism.highlightElement(block);
      });
    }

    // 2. Refresh Lucide Icons (specifically for copy buttons inside dynamic code headers)
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // 3. Bind copy handlers to dynamic buttons
    container.querySelectorAll('.copy-code-btn').forEach((btn) => {
      // Remove previous listener to avoid double bindings
      btn.removeEventListener('click', this.handleCodeCopy);
      btn.addEventListener('click', this.handleCodeCopy);
    });
  }

  handleCodeCopy(e) {
    const btn = e.currentTarget;
    const targetId = btn.getAttribute('data-target');
    const codeBlock = document.getElementById(targetId);
    
    if (codeBlock) {
      navigator.clipboard.writeText(codeBlock.innerText).then(() => {
        const label = btn.querySelector('span');
        const icon = btn.querySelector('i');
        
        if (label) label.textContent = 'Copied!';
        if (icon) {
          icon.setAttribute('data-lucide', 'check');
          lucide.createIcons();
        }

        setTimeout(() => {
          if (label) label.textContent = 'Copy Code';
          if (icon) {
            icon.setAttribute('data-lucide', 'copy');
            lucide.createIcons();
          }
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy code snippet:', err);
      });
    }
  }

  scrollToBottom() {
    this.scrollAnchor.scrollIntoView({ behavior: 'smooth' });
  }

  exportCurrentChat() {
    const conv = this.getActiveConversation();
    if (!conv || conv.messages.length === 0) {
      alert('No messages in active conversation to export.');
      return;
    }

    // Compile nice markdown export file
    let mdContent = `# Chat Log: ${conv.title}\n\n`;
    mdContent += `*Model: OpenAI: gpt-oss-120b (free)*\n`;
    mdContent += `*Generated: ${new Date().toLocaleString()}*\n\n---\n\n`;

    conv.messages.forEach(msg => {
      const header = msg.role === 'user' ? '### 👤 User' : '### 🤖 Terra AI';
      mdContent += `${header}\n\n${msg.content}\n\n---\n\n`;
    });

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${conv.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_chat.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // --- AUTHENTICATION IMPLEMENTATION METHODS ---
  initAuth() {
    // Initialize Firebase App if loaded and not already running
    if (this.firebaseConfig && typeof firebase !== 'undefined') {
      if (!firebase.apps.length) {
        try {
          firebase.initializeApp(this.firebaseConfig);
        } catch (e) {
          console.error("Firebase initialization anomaly:", e);
        }
      }

      // Handle redirect result (useful for browsers blocking popups)
      firebase.auth().getRedirectResult().then((result) => {
        if (result && result.user) {
          const fbUser = result.user;
          const provider = result.credential ? result.credential.signInMethod.split('.')[0] : 'google';
          this.user = {
            uid: fbUser.uid,
            displayName: fbUser.displayName || `${provider.charAt(0).toUpperCase() + provider.slice(1)} Explorer`,
            email: fbUser.email || `${provider}-user@firebase.com`,
            photoURL: fbUser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${fbUser.uid}`,
            provider: provider,
            isMock: false
          };
          localStorage.setItem('aether_user', JSON.stringify(this.user));
          this.updateAuthStateUI();
          this.showStatus(`Logged in successfully via Firebase Redirect!`, 'success');
        }
      }).catch((err) => {
        console.error("Firebase Redirect Login Error:", err);
      });
    }
    
    // Sync UI with active state
    this.updateAuthStateUI();
  }

  updateAuthStateUI() {
    if (this.user) {
      // Hydrate customPhotoDataUrl state if user has a custom picture
      if (this.user.photoURL && (this.user.photoURL.startsWith('data:image/') || !this.user.photoURL.includes('dicebear.com'))) {
        this.customPhotoDataUrl = this.user.photoURL;
      } else {
        this.customPhotoDataUrl = null;
      }

      // Hide auth overlay and show profile details
      if (this.authOverlay) this.authOverlay.classList.add('hidden');
      if (this.sidebarProfileCard) {
        this.sidebarProfileCard.style.display = 'flex';
        
        // Render Profile Metadata
        if (this.profileAvatar) {
          this.profileAvatar.src = this.user.photoURL || 'https://api.dicebear.com/7.x/adventurer/svg?seed=Terra';
        }
        if (this.profileDisplayName) {
          this.profileDisplayName.textContent = this.user.displayName || 'Terra Explorer';
        }
        if (this.profileDisplayEmail) {
          this.profileDisplayEmail.textContent = this.user.email || 'user@terra.ai';
        }
      }

      // Update settings photo preview too
      if (this.settingsPhotoPreview) {
        this.settingsPhotoPreview.src = this.user.photoURL || 'https://api.dicebear.com/7.x/adventurer/svg?seed=Terra';
      }

      // Pre-populate input fields inside Account Settings
      if (this.profileNameInput) {
        this.profileNameInput.value = this.user.displayName || '';
      }
      if (this.profileEmailInput) {
        this.profileEmailInput.value = this.user.email || '';
      }
      if (this.profileAvatarSeedInput) {
        let seed = 'Terra';
        if (this.user.photoURL) {
          const match = this.user.photoURL.match(/seed=([^&]+)/);
          if (match) {
            seed = decodeURIComponent(match[1]);
          } else {
            seed = this.user.displayName || 'Terra';
          }
        }
        this.profileAvatarSeedInput.value = seed;
      }
    } else {
      // Unauthenticated state: display the gating overlay
      if (this.authOverlay) this.authOverlay.classList.remove('hidden');
      if (this.sidebarProfileCard) this.sidebarProfileCard.style.display = 'none';
      
      // Ensure sidebar settings are collapsed
      if (this.sidebarSettingsPanel) {
        this.sidebarSettingsPanel.classList.remove('expanded');
      }
    }
    
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  async handleSocialLogin(provider) {
    if (this.firebaseConfig && typeof firebase !== 'undefined') {
      // Production Firebase OAuth routine
      this.showLoginLoading(provider, true);
      try {
        const authProvider = provider === 'google' 
          ? new firebase.auth.GoogleAuthProvider() 
          : new firebase.auth.GithubAuthProvider();
          
        // Try popup first
        const result = await firebase.auth().signInWithPopup(authProvider);
        const fbUser = result.user;
        
        this.user = {
          uid: fbUser.uid,
          displayName: fbUser.displayName || (provider === 'google' ? 'Google Explorer' : 'GitHub Explorer'),
          email: fbUser.email || `${provider}-user@firebase.com`,
          photoURL: fbUser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${fbUser.uid}`,
          provider: provider,
          isMock: false
        };
        
        localStorage.setItem('aether_user', JSON.stringify(this.user));
        this.updateAuthStateUI();
        this.showStatus(`Logged in successfully via ${provider === 'google' ? 'Google' : 'GitHub'}!`, 'success');
      } catch (err) {
        console.error("Firebase Social OAuth Anomaly:", err);
        if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
          this.showStatus("Popup blocked or closed. Redirecting for sign-in...", "info");
          const authProvider = provider === 'google' 
            ? new firebase.auth.GoogleAuthProvider() 
            : new firebase.auth.GithubAuthProvider();
          await firebase.auth().signInWithRedirect(authProvider);
        } else {
          alert(`Authentication unsuccessful: ${err.message}`);
        }
      } finally {
        this.showLoginLoading(provider, false);
      }
    } else {
      // Sandbox Simulated Login Mode
      let email = this.loginEmailInput ? this.loginEmailInput.value.trim() : '';
      
      if (!email) {
        const userInput = prompt(`[Sandbox Mode] Enter your email to connect via ${provider === 'google' ? 'Google' : 'GitHub'}:`, provider === 'google' ? 'user@gmail.com' : 'user@github.com');
        if (userInput === null) {
          // Cancelled
          this.showLoginLoading(provider, false);
          return;
        }
        email = userInput.trim() || (provider === 'google' ? 'user@gmail.com' : 'user@github.com');
      }

      this.showLoginLoading(provider, true);
      
      // Simulating loading delay
      await new Promise(resolve => setTimeout(resolve, 800));

      const username = email.split('@')[0];
      const displayName = username.charAt(0).toUpperCase() + username.slice(1);
      
      this.user = {
        uid: 'mock-' + provider + '-' + Math.random().toString(36).substring(2, 10),
        displayName: displayName,
        email: email,
        photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`,
        provider: provider,
        isMock: true
      };
      
      localStorage.setItem('aether_user', JSON.stringify(this.user));
      this.updateAuthStateUI();
      this.showStatus(`Signed in as ${this.user.displayName} (Simulated Sandbox).`, 'success');
      this.showLoginLoading(provider, false);
    }
  }
  async handleEmailLogin(email, password) {
    if (!email || !password) return;

    if (this.firebaseConfig && typeof firebase !== 'undefined') {
      // Production Firebase Email Routine
      this.showEmailSpinner(true);
      try {
        const result = await firebase.auth().signInWithEmailAndPassword(email, password);
        const fbUser = result.user;
        
        this.user = {
          uid: fbUser.uid,
          displayName: fbUser.displayName || email.split('@')[0],
          email: fbUser.email,
          photoURL: fbUser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${fbUser.uid}`,
          provider: 'email',
          isMock: false
        };
        
        localStorage.setItem('aether_user', JSON.stringify(this.user));
        this.updateAuthStateUI();
        this.showStatus('Logged in successfully!', 'success');
      } catch (err) {
        console.error("Firebase Email Auth Anomaly:", err);
        alert(`Login unsuccessful: ${err.message}`);
      } finally {
        this.showEmailSpinner(false);
      }
    } else {
      // Sandbox Simulated Email Login
      this.showEmailSpinner(true);
      
      // Simulating loading delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const username = email.split('@')[0];
      const displayName = username.charAt(0).toUpperCase() + username.slice(1);
      
      this.user = {
        uid: 'mock-email-' + Math.random().toString(36).substring(2, 10),
        displayName: displayName || 'Sandbox Explorer',
        email: email,
        photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${username || 'Terra'}`,
        provider: 'email',
        isMock: true
      };
      
      localStorage.setItem('aether_user', JSON.stringify(this.user));
      this.updateAuthStateUI();
      this.showStatus(`Signed in as ${this.user.displayName} (Simulated Sandbox).`, 'success');
      this.showEmailSpinner(false);
    }
  }

  showLoginLoading(provider, isLoading) {
    const btn = provider === 'google' ? this.btnGoogleLogin : this.btnGithubLogin;
    if (!btn) return;
    
    if (isLoading) {
      btn.disabled = true;
      btn.style.opacity = '0.7';
      btn.style.cursor = 'not-allowed';
      btn.querySelector('span').textContent = 'Connecting...';
    } else {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.querySelector('span').textContent = provider === 'google' ? 'Google' : 'GitHub';
    }
  }

  showEmailSpinner(isLoading) {
    if (!this.loginSubmitBtn || !this.loginSpinner) return;
    
    if (isLoading) {
      this.loginSubmitBtn.disabled = true;
      this.loginSubmitBtn.style.opacity = '0.7';
      this.loginSubmitBtn.querySelector('.btn-label').style.display = 'none';
      this.loginSpinner.classList.remove('hidden');
    } else {
      this.loginSubmitBtn.disabled = false;
      this.loginSubmitBtn.style.opacity = '1';
      this.loginSubmitBtn.querySelector('.btn-label').style.display = 'block';
      this.loginSpinner.classList.add('hidden');
    }
  }

  handleLogout() {
    if (confirm('Are you sure you want to sign out of Terra AI?')) {
      if (this.firebaseConfig && typeof firebase !== 'undefined') {
        try {
          firebase.auth().signOut();
        } catch (e) {
          console.error("Firebase Sign Out Anomaly:", e);
        }
      }
      
      this.user = null;
      localStorage.removeItem('aether_user');
      this.updateAuthStateUI();
      this.showStatus('Successfully signed out.', 'info');
      
      if (this.loginEmailInput) this.loginEmailInput.value = '';
      if (this.loginPasswordInput) this.loginPasswordInput.value = '';
    }
  }

  // --- ART SYNTHESIS & IMAGE GENERATION METHODS ---
  extractImagePrompt(input) {
    const text = input.trim();
    
    // Slash commands
    if (text.startsWith('/image ')) {
      return text.substring(7).trim();
    }
    if (text.startsWith('/draw ')) {
      return text.substring(6).trim();
    }
    if (text.startsWith('/paint ')) {
      return text.substring(7).trim();
    }
    
    // Natural language patterns
    const patterns = [
      /^(?:please\s+)?(?:generate|create|make|draw|paint|synthesize)\s+(?:an?\s+)?(?:image|picture|photo|illustration|painting|drawing|artwork)\s+(?:of|about|showing)\s+(.+)$/i,
      /^(?:please\s+)?(?:draw|paint|depict|illustrate)\s+(?:an?\s+)?(.+)$/i,
      /^(?:please\s+)?(?:generate|create|make)\s+(?:an?\s+)?(?:image|picture|photo|illustration|painting|drawing|artwork)\s+for\s+(.+)$/i
    ];
    
    for (const regex of patterns) {
      const match = text.match(regex);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    // Fallback if the input is exactly "/image" or "/draw" or "/paint"
    if (text.toLowerCase() === '/image' || text.toLowerCase() === '/draw' || text.toLowerCase() === '/paint') {
      return 'a beautiful cosmic scenery with glowing celestial portals';
    }
    
    return null;
  }

  async handleImageGeneration(fullInput, promptText) {
    // 1. Create/Retrieve conversation thread if not present
    let currentConv = this.getActiveConversation();
    if (!currentConv) {
      this.createNewConversation();
      currentConv = this.getActiveConversation();
    }

    // Adjust title if it is the first user prompt
    if (currentConv.messages.length === 0) {
      currentConv.title = fullInput.length > 30 ? fullInput.substring(0, 28) + '...' : fullInput;
      this.activeThreadTitle.textContent = currentConv.title;
    }

    // Add user message to state
    const userMsg = { role: 'user', content: fullInput };
    currentConv.messages.push(userMsg);
    this.saveConversationsToStorage();

    // Render user message in feed
    if (this.welcomeScreen.style.display !== 'none') {
      this.welcomeScreen.style.display = 'none';
      this.messagesList.style.display = 'flex';
    }
    
    this.appendMessageToFeed('user', fullInput);
    this.chatInput.value = '';
    this.chatInput.style.height = 'auto';
    this.chatInput.dispatchEvent(new Event('input'));
    this.scrollToBottom();

    // 2. Add custom image generation bubble
    const bubbleId = 'ai-image-gen-' + Date.now();
    this.appendAIMessageImagePlaceholder(bubbleId, promptText);
    this.scrollToBottom();

    const bubbleNode = document.getElementById(bubbleId);
    const frameNode = bubbleNode.querySelector('.image-gen-frame');
    const statusNode = bubbleNode.querySelector('.loader-status');
    const imgNode = bubbleNode.querySelector('.gen-result-img');
    const actionsNode = bubbleNode.querySelector('.image-gen-actions');

    const downloadBtn = bubbleNode.querySelector('.download-btn');
    const viewBtn = bubbleNode.querySelector('.view-btn');

    // Synthesis status simulation sequence for rich premium experience
    const statuses = [
      { text: 'Analyzing artistic prompt...', delay: 600 },
      { text: 'Connecting to Pollinations Art Engine...', delay: 1000 },
      { text: 'Synthesizing pixels...', delay: 1200 },
      { text: 'Finalizing high-res details...', delay: 800 }
    ];

    let currentStatusIndex = 0;

    const runStatusUpdate = () => {
      if (currentStatusIndex < statuses.length && statusNode) {
        statusNode.textContent = statuses[currentStatusIndex].text;
        setTimeout(() => {
          currentStatusIndex++;
          runStatusUpdate();
        }, statuses[currentStatusIndex].delay);
      }
    };

    runStatusUpdate();

    // 3. Generate image URL (with enhanced style triggers for beautiful high-end results)
    const enhancedPrompt = `${promptText}, highly detailed digital painting, dramatic cinematic lighting, smooth gradients, 8k resolution masterpiece`;
    const randomSeed = Math.floor(Math.random() * 1000000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&nologo=true&seed=${randomSeed}`;

    // Preload image in background
    const tempImg = new Image();
    tempImg.src = imageUrl;

    tempImg.onload = () => {
      if (statusNode) statusNode.textContent = 'Rendering artwork...';
      
      setTimeout(() => {
        if (imgNode) {
          imgNode.src = imageUrl;
          imgNode.style.display = 'block';
        }
        
        // Transition card elements from loading state
        if (frameNode) frameNode.classList.remove('loading');
        const loader = bubbleNode.querySelector('.paint-loader');
        if (loader) loader.style.display = 'none';
        if (statusNode) statusNode.style.display = 'none';
        if (actionsNode) actionsNode.style.display = 'flex';

        // Add premium action buttons listeners
        if (downloadBtn) {
          downloadBtn.addEventListener('click', () => {
            this.downloadImageFile(imageUrl, `${promptText.toLowerCase().replace(/[^a-z0-9]/g, '_')}.png`);
          });
        }

        if (viewBtn) {
          viewBtn.addEventListener('click', () => {
            window.open(imageUrl, '_blank');
          });
        }

        // Persist generated image to local storage history as standard markdown link
        const assistantMsg = {
          role: 'assistant',
          content: `![${promptText}](${imageUrl})\n\n*(Artwork generated via Terra Art Engine for: "${promptText}")*`
        };
        currentConv.messages.push(assistantMsg);
        
        this.saveConversationsToStorage();
        this.renderConversationList();
        
        // Remove ID so it behaves as static node in history
        if (bubbleNode) bubbleNode.removeAttribute('id');
        this.scrollToBottom();
      }, 800);
    };

    tempImg.onerror = (err) => {
      console.error("Art creation anomaly:", err);
      if (statusNode) statusNode.textContent = 'Failed to synthesize artwork. Please try again.';
      if (frameNode) frameNode.classList.add('error');
      const loader = bubbleNode.querySelector('.paint-loader');
      if (loader) loader.style.display = 'none';
    };
  }

  appendAIMessageImagePlaceholder(elementId, promptText) {
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper ai';
    wrapper.id = elementId;

    wrapper.innerHTML = `
      <div class="avatar">▲</div>
      <div class="message-bubble image-gen-bubble">
        <div class="image-gen-card">
          <div class="image-gen-header">
            <i data-lucide="sparkles" class="sparkle-icon"></i>
            <span class="gen-title">Terra AI Art Engine</span>
          </div>
          <div class="image-gen-prompt">"${escapeHtml(promptText)}"</div>
          <div class="image-gen-frame loading">
            <div class="paint-loader">
              <div class="loader-ring"></div>
              <div class="loader-spark"></div>
            </div>
            <div class="loader-status">Initializing Art Engine...</div>
            <img class="gen-result-img" style="display:none;" />
          </div>
          <div class="image-gen-actions" style="display:none;">
            <button class="btn-image-action download-btn">
              <i data-lucide="download"></i> Download
            </button>
            <button class="btn-image-action view-btn">
              <i data-lucide="maximize-2"></i> Full Resolution
            </button>
          </div>
        </div>
      </div>
    `;

    this.messagesList.appendChild(wrapper);
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  async downloadImageFile(url, filename) {
    try {
      this.showStatus('Downloading artwork...', 'info');
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network response was not ok');
      const blob = await response.clone().blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      this.showStatus('Download completed successfully.', 'success');
    } catch (e) {
      console.warn("Direct download failed, falling back to opening in a new tab:", e);
      window.open(url, '_blank');
      this.showStatus('Opened image in a new tab.', 'info');
    }
  }
}

// Instantiate Terra Control Center on page render completion
window.addEventListener('DOMContentLoaded', () => {
  window.terra = new TerraApp();
});
