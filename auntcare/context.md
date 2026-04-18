I’d build this as an offline-first medical assistant, but I would not make the safety decision depend only on the LLM. For something symptom-related, the safer design is:

local LLM + deterministic red-flag triage rules + structured doctor report generator

That gives you conversational UX, works without internet, and still has a predictable escalation path when symptoms look serious.

One architectural assumption up front: I recommend llama.rn as the default on-device runtime for this repo. That is an inference from the official sources: it is a React Native binding over llama.cpp, works with local GGUF models, and is a cleaner fit for shipping a custom fine-tuned model in a bare RN app. I am not picking React Native ExecuTorch as the default because its official repo currently lists iOS 17 and Android 13 minimum support, which is a tighter constraint than your current project setup.

Plan

Step 1: Build the UI shell to match the screenshots
What I’ll do: replace the React Native starter screen with a real app shell: home screen, recent conversations list, “New Conversation” CTA, conversation screen, Chat / Report segmented tabs, message bubbles, and bottom input bar. I’ll keep it visually close to your screenshots and tighten spacing, keyboard behavior, and empty states.
Why: this locks the product shape first, before we spend time on storage or AI plumbing.
What you can test: launch on iOS and Android, navigate between home and conversation, open tabs, type into the composer. No AI yet, but the UI will feel like the app.

Step 2: Add local persistence for conversations and reports
What I’ll do: define app data models and store them fully on-device using a local storage layer (MMKV for fast key/value storage, with a clean repository wrapper). I’ll persist conversations, timestamps, current draft, and generated report data.
Why: “no internet access” means local data handling is not optional. I want the UI from Step 1 to survive app restarts before introducing intelligence.
What you can test: create conversations, reopen the app, confirm recent items and message history are still there.

Step 3: Add the conversation engine and safety rules with a mocked AI adapter
What I’ll do: create the app’s orchestration layer: message flow, assistant turn generation, serious-symptom detection, escalation banner, and structured report drafting. At this step the “AI” response will come from a local stub adapter, not the real LLM yet.
Why: this separates product logic from inference. It lets us validate the serious-symptom workflow before touching native model runtime.
What you can test: type sample symptoms, see conversational replies, trigger “please see a doctor” behavior on red-flag inputs, and watch the Report tab populate.

Step 4: Integrate the real local LLM runtime
What I’ll do: wire in llama.rn, stream tokens into the chat UI, load a bundled or sideloaded GGUF model, and add loading/error states. I’ll keep the AI behind an adapter so the rest of the app stays stable.
Why: native inference is the highest-risk integration point. By this stage the UI, storage, and safety flow are already proven.
What you can test: real on-device responses with airplane mode on. From this step onward, I’ll want at least one real iPhone and one real Android device for meaningful testing.

Step 5: Add the medically adapted model pipeline
What I’ll do: set up the model preparation workflow outside the mobile app: curated medical dataset, prompt formatting, fine-tuning/export path, quantization, offline evaluation set, and a model packaging strategy for mobile.
Why: “fine-tuned with medical data” is a separate ML pipeline, not just an app feature. Also, I would not promise “correct answers”; I would target medically grounded behavior plus explicit escalation rules.
What you can test: swap the mock/general model for the medically adapted model and compare answers on a fixed symptom test set.

Step 6: Make the doctor report genuinely useful
What I’ll do: turn the report into a structured handoff artifact: symptom summary, onset/duration, severity, relevant risk factors, escalation reason, recent conversation summary, and suggested questions for the doctor. Then add local export/share as plain text and PDF.
Why: the escalation path only works if the output is readable and actionable for a clinician.
What you can test: generate a report from a serious conversation and preview/export it locally without network access.

Step 7: Hardening, safety copy, and device QA
What I’ll do: memory guards, model-load fallback states, slow-device UX, crash handling, offline-only verification, privacy messaging, and platform-specific QA on iOS and Android.
Why: local LLM apps fail more often on resource limits than on UI logic. This phase makes it usable outside the simulator.
What you can test: repeated app launches, cold starts, long chats, low-memory behavior, and offline-only operation.

How you’ll validate after each step

From Step 1 onward, the app stays runnable with:

npm start
npm run ios
npm run android
The difference is what becomes “real” at each phase:
UI first, then persistence, then workflow, then inference, then medical model quality, then export, then hardening.

Important implementation choices

Offline-first means no remote API calls, no cloud chat backend, and no dependence on internet for normal app use.
Serious symptom escalation should come from explicit rules plus LLM reasoning, not LLM reasoning alone.
I would keep the UI almost identical to your screenshots for Step 1.
I would design the model layer so we can ship a small bundled starter model and optionally support a larger sideloaded model later.
Sources I used for the runtime choice

llama.rn official repo: https://github.com/mybigday/llama.rn
llama.cpp wiki / GGUF ecosystem: https://github.com/ggml-org/llama.cpp/wiki
react-native-mmkv official repo: https://github.com/mrousavy/react-native-mmkv
React Navigation native stack docs: https://reactnavigation.org/docs/native-stack-navigator
React Native ExecuTorch docs: https://docs.swmansion.com/react-native-executorch/docs/fundamentals/getting-started
React Native ExecuTorch repo: https://github.com/software-mansion/react-native-executorch
Approve Step 1 and I’ll build the UI shell first, then stop for your review before moving to Step 2.