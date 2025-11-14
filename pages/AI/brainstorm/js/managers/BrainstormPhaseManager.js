// ===== FILE: dealgen/js/managers/BrainstormPhaseManager.js ===== //
import { ResultsPhaseManager } from './ResultsPhaseManager.js';

export class BrainstormPhaseManager {
    constructor(sessionState, domElements, aiService, timerManager, ideasManager, uiManager) {
        this.sessionState = sessionState;
        this.domElements = domElements;
        this.aiService = aiService; // AIService instance for most AI calls
        this.timerManager = timerManager;
        this.ideasManager = ideasManager;
        this.uiManager = uiManager;

        // Direct API endpoint for the specific "more suggestions" call, if needed, or use aiService's _callApi
        this.apiEndpoint = '/api/generate';

        // Guard to prevent double-advance clicks
        this._isAdvancing = false;
    }

    /**
     * Helper to call the backend API for generating more suggestions.
     * Reuses aiService._callApi so Authorization header is included.
     */
    async _callApiForMoreSuggestions(payload) {
        console.log('BrainstormPhaseManager: Using aiService._callApi for more suggestions with payload:', JSON.stringify(payload));
        return await this.aiService._callApi(payload);
    }

    startQuestionTimer() {
        // Ensure questions are loaded
        if (
            !this.sessionState.questions ||
            this.sessionState.questions.length === 0 ||
            !this.sessionState.questions[this.sessionState.currentQuestionIndex]
        ) {
            console.error("BrainstormPhaseManager: Questions not loaded or current question index is invalid.", this.sessionState);
            this.domElements.currentTopicElement.textContent = `Error: No questions loaded for Round ${this.sessionState.round}.`;
            this.domElements.aiPromptElement.innerHTML = `<p class="question-text">Could not load the next question. Please try starting a new session.</p>`;
            return;
        }

        const currentQuestion = this.sessionState.questions[this.sessionState.currentQuestionIndex];
        this.domElements.currentTopicElement.textContent =
            `Round ${this.sessionState.round} - Question ${this.sessionState.currentQuestionIndex + 1} of ${this.sessionState.questions.length}`;

        // Typing animation while we stage the UI
        this.uiManager.showTypingAnimation();

        setTimeout(() => {
            this.domElements.aiPromptElement.innerHTML = `
                <p class="question-text">${currentQuestion.question}</p>
                <p class="question-explanation">${currentQuestion.explanation}</p>
                <div class="suggestion-pills">
                    ${(currentQuestion.suggestionPills || []).map(pill =>
                        `<button class="suggestion-pill" data-value="${pill}">${pill}</button>`
                    ).join('')}
                    <button id="generate-more-pills" class="generate-more-pills">
                        <svg viewBox="0 0 24 24" width="16" height="16"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor"/></svg>
                        More ideas
                    </button>
                </div>
            `;
            this.domElements.aiPromptElement.classList.add('active');

            this.domElements.aiPromptElement.querySelectorAll('.suggestion-pill').forEach(pill => {
                pill.addEventListener('click', (e) => {
                    const suggestionText = e.target.dataset.value;
                    this.ideasManager.addIdea(suggestionText);
                });
            });

            const moreButton = this.domElements.aiPromptElement.querySelector('#generate-more-pills');
            if (moreButton) {
                moreButton.addEventListener('click', () => this.generateMoreSuggestions(currentQuestion));
            }
        }, 1500); // Typing animation delay

        this.ideasManager.clearIdeasDisplay();
        this.domElements.ideasInput.value = '';
        this.domElements.ideasInput.focus();
        this.ideasManager.displayCurrentQuestionIdeas();

        this.sessionState.timeRemaining = this.sessionState.timePerQuestion;
        this.timerManager.startTimer();
    }

    async generateMoreSuggestions(currentQuestion) {
        const moreButton = this.domElements.aiPromptElement.querySelector('#generate-more-pills');
        if (moreButton) {
            moreButton.innerHTML = `<div class="small-spinner"></div> Generating...`;
            moreButton.disabled = true;

            try {
                await new Promise(resolve => setTimeout(resolve, 1000)); // small "thinking" delay

                const currentIdeas = currentQuestion.suggestionPills || [];
                const requestPayload = {
                    messages: [
                        {
                            role: "system",
                            content: `You're helping with a brainstorming session about "${this.sessionState.focus}".
                            The current question is: "${currentQuestion.question}"
                            Previous suggestion ideas were: ${JSON.stringify(currentIdeas)}.
                            The user wants more ideas because they didn't find these suggestions helpful enough.
                            Generate 3 NEW, more creative and thoughtful suggestion ideas for this question.
                            Each idea should be a complete sentence or phrase (about 8-15 words) that directly answers the question.
                            Be specific, insightful, and potentially unexpected in your answers.
                            Format as JSON array with just the text of each idea.`
                        },
                        {
                            role: "user",
                            content: `Generate 3 fresh, thoughtful suggestions for: "${currentQuestion.question}"`
                        }
                    ],
                    json: true // Expect the 'content' from API to be a JSON string (array of ideas)
                };

                const apiResponse = await this._callApiForMoreSuggestions(requestPayload);
                const newIdeas = JSON.parse(apiResponse.content); // Parse JSON string -> array

                const pillsContainer = this.domElements.aiPromptElement.querySelector('.suggestion-pills');
                moreButton.remove();

                const addPillWithAnimation = (idea, index) => {
                    const pill = document.createElement('button');
                    pill.className = 'suggestion-pill new-pill';
                    pill.dataset.value = idea;
                    pill.style.opacity = '0';
                    pill.style.transform = 'translateX(-5px)';
                    pillsContainer.appendChild(pill);

                    const words = idea.split(' ');
                    let displayedText = '';
                    let wordIndex = 0;

                    const animateNextWord = () => {
                        if (wordIndex < words.length) {
                            displayedText += (wordIndex > 0 ? ' ' : '') + words[wordIndex];
                            pill.textContent = displayedText;
                            wordIndex++;
                            setTimeout(animateNextWord, 100);
                        } else {
                            pill.addEventListener('click', () => {
                                this.ideasManager.addIdea(idea);
                            });
                        }
                    };

                    setTimeout(() => {
                        pill.style.transition = 'opacity 0.3s, transform 0.3s';
                        pill.style.opacity = '1';
                        pill.style.transform = 'translateX(0)';
                        animateNextWord();
                    }, index * 200);
                };

                newIdeas.forEach((idea, index) => {
                    addPillWithAnimation(idea, index);
                });

                setTimeout(() => {
                    const newMoreButton = document.createElement('button');
                    newMoreButton.id = 'generate-more-pills';
                    newMoreButton.className = 'generate-more-pills';
                    newMoreButton.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor"/></svg> More ideas`;
                    newMoreButton.style.opacity = '0';
                    newMoreButton.style.transform = 'translateX(-5px)';
                    pillsContainer.appendChild(newMoreButton);

                    setTimeout(() => {
                        newMoreButton.style.transition = 'opacity 0.3s, transform 0.3s';
                        newMoreButton.style.opacity = '1';
                        newMoreButton.style.transform = 'translateX(0)';
                        newMoreButton.addEventListener('click', () => this.generateMoreSuggestions(currentQuestion));
                    }, 100);
                }, newIdeas.length * 200 + 150);

                currentQuestion.suggestionPills = [...(currentQuestion.suggestionPills || []), ...newIdeas];

            } catch (error) {
                console.error('Error generating more suggestions:', error);
                // Restore or re-create the button
                let existingMoreButton = this.domElements.aiPromptElement.querySelector('#generate-more-pills');
                if (!existingMoreButton) {
                    const pillsContainer = this.domElements.aiPromptElement.querySelector('.suggestion-pills');
                    if (pillsContainer) {
                        existingMoreButton = document.createElement('button');
                        existingMoreButton.id = 'generate-more-pills';
                        existingMoreButton.className = 'generate-more-pills';
                        pillsContainer.appendChild(existingMoreButton);
                        existingMoreButton.addEventListener('click', () => this.generateMoreSuggestions(currentQuestion));
                    }
                }
                if (existingMoreButton) {
                    existingMoreButton.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor"/></svg> More ideas (Error)`;
                    existingMoreButton.disabled = false;
                }
                const errorDisplay = document.createElement('p');
                errorDisplay.textContent = 'Could not generate more suggestions at this time.';
                errorDisplay.style.color = 'red';
                this.domElements.aiPromptElement.appendChild(errorDisplay);
                setTimeout(() => errorDisplay.remove(), 5000);
            }
        }
    }

    async skipToNextQuestion() {
        // Prevent double clicks
        if (this._isAdvancing) return;
        this._isAdvancing = true;

        // Stop the timer immediately
        this.timerManager.stopTimer();

        // Button feedback
        const btn = this.domElements.continueSessionBtn;
        const prevHTML = btn ? btn.innerHTML : null;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<div class="small-spinner"></div> Preparing next question…';
        }

        // Immediate UI hint in the prompt area
        const prevPromptHTML = this.domElements.aiPromptElement.innerHTML;
        this.uiManager.showTypingAnimation();
        this.domElements.aiPromptElement.innerHTML =
            '<p class="muted">Preparing the next question…</p>';

        try {
            // Optional: AI review of the just-finished question
            const reviewText = await this.aiService.generateAiQuestionReview();
            if (reviewText) {
                this.domElements.aiProgressComment.innerHTML = reviewText;
            }

            // Move to next question or finish
            this.sessionState.currentQuestionIndex++;

            if (this.sessionState.currentQuestionIndex < this.sessionState.questions.length) {
                this.startQuestionTimer();
            } else {
                await this.finishSession();
            }
        } catch (err) {
            console.error('skipToNextQuestion error:', err);
            // Show a friendly error and restore previous prompt
            this.domElements.aiPromptElement.innerHTML =
                '<p class="question-text" style="color:red">Could not load the next question. Please try again.</p>';
            setTimeout(() => {
                this.domElements.aiPromptElement.innerHTML = prevPromptHTML;
            }, 3000);
        } finally {
            if (btn) {
                btn.disabled = false;
                if (prevHTML != null) btn.innerHTML = prevHTML;
            }
            this._isAdvancing = false;
        }
    }

    async finishSession() {
        this.uiManager.switchToResultsPhase();

        const resultsPhaseManager = new ResultsPhaseManager(
            this.sessionState,
            this.domElements,
            this.aiService, // AIService is passed, which uses the correct API
            this.uiManager
        );

        await resultsPhaseManager.displayResults();
    }
}
// ===== END dealgen/js/managers/BrainstormPhaseManager.js ===== //
