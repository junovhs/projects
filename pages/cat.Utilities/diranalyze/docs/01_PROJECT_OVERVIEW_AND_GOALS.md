<!--
AI UPDATE INSTRUCTIONS:
This document outlines the core vision, principles, target users, and key use cases for DirAnalyze.
To update this document:
1. Review recent feature additions or changes in project direction (e.g., from roadmap, changelog, or recent commits).
2. If new core principles emerge, add or refine them.
3. If the understanding of target users evolves, update that section.
4. Add new key use cases as new features enable them. For example, if a "code quality analysis" feature is added, a new use case for it should be described.
5. Ensure the language remains clear, concise, and motivating.
Provide the complete updated Markdown content for this file.
-->

# DirAnalyze: Project Overview and Goals

## 1. Introduction: The AI Cockpit for Code

DirAnalyze is a tiny, local-first AI cockpit designed for navigating, understanding, and refactoring large or unfamiliar codebases. It aims to bridge the gap between powerful Large Language Models (LLMs) and practical, everyday software development by providing focused context, enabling safe AI-driven modifications, and maintaining a transparent, auditable workflow.

Our core philosophy is to empower developers by making AI a seamless, secure, and efficient partner in their local development environment, without the bloat or privacy concerns of many existing solutions.

## 2. Why DirAnalyze? The Problems We Solve

Modern software development, especially with the advent of capable LLMs, presents new opportunities and challenges:

| Pain Point                               | DirAnalyze's Envisioned Solution                                     |
|------------------------------------------|----------------------------------------------------------------------|
| **IDE & Plugin Overload:** Heavyweight IDEs with numerous plugins can be slow and complex. | Aims for a minimal, fast, single binary application (target <5MB).      |
| **LLM Context Bloat:** Pasting entire repositories into LLMs is inefficient, costly, and hits token limits. | **Hierarchical Semantic Sketch (Planned):** Intelligently selects and summarizes only relevant code, drastically reducing token count while preserving context. |
| **Manual AI Workflow:** The copy-code -> prompt-LLM -> paste-code loop is tedious and error-prone. | **AI Patcher & Live Editing:** Applies AI-suggested changes (via CAPCA JSON format) directly to local files, with user review. |
| **Cloud & Privacy Concerns:** Sending proprietary code to third-party cloud services is a risk for many. | **Local-First & Offline by Default:** Operates on local files. Only your chosen LLM endpoint (which you control) sees code snippets, if and when you send them. |
| **"Black Box" AI Changes:** Difficult to track exactly what an AI modified and why. | **Deterministic Hash Log & Versioning (In Progress):** Every file read, AI prompt, LLM response, and applied diff is logged for full auditability and potential replay. Version snapshots provide a safety net. |
| **Toolchain Lock-in:** Reliance on specific cloud platforms or AI providers. | **LLM Agnostic (via Proxy):** Backend proxy can be adapted for various LLMs (OpenAI, Anthropic, Ollama planned). Runner API (planned) aims for toolchain flexibility. |

## 3. Core Design Principles

DirAnalyze is built upon the following core principles:

1.  **Own the Stack:** Every byte needed to rebuild and understand the tool's core operation should ideally live within its repository or be from universally available system components. Minimize external, opaque dependencies.
2.  **Deterministic First:** Hash everything critical – file reads, user selections, AI prompts, LLM responses, applied diffs. The goal is reproducible context generation and an auditable history of changes.
3.  **Machine-First Interface (for AI interaction):** LLMs are best when consuming and producing structured data. DirAnalyze favors JSON (like CAPCA for patches) for AI interactions, with the UI acting as a human-friendly viewer and controller.
4.  **Small Surface First:** Focus on a minimal set of core, high-impact features. Experimental or niche functionalities should be behind feature flags or developed as plugins to keep the core lean.
5.  **Offline by Default:** The core analysis and UI should function entirely offline. Network activity should be explicit and limited to user-configured LLM HTTPS endpoints or other opt-in services.
6.  **Local-First & User Control:** Your code stays on your machine. You decide what, if anything, is sent to an external AI. You have control over applying changes.
7.  **Transparency & Auditability:** Through the deterministic log and versioning system, users should be able to understand what the AI was shown and what changes it made.

## 4. Target Users

DirAnalyze is primarily designed for:

*   **Individual Developers:** Working on personal projects, exploring open-source codebases, or needing a lightweight AI assistant.
*   **Developers in Small to Medium-Sized Teams:** Where quick onboarding to existing code or AI-assisted refactoring can boost productivity.
*   **Security-Conscious Developers/Organizations:** Who prefer to keep their codebase local and have fine-grained control over what data is shared with LLMs.
*   **Developers Frustrated by Tool Bloat:** Who seek a focused, fast, and resource-efficient alternative to large IDEs for AI-assisted tasks.
*   **AI-Powered Workflow Enthusiasts:** Who want to integrate LLMs more deeply into their development loop in a structured and safe manner.

## 5. Key Use Cases & Scenarios

DirAnalyze aims to support developers in the following scenarios:

*   **Rapid Codebase Understanding:**
    *   Quickly get a structural overview of an unfamiliar project.
    *   Identify key files, dependencies (visualized or reported), and code statistics.
    *   (Planned) Use the Semantic Sketch to get summaries of packages, files, and symbols without reading all the code.
*   **AI-Assisted Refactoring and Modification:**
    *   Select relevant code sections or describe a change intent.
    *   Use the AI Debriefing Assistant to package context for an LLM.
    *   Receive structured patch instructions (CAPCA JSON) from the LLM.
    *   Review diffs for each proposed change within DirAnalyze.
    *   Apply accepted patches directly to the local file system.
*   **Safe Experimentation with AI Code Generation:**
    *   Leverage the upcoming Versioning System to snapshot the project before applying AI patches.
    *   Easily review or revert changes if the AI's suggestions are not as expected.
*   **Preparing Optimized Context for LLMs:**
    *   Move beyond manually copy-pasting files.
    *   Use the AI Debriefing Assistant for standard context packages.
    *   (Planned) Rely on the Hierarchical Semantic Sketch to automatically provide the LLM with the most relevant, token-efficient context for a given query or task.
*   **Auditing AI-Driven Changes:**
    *   (In Progress) Utilize the Deterministic Hash Log to see a record of files accessed, prompts sent to LLMs, and diffs applied.
*   **Local-First Development with LLMs:**
    *   Perform analysis and code modification tasks without requiring constant cloud connectivity or sending entire projects to third-party services.
    *   Control which LLM endpoint is used.

## 6. Long-Term Vision

The long-term vision for DirAnalyze is to be an indispensable, lightweight, and trustworthy companion for any developer looking to leverage AI in their coding workflow. This includes:

*   Becoming a standard tool for "AI-native" software development.
*   Extensible plugin architecture for custom runners, analyzers, and AI interactions.
*   Strong focus on security, privacy, and developer control.
*   Minimal resource footprint, making it accessible on any machine.
*   Fostering a community that contributes to its core and extends its capabilities.