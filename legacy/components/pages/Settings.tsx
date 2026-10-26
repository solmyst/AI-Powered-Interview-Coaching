import { useState, useEffect } from 'react';
import { 
  Key, 
  Cpu, 
  Save, 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink,
  Shield,
  Info
} from 'lucide-react';
import { AIProviderService, AIConfig, AIProvider } from '../../services/aiProviderService';

export function Settings() {
  const [config, setConfig] = useState<AIConfig>({
    provider: 'ollama',
    model: 'llama3.2',
    apiKey: ''
  });
  const [availableOllamaModels, setAvailableOllamaModels] = useState<string[]>([]);
  const [isCheckingOllama, setIsCheckingOllama] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const savedConfig = AIProviderService.getConfig();
    setConfig(savedConfig);
    
    if (savedConfig.provider === 'ollama') {
      fetchOllamaModels();
    }
  }, []);

  const fetchOllamaModels = async () => {
    setIsCheckingOllama(true);
    try {
      const { OllamaService } = await import('../../services/ollamaService');
      const status = await OllamaService.checkAvailability();
      if (status.available) {
        setAvailableOllamaModels(status.models);
      }
    } catch (error) {
      console.error('Failed to fetch Ollama models:', error);
    } finally {
      setIsCheckingOllama(false);
    }
  };

  const handleProviderSwitch = (provider: AIProvider) => {
    setConfig({ ...config, provider });
    if (provider === 'ollama' && availableOllamaModels.length === 0) {
      fetchOllamaModels();
    }
  };

  const handleSave = () => {
    setIsSaving(true);
    AIProviderService.saveConfig(config);
    setTimeout(() => {
      setIsSaving(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }, 800);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 text-left font-sans text-ash">
      <div className="mb-10">
        <h1 className="text-4xl font-bold font-serif text-void mb-2 tracking-tight">Settings</h1>
        <p className="text-ash/90 text-md">Configure your AI providers and application preferences.</p>
      </div>

      <div className="space-y-6">
        {/* AI Provider Section */}
        <div className="bg-vellum/35 backdrop-blur-sm rounded-3xl border border-mist/20 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-mist/25 bg-vellum/45">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-clay/10 border border-clay/15 rounded-xl flex items-center justify-center">
                <Cpu className="w-6 h-6 text-clay" />
              </div>
              <div>
                <h2 className="text-xl font-bold font-serif text-void">AI Engine Configuration</h2>
                <p className="text-sm text-ash/80">Choose between local or cloud-based AI for interview intelligence.</p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Provider Selection */}
            <div>
              <label className="block text-sm font-bold text-void mb-3">AI Provider</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => handleProviderSwitch('ollama')}
                  className={`relative p-5 rounded-2xl border-2 text-left transition-all duration-300 ${
                    config.provider === 'ollama'
                      ? 'border-clay bg-clay/5 shadow-sm'
                      : 'border-mist/20 bg-vellum/10 hover:border-clay/40 hover:bg-vellum/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-void">Ollama (Local)</span>
                    {config.provider === 'ollama' && <CheckCircle2 className="w-5 h-5 text-clay" />}
                  </div>
                  <p className="text-xs text-ash/90 mb-4 leading-relaxed">Privacy-first. Runs entirely on your machine. Requires Ollama installed.</p>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-clay uppercase tracking-wider">
                    <Shield className="w-3.5 h-3.5" />
                    Offline Capable
                  </div>
                </button>

                <button
                  onClick={() => handleProviderSwitch('openai')}
                  className={`relative p-5 rounded-2xl border-2 text-left transition-all duration-300 ${
                    config.provider === 'openai'
                      ? 'border-clay bg-clay/5 shadow-sm'
                      : 'border-mist/20 bg-vellum/10 hover:border-clay/40 hover:bg-vellum/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-void">OpenAI (Cloud)</span>
                    {config.provider === 'openai' && <CheckCircle2 className="w-5 h-5 text-clay" />}
                  </div>
                  <p className="text-xs text-ash/90 mb-4 leading-relaxed">Highest quality responses. Requires an active internet connection and API key.</p>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-clay uppercase tracking-wider">
                    <Cpu className="w-3.5 h-3.5" />
                    GPT-4 Support
                  </div>
                </button>
              </div>
            </div>

            {/* Provider-specific Settings */}
            <div className="pt-6 border-t border-mist/20">
              {config.provider === 'openai' ? (
                <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div>
                    <label className="block text-sm font-bold text-void mb-1.5">
                      OpenAI API Key
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Key className="h-4 w-4 text-mist" />
                      </div>
                      <input
                        type="password"
                        value={config.apiKey}
                        onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                        className="block w-full pl-10 pr-3.5 py-3 border border-mist/25 bg-vellum/10 focus:ring-2 focus:ring-clay/35 focus:border-clay text-sm rounded-xl text-void"
                        placeholder="sk-..."
                      />
                    </div>
                    <p className="mt-2 text-xs text-mist font-semibold flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-clay" />
                      Your key is stored locally in your browser and never sent to our servers.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-void mb-1.5">
                      Model
                    </label>
                    <select
                      value={config.model}
                      onChange={(e) => setConfig({ ...config, model: e.target.value })}
                      className="block w-full px-3.5 py-3 border border-mist/25 bg-vellum/10 focus:ring-2 focus:ring-clay/35 focus:border-clay text-sm rounded-xl text-void font-medium"
                    >
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Fast & Balanced)</option>
                      <option value="gpt-4-turbo">GPT-4 Turbo (Smartest)</option>
                      <option value="gpt-4o">GPT-4o (Omni - Recommended)</option>
                    </select>
                  </div>

                  <a 
                    href="https://platform.openai.com/api-keys" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-clay hover:text-clay/80 font-bold border-b border-transparent hover:border-clay transition-all mt-1"
                  >
                    <span>Get your API key from OpenAI dashboard</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-bold text-void">
                        Ollama Model Name
                      </label>
                      <button 
                        onClick={fetchOllamaModels}
                        className="text-[10px] font-bold text-clay uppercase tracking-wider hover:text-clay/80 transition-colors"
                      >
                        {isCheckingOllama ? 'Fetching...' : 'Refresh Models'}
                      </button>
                    </div>
                    
                    {availableOllamaModels.length > 0 ? (
                      <select
                        value={config.model}
                        onChange={(e) => setConfig({ ...config, model: e.target.value })}
                        className="block w-full px-3.5 py-3 border border-mist/25 bg-vellum/10 focus:ring-2 focus:ring-clay/35 focus:border-clay text-sm rounded-xl text-void font-medium mb-2"
                      >
                        {availableOllamaModels.map(model => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={config.model}
                        onChange={(e) => setConfig({ ...config, model: e.target.value })}
                        className="block w-full px-3.5 py-3 border border-mist/25 bg-vellum/10 focus:ring-2 focus:ring-clay/35 focus:border-clay text-sm rounded-xl text-void mb-2"
                        placeholder="llama3.2"
                      />
                    )}
                    
                    <p className="mt-2 text-xs text-mist font-semibold">
                      Make sure you have run <code className="bg-vellum/60 px-1.5 py-0.5 rounded font-mono text-void text-[11px]">ollama pull {config.model}</code> on your machine.
                    </p>
                  </div>
                  
                  <div className="p-5 bg-clay/5 border border-clay/15 rounded-2xl">
                    <div className="flex gap-3">
                      <AlertCircle className="w-5 h-5 text-clay shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-bold font-serif text-void">Local Requirement</h4>
                        <p className="text-xs text-ash mt-1 leading-relaxed">
                          Ollama must be running on your local machine with CORS enabled. 
                          If you are using the deployed version, cloud providers like OpenAI are recommended for a seamless experience.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 bg-vellum/45 border-t border-mist/20 flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold transition-all duration-300 ${
                showSuccess 
                  ? 'bg-clay/20 text-clay border border-clay/25'
                  : 'bg-clay text-parchment hover:bg-clay/90 hover:scale-105 active:scale-95 shadow-md shadow-clay/10'
              } disabled:opacity-50 text-sm`}
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-parchment/30 border-t-parchment rounded-full animate-spin" />
              ) : showSuccess ? (
                <><CheckCircle2 className="w-5 h-5 text-clay" /> Saved!</>
              ) : (
                <><Save className="w-5 h-5" /> Save Configuration</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
