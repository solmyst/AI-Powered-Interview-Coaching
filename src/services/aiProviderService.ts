
export type AIProvider = 'ollama' | 'openai';

export interface AIConfig {
  provider: AIProvider;
  apiKey?: string;
  model: string;
}

class AIProviderService {
  private static readonly STORAGE_KEY = 'interview_ace_ai_config';

  static getConfig(): AIConfig {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fallback to default
      }
    }
    return {
      provider: 'ollama',
      model: 'llama3.2'
    };
  }

  static saveConfig(config: AIConfig): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
  }

  static async generateFollowUp(originalQuestion: string, userTranscript: string): Promise<string> {
    const config = this.getConfig();

    if (config.provider === 'openai' && config.apiKey) {
      return this.generateOpenAIFollowUp(originalQuestion, userTranscript, config.apiKey, config.model);
    } else {
      // Use Ollama (proxy via Vite)
      try {
        const { OllamaService } = await import('./ollamaService');
        return await OllamaService.generateFollowUp(originalQuestion, userTranscript, config.model);
      } catch (error) {
        console.error('Ollama follow-up failed:', error);
        throw error;
      }
    }
  }

  static async generateFeedback(type: string, transcript: string, scores: any): Promise<{ strengths: string[]; improvements: string[] }> {
    const config = this.getConfig();

    if (config.provider === 'openai' && config.apiKey) {
      return this.generateOpenAIFeedback(type, transcript, scores, config.apiKey, config.model);
    } else {
      const { OllamaService } = await import('./ollamaService');
      return await OllamaService.generateSessionFeedback(type, transcript, scores);
    }
  }

  private static async generateOpenAIFollowUp(
    originalQuestion: string, 
    userTranscript: string, 
    apiKey: string,
    model: string = 'gpt-3.5-turbo'
  ): Promise<string> {
    const prompt = `You are an expert technical interviewer. 
The candidate was asked: "${originalQuestion}"
The candidate responded: "${userTranscript}"
Formulate ONE concise, direct follow-up question. Just output the question.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model === 'llama3.2' ? 'gpt-3.5-turbo' : model, // Map default to GPT if needed
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 100
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  }

  private static async generateOpenAIFeedback(
    type: string,
    transcript: string,
    scores: any,
    apiKey: string,
    model: string = 'gpt-3.5-turbo'
  ): Promise<{ strengths: string[]; improvements: string[] }> {
    const prompt = `You are a professional hiring manager. Analyze this interview and provide feedback.
Type: ${type}
Transcript: "${transcript.substring(0, 2000)}"
Scores: Eye Contact: ${scores.eyeContact}%, Clarity: ${scores.speechClarity}%, Confidence: ${scores.confidence}%

Output EXACTLY in this JSON format:
{
  "strengths": ["string", "string"],
  "improvements": ["string", "string"]
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model === 'llama3.2' ? 'gpt-3.5-turbo' : model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    return {
      strengths: result.strengths || [],
      improvements: result.improvements || []
    };
  }
}

export { AIProviderService };
