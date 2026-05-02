export class OllamaService {
  private static readonly OLLAMA_URL = '/api/ollama';

  /**
   * Check if the local Ollama instance is accessible and has models
   */
  static async checkAvailability(): Promise<{ available: boolean; models: string[] }> {
    try {
      const response = await fetch(`${this.OLLAMA_URL}/tags`);
      
      if (!response.ok) {
        return { available: false, models: [] };
      }
      
      const data = await response.json();
      return { 
        available: true, 
        models: data.models ? data.models.map((m: { name: string }) => m.name) : [] 
      };
    } catch (error) {
      console.warn('Ollama is not running or not accessible:', error);
      return { available: false, models: [] };
    }
  }

  /**
   * Generates a dynamic follow-up question based on the user's transcript 
   * and the original interview question.
   */
  static async generateFollowUp(
    originalQuestion: string, 
    userTranscript: string, 
    model: string = 'llama3.2'
  ): Promise<string> {
    if (!userTranscript || userTranscript.trim() === '') {
      return "Could you elaborate more on your previous point?";
    }

    const payload = {
      model: model,
      prompt: `You are an expert technical interviewer. 
The candidate was asked the following question:
"${originalQuestion}"

The candidate responded with:
"${userTranscript}"

Formulate ONE concise, direct, and slightly challenging follow-up question to probe deeper into their answer. 
Do not include any introductory text, pleasantries, or explanations. Just output the question.`,
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: 50
      }
    };

    try {
      const response = await fetch(`${this.OLLAMA_URL}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to generate from Ollama');
      }

      const data = await response.json();
      return data.response.trim();
    } catch (error) {
      console.error('Error generating follow-up with Ollama:', error);
      return this.getFallbackFollowUp();
    }
  }

  private static getFallbackFollowUp(): string {
    const followUps = [
      "Can you give me a specific example of that?",
      "How did that make you feel?",
      "What would you do differently next time?",
      "How did your team react to that?",
      "What was the specific outcome?",
      "How did you measure success in that scenario?",
      "What were the biggest challenges you faced?",
      "How long did that process take?"
    ];
    return followUps[Math.floor(Math.random() * followUps.length)];
  }
}
