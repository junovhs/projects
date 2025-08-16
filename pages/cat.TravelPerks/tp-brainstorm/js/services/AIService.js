// Call /api/generate; in dev, vite proxies to https://lilapps.vercel.app
export class AIService {
  constructor(sessionState) {
    this.sessionState = sessionState;
    this.apiEndpoint = '/api/generate';
  }

  // Prefer shared client that injects Authorization (public/ai.js)
  async _callApi(payload) {
    if (typeof window !== 'undefined' && window.AI?.call) {
      return await window.AI.call(this.apiEndpoint, payload);
    }

    const res = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const raw = await res.text();             // read ONCE
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
