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
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Configure your AI providers and application preferences.</p>
      </div>

      <div className="space-y-6">
        {/* AI Provider Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Cpu className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">AI Engine Configuration</h2>
                <p className="text-sm text-gray-500">Choose between local or cloud-based AI for interview intelligence.</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Provider Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">AI Provider</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => handleProviderSwitch('ollama')}
                  className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                    config.provider === 'ollama'
                      ? 'border-blue-600 bg-blue-50/30'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900">Ollama (Local)</span>
                    {config.provider === 'ollama' && <CheckCircle2 className="w-5 h-5 text-blue-600" />}
                  </div>
                  <p className="text-xs text-gray-500 mb-2">Privacy-first. Runs entirely on your machine. Requires Ollama installed.</p>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                    <Shield className="w-3 h-3" />
                    Offline Capable
                  </div>
                </button>

                <button
                  onClick={() => handleProviderSwitch('openai')}
                  className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                    config.provider === 'openai'
                      ? 'border-blue-600 bg-blue-50/30'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900">OpenAI (Cloud)</span>
                    {config.provider === 'openai' && <CheckCircle2 className="w-5 h-5 text-blue-600" />}
                  </div>
                  <p className="text-xs text-gray-500 mb-2">Highest quality responses. Requires an active internet connection and API key.</p>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-purple-600 uppercase tracking-wider">
                    <Cpu className="w-3 h-3" />
                    GPT-4 Support
                  </div>
                </button>
              </div>
            </div>

            {/* Provider-specific Settings */}
            <div className="pt-4 border-t border-gray-100">
              {config.provider === 'openai' ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      OpenAI API Key
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Key className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="password"
                        value={config.apiKey}
                        onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                        className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                        placeholder="sk-..."
                      />
                    </div>
                    <p className="mt-2 text-xs text-gray-500 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5" />
                      Your key is stored locally in your browser and never sent to our servers.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Model
                    </label>
                    <select
                      value={config.model}
                      onChange={(e) => setConfig({ ...config, model: e.target.value })}
                      className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
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
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Get your API key from OpenAI dashboard
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">
                        Ollama Model Name
                      </label>
                      <button 
                        onClick={fetchOllamaModels}
                        className="text-[10px] font-bold text-blue-600 uppercase tracking-tight hover:text-blue-700 transition-colors"
                      >
                        {isCheckingOllama ? 'Fetching...' : 'Refresh Models'}
                      </button>
                    </div>
                    
                    {availableOllamaModels.length > 0 ? (
                      <select
                        value={config.model}
                        onChange={(e) => setConfig({ ...config, model: e.target.value })}
                        className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm mb-2"
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
                        className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm mb-2"
                        placeholder="llama3.2"
                      />
                    )}
                    
                    <p className="mt-2 text-xs text-gray-500">
                      Make sure you have run `ollama pull {config.model}` on your machine.
                    </p>
                  </div>
                  
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                      <div>
                        <h4 className="text-sm font-semibold text-amber-900">Local Requirement</h4>
                        <p className="text-xs text-amber-700 mt-1 leading-relaxed">
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

          <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all ${
                showSuccess 
                  ? 'bg-green-600 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30'
              } disabled:opacity-50`}
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : showSuccess ? (
                <><CheckCircle2 className="w-5 h-5" /> Saved!</>
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
