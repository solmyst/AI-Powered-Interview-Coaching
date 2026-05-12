const r=class r{static async checkAvailability(){try{const e=await fetch(`${this.OLLAMA_URL}/tags`);if(!e.ok)return{available:!1,models:[]};const t=await e.json();return{available:!0,models:t.models?t.models.map(o=>o.name):[]}}catch(e){return console.warn("Ollama is not running or not accessible:",e),{available:!1,models:[]}}}static async generateFollowUp(e,t,o="llama3.2"){if(!t||t.trim()==="")return"Could you elaborate more on your previous point?";const n={model:o,prompt:`You are an expert technical interviewer. 
The candidate was asked the following question:
"${e}"

The candidate responded with:
"${t}"

Formulate ONE concise, direct, and slightly challenging follow-up question to probe deeper into their answer. 
Do not include any introductory text, pleasantries, or explanations. Just output the question.`,stream:!1,options:{temperature:.7,num_predict:50}};try{const a=await fetch(`${this.OLLAMA_URL}/generate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(n)});if(!a.ok)throw new Error("Failed to generate from Ollama");return(await a.json()).response.trim()}catch(a){return console.error("Error generating follow-up with Ollama:",a),this.getFallbackFollowUp()}}static async generateSessionFeedback(e,t,o){if(!t||t.length<50)return{strengths:[],improvements:[]};const n=`You are a professional hiring manager. Analyze this interview session and provide specific, personalized feedback.
Interview Type: ${e}
Transcript: "${t.substring(0,2e3)}"
Scores: Eye Contact: ${o.eyeContact}%, Clarity: ${o.speechClarity}%, Confidence: ${o.confidence}%

Output EXACTLY in this JSON format:
{
  "strengths": ["string", "string"],
  "improvements": ["string", "string"]
}
Provide 2-3 specific strengths and 2-3 actionable improvements based on the transcript and scores. Do not use generic praise. Be concise but professional.`;try{const a=await fetch(`${this.OLLAMA_URL}/generate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"llama3.2",prompt:n,stream:!1,format:"json"})});if(!a.ok)throw new Error("Ollama failed");const s=await a.json(),i=JSON.parse(s.response);return{strengths:i.strengths||[],improvements:i.improvements||[]}}catch(a){throw console.warn("AI Feedback failed, using rule-based feedback"),a}}static getFallbackFollowUp(){const e=["Can you give me a specific example of that?","How did that make you feel?","What would you do differently next time?","How did your team react to that?","What was the specific outcome?","How did you measure success in that scenario?","What were the biggest challenges you faced?","How long did that process take?"];return e[Math.floor(Math.random()*e.length)]}};r.OLLAMA_URL="/api/ollama";let l=r;export{l as OllamaService};
