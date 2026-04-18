import {
  analyzeTriage,
  buildConversation,
  createAssistantReply,
  starterMessage,
} from '../src/models/appState';

describe('conversation workflow', () => {
  test('flags stroke-like symptoms as an emergency', () => {
    const assessment = analyzeTriage([
      {
        id: 'assistant-1',
        role: 'assistant',
        text: starterMessage,
      },
      {
        id: 'user-1',
        role: 'user',
        text: 'My face feels numb on one side and my speech is slurred.',
      },
    ]);

    expect(assessment.level).toBe('emergency');
    expect(assessment.requiresEmergencyCare).toBe(true);
    expect(assessment.reasons.join(' ')).toContain('stroke');
  });

  test('flags chest pain as doctor review and reflects it in the report', () => {
    const conversation = buildConversation({
      id: 'conversation-1',
      title: 'Conversation 1',
      updatedAt: 1,
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          text: starterMessage,
        },
        {
          id: 'user-1',
          role: 'user',
          text: 'I have had chest pain since this morning.',
        },
      ],
    });

    expect(conversation.triage.level).toBe('doctor');
    expect(conversation.report.careLevel).toBe('doctor');
    expect(conversation.report.status).toBe('ready');
    expect(conversation.report.recommendation).toContain('clinician');
  });

  test('creates an escalation reply when symptoms are serious', () => {
    const reply = createAssistantReply([
      {
        id: 'assistant-1',
        role: 'assistant',
        text: starterMessage,
      },
      {
        id: 'user-1',
        role: 'user',
        text: 'I have chest pain and shortness of breath and I feel dizzy.',
      },
    ]);

    expect(reply).toContain('urgent medical care');
    expect(reply).toContain('Report tab');
  });
});
