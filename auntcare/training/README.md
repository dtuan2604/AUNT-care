# Training Assets

This directory is the local staging area for the medically adapted model workflow.

The phone does not fine-tune the model. Training happens on a workstation, then the finished GGUF model is copied onto the device and loaded through the hidden local-model screen in the app.

## Files

- `templates/medical-supervised-template.jsonl`
  Supervised instruction examples for conversational fine-tuning or LoRA adaptation.
- `eval/medical-eval-template.jsonl`
  Fixed regression prompts for offline evaluation before shipping a new model.

## Supervised JSONL schema

Each line must be valid JSON with:

- `instruction`: user prompt text
- `response`: target assistant reply
- `careLevel`: `routine`, `doctor`, or `emergency`
- `sources`: array of official source URLs
- `notes`: optional reviewer note

## Evaluation JSONL schema

Each line must be valid JSON with:

- `userMessage`: patient message
- `expectedCareLevel`: `routine`, `doctor`, or `emergency`
- `mustMention`: optional array of required phrases
- `mustNotMention`: optional array of phrases that should not appear
- `sources`: array of official source URLs

## Validation

Run this before training or packaging:

```sh
npm run validate:medical-data
```

The validator checks the example shape, care levels, and source list presence. It does not replace human review.
