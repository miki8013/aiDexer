"use client";

import { useState } from "react";

// Maximum length of the user's search query. Kept aligned with the server-side
// limit in api/recommend/route.ts so we never send a huge blob of text.
const MAX_QUERY_LENGTH = 500;

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

function getSuggestions(category: string): AIModel[] {
  if (category !== "All") {
    return aiDatabase.filter(ai => ai.category === category);
  }
  return aiDatabase; // Show all tools as candidates; displayCount controls how many are visible
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [recommendations, setRecommendations] = useState<AIModel[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [isLoading, setIsLoading] = useState(false);
  const [displayCount, setDisplayCount] = useState(4);
  const [hasSearched, setHasSearched] = useState(false);
  const [staticSuggestions, setStaticSuggestions] = useState<AIModel[]>(getSuggestions("All"));

  const categories = ["All", ...Array.from(new Set(aiDatabase.map(ai => ai.category)))];

  const getRecommendations = async (query: string) => {
    if (!query.trim()) return [];
    
    // Defensive guard: limit the amount of text sent to the API
    const limitedQuery = query.trim().slice(0, MAX_QUERY_LENGTH);
    if (!limitedQuery) return [];
    
    try {
      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: limitedQuery,
          category: selectedCategory === 'All' ? undefined : selectedCategory,
        }),
      });

      const data = await response.json();
      return data.recommendations || [];
    } catch (error) {
      console.error('Error getting recommendations:', error);
      // Fallback to basic matching
      const lowerQuery = limitedQuery.toLowerCase();
      
      return aiDatabase.filter(ai => {
        const matchesCategory = selectedCategory === "All" || ai.category === selectedCategory;
        const matchesSearch = 
          ai.name.toLowerCase().includes(lowerQuery) ||
          ai.description.toLowerCase().includes(lowerQuery) ||
          ai.strengths.some(s => s.toLowerCase().includes(lowerQuery)) ||
          ai.bestFor.some(b => b.toLowerCase().includes(lowerQuery)) ||
          ai.category.toLowerCase().includes(lowerQuery);
        
        return matchesCategory && matchesSearch;
      });
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setDisplayCount(4); // Reset display count
    // Typing a search should search across ALL tools, so clear the focused category
    setSelectedCategory("All");
    setHasSearched(true); // Mark that user has searched
    const results = await getRecommendations(searchQuery);
    setRecommendations(results);
    setIsLoading(false);
  };

  // Trigger AI search when category is clicked
  const handleCategoryClick = async (category: string) => {
    setIsLoading(true);
    setSelectedCategory(category);
    setDisplayCount(4); // Reset display count
    setHasSearched(true); // Mark that user has searched
    // Use category as the search query for AI
    const query = category === 'All' ? 'AI tools' : category;
    setSearchQuery(query); // Update the search input to show the category
    const results = await getRecommendations(query);
    setRecommendations(results);
    setIsLoading(false);
  };

  const handleLoadMore = () => {
    setDisplayCount(prev => prev + 4);
  };

  // Load more tools for the popular/category view by querying the AI
  const handleLoadMorePopular = async () => {
    setIsLoading(true);
    const query = selectedCategory === 'All' ? 'AI tools' : selectedCategory;
    setSearchQuery(query);
    const results = await getRecommendations(query);
    // Only append tools that match the active category (unless All)
    const filtered = selectedCategory === 'All'
      ? results
      : results.filter((ai: AIModel) => ai.category === selectedCategory);
    setStaticSuggestions(prev => {
      // Merge without duplicate names
      const merged = [...prev];
      for (const ai of filtered) {
        if (!merged.some(existing => existing.name === ai.name)) {
          merged.push(ai);
        }
      }
      return merged;
    });
    setDisplayCount(prev => prev + 4);
    setIsLoading(false);
  };

  // Update static suggestions when category changes (but not searching)
  const handleCategoryFilter = (category: string) => {
    setSelectedCategory(category);
    setStaticSuggestions(getSuggestions(category));
    setDisplayCount(4); // Reset how many are visible when switching category
    setHasSearched(false); // Reset search state when just filtering
  };

  return (
    <main className="min-h-screen bg-white">
      {/* Subtle light-blue ambient glows - only in the top corners, fading away */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(700px circle at 12% -5%, rgba(147,197,253,0.14), transparent 60%), radial-gradient(600px circle at 88% -8%, rgba(147,197,253,0.12), transparent 55%)",
        }}
      />
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <header className="mb-16">
          <h1 className="text-5xl font-black text-neutral-900 mb-4 tracking-tight">
            aiDexer
          </h1>
          <p className="text-xl text-neutral-600 max-w-xl">
            Find the right AI tool for what you're trying to do
          </p>
        </header>

        {/* Search Section */}
        <div className="mb-16">
          <form onSubmit={handleSearch} className="space-y-6">
            <div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value.slice(0, MAX_QUERY_LENGTH))}
                placeholder="What do you want to do? (e.g., write code, create images)"
                maxLength={MAX_QUERY_LENGTH}
                className="w-full px-0 py-4 text-2xl font-medium text-neutral-900 placeholder-neutral-400 border-0 border-b-2 border-neutral-200 focus:border-neutral-900 focus:ring-0 bg-transparent transition-colors"
              />
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-neutral-400">
                  {searchQuery.trim() ? undefined : 'Keep it short — just describe what you want to do.'}
                </span>
                <span className={
                  searchQuery.length >= MAX_QUERY_LENGTH
                    ? "text-red-600 font-medium"
                    : "text-neutral-400"
                }>
                  {searchQuery.length}/{MAX_QUERY_LENGTH}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => {
                    if (hasSearched) {
                      handleCategoryClick(category);
                    } else {
                      handleCategoryFilter(category);
                    }
                  }}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    selectedCategory === category
                      ? "bg-neutral-900 text-white"
                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="px-8 py-3 bg-neutral-900 text-white font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>

        {/* Results Section */}
        {hasSearched ? (
          // AI Results (after user search)
          recommendations.length > 0 && (
            <div className="mb-16">
              <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-6">
                {recommendations.length} result{recommendations.length !== 1 ? 's' : ''} found
              </h2>
              <div className="space-y-4">
                {recommendations.slice(0, displayCount).map((ai, index) => (
                  <div
                    key={index}
                    className="border border-neutral-200 p-6 hover:border-neutral-400 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-xl font-semibold text-neutral-900">
                        {ai.name}
                      </h3>
                      <span className="text-sm text-neutral-500">
                        {ai.category}
                      </span>
                    </div>
                    
                    <p className="text-neutral-600 mb-4">
                      {ai.description}
                    </p>

                    <div className="space-y-3">
                      <div>
                        <span className="text-xs font-semibold text-neutral-500 uppercase">Best for:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {ai.bestFor.map((item, i) => (
                            <span key={i} className="text-sm text-neutral-700">
                              {item}{i !== ai.bestFor.length - 1 && ','}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-8 text-sm">
                        <div>
                          <span className="text-neutral-500">Pricing:</span>{' '}
                          <span className="text-neutral-900">{ai.pricing}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500">Access:</span>{' '}
                          <span className="text-neutral-900">{ai.access}</span>
                        </div>
                      </div>
<a
                        href={ai.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-neutral-900 hover:bg-neutral-800 transition-colors"
                      >
                        Visit {ai.name} →
                      </a>
                    </div>
                  </div>
                ))}
              </div>

              {/* Load More Button */}
              {displayCount < recommendations.length && (
                <div className="mt-8 text-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoading}
                    className="px-8 py-3 bg-neutral-100 text-neutral-900 font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Load More
                  </button>
                </div>
              )}
            </div>
          )
        ) : (
          // Static Suggestions (before user search)
          staticSuggestions.length > 0 && (
            <div className="mb-16">
              <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-6">
                {selectedCategory === "All" ? "Popular AI Tools" : `Popular ${selectedCategory} Tools`}
              </h2>
              <div className="space-y-4">
                {staticSuggestions.slice(0, displayCount).map((ai, index) => (
                  <div
                    key={index}
                    className="border border-neutral-200 p-6 hover:border-neutral-400 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-xl font-semibold text-neutral-900">
                        {ai.name}
                      </h3>
                      <span className="text-sm text-neutral-500">
                        {ai.category}
                      </span>
                    </div>
                    
                    <p className="text-neutral-600 mb-4">
                      {ai.description}
                    </p>

                    <div className="space-y-3">
                      <div>
                        <span className="text-xs font-semibold text-neutral-500 uppercase">Best for:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {ai.bestFor.map((item, i) => (
                            <span key={i} className="text-sm text-neutral-700">
                              {item}{i !== ai.bestFor.length - 1 && ','}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-8 text-sm">
                        <div>
                          <span className="text-neutral-500">Pricing:</span>{' '}
                          <span className="text-neutral-900">{ai.pricing}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500">Access:</span>{' '}
                          <span className="text-neutral-900">{ai.access}</span>
                        </div>
                      </div>
<a
                        href={ai.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-neutral-900 hover:bg-neutral-800 transition-colors"
                      >
                        Visit {ai.name} →
                      </a>
                    </div>
                  </div>
                ))}
              </div>

              {/* Load More Button */}
              {displayCount < staticSuggestions.length && (
                <div className="mt-8 text-center">
                  <button
                    onClick={handleLoadMorePopular}
                    disabled={isLoading}
                    className="px-8 py-3 bg-neutral-100 text-neutral-900 font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </div>
          )
        )}

        </div>
    </main>
  );
}
