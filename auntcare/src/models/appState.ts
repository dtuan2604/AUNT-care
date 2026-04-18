export type MessageRole = 'assistant' | 'user';
export type ConversationTab = 'chat' | 'report';
export type CareLevel = 'routine' | 'doctor' | 'emergency';

export type Message = {
  id: string;
  role: MessageRole;
  text: string;
};

export type ReportSection = {
  label: string;
  value: string;
};

export type TriageAssessment = {
  level: CareLevel;
  reasons: string[];
  recommendation: string;
  requiresDoctorReview: boolean;
  requiresEmergencyCare: boolean;
};

export type ReportDraft = {
  status: 'draft' | 'ready';
  updatedAt: number;
  careLevel: CareLevel;
  summary: string;
  recommendation: string;
  sections: ReportSection[];
};

export type Conversation = {
  id: string;
  title: string;
  updatedAt: number;
  messages: Message[];
  triage: TriageAssessment;
  report: ReportDraft;
};

export type AppState = {
  schemaVersion: 1;
  conversations: Conversation[];
  draftsByConversationId: Record<string, string>;
  settings: {
    modelFileUri: string;
    modelFileName: string;
  };
};

export const starterMessage =
  "Hello! I'm AUNT Care, your health assistant. Can you describe what symptoms you're experiencing?";

type ConversationSeed = {
  id: string;
  title: string;
  updatedAt: number;
  messages: Message[];
};

const symptomCatalog = [
  {
    key: 'chestPain',
    label: 'Chest pain or pressure',
    patterns: [
      'chest pain',
      'chest pressure',
      'chest tightness',
      'crushing pain',
      'squeezing pain',
      'pressure in my chest',
      'pain in my chest',
    ],
  },
  {
    key: 'breathing',
    label: 'Trouble breathing',
    patterns: [
      'shortness of breath',
      'trouble breathing',
      'difficulty breathing',
      'hard to breathe',
      "can't breathe",
      'cannot breathe',
      'breathing is hard',
      'breathless',
    ],
  },
  {
    key: 'stroke',
    label: 'Possible stroke symptoms',
    patterns: [
      'face droop',
      'slurred speech',
      'trouble speaking',
      'cannot speak',
      'numb on one side',
      'weak on one side',
      'one side is weak',
      'one side is numb',
      'sudden trouble seeing',
      'vision loss',
      'loss of balance',
      'cannot lift my arm',
      'arm weakness',
      'leg weakness',
      'sudden severe headache',
    ],
  },
  {
    key: 'abdominalPain',
    label: 'Abdominal pain',
    patterns: [
      'abdominal pain',
      'stomach pain',
      'belly pain',
      'pain in my abdomen',
      'pain in my stomach',
    ],
  },
  {
    key: 'fever',
    label: 'Fever',
    patterns: ['fever', 'temperature', 'chills'],
  },
  {
    key: 'vomiting',
    label: 'Vomiting',
    patterns: ['vomiting', 'throwing up', 'cannot keep food down'],
  },
  {
    key: 'diarrhea',
    label: 'Diarrhea',
    patterns: ['diarrhea', 'loose stool'],
  },
  {
    key: 'cough',
    label: 'Cough',
    patterns: ['cough', 'coughing'],
  },
  {
    key: 'headache',
    label: 'Headache',
    patterns: ['headache', 'migraine'],
  },
  {
    key: 'dizziness',
    label: 'Dizziness or lightheadedness',
    patterns: ['dizzy', 'dizziness', 'lightheaded', 'light headed'],
  },
  {
    key: 'nausea',
    label: 'Nausea',
    patterns: ['nausea', 'nauseous'],
  },
  {
    key: 'sweating',
    label: 'Sweating',
    patterns: ['sweating', 'clammy'],
  },
  {
    key: 'bleeding',
    label: 'Bleeding',
    patterns: [
      'bleeding',
      'coughing up blood',
      'vomiting blood',
      'blood in my vomit',
      'will not stop bleeding',
      "won't stop bleeding",
    ],
  },
  {
    key: 'confusion',
    label: 'Confusion or altered mental status',
    patterns: [
      'confused',
      'confusion',
      'disoriented',
      'unusual behavior',
      'hard to wake',
      'cannot stay awake',
    ],
  },
  {
    key: 'fainting',
    label: 'Fainting or seizure',
    patterns: [
      'passed out',
      'fainted',
      'fainting',
      'lost consciousness',
      'seizure',
      'convulsion',
    ],
  },
];

const severityPatterns = [
  'severe',
  'worst',
  'getting worse',
  'worsening',
  'very bad',
  'unbearable',
];

const emergencyChestCompanionPatterns = [
  'shortness of breath',
  'trouble breathing',
  'difficulty breathing',
  'nausea',
  'sweating',
  'clammy',
  'dizzy',
  'lightheaded',
  'jaw pain',
  'pain in my jaw',
  'arm pain',
  'left arm',
  'back pain',
];

const onsetRegexes = [
  /\b(since [^.?!,]+)/i,
  /\b(started [^.?!,]+)/i,
  /\b(began [^.?!,]+)/i,
  /\b(for \d+\s+(?:minute|minutes|hour|hours|day|days|week|weeks))/i,
  /\b(this morning|this afternoon|last night|today|yesterday)\b/i,
];

const triggerRegexes = [
  /\b(worse when [^.?!,]+)/i,
  /\b(worse with [^.?!,]+)/i,
  /\b(after [^.?!,]+)/i,
  /\b(when I [^.?!,]+)/i,
  /\b(better with [^.?!,]+)/i,
];

const fallbackRoutineQuestions = [
  'When did this start, and has it been getting better or worse?',
  'How severe does it feel right now, and what makes it better or worse?',
  'Are there any other symptoms happening at the same time?',
];

function dedupe(items: string[]) {
  return Array.from(new Set(items));
}

function normalizeText(text: string) {
  return text.toLowerCase();
}

function collectUserMessages(messages: Message[]) {
  return messages.filter(message => message.role === 'user');
}

function getCombinedUserText(messages: Message[]) {
  return collectUserMessages(messages)
    .map(message => message.text)
    .join(' ')
    .trim();
}

function hasPattern(text: string, patterns: string[]) {
  return patterns.some(pattern => text.includes(pattern));
}

function extractMatchedSymptoms(text: string) {
  return symptomCatalog
    .filter(symptom => hasPattern(text, symptom.patterns))
    .map(symptom => symptom.label);
}

function extractPatternMatch(text: string, regexes: RegExp[]) {
  for (const regex of regexes) {
    const match = text.match(regex);
    if (match?.[1]) {
      return match[1];
    }

    if (match?.[0]) {
      return match[0];
    }
  }

  return null;
}

function buildSymptomSummary(messages: Message[]) {
  const combinedText = getCombinedUserText(messages);
  const normalizedText = normalizeText(combinedText);
  const symptoms = dedupe(extractMatchedSymptoms(normalizedText));
  const onset = extractPatternMatch(combinedText, onsetRegexes);
  const triggers = extractPatternMatch(combinedText, triggerRegexes);

  return {
    combinedText,
    normalizedText,
    symptoms,
    onset,
    triggers,
  };
}

function createRoutineAssessment(hasUserMessage: boolean): TriageAssessment {
  if (!hasUserMessage) {
    return {
      level: 'routine',
      reasons: [],
      recommendation:
        'Continue the conversation so the assistant can collect symptom details.',
      requiresDoctorReview: false,
      requiresEmergencyCare: false,
    };
  }

  return {
    level: 'routine',
    reasons: [],
    recommendation:
      'Continue monitoring symptoms and answer a few follow-up questions.',
    requiresDoctorReview: false,
    requiresEmergencyCare: false,
  };
}

export function analyzeTriage(messages: Message[]): TriageAssessment {
  const userMessages = collectUserMessages(messages);
  if (userMessages.length === 0) {
    return createRoutineAssessment(false);
  }

  const { normalizedText } = buildSymptomSummary(messages);
  const reasons: string[] = [];
  let level: CareLevel = 'routine';

  const mentionsChestPain = hasPattern(normalizedText, [
    'chest pain',
    'chest pressure',
    'chest tightness',
    'crushing pain',
    'squeezing pain',
  ]);
  const mentionsBreathing = hasPattern(normalizedText, [
    'shortness of breath',
    'trouble breathing',
    'difficulty breathing',
    'hard to breathe',
    "can't breathe",
    'cannot breathe',
  ]);
  const mentionsStroke = hasPattern(normalizedText, [
    'face droop',
    'slurred speech',
    'trouble speaking',
    'cannot speak',
    'numb on one side',
    'weak on one side',
    'one side is weak',
    'one side is numb',
    'sudden trouble seeing',
    'vision loss',
    'loss of balance',
    'sudden severe headache',
  ]);
  const mentionsBleeding = hasPattern(normalizedText, [
    'bleeding',
    'coughing up blood',
    'vomiting blood',
    'blood in my vomit',
    'will not stop bleeding',
    "won't stop bleeding",
  ]);
  const mentionsConfusionOrFainting = hasPattern(normalizedText, [
    'confused',
    'confusion',
    'disoriented',
    'passed out',
    'fainted',
    'lost consciousness',
    'seizure',
    'convulsion',
    'hard to wake',
    'cannot stay awake',
  ]);
  const mentionsSevereAbdominalPain =
    hasPattern(normalizedText, [
      'abdominal pain',
      'stomach pain',
      'belly pain',
      'pain in my abdomen',
      'pain in my stomach',
    ]) && hasPattern(normalizedText, severityPatterns);

  if (mentionsStroke) {
    level = 'emergency';
    reasons.push('Possible stroke symptoms need urgent medical evaluation.');
  }

  if (mentionsBreathing) {
    level = 'emergency';
    reasons.push('Trouble breathing can require urgent medical care.');
  }

  if (
    mentionsChestPain &&
    hasPattern(normalizedText, emergencyChestCompanionPatterns)
  ) {
    level = 'emergency';
    reasons.push(
      'Chest pain with breathing trouble, nausea, sweating, dizziness, or spreading pain can be serious.',
    );
  }

  if (mentionsBleeding) {
    level = 'emergency';
    reasons.push('Bleeding that will not stop or blood in vomit or cough is an emergency warning sign.');
  }

  if (mentionsConfusionOrFainting) {
    level = 'emergency';
    reasons.push('Confusion, fainting, or seizure-like symptoms need urgent evaluation.');
  }

  if (mentionsSevereAbdominalPain) {
    level = 'emergency';
    reasons.push('Severe abdominal pain can require urgent medical care.');
  }

  if (level !== 'emergency') {
    const doctorSignals: string[] = [];

    if (mentionsChestPain) {
      doctorSignals.push('Chest pain should be reviewed by a clinician.');
    }

    if (
      hasPattern(normalizedText, ['fever']) &&
      hasPattern(normalizedText, ['3 days', '4 days', '5 days', 'week'])
    ) {
      doctorSignals.push('Fever lasting multiple days should be medically reviewed.');
    }

    if (
      hasPattern(normalizedText, ['vomiting', 'throwing up', 'diarrhea']) &&
      hasPattern(normalizedText, ['all day', 'cannot keep food down', 'dehydrated', 'dry mouth'])
    ) {
      doctorSignals.push('Persistent vomiting, diarrhea, or dehydration symptoms need clinician review.');
    }

    if (
      hasPattern(normalizedText, ['abdominal pain', 'stomach pain', 'belly pain']) &&
      hasPattern(normalizedText, ['persistent', 'getting worse', 'worsening'])
    ) {
      doctorSignals.push('Persistent or worsening abdominal pain should be reviewed promptly.');
    }

    if (
      doctorSignals.length === 0 &&
      hasPattern(normalizedText, severityPatterns)
    ) {
      doctorSignals.push('The symptom severity you described should be reviewed by a clinician.');
    }

    if (doctorSignals.length > 0) {
      level = 'doctor';
      reasons.push(...doctorSignals);
    }
  }

  if (level === 'emergency') {
    return {
      level,
      reasons: dedupe(reasons),
      recommendation:
        'Seek urgent medical care now. If symptoms are happening now, call 911 or your local emergency number.',
      requiresDoctorReview: true,
      requiresEmergencyCare: true,
    };
  }

  if (level === 'doctor') {
    return {
      level,
      reasons: dedupe(reasons),
      recommendation:
        'Arrange a clinician review soon. Use the report tab to share the symptom summary.',
      requiresDoctorReview: true,
      requiresEmergencyCare: false,
    };
  }

  return createRoutineAssessment(true);
}

function createLatestUserSummary(messages: Message[]) {
  const latestUserMessage = [...messages]
    .reverse()
    .find(message => message.role === 'user')?.text;

  return latestUserMessage ?? 'No symptom details captured yet.';
}

function createReportSections(
  messages: Message[],
  triage: TriageAssessment,
): ReportSection[] {
  const { symptoms, onset, triggers } = buildSymptomSummary(messages);
  const latestUserSummary = createLatestUserSummary(messages);
  const symptomLine =
    symptoms.length > 0 ? symptoms.join(', ') : 'No symptom pattern identified yet.';
  const escalationLine =
    triage.reasons.length > 0
      ? triage.reasons.join(' ')
      : 'No escalation signals detected at this stage.';

  return [
    {
      label: 'Primary concern',
      value: latestUserSummary,
    },
    {
      label: 'Symptoms reported',
      value: symptomLine,
    },
    {
      label: 'Onset and timing',
      value: onset ?? 'Not captured yet.',
    },
    {
      label: 'What changes the symptoms',
      value: triggers ?? 'Not captured yet.',
    },
    {
      label: 'Recommended action',
      value: triage.recommendation,
    },
    {
      label: 'Reasons for escalation',
      value: escalationLine,
    },
  ];
}

export function createReportDraft(
  messages: Message[],
  updatedAt: number,
): ReportDraft {
  const triage = analyzeTriage(messages);

  return {
    status: triage.level === 'routine' ? 'draft' : 'ready',
    updatedAt,
    careLevel: triage.level,
    summary: createLatestUserSummary(messages),
    recommendation: triage.recommendation,
    sections: createReportSections(messages, triage),
  };
}

function createRoutineReply(
  messages: Message[],
  turnIndex: number,
) {
  const { symptoms, onset, triggers } = buildSymptomSummary(messages);

  if (symptoms.length === 0) {
    return `I want to understand this better. ${fallbackRoutineQuestions[
      turnIndex % fallbackRoutineQuestions.length
    ]}`;
  }

  if (!onset) {
    return `Thanks. I noted ${symptoms.join(
      ', ',
    )}. When did this start, and has it been getting better or worse?`;
  }

  if (!triggers) {
    return `Thanks. I noted ${symptoms.join(
      ', ',
    )} ${onset}. What makes it better or worse, and how strong does it feel right now?`;
  }

  return `I noted ${symptoms.join(
    ', ',
  )} ${onset}. Are there any other symptoms happening at the same time, such as fever, nausea, weakness, or dizziness?`;
}

export function createAssistantReply(messages: Message[]) {
  const triage = analyzeTriage(messages);
  const { symptoms, onset } = buildSymptomSummary(messages);
  const userTurnCount = collectUserMessages(messages).length;
  const symptomLine =
    symptoms.length > 0 ? symptoms.join(', ') : 'the symptoms you described';

  if (triage.level === 'emergency') {
    return `Some of what you described can be serious, especially ${symptomLine}. Please seek urgent medical care now and call 911 or your local emergency number if symptoms are happening now. I prepared a report in the Report tab so a clinician can review it quickly.`;
  }

  if (triage.level === 'doctor') {
    return `Based on what you shared, I recommend getting medical care soon. I prepared a report in the Report tab that you can show a doctor. ${onset ? `I noted that this ${onset}.` : ''} If you can, tell me what makes it better or worse so the summary is more complete.`;
  }

  return createRoutineReply(messages, userTurnCount - 1);
}

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(timestamp));
}

export function buildConversation(seed: ConversationSeed): Conversation {
  const triage = analyzeTriage(seed.messages);
  const report = createReportDraft(seed.messages, seed.updatedAt);

  return {
    id: seed.id,
    title: seed.title,
    updatedAt: seed.updatedAt,
    messages: seed.messages,
    triage,
    report,
  };
}

export function runConversationTurn(
  conversation: Conversation,
  userText: string,
): Conversation {
  const conversationWithUser = appendUserMessage(conversation, userText);

  return appendAssistantMessage(
    conversationWithUser,
    createAssistantReply(conversationWithUser.messages),
  );
}

export function appendUserMessage(
  conversation: Conversation,
  userText: string,
): Conversation {
  const updatedAt = Date.now();
  const userMessage: Message = {
    id: createId('message'),
    role: 'user',
    text: userText,
  };

  return buildConversation({
    id: conversation.id,
    title: conversation.title,
    updatedAt,
    messages: [...conversation.messages, userMessage],
  });
}

export function appendAssistantMessage(
  conversation: Conversation,
  assistantText: string,
): Conversation {
  const updatedAt = Date.now();
  const assistantMessage: Message = {
    id: createId('message'),
    role: 'assistant',
    text: assistantText,
  };

  return buildConversation({
    id: conversation.id,
    title: conversation.title,
    updatedAt,
    messages: [...conversation.messages, assistantMessage],
  });
}

function createInitialConversationSeeds() {
  const now = new Date();
  const earlier = new Date(now.getTime() - 1000 * 60 * 90);

  return [
    {
      id: 'conversation-1',
      title: 'Conversation 1',
      updatedAt: now.getTime(),
      messages: [
        {
          id: 'message-1',
          role: 'assistant' as const,
          text: starterMessage,
        },
      ],
    },
    {
      id: 'conversation-2',
      title: 'Conversation 2',
      updatedAt: earlier.getTime(),
      messages: [
        {
          id: 'message-2',
          role: 'assistant' as const,
          text: 'Tell me what changed today and what feels most uncomfortable right now.',
        },
      ],
    },
  ];
}

export function createInitialAppState(): AppState {
  return {
    schemaVersion: 1,
    conversations: createInitialConversationSeeds().map(buildConversation),
    draftsByConversationId: {},
    settings: {
      modelFileUri: '',
      modelFileName: '',
    },
  };
}
