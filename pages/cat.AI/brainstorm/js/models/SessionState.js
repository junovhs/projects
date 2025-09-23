export class SessionState {
    constructor() {
        this.focus = '';
        this.contextSituation = '';
        this.contextGoal = '';
        this.contextChallenges = '';
        this.questionsPerRound = 4; 
        this.totalTime = 0;
        this.timePerQuestion = 0;

        this.questions = [];
        this.currentQuestionIndex = 0;

        this.isPaused = false;
        this.timeRemaining = 0;
        this.timerInterval = null;

        // Brainstorm data
        this.ideas = {};               // { [questionKey]: string[] }
        this.pinnedIdeas = [];         // string[]
        this.challenges = {};          // { [questionKey]: string[] }

        // AI + session
        this.conversationHistory = [];
        this.isGeneratingAiContent = false;

        // Rounds
        this.round = 1;
        this.previousRounds = [];
    }
    
    resetForNewRound() {
        // Store current round data in previous rounds (correct spread syntax)
        this.previousRounds.push({
            round: this.round,
            focus: this.focus,
            contextSituation: this.contextSituation,
            contextGoal: this.contextGoal,
            contextChallenges: this.contextChallenges,
            questions: this.questions,
            ideas: { ...this.ideas },
            challenges: { ...this.challenges }
        });
        
        // Increment round
        this.round++;
        
        // Clear current (keep pinned ideas across rounds)
        this.ideas = {};
        this.challenges = {};

        // Reset questions and index
        this.questions = [];
        this.currentQuestionIndex = 0;
    }
    
    getAllIdeasFromPreviousRound() {
        const lastRound = this.previousRounds[this.previousRounds.length - 1];
        if (!lastRound) return [];
        
        // Flatten all ideas from last round (correct spread syntax)
        const allIdeas = [];
        for (const questionKey in lastRound.ideas) {
            if (lastRound.ideas[questionKey] && lastRound.ideas[questionKey].length) {
                allIdeas.push(...lastRound.ideas[questionKey]);
            }
        }
        return allIdeas;
    }
}