# Medical Model Pipeline

This app is offline-first at runtime, but the medical model preparation happens off-device.

The safe architecture is:

`local model + deterministic escalation rules + doctor report generator`

The model can improve conversational quality and coverage. The hard stop for serious symptoms should remain rule-based so the app does not rely on probabilistic generation for escalation.

## Official source set

Use primary public sources for the starting corpus and cite them in the training data:

1. MedlinePlus Health Topics and XML feeds
   - Health topics directory: https://medlineplus.gov/healthtopics.html
   - XML downloads: https://medlineplus.gov/xml.html
   - XML tag reference: https://medlineplus.gov/xmldescription.html
2. DailyMed for drug labeling and medication safety context
   - About DailyMed: https://dailymed.nlm.nih.gov/dailymed/about-dailymed.cfm
   - Application support and web services: https://dailymed.nlm.nih.gov/dailymed/app-support.cfm
3. Official escalation guidance used by the app rules
   - CDC stroke signs: https://www.cdc.gov/stroke/signs-symptoms/index.html
   - MedlinePlus chest pain: https://medlineplus.gov/chestpain.html
   - MedlinePlus breathing difficulty: https://medlineplus.gov/ency/article/003075.htm
   - MedlinePlus emergency warning signs: https://medlineplus.gov/ency/article/001927.htm

## Working layout

- `training/raw/`
  Raw downloads from official sources on a workstation.
- `training/curated/`
  Cleaned and de-duplicated source passages with source attribution.
- `training/templates/`
  Instruction and response pairs for supervised fine-tuning.
- `training/eval/`
  Fixed regression prompts for offline evaluation.

## Recommended workflow

1. Download the official source material on a workstation.
2. Normalize the material into small fact units with explicit source URLs.
3. Convert curated facts into instruction examples:
   - routine symptom follow-up
   - doctor-review escalation
   - emergency escalation
   - medication guidance that stays close to labeling
4. Review the examples with a clinician or a medically trained reviewer.
5. Fine-tune or adapt a base model with LoRA on the workstation.
6. Run the fixed evaluation set and compare:
   - expected care level
   - dangerous omissions
   - over-escalation rate
   - source-grounded answer quality
7. Merge and quantize the approved model to GGUF.
8. Copy the GGUF file onto the device and import it from the hidden Local Model screen.

## Output contract for the model

The assistant should be trained to:

- stay brief and conversational
- avoid final diagnostic certainty
- ask at most one follow-up question for routine cases
- recommend clinician review for concerning cases
- direct the user to emergency care for red-flag cases
- defer to the app's structured report flow when escalation happens

The assistant should not be trained to:

- give definitive diagnoses
- minimize chest pain, breathing difficulty, stroke symptoms, or altered mental status
- contradict the deterministic escalation rules

## Packaging for the app

The app runtime expects a local `file://...gguf` URI.

Current import path:

1. Long-press the brand row or footer on the home screen.
2. Open the hidden `Local Model` screen.
3. Choose a GGUF file or paste a `file://` path.
4. Load the model locally.

## Release gate before shipping a new model

- `npm run validate:medical-data`
- Run the full app test suite
- Evaluate the model on the fixed regression set
- Review dangerous failures manually
- Recheck that emergency prompts still escalate even if the model is unloaded or fails
