import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

// Cache for available models to avoid repeated API calls
let availableModelsCache: string[] | null = null;
let modelsCacheTime = 0;
const MODELS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getAvailableChatModels(): Promise<string[]> {
  const now = Date.now();
  
  // Return cached models if still valid
  if (availableModelsCache && (now - modelsCacheTime) < MODELS_CACHE_DURATION) {
    return availableModelsCache;
  }
  
  try {
    const models = await groq.models.list();
    const chatModels = models.data
      .filter((model: any) => 
        model.id && 
        model.active && 
        // Filter for text generation models only (exclude guard, audio, embedding, etc.)
        (model.id.includes('llama') || 
         model.id.includes('gemma') || 
         model.id.includes('mixtral') ||
         model.id.includes('gpt-oss')) &&
        // Exclude guard models and other non-generation models
        !model.id.includes('guard') &&
        !model.id.includes('prompt-guard') &&
        !model.id.includes('whisper') &&
        !model.id.includes('safeguard') &&
        !model.id.includes('tts')
      )
      .map((model: any) => ({
        id: model.id,
        context_window: model.context_window || 8192
      }));
    
    availableModelsCache = chatModels.map((m: any) => m.id);
    modelsCacheTime = now;
    return availableModelsCache;
  } catch (error) {
    console.error('Error fetching available models:', error);
    // Fallback to known models if API fails
    return [
      'llama-3.1-8b-instant',
      'llama-3.1-70b-versatile', 
      'llama3-70b-8192',
      'llama3-8b-8192',
      'gemma2-9b-it'
    ];
  }
}

function selectBestModel(availableModels: string[]): string {
  // Priority order for models - prefer more capable ones
  const modelPriority = [
    'llama-3.1-70b-versatile',
    'llama3-70b-8192', 
    'llama-3.1-8b-instant',
    'llama3-8b-8192',
    'llama3-groq-70b-8192-tool-use-preview',
    'gemma2-9b-it',
    'mixtral-8x7b-32768'
  ];
  
  // Find the first available model from our priority list
  for (const priorityModel of modelPriority) {
    if (availableModels.includes(priorityModel)) {
      return priorityModel;
    }
  }
  
  // If none of our priority models are available, filter out guard models and use the first available
  const filteredModels = availableModels.filter(m => 
    !m.includes('guard') && 
    !m.includes('prompt-guard') &&
    !m.includes('whisper')
  );
  
  return filteredModels[0] || 'llama-3.1-8b-instant';
}

// In-memory rate limiting (simple, no external services needed)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(identifier: string, limit: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);
  
  if (!record || now > record.resetTime) {
    // Create new record or reset expired one
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + windowMs
    });
    return true;
  }
  
  if (record.count >= limit) {
    return false;
  }
  
  record.count++;
  return true;
}

// Clean up expired rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60000); // Clean up every minute

// Security headers
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

// Input validation and sanitization
function validateAndSanitizeInput(data: any): { valid: boolean; error?: string; sanitized?: any } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid request format' };
  }

  const { query, category } = data;

  // Validate query
  if (!query || typeof query !== 'string') {
    return { valid: false, error: 'Query is required and must be a string' };
  }

  if (query.length < 2 || query.length > 500) {
    return { valid: false, error: 'Query must be between 2 and 500 characters' };
  }

  // Sanitize query - remove potentially dangerous characters
  const sanitizedQuery = query
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();

  if (sanitizedQuery.length === 0) {
    return { valid: false, error: 'Invalid query content' };
  }

  // Validate category if provided
  if (category && typeof category === 'string') {
    const validCategories = ["All", "General Purpose", "Coding", "Image Generation", "Marketing/Writing", "Productivity", "Research", "Video", "Audio", "Presentations", "Development Platform"];
    if (!validCategories.includes(category)) {
      return { valid: false, error: 'Invalid category' };
    }
  }

  return {
    valid: true,
    sanitized: {
      query: sanitizedQuery,
      category: category || undefined
    }
  };
}

// IP address extraction
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (cfConnectingIP) return cfConnectingIP;
  if (forwarded) return forwarded.split(',')[0].trim();
  if (realIP) return realIP;
  
  return 'unknown';
}

// Bot detection
function detectBot(request: NextRequest): boolean {
  const userAgent = request.headers.get('user-agent') || '';
  const botPatterns = [
    /bot/i, /crawler/i, /spider/i, /scraper/i,
    /curl/i, /wget/i, /python/i, /java/i,
    /headless/i, /phantom/i, /selenium/i
  ];
  
  return botPatterns.some(pattern => pattern.test(userAgent));
}

// Request size limit
function checkRequestSize(request: NextRequest): boolean {
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > 10000) { // 10KB limit
    return false;
  }
  return true;
}

interface AIModel {
  name: string;
  category: string;
  strengths: string[];
  bestFor: string[];
  pricing: string;
  access: string;
  description: string;
  url: string;
}

const aiDatabase: AIModel[] = [
  {
    name: "ChatGPT (GPT-4)",
    category: "General Purpose",
    strengths: ["Conversational AI", "Complex reasoning", "Code generation", "Creative writing"],
    bestFor: ["General questions", "Coding help", "Writing assistance", "Analysis"],
    pricing: "Free tier available, Paid from $20/month",
    access: "Web, API, Mobile",
    description: "OpenAI's flagship language model, excellent for a wide range of tasks from casual conversation to complex problem-solving.",
    url: "https://chatgpt.com",
  },
  {
    name: "Claude (Anthropic)",
    category: "General Purpose",
    strengths: ["Natural conversation", "Long context", "Analysis", "Safety-focused"],
    bestFor: ["Long documents", "Analysis", "Writing", "Research"],
    pricing: "Free tier available, Paid from $20/month",
    access: "Web, API",
    description: "Anthropic's AI assistant known for natural conversations and ability to handle very long contexts.",
    url: "https://claude.ai",
  },
  {
    name: "GitHub Copilot",
    category: "Coding",
    strengths: ["Code completion", "Multi-language support", "IDE integration", "Real-time suggestions"],
    bestFor: ["Software development", "Code writing", "Debugging", "Learning to code"],
    pricing: "$10/month for individuals",
    access: "IDE extension",
    description: "AI-powered code completion tool that integrates directly with your development environment.",
    url: "https://github.com/features/copilot",
  },
  {
    name: "Midjourney",
    category: "Image Generation",
    strengths: ["High-quality images", "Artistic style", "Creative prompts", "Consistent results"],
    bestFor: ["Art creation", "Design concepts", "Illustrations", "Creative projects"],
    pricing: "$10-120/month",
    access: "Discord, Web",
    description: "Generates high-quality artistic images from text prompts, known for stunning visual results.",
    url: "https://www.midjourney.com",
  },
  {
    name: "DALL-E 3",
    category: "Image Generation",
    strengths: ["Text understanding", "Precise control", "Integration with ChatGPT", "Commercial use"],
    bestFor: ["Marketing images", "Concept art", "Illustrations", "Design work"],
    pricing: "Pay-per-use",
    access: "ChatGPT Plus, API",
    description: "OpenAI's image generation model with excellent text understanding and precise control.",
    url: "https://openai.com/dall-e-3",
  },
  {
    name: "Stable Diffusion",
    category: "Image Generation",
    strengths: ["Open source", "Customizable", "Local running", "Many models"],
    bestFor: ["Image generation", "Fine-tuning", "Custom models", "Privacy"],
    pricing: "Free (self-hosted)",
    access: "Local, Web platforms",
    description: "Open-source image generation model that can be run locally and customized extensively.",
    url: "https://stability.ai",
  },
  {
    name: "Jasper",
    category: "Marketing/Writing",
    strengths: ["Marketing copy", "SEO content", "Brand voice", "Templates"],
    bestFor: ["Marketing teams", "Content creation", "Copywriting", "Social media"],
    pricing: "$49-125/month",
    access: "Web",
    description: "AI writing assistant specifically designed for marketing teams and content creators.",
    url: "https://www.jasper.ai",
  },
  {
    name: "Notion AI",
    category: "Productivity",
    strengths: ["Note-taking integration", "Summarization", "Writing assistance", "Organization"],
    bestFor: ["Note-taking", "Documentation", "Meeting notes", "Knowledge management"],
    pricing: "$10/month add-on",
    access: "Notion workspace",
    description: "AI assistant integrated directly into Notion for enhanced productivity and document management.",
    url: "https://www.notion.so/product/ai",
  },
  {
    name: "Perplexity AI",
    category: "Research",
    strengths: ["Real-time web search", "Citation sources", "Research accuracy", "Up-to-date info"],
    bestFor: ["Research", "Fact-checking", "Current events", "Academic work"],
    pricing: "Free tier available, Paid from $20/month",
    access: "Web, API",
    description: "AI-powered search engine that provides cited sources and real-time information.",
    url: "https://www.perplexity.ai",
  },
  {
    name: "Runway",
    category: "Video",
    strengths: ["Video generation", "Video editing", "AI effects", "Professional tools"],
    bestFor: ["Video creation", "Content creation", "Film production", "Marketing videos"],
    pricing: "$12-76/month",
    access: "Web",
    description: "Professional AI video generation and editing platform for content creators.",
    url: "https://runwayml.com",
  },
  {
    name: "ElevenLabs",
    category: "Audio",
    strengths: ["Voice cloning", "Text-to-speech", "Natural voices", "Multi-language"],
    bestFor: ["Voiceovers", "Audiobooks", "Content creation", "Accessibility"],
    pricing: "Free tier available, Paid from $5/month",
    access: "Web, API",
    description: "Advanced text-to-speech and voice cloning platform with incredibly natural-sounding voices.",
    url: "https://elevenlabs.io",
  },
  {
    name: "Cursor",
    category: "Coding",
    strengths: ["AI-powered IDE", "Code understanding", "Debugging", "Chat with codebase"],
    bestFor: ["Software development", "Code review", "Learning codebases", "Refactoring"],
    pricing: "Free tier available, Paid from $20/month",
    access: "IDE",
    description: "AI-first code editor that understands your entire codebase and helps with development tasks.",
    url: "https://cursor.com",
  },
  {
    name: "Gamma",
    category: "Presentations",
    strengths: ["Slide generation", "Design automation", "Content creation", "Templates"],
    bestFor: ["Presentations", "Pitch decks", "Marketing materials", "Reports"],
    pricing: "Free tier available, Paid from $10/month",
    access: "Web",
    description: "AI-powered presentation builder that creates beautiful slides from simple prompts.",
    url: "https://gamma.app",
  },
  {
    name: "Hugging Face",
    category: "Development Platform",
    strengths: ["Model hub", "Open source", "Custom models", "Community"],
    bestFor: ["ML development", "Model deployment", "Research", "Custom solutions"],
    pricing: "Free (mostly), Paid compute",
    access: "Web, API",
    description: "Platform for sharing and using open-source machine learning models and tools.",
    url: "https://huggingface.co",
  },
  {
    name: "Gemini Advanced",
    category: "General Purpose",
    strengths: ["Multimodal", "Long context", "Google integration", "Reasoning"],
    bestFor: ["General questions", "Coding", "Research", "Multimodal tasks"],
    pricing: "Free tier available, Paid from $19.99/month",
    access: "Web, Mobile, API",
    description: "Google's flagship multimodal AI model with deep integration across Google services and powerful reasoning.",
    url: "https://gemini.google.com",
  },
  {
    name: "Microsoft Copilot",
    category: "General Purpose",
    strengths: ["Microsoft 365 integration", "Web search", "Chat", "Copilot Studio"],
    bestFor: ["Office work", "Everyday questions", "Productivity", "Content creation"],
    pricing: "Free tier, Paid from $20/month",
    access: "Web, Windows, Mobile",
    description: "Microsoft's AI assistant woven into Windows and Microsoft 365, great for everyday productivity.",
    url: "https://copilot.microsoft.com",
  },
  {
    name: "Grok (xAI)",
    category: "General Purpose",
    strengths: ["Real-time data", "Humorous style", "X integration", "Conversation"],
    bestFor: ["Real-time topics", "Casual conversation", "News", "General questions"],
    pricing: "Free tier available, Paid from $8/month",
    access: "Web, X platform",
    description: "xAI's assistant with real-time knowledge and a distinctive conversational personality.",
    url: "https://x.ai/grok",
  },
  {
    name: "Mistral Large",
    category: "General Purpose",
    strengths: ["Reasoning", "Multilingual", "Strong logic", "API access"],
    bestFor: ["Complex reasoning", "Multilingual tasks", "Enterprise", "Coding"],
    pricing: "Pay-per-use API",
    access: "API, Web (Le Chat)",
    description: "Mistral AI's high-capability large model offering strong reasoning and multilingual performance.",
    url: "https://mistral.ai",
  },
  {
    name: "Replit Agent",
    category: "Coding",
    strengths: ["Full-stack building", "Deployment", "IDE", "Autonomous agents"],
    bestFor: ["App building", "Prototyping", "Full-stack dev", "Deployment"],
    pricing: "Free tier, Paid from $20/month",
    access: "Web IDE",
    description: "An AI agent inside Replit that builds and deploys full applications from natural language prompts.",
    url: "https://replit.com",
  },
  {
    name: "Windsurf",
    category: "Coding",
    strengths: ["Agentic IDE", "Code intelligence", "Multi-file edits", "Cascade agent"],
    bestFor: ["Software development", "Refactoring", "Code review", "Learning codebases"],
    pricing: "Free tier, Paid from $15/month",
    access: "IDE",
    description: "An agentic AI code editor offering deep codebase understanding and multi-file editing.",
    url: "https://windsurf.com",
  },
  {
    name: "Tabnine",
    category: "Coding",
    strengths: ["Code completion", "Privacy-first", "Models trained on OSS", "IDE support"],
    bestFor: ["Code completion", "Enterprise dev", "Productivity", "Multi-language"],
    pricing: "Free tier, Paid from $9/month",
    access: "IDE extension",
    description: "A privacy-focused AI code completion assistant widely used across IDEs and enterprises.",
    url: "https://www.tabnine.com",
  },
  {
    name: "Codeium",
    category: "Coding",
    strengths: ["Free AI autocomplete", "Chat", "Multiline suggestions", "IDE support"],
    bestFor: ["Code completion", "Learning to code", "Boosting speed", "Multi-language"],
    pricing: "Free, Premium from $10/month",
    access: "IDE extension, Web",
    description: "A free AI code completion and chat tool supporting many IDEs and languages.",
    url: "https://codeium.com",
  },
  {
    name: "Ideogram",
    category: "Image Generation",
    strengths: ["Text rendering", "Typography", "Style control", "Quality images"],
    bestFor: ["Logos", "Text in images", "Posters", "Design assets"],
    pricing: "Free tier, Paid from $8/month",
    access: "Web, API",
    description: "An image generator known for excellent text rendering and typographic accuracy in images.",
    url: "https://ideogram.ai",
  },
  {
    name: "Leonardo AI",
    category: "Image Generation",
    strengths: ["Fine-tuned models", "Style presets", "High resolution", "Creative control"],
    bestFor: ["Game art", "Concept art", "Assets", "Creative projects"],
    pricing: "Free tier, Paid from $12/month",
    access: "Web, API",
    description: "An image generation platform with fine-tuned models and strong creative controls for artists.",
    url: "https://leonardo.ai",
  },
  {
    name: "Adobe Firefly",
    category: "Image Generation",
    strengths: ["Creative Suite integration", "Commercially safe", "Style variety", "Editing"],
    bestFor: ["Design", "Marketing", "Photography edits", "Creative work"],
    pricing: "Paid via Creative Cloud credit",
    access: "Web, Adobe apps",
    description: "Adobe's generative AI for images designed for commercial safety and Creative Cloud workflows.",
    url: "https://firefly.adobe.com",
  },
  {
    name: "Writesonic",
    category: "Marketing/Writing",
    strengths: ["SEO content", "Article writer", "Ads copy", "Templates"],
    bestFor: ["Blog posts", "SEO", "Ads", "Social media"],
    pricing: "Free tier, Paid from $16/month",
    access: "Web, API",
    description: "An AI writing tool focused on SEO-optimized articles and marketing copy at scale.",
    url: "https://writesonic.com",
  },
  {
    name: "Copy.ai",
    category: "Marketing/Writing",
    strengths: ["Copy generation", "Workflows", "Brand voice", "Go-to-market"],
    bestFor: ["Marketing copy", "Sales", "Emails", "Brand campaigns"],
    pricing: "Free tier, Paid from $36/month",
    access: "Web, API",
    description: "An AI copywriting platform helping marketing teams generate on-brand content and workflows.",
    url: "https://www.copy.ai",
  },
  {
    name: "Grammarly",
    category: "Marketing/Writing",
    strengths: ["Grammar checking", "Tone adjustment", "Rewrite", "Clarity"],
    bestFor: ["Polishing writing", "Emails", "Documents", "Academic work"],
    pricing: "Free tier, Premium from $12/month",
    access: "Web, Browser, Word",
    description: "AI writing assistant for grammar, clarity, tone, and style improvements across many platforms.",
    url: "https://www.grammarly.com",
  },
  {
    name: "Rytr",
    category: "Marketing/Writing",
    strengths: ["Affordable", "Tone selection", "Use cases", "Multi-language"],
    bestFor: ["Copywriting", "Blogs", "Emails", "Product descriptions"],
    pricing: "Free tier, Paid from $9/month",
    access: "Web",
    description: "A budget-friendly AI writing assistant covering many copywriting use cases and languages.",
    url: "https://rytr.me",
  },
  {
    name: "Otter AI",
    category: "Productivity",
    strengths: ["Meeting transcription", "Live captions", "Summaries", "Integration"],
    bestFor: ["Meeting notes", "Transcription", "Interviews", "Action items"],
    pricing: "Free tier, Paid from $16.99/month",
    access: "Web, Zoom, Mobile",
    description: "AI meeting assistant that records, transcribes, and summarizes conversations in real time.",
    url: "https://otter.ai",
  },
  {
    name: "Zapier AI",
    category: "Productivity",
    strengths: ["Automation", "App integrations", "AI steps", "Workflows"],
    bestFor: ["Automation", "Workflows", "Data sync", "Business processes"],
    pricing: "Free tier, Paid from $19.99/month",
    access: "Web",
    description: "Automation platform with AI steps that connect thousands of apps to streamline workflows.",
    url: "https://zapier.com",
  },
  {
    name: "Mem",
    category: "Productivity",
    strengths: ["Self-organizing notes", "AI tagging", "Search", "Knowledge base"],
    bestFor: ["Note-taking", "Knowledge management", "Personal CRM", "Research notes"],
    pricing: "Free tier, Paid from $14.99/month",
    access: "Web, Mobile",
    description: "A self-organizing AI note and knowledge management app that automatically structures your notes.",
    url: "https://get.mem.ai",
  },
  {
    name: "Superhuman AI",
    category: "Productivity",
    strengths: ["Email triage", "Drafting", "Smart replies", "Speed"],
    bestFor: ["Email management", "Inbox zero", "Drafting", "Executive work"],
    pricing: "$30/month",
    access: "Desktop, Mobile",
    description: "A high-speed email client with AI features for drafting, triage, and achieving inbox zero.",
    url: "https://superhuman.com",
  },
  {
    name: "Elicit",
    category: "Research",
    strengths: ["Literature review", "Data extraction", "Papers", "Research tasks"],
    bestFor: ["Academic research", "Literature reviews", "Systematic reviews", "Evidence gathering"],
    pricing: "Free tier, Paid from $12/month",
    access: "Web",
    description: "An AI research assistant that helps find and analyze academic papers using natural language.",
    url: "https://elicit.com",
  },
  {
    name: "Consensus",
    category: "Research",
    strengths: ["Evidence-based answers", "Paper search", "Citations", "Claim insights"],
    bestFor: ["Fact-checking", "Research", "Debate evidence", "Academic writing"],
    pricing: "Free tier, Premium from $8.99/month",
    access: "Web",
    description: "A search engine that taps into a large academic corpus to answer questions with cited evidence.",
    url: "https://consensus.app",
  },
  {
    name: "Scite",
    category: "Research",
    strengths: ["Citation context", "Smart citations", "Reference checks", "Papers"],
    bestFor: ["Citation analysis", "Literature review", "Academic writing", "Verification"],
    pricing: "Free tier, Paid from $20/month",
    access: "Web",
    description: "A platform that shows how papers are cited and whether findings are supported, for better research.",
    url: "https://scite.ai",
  },
  {
    name: "SciSpace",
    category: "Research",
    strengths: ["Paper interpretation", "Math parsing", "Paraphrasing", "Literature tools"],
    bestFor: ["Reading papers", "Understanding research", "Citations", "Study support"],
    pricing: "Free tier, Paid from $20/month",
    access: "Web, Chrome",
    description: "An AI tool that helps read, interpret, and navigate academic papers and complex scientific text.",
    url: "https://scispace.com",
  },
  {
    name: "Synthesia",
    category: "Video",
    strengths: ["AI avatars", "Video generation", "Script to video", "60+ languages"],
    bestFor: ["Training videos", "Corporate comms", "Explainer videos", "L&D"],
    pricing: "Free tier, Paid from $29/month",
    access: "Web, API",
    description: "Platform for creating professional videos with AI avatars from simple scripts in many languages.",
    url: "https://www.synthesia.io",
  },
  {
    name: "HeyGen",
    category: "Video",
    strengths: ["Avatar videos", "Voice cloning", "Translation", "Talking heads"],
    bestFor: ["Marketing videos", "Product demos", "Localization", "Content creation"],
    pricing: "Free tier, Paid from $29/month",
    access: "Web",
    description: "AI video platform for generating realistic talking-head videos and translating content.",
    url: "https://www.heygen.com",
  },
  {
    name: "Pika",
    category: "Video",
    strengths: ["Text-to-video", "Effects", "Stylization", "Fast generation"],
    bestFor: ["Short clips", "Creative effects", "Social content", "Prototyping"],
    pricing: "Free tier, Premium from $8/month",
    access: "Web, Discord",
    description: "A fast AI video generator turning text prompts into stylized short video clips.",
    url: "https://pika.art",
  },
  {
    name: "CapCut",
    category: "Video",
    strengths: ["AI editing", "Auto captions", "Templates", "Mobile"],
    bestFor: ["Short-form video", "Social media", "Quick edits", "TikTok"],
    pricing: "Free with premium options",
    access: "Web, Mobile, Desktop",
    description: "A popular video editor with AI features like auto captions and one-tap effects.",
    url: "https://www.capcut.com",
  },
  {
    name: "Descript",
    category: "Audio",
    strengths: ["Podcast editing", "Text-based editing", "Overdub", "Transcription"],
    bestFor: ["Podcasts", "Audio editing", "Video editing", "Transcription"],
    pricing: "Free tier, Paid from $12/month",
    access: "Web, Desktop",
    description: "AI audio and video editor that lets you edit media by editing text transcripts.",
    url: "https://www.descript.com",
  },
  {
    name: "Murf",
    category: "Audio",
    strengths: ["Text-to-speech", "Studio voices", "Voiceover", "Fine control"],
    bestFor: ["Voiceovers", "eLearning", "Ads", "Presentations"],
    pricing: "Free tier, Paid from $19/month",
    access: "Web",
    description: "An AI voice generator with studio-quality voices for voiceovers and commercial use.",
    url: "https://murf.ai",
  },
  {
    name: "Suno",
    category: "Audio",
    strengths: ["Music generation", "Songwriting", "Lyrics", "Vocal tracks"],
    bestFor: ["Original music", "Songs", "Background music", "Creative projects"],
    pricing: "Free tier, Paid from $10/month",
    access: "Web, iOS",
    description: "An AI music generator that creates original songs from text descriptions and prompts.",
    url: "https://suno.com",
  },
  {
    name: "Play.ht",
    category: "Audio",
    strengths: ["Text-to-speech", "Voice cloning", "Realistic voices", "API"],
    bestFor: ["Audiobooks", "Voiceovers", "Assistants", "Content generation"],
    pricing: "Free tier, Paid from $29.25/month",
    access: "Web, API",
    description: "Realistic AI text-to-speech and voice cloning platform with a large voice library.",
    url: "https://play.ht",
  },
  {
    name: "Tome",
    category: "Presentations",
    strengths: ["Deck generation", "Storytelling", "AI templates", "Branded design"],
    bestFor: ["Pitch decks", "Proposals", "Presentations", "Narrative decks"],
    pricing: "Free tier, Paid from $20/month",
    access: "Web",
    description: "An AI storytelling tool that generates polished presentation decks from prompts.",
    url: "https://tome.app",
  },
  {
    name: "Beautiful.ai",
    category: "Presentations",
    strengths: ["Auto-design", "Smart templates", "Brand consistency", "Live editing"],
    bestFor: ["Slick decks", "Business presentations", "Reports", "Pitch decks"],
    pricing: "Free trial, Paid from $12/month",
    access: "Web",
    description: "A presentation tool that auto-designs slides so decks stay consistent and polished.",
    url: "https://www.beautiful.ai",
  },
  {
    name: "Pitch",
    category: "Presentations",
    strengths: ["Team collaboration", "Analytics", "Templates", "Design"],
    bestFor: ["Team decks", "Startup pitches", "Collaboration", "Analytics"],
    pricing: "Free tier, Paid from $20/month",
    access: "Web",
    description: "A collaborative presentation platform with analytics and flexible team features.",
    url: "https://pitch.com",
  },
  {
    name: "SlidesAI",
    category: "Presentations",
    strengths: ["Slides from text", "Google Slides add-in", "Templates", "Speed"],
    bestFor: ["Quick decks", "Lecture slides", "Reports", "Presentations"],
    pricing: "Free tier, Paid from $10/month",
    access: "Google Slides add-in",
    description: "An AI add-in that turns text into ready-to-use Google Slides presentations instantly.",
    url: "https://www.slidesai.io",
  },
  {
    name: "Replicate",
    category: "Development Platform",
    strengths: ["Model hosting", "API access", "Many models", "Cloud inference"],
    bestFor: ["Model deployment", "Prototyping", "APIs", "AI apps"],
    pricing: "Pay-per-use",
    access: "API, Web",
    description: "A cloud platform to run and host open-source AI models behind simple APIs.",
    url: "https://replicate.com",
  },
  {
    name: "Modal",
    category: "Development Platform",
    strengths: ["Serverless compute", "GPU", "Python", "Scaling"],
    bestFor: ["ML pipelines", "GPU workloads", "Batch jobs", "Deployment"],
    pricing: "Pay-per-use",
    access: "SDK, API",
    description: "Serverless cloud platform for running GPU-heavy AI and ML workloads in Python.",
    url: "https://modal.com",
  },
  {
    name: "LangChain",
    category: "Development Platform",
    strengths: ["LLM framework", "Agent building", "Tooling", "Integrations"],
    bestFor: ["LLM apps", "Agents", "RAG", "Developer tooling"],
    pricing: "OSS, Paid cloud",
    access: "Library, API",
    description: "A framework for building LLM-powered applications, agents, and retrieval pipelines.",
    url: "https://www.langchain.com",
  },
  {
    name: "Together AI",
    category: "Development Platform",
    strengths: ["Model inference", "Fine-tuning", "GPU cloud", "Open models"],
    bestFor: ["Model serving", "Fine-tuning", "AI apps", "Research"],
    pricing: "Pay-per-use",
    access: "API, Cloud",
    description: "A cloud platform for running, fine-tuning, and serving open-source AI models.",
    url: "https://www.together.ai",
  }
];

type ChatCompletion = Groq.Chat.Completions.ChatCompletion;

async function callGroqWithRetry(
  params: Parameters<typeof groq.chat.completions.create>[0],
  maxRetries: number = 2
): Promise<ChatCompletion> {
  let attempts = 0;
  while (true) {
    try {
      return await groq.chat.completions.create(params) as ChatCompletion;
    } catch (err: any) {
      // On 429 (rate limit), wait for the retry-after window and try again.
      // This avoids failing the request when Groq is temporarily over TPM/TPR.
      if (err?.status === 429 && attempts < maxRetries) {
        attempts++;
        const retryAfter = err?.headers?.get?.('retry-after');
        const waitMs = (retryAfter && Number(retryAfter)) ? Number(retryAfter) * 1000 : 20000;
        console.log(`Groq rate limited. Retrying in ${waitMs}ms (attempt ${attempts}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      } else {
        throw err;
      }
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    // Security Check 1: Request size limit
    if (!checkRequestSize(request)) {
      return NextResponse.json(
        { error: 'Request too large' },
        { status: 413, headers: securityHeaders }
      );
    }

    // Security Check 2: Bot detection
    if (detectBot(request)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403, headers: securityHeaders }
      );
    }

    // Security Check 3: Rate limiting (in-memory, no external services)
    const clientIP = getClientIP(request);
    if (!checkRateLimit(clientIP, 10, 60000)) { // 10 requests per 60 seconds
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: securityHeaders }
      );
    }

    // Security Check 4: Input validation and sanitization
    const body = await request.json();
    const validation = validateAndSanitizeInput(body);
    
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'Invalid input' },
        { status: 400, headers: securityHeaders }
      );
    }

    const { query, category } = validation.sanitized!;

    // Create a formatted database string for the AI (kept compact to stay within
    // free-tier token limits and avoid burning TPM on every request)
    const databaseString = aiDatabase.map((ai, index) =>
      `${index + 1}. ${ai.name} (${ai.category}, ${ai.pricing}, ${ai.access}): ${ai.description}`
    ).join('\n');

    const systemPrompt = `You are an AI recommendation expert. Your task is to recommend the best AI tools from the provided database based on the user's query.

Available AI tools:
${databaseString}

Analyze the user's query and return the indices (1-${aiDatabase.length}) of the most relevant AI tools. Consider:
- The specific task they want to accomplish
- Their industry or use case
- Any constraints mentioned (budget, privacy, etc.)
- Category preferences if specified

IMPORTANT: You must return a valid JSON object with a "recommendations" key containing an array of indices.
Return up to 8 indices, ordered from most to least relevant, prioritizing the specified category when one is given.
Example format: {"recommendations": [1, 5, 3]}

Return ONLY the JSON object, nothing else.`;

    const userPrompt = `User query: "${query}"${category ? `\nCategory preference: ${category}` : ''}

Return a JSON object with a "recommendations" key containing the indices of the most relevant AI tools for this query.`;

    // Dynamically select the best available model
    const availableModels = await getAvailableChatModels();
    const selectedModel = selectBestModel(availableModels);
    
    console.log(`Using model: ${selectedModel} (available: ${availableModels.length} models)`);

    // Adjust max_tokens based on model (smaller models may have limits)
    // The response is just indices, so a small limit is plenty and saves TPM.
    const maxTokens = 150;

    const chatCompletion = await callGroqWithRetry({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: selectedModel,
      temperature: 0.5,
      max_tokens: maxTokens,
      // Don't force JSON format as it causes issues with some models
    });

    const response = chatCompletion.choices[0]?.message?.content || '[]';
    
    // Parse the response - handle both JSON objects and direct arrays
    let recommendedIndices: number[] = [];
    
    try {
      // Try to parse as JSON object first
      const parsedResponse = JSON.parse(response);
      
      if (Array.isArray(parsedResponse)) {
        // Direct array response like [3,12,1]
        recommendedIndices = parsedResponse;
      } else if (parsedResponse.recommendations && Array.isArray(parsedResponse.recommendations)) {
        // Object with recommendations key
        recommendedIndices = parsedResponse.recommendations;
      } else if (parsedResponse.indices && Array.isArray(parsedResponse.indices)) {
        // Object with indices key
        recommendedIndices = parsedResponse.indices;
      } else {
        // Try to extract array from object values
        const values = Object.values(parsedResponse);
        recommendedIndices = values.find(Array.isArray) as number[] || [];
      }
    } catch (parseError) {
      // If JSON parsing fails, try to extract array from text
      const arrayMatch = response.match(/\[(.*?)\]/);
      if (arrayMatch) {
        try {
          recommendedIndices = JSON.parse(`[${arrayMatch[1]}]`);
        } catch (e) {
          console.error('Failed to parse array from response:', response);
        }
      }
    }
    
    // Ensure we have valid indices
    recommendedIndices = recommendedIndices
      .filter((index: any) => typeof index === 'number' && !isNaN(index) && index >= 1 && index <= aiDatabase.length);
    
    // Get the actual AI models based on indices (subtract 1 since array is 0-indexed)
    const recommendations = recommendedIndices
      .map((index: number) => aiDatabase[index - 1])
      .filter((ai): ai is AIModel => ai !== undefined);

    return NextResponse.json({ recommendations }, { headers: securityHeaders });

  } catch (error) {
    console.error('Error getting AI recommendations:', error);
    
    // Security: Don't expose internal errors
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: securityHeaders }
    );
  }
}

// Add GET method handler to prevent GET requests
export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405, headers: securityHeaders }
  );
}
