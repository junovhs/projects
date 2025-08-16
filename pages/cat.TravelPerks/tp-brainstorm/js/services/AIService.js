// ===== START OF FILE: pages/cat.TravelPerks/tp-brainstorm/js/services/AIService.js =====
export class AIService {
  constructor(sessionState) {
    this.sessionState = sessionState;

    // In local dev, hit your deployed API directly (bypasses any proxy weirdness).
    const isLocal =
      typeof window !== 'undefined' &&
      /^localhost(:\d+)?$/.test(window.location.hostname);
    this.apiEndpoint = isLocal
      ? 'https://lilapps.vercel.app/api/generate'
      : '/api/generate';
  }

  // --- Internal password helper (works even if /ai.js wasn't loaded) ---
  async _ensurePassword() {
    if (typeof window === 'undefined') return null;

    // Prefer shared client storage if ai.js is present
    if (window.AI && typeof window.AI.ensurePassword === 'function') {
      return await window.AI.ensurePassword();
    }

    const KEY = 'ai-pass';
    let pass = sessionStorage.getItem(KEY);
    if (!pass) {
      pass = window.prompt('Enter AI API password'); // shown once per tab
      if (!pass) throw new Error('No password provided');
      sessionStorage.setItem(KEY, pass);
    }
    return pass;
  }

  // --- Core fetch with Authorization header (always set) ---
  async _callApi(payload) {
    // If the shared client exists, use it (it also handles 401->re-prompt)
    if (typeof window !== 'undefined' && window.AI?.call) {
      return await window.AI.call(this.apiEndpoint, payload);
    }

    // Fallback: add Authorization here
    let pass = await this._ensurePassword();

    const doFetch = async () => {
      const res = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${pass}`,
        },
        body: JSON.stringify(payload),
      });
      return res;
    };

    let res = await doFetch();

    // If unauthorized, clear and prompt once more
    if (res.status === 401 && typeof window !== 'undefined') {
      sessionStorage.removeItem('ai-pass');
      pass = await this._ensurePassword();
      res = await doFetch();
    }

    if (!res.ok) {
      const raw = await res.text(); // read ONCE
      let parsed; try { parsed = JSON.parse(raw); } catch { parsed = {}; }
      const msg = parsed?.details || parsed?.error || raw || `API request failed (${res.status})`;
      throw new Error(msg);
    }

    return await res.json(); // { content: "..." }
  }

  async generateAiQuestions() {
    const contextPrompt = `
SITUATION: ${this.sessionState.contextSituation}
GOAL: ${this.sessionState.contextGoal}
CHALLENGES: ${this.sessionState.contextChallenges}
    `.trim();

    const structurePrompt = this.sessionState.round === 1
      ? `You're helping the user brainstorm with this context:
${contextPrompt}

Generate a series of ${this.sessionState.questionsPerRound} thought-provoking questions that guide their brainstorming toward the goal.
Start broad and then get more specific. Each question must relate directly to the goal and context.
For each question provide:
- "explanation" (1–2 sentences on why it matters)
- "suggestionPills": exactly 3 example answers (each 8–15 words).`
      : `You're helping refine a brainstorming session in Round ${this.sessionState.round}.
Original context:
${contextPrompt}

Based on the previous round's ideas: ${JSON.stringify(this.sessionState.getAllIdeasFromPreviousRound())}
and these pinned ideas: ${JSON.stringify(this.sessionState.pinnedIdeas)}
generate ${this.sessionState.questionsPerRound} focused follow-up questions to deepen the brainstorming.
For each, include "explanation" (1–2 sentences) and "suggestionPills": exactly 3 example answers.`;

    const formatInstructions = `Return ONLY JSON:
{
  "questions": [
    { "question": "...", "explanation": "...", "suggestionPills": ["...", "...", "..."] }
  ]
}`;

    const requestPayload = {
      messages: [
        { role: 'system', content: structurePrompt + '\n\n' + formatInstructions },
        { role: 'user', content: this.sessionState.round === 1
            ? `I want to brainstorm about ${this.sessionState.contextGoal}. I have ${this.sessionState.totalTime} minutes.`
            : `Continue Round ${this.sessionState.round} for ${this.sessionState.contextGoal}.`
        }
      ],
      json: true
    };

    const apiResponse = await this._callApi(requestPayload);
    const parsed = JSON.parse(apiResponse.content || '{}');
    const list = Array.isArray(parsed?.questions) ? parsed.questions : [];
    this.sessionState.questions = list.map(q => ({
      question: q?.question || String(q || ''),
      explanation: q?.explanation || '',
      suggestionPills: Array.isArray(q?.suggestionPills) ? q.suggestionPills : []
    }));
  }

  async generateAiQuestionReview() {
    const q = this.sessionState.questions[this.sessionState.currentQuestionIndex] || {};
    const ideas = this.sessionState.ideas?.[`q${this.sessionState.currentQuestionIndex + 1}`] || [];

    const requestPayload = {
      messages: [
        { role: 'system', content: `You're a concise brainstorm coach. Give one brief, encouraging sentence that references the question and the ideas so far.` },
        { role: 'user', content: `Question: ${q.question}\nIdeas so far: ${JSON.stringify(ideas)}` }
      ],
      json: false
    };

    const res = await this._callApi(requestPayload);
    return (res?.content || '').trim();
  }

  async generateAiAnalysis() {
    const questions = this.sessionState.questions || [];
    const ideasByQ = this.sessionState.ideas || {};
    const pinned = this.sessionState.pinnedIdeas || [];

    const requestPayload = {
      messages: [
        { role: 'system', content: `You're analyzing a brainstorm session. Provide 3–6 crisp takeaways plus 3 next-step suggestions.` },
        { role: 'user', content:
`Round: ${this.sessionState.round}
Focus: ${this.sessionState.focus}
Questions: ${JSON.stringify(questions)}
Ideas: ${JSON.stringify(ideasByQ)}
Pinned: ${JSON.stringify(pinned)}` }
      ],
      json: false
    };

    const res = await this._callApi(requestPayload);
    return (res?.content || '').trim();
  }
}
// ===== END OF FILE: pages/cat.TravelPerks/tp-brainstorm/js/services/AIService.js =====
