import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  BUNDLED_MODEL_ASSET_NAME,
  generateLocalAssistantReply,
  getLocalModelSnapshot,
  loadBundledModelAsset,
  loadLocalModel,
  unloadLocalModel,
} from './ai/localLlmRuntime';
import type { LocalModelSnapshot } from './ai/localLlmRuntime';
import { deriveModelFileName, pickLocalModelFile } from './ai/modelImport';
import type {
  AppState,
  CareLevel,
  Conversation,
  ConversationTab,
} from './models/appState';
import {
  appendAssistantMessage,
  appendUserMessage,
  buildConversation,
  createAssistantReply,
  createId,
  formatDate,
  starterMessage,
} from './models/appState';
import { loadAppState, saveAppState } from './storage/appStore';

type ScreenState =
  | {
      name: 'home';
    }
  | {
      name: 'model-tools';
    }
  | {
      name: 'conversation';
      conversationId: string;
    };

type ModelStatus = 'rules' | 'loading' | 'ready' | 'error';

type ModelUiState = {
  status: ModelStatus;
  message: string;
  progress: number;
  snapshot: LocalModelSnapshot;
};

type GenerationState = {
  conversationId: string;
  isGenerating: boolean;
  partialText: string;
};

type HomeScreenProps = {
  conversations: Conversation[];
  onCreateConversation: () => void;
  onOpenModelTools: () => void;
  onOpenConversation: (conversationId: string) => void;
};

function HomeScreen({
  conversations,
  onCreateConversation,
  onOpenModelTools,
  onOpenConversation,
}: HomeScreenProps) {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.homeTopSection}>
        <Pressable
          delayLongPress={600}
          onLongPress={onOpenModelTools}
          style={styles.brandRow}>
          <View style={styles.brandIcon}>
            <Text style={styles.brandIconText}>♥</Text>
          </View>
          <View>
            <Text style={styles.brandTitle}>AUNT Care</Text>
            <Text style={styles.brandSubtitle}>Health Assistant</Text>
          </View>
        </Pressable>

        <Pressable onPress={onCreateConversation} style={styles.primaryButton}>
          <Text style={styles.primaryButtonIcon}>+</Text>
          <Text style={styles.primaryButtonText}>New Conversation</Text>
        </Pressable>

        <Text style={styles.sectionLabel}>RECENT</Text>

        <View style={styles.recentCard}>
          {conversations.map((conversation, index) => (
            <Pressable
              key={conversation.id}
              onPress={() => onOpenConversation(conversation.id)}
              style={[
                styles.recentRow,
                index < conversations.length - 1 && styles.recentRowDivider,
              ]}>
              <View style={styles.recentTextBlock}>
                <Text style={styles.recentTitle}>{conversation.title}</Text>
                <Text style={styles.recentDate}>
                  {formatDate(conversation.updatedAt)}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.homeBodyFill} />

      <View style={styles.homeFooter}>
        <Pressable delayLongPress={600} onLongPress={onOpenModelTools}>
          <Text style={styles.homeFooterText}>All data stored locally on device</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

type ModelToolsScreenProps = {
  modelFileName: string;
  modelFileUri: string;
  modelState: ModelUiState;
  onBack: () => void;
  onChangeModelFileUri: (value: string) => void;
  onPickModelFile: () => Promise<void> | void;
  onLoadModel: () => Promise<void> | void;
  onUnloadModel: () => Promise<void> | void;
};

function ModelToolsScreen({
  modelFileName,
  modelFileUri,
  modelState,
  onBack,
  onChangeModelFileUri,
  onPickModelFile,
  onLoadModel,
  onUnloadModel,
}: ModelToolsScreenProps) {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.modelToolsHeader}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹</Text>
        </Pressable>
        <Text style={styles.modelToolsHeaderTitle}>Local Model</Text>
        <View style={styles.headerAccessorySpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.modelToolsBody}
        keyboardShouldPersistTaps="handled"
        style={styles.homeBodyFill}>
        <View style={styles.modelCard}>
          <View style={styles.modelHeaderRow}>
            <View style={styles.modelHeaderCopy}>
              <Text style={styles.modelTitle}>Offline GGUF Runtime</Text>
              <Text style={styles.modelSubtitle}>
                Load a local `file://` GGUF model already stored on the device.
              </Text>
            </View>

            <View
              style={[
                styles.modelStatusPill,
                getModelStatusPillStyle(modelState.status),
              ]}>
              <Text
                style={[
                  styles.modelStatusText,
                  getModelStatusTextStyle(modelState.status),
                ]}>
                {getModelStatusLabel(modelState.status)}
              </Text>
            </View>
          </View>

          <Text style={styles.modelMessage}>{modelState.message}</Text>

          {modelState.status === 'loading' ? (
            <Text style={styles.modelProgressText}>
              Loading locally... {Math.round(modelState.progress)}%
            </Text>
          ) : null}

          <Pressable onPress={onPickModelFile} style={styles.modelImportButton}>
            <Text style={styles.modelImportButtonText}>Choose GGUF File</Text>
          </Pressable>

          <Text style={styles.modelImportHint}>
            Or paste a local `file://` URI below.
          </Text>

          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={onChangeModelFileUri}
            placeholder="file:///.../auntcare-medical.gguf"
            placeholderTextColor="#9aa1b4"
            style={styles.modelInput}
            value={modelFileUri}
          />

          <View style={styles.modelActionsRow}>
            <Pressable
              disabled={
                modelState.status === 'loading' || modelFileUri.trim().length === 0
              }
              onPress={onLoadModel}
              style={[
                styles.modelActionButton,
                styles.modelActionPrimary,
                (modelState.status === 'loading' ||
                  modelFileUri.trim().length === 0) &&
                  styles.modelActionDisabled,
              ]}>
              <Text style={styles.modelActionPrimaryText}>Load Model</Text>
            </Pressable>

            <Pressable
              disabled={
                modelState.status === 'loading' || !modelState.snapshot.isLoaded
              }
              onPress={onUnloadModel}
              style={[
                styles.modelActionButton,
                styles.modelActionSecondary,
                (modelState.status === 'loading' ||
                  !modelState.snapshot.isLoaded) &&
                  styles.modelActionDisabled,
              ]}>
              <Text style={styles.modelActionSecondaryText}>Unload</Text>
            </Pressable>
          </View>

          <View style={styles.modelMetaBlock}>
            <Text style={styles.modelMetaLabel}>Loaded runtime</Text>
            <Text style={styles.modelMetaValue}>
              {modelState.snapshot.isLoaded
                ? modelState.snapshot.modelLabel
                : 'Rules mode only'}
            </Text>
          </View>

          {modelFileName.trim() ? (
            <View style={styles.modelMetaBlock}>
              <Text style={styles.modelMetaLabel}>Selected file</Text>
              <Text style={styles.modelMetaValue}>{modelFileName.trim()}</Text>
            </View>
          ) : null}

          {modelState.snapshot.isLoaded ? (
            <View style={styles.modelMetaBlock}>
              <Text style={styles.modelMetaLabel}>Loaded path</Text>
              <Text style={styles.modelMetaValue}>
                {modelState.snapshot.modelUri}
              </Text>
            </View>
          ) : modelFileUri.trim() ? (
            <View style={styles.modelMetaBlock}>
              <Text style={styles.modelMetaLabel}>Saved path</Text>
              <Text style={styles.modelMetaValue}>{modelFileUri.trim()}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type ConversationScreenProps = {
  activeTab: ConversationTab;
  conversation: Conversation;
  draft: string;
  generationText: string;
  isGenerating: boolean;
  onBack: () => void;
  onChangeDraft: (value: string) => void;
  onSelectTab: (tab: ConversationTab) => void;
  onSendMessage: () => Promise<void> | void;
};

function ConversationScreen({
  activeTab,
  conversation,
  draft,
  generationText,
  isGenerating,
  onBack,
  onChangeDraft,
  onSelectTab,
  onSendMessage,
}: ConversationScreenProps) {
  const reportUpdatedAt = conversation.report.updatedAt;
  const isEscalated = conversation.triage.level !== 'routine';
  const triageLabel = getCareLevelLabel(conversation.triage.level);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={12}
      style={styles.keyboardContainer}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.conversationHeader}>
          <View style={styles.tabsRow}>
            <Pressable
              onPress={() => onSelectTab('chat')}
              style={[styles.tabButton, activeTab === 'chat' && styles.activeTab]}>
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'chat' && styles.activeTabText,
                ]}>
                Chat
              </Text>
            </Pressable>

            <Pressable
              onPress={() => onSelectTab('report')}
              style={[
                styles.tabButton,
                activeTab === 'report' && styles.activeTab,
              ]}>
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'report' && styles.activeTabText,
                ]}>
                Report
              </Text>
            </Pressable>
          </View>

          <View style={styles.headerBar}>
            <Pressable onPress={onBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>‹</Text>
            </Pressable>

            <Text style={styles.headerTitle}>{conversation.title}</Text>

            <Pressable style={styles.languageButton}>
              <Text style={styles.languageButtonText}>EN</Text>
              <Text style={styles.languageButtonCaret}>⌄</Text>
            </Pressable>
          </View>
        </View>

        {activeTab === 'chat' ? (
          <ScrollView
            contentContainerStyle={styles.chatContent}
            keyboardShouldPersistTaps="handled"
            style={styles.chatScrollView}>
            {isEscalated ? (
              <View
                style={[
                  styles.alertBanner,
                  conversation.triage.level === 'emergency'
                    ? styles.alertBannerEmergency
                    : styles.alertBannerDoctor,
                ]}>
                <Text style={styles.alertBannerTitle}>{triageLabel}</Text>
                <Text style={styles.alertBannerText}>
                  {conversation.triage.recommendation}
                </Text>
                {conversation.triage.reasons.map(reason => (
                  <Text key={reason} style={styles.alertBannerReason}>
                    • {reason}
                  </Text>
                ))}
              </View>
            ) : null}

            {conversation.messages.map(message => (
              <View
                key={message.id}
                style={[
                  styles.messageBubble,
                  message.role === 'assistant'
                    ? styles.assistantBubble
                    : styles.userBubble,
                ]}>
                <Text
                  style={[
                    styles.messageText,
                    message.role === 'assistant'
                      ? styles.assistantMessageText
                      : styles.userMessageText,
                  ]}>
                  {message.text}
                </Text>
              </View>
            ))}

            {isGenerating ? (
              <View style={[styles.messageBubble, styles.assistantBubble]}>
                <Text style={[styles.messageText, styles.assistantMessageText]}>
                  {generationText || 'Generating locally...'}
                </Text>
              </View>
            ) : null}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.reportContent}>
            <View style={styles.reportCard}>
              <View style={styles.reportStatusRow}>
                <View
                  style={[
                    styles.reportStatusPill,
                    getReportStatusPillStyle(conversation.report.careLevel),
                  ]}>
                  <Text
                    style={[
                      styles.reportStatusText,
                      getReportStatusTextStyle(conversation.report.careLevel),
                    ]}>
                    {getReportStatusLabel(conversation.report)}
                  </Text>
                </View>
                <Text style={styles.reportDate}>
                  Updated {formatDate(reportUpdatedAt)}
                </Text>
              </View>

              <View style={styles.reportSummaryBlock}>
                <Text style={styles.reportSummaryLabel}>Summary</Text>
                <Text style={styles.reportSummaryText}>
                  {conversation.report.summary}
                </Text>
              </View>

              {conversation.report.sections.map(section => (
                <View key={section.label} style={styles.reportSection}>
                  <Text style={styles.reportLabel}>{section.label}</Text>
                  <Text style={styles.reportValue}>{section.value}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.reportFootnote}>
              This summary stays on the device.
            </Text>
          </ScrollView>
        )}

        <View style={styles.composerShell}>
          <View style={styles.composerRow}>
            <TextInput
              editable={!isGenerating}
              onChangeText={onChangeDraft}
              onSubmitEditing={onSendMessage}
              placeholder="Type your response..."
              placeholderTextColor="#9a9fb1"
              returnKeyType="send"
              style={styles.composerInput}
              value={draft}
            />

            <Pressable
              disabled={isGenerating}
              onPress={onSendMessage}
              style={[styles.sendButton, isGenerating && styles.sendButtonDisabled]}>
              <Text style={styles.sendButtonText}>↗</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function createRulesModeState(
  snapshot: LocalModelSnapshot,
  modelFileUri: string,
  modelFileName: string,
): ModelUiState {
  const selectionLabel = modelFileName.trim() || deriveModelFileName(modelFileUri);

  return {
    status: 'rules',
    message: modelFileUri.trim()
      ? `Rules mode is active. ${selectionLabel} is selected and ready to load.`
      : 'Rules mode is active until you load a local GGUF model.',
    progress: 0,
    snapshot,
  };
}

function createReadyModelState(snapshot: LocalModelSnapshot): ModelUiState {
  return {
    status: 'ready',
    message: `${snapshot.modelLabel} is loaded and ready for routine conversations.`,
    progress: 100,
    snapshot,
  };
}

function createErrorModelState(message: string): ModelUiState {
  return {
    status: 'error',
    message,
    progress: 0,
    snapshot: getLocalModelSnapshot(),
  };
}

function AppShell() {
  const [appState, setAppState] = useState<AppState>(loadAppState);
  const [screen, setScreen] = useState<ScreenState>({
    name: 'home',
  });
  const [activeTab, setActiveTab] = useState<ConversationTab>('chat');
  const [modelState, setModelState] = useState<ModelUiState>(() => {
    const snapshot = getLocalModelSnapshot();
    return snapshot.isLoaded
      ? createReadyModelState(snapshot)
      : createRulesModeState(
          snapshot,
          appState.settings.modelFileUri,
          appState.settings.modelFileName,
        );
  });
  const [generationState, setGenerationState] = useState<GenerationState>({
    conversationId: '',
    isGenerating: false,
    partialText: '',
  });
  const [hasAttemptedStartupModelLoad, setHasAttemptedStartupModelLoad] =
    useState(false);

  useEffect(() => {
    saveAppState(appState);
  }, [appState]);

  useEffect(() => {
    if (hasAttemptedStartupModelLoad || getLocalModelSnapshot().isLoaded) {
      return;
    }

    const savedModelUri = appState.settings.modelFileUri.trim();
    let isCancelled = false;

    setHasAttemptedStartupModelLoad(true);
    setModelState(current => ({
      ...current,
      status: 'loading',
      message: savedModelUri
        ? 'Preparing the saved local model on this device.'
        : 'Preparing the bundled starter model on this device.',
      progress: 0,
    }));

    const setLoadingProgress = (message: string) => (progress: number) => {
      if (isCancelled) {
        return;
      }

      setModelState(current => ({
        ...current,
        status: 'loading',
        message,
        progress: Math.max(0, Math.min(progress, 100)),
      }));
    };

    const finalizeReadyState = (snapshot: LocalModelSnapshot) => {
      if (isCancelled) {
        return;
      }

      setModelState(createReadyModelState(snapshot));
    };

    const tryBundledFallback = async () => {
      const snapshot = await loadBundledModelAsset(
        BUNDLED_MODEL_ASSET_NAME,
        setLoadingProgress('Preparing the bundled starter model on this device.'),
      );
      finalizeReadyState(snapshot);
    };

    const startModelLoad = async () => {
      try {
        if (savedModelUri) {
          const snapshot = await loadLocalModel(
            savedModelUri,
            setLoadingProgress('Preparing the saved local model on this device.'),
          );
          finalizeReadyState(snapshot);
          return;
        }

        await tryBundledFallback();
      } catch (error) {
        if (savedModelUri) {
          try {
            await tryBundledFallback();
            return;
          } catch {
            // Fall through to rules mode below.
          }
        }

        if (isCancelled) {
          return;
        }

        const fallbackMessage =
          error instanceof Error ? error.message : 'The startup model could not be loaded.';
        setModelState(
          createErrorModelState(
            `${fallbackMessage} The app is continuing in the built-in offline rules mode.`,
          ),
        );
      }
    };

    startModelLoad();

    return () => {
      isCancelled = true;
    };
  }, [
    appState.settings.modelFileName,
    appState.settings.modelFileUri,
    hasAttemptedStartupModelLoad,
  ]);

  const conversations = appState.conversations;
  const draftsByConversationId = appState.draftsByConversationId;

  const sortedConversations = useMemo(
    () =>
      [...conversations].sort((left, right) => right.updatedAt - left.updatedAt),
    [conversations],
  );

  const activeConversation =
    screen.name === 'conversation'
      ? sortedConversations.find(
          conversation => conversation.id === screen.conversationId,
        ) ?? sortedConversations[0]
      : null;
  const activeDraft = activeConversation
    ? draftsByConversationId[activeConversation.id] ?? ''
    : '';
  const isGeneratingActiveConversation =
    activeConversation?.id === generationState.conversationId &&
    generationState.isGenerating;

  function setConversation(nextConversation: Conversation, nextDraft?: string) {
    setAppState(current => ({
      ...current,
      conversations: current.conversations.map(conversation =>
        conversation.id === nextConversation.id ? nextConversation : conversation,
      ),
      draftsByConversationId:
        nextDraft === undefined
          ? current.draftsByConversationId
          : {
              ...current.draftsByConversationId,
              [nextConversation.id]: nextDraft,
            },
    }));
  }

  function openConversation(conversationId: string) {
    setActiveTab('chat');
    setScreen({
      name: 'conversation',
      conversationId,
    });
  }

  function createConversation() {
    const conversationId = createId('conversation');
    const updatedAt = Date.now();
    const messages: Conversation['messages'] = [
      {
        id: createId('message'),
        role: 'assistant',
        text: starterMessage,
      },
    ];

    const nextConversation = buildConversation({
      id: conversationId,
      title: `Conversation ${conversations.length + 1}`,
      updatedAt,
      messages,
    });

    setAppState(current => ({
      ...current,
      conversations: [nextConversation, ...current.conversations],
      draftsByConversationId: {
        ...current.draftsByConversationId,
        [conversationId]: '',
      },
    }));
    openConversation(conversationId);
  }

  function updateDraft(nextDraft: string) {
    if (!activeConversation) {
      return;
    }

    setAppState(current => ({
      ...current,
      draftsByConversationId: {
        ...current.draftsByConversationId,
        [activeConversation.id]: nextDraft,
      },
    }));
  }

  function setModelSelection(modelFileUri: string, modelFileName: string) {
    setAppState(current => ({
      ...current,
      settings: {
        ...current.settings,
        modelFileUri,
        modelFileName,
      },
    }));

    setModelState(current => {
      if (current.snapshot.isLoaded && current.status === 'ready') {
        return current;
      }

      return createRulesModeState(current.snapshot, modelFileUri, modelFileName);
    });
  }

  function updateModelFileUri(modelFileUri: string) {
    setModelSelection(
      modelFileUri,
      modelFileUri.trim()
        ? deriveModelFileName(modelFileUri)
        : '',
    );
  }

  async function handlePickModelFile() {
    try {
      const pickedFile = await pickLocalModelFile();
      if (!pickedFile) {
        return;
      }

      setModelSelection(pickedFile.modelUri, pickedFile.modelFileName);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unable to import the selected model.';
      setModelState(createErrorModelState(errorMessage));
    }
  }

  async function handleLoadModel() {
    const requestedModelUri = appState.settings.modelFileUri.trim();
    if (!requestedModelUri) {
      setModelState(
        createErrorModelState(
          'Enter a local file:// URI for a GGUF model before loading.',
        ),
      );
      return;
    }

    setModelState(current => ({
      ...current,
      status: 'loading',
      message: 'Preparing the local model runtime on this device.',
      progress: 0,
    }));

    try {
      const snapshot = await loadLocalModel(requestedModelUri, progress => {
        setModelState(current => ({
          ...current,
          status: 'loading',
          message: 'Preparing the local model runtime on this device.',
          progress: Math.max(0, Math.min(progress, 100)),
        }));
      });

      setAppState(current => ({
        ...current,
        settings: {
          ...current.settings,
          modelFileUri: snapshot.modelUri,
          modelFileName:
            current.settings.modelFileName || deriveModelFileName(snapshot.modelUri),
        },
      }));
      setModelState(createReadyModelState(snapshot));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unable to load the local model.';
      setModelState(createErrorModelState(errorMessage));
    }
  }

  async function handleUnloadModel() {
    await unloadLocalModel();
    setModelState(
      createRulesModeState(
        getLocalModelSnapshot(),
        appState.settings.modelFileUri,
        appState.settings.modelFileName,
      ),
    );
  }

  async function sendMessage() {
    if (!activeConversation || generationState.isGenerating) {
      return;
    }

    const trimmedDraft = activeDraft.trim();
    if (!trimmedDraft) {
      return;
    }

    const conversationWithUser = appendUserMessage(activeConversation, trimmedDraft);
    const shouldUseLocalModel =
      modelState.snapshot.isLoaded && conversationWithUser.triage.level === 'routine';

    setConversation(conversationWithUser, '');
    setActiveTab('chat');

    if (!shouldUseLocalModel) {
      const rulesReply = createAssistantReply(conversationWithUser.messages);
      setConversation(
        appendAssistantMessage(conversationWithUser, rulesReply),
        '',
      );
      return;
    }

    setGenerationState({
      conversationId: conversationWithUser.id,
      isGenerating: true,
      partialText: '',
    });

    try {
      const localReply = await generateLocalAssistantReply({
        messages: conversationWithUser.messages,
        triage: conversationWithUser.triage,
        onToken: partialText => {
          setGenerationState(current => {
            if (current.conversationId !== conversationWithUser.id) {
              return current;
            }

            return {
              ...current,
              partialText,
            };
          });
        },
      });

      setConversation(
        appendAssistantMessage(conversationWithUser, localReply),
        '',
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Local generation failed.';
      setModelState(
        createErrorModelState(
          `${errorMessage} Falling back to the built-in offline rules.`,
        ),
      );
      setConversation(
        appendAssistantMessage(
          conversationWithUser,
          createAssistantReply(conversationWithUser.messages),
        ),
        '',
      );
    } finally {
      setGenerationState({
        conversationId: '',
        isGenerating: false,
        partialText: '',
      });
    }
  }

  if (screen.name === 'model-tools') {
    return (
      <ModelToolsScreen
        modelFileName={appState.settings.modelFileName}
        modelFileUri={appState.settings.modelFileUri}
        modelState={modelState}
        onBack={() => setScreen({ name: 'home' })}
        onChangeModelFileUri={updateModelFileUri}
        onPickModelFile={handlePickModelFile}
        onLoadModel={handleLoadModel}
        onUnloadModel={handleUnloadModel}
      />
    );
  }

  if (screen.name === 'conversation' && activeConversation) {
    return (
      <ConversationScreen
        activeTab={activeTab}
        conversation={activeConversation}
        draft={activeDraft}
        generationText={generationState.partialText}
        isGenerating={isGeneratingActiveConversation}
        onBack={() => setScreen({ name: 'home' })}
        onChangeDraft={updateDraft}
        onSelectTab={setActiveTab}
        onSendMessage={sendMessage}
      />
    );
  }

  return (
    <HomeScreen
      conversations={sortedConversations}
      onCreateConversation={createConversation}
      onOpenModelTools={() => setScreen({ name: 'model-tools' })}
      onOpenConversation={openConversation}
    />
  );
}

function getCareLevelLabel(level: CareLevel) {
  switch (level) {
    case 'emergency':
      return 'Urgent medical care recommended';
    case 'doctor':
      return 'Doctor review recommended';
    default:
      return 'Monitoring';
  }
}

function getModelStatusLabel(status: ModelStatus) {
  switch (status) {
    case 'loading':
      return 'Loading';
    case 'ready':
      return 'Ready';
    case 'error':
      return 'Error';
    default:
      return 'Rules';
  }
}

function getModelStatusPillStyle(status: ModelStatus) {
  switch (status) {
    case 'loading':
      return styles.modelStatusLoadingPill;
    case 'ready':
      return styles.modelStatusReadyPill;
    case 'error':
      return styles.modelStatusErrorPill;
    default:
      return styles.modelStatusRulesPill;
  }
}

function getModelStatusTextStyle(status: ModelStatus) {
  switch (status) {
    case 'loading':
      return styles.modelStatusLoadingText;
    case 'ready':
      return styles.modelStatusReadyText;
    case 'error':
      return styles.modelStatusErrorText;
    default:
      return styles.modelStatusRulesText;
  }
}

function getReportStatusLabel(conversationReport: Conversation['report']) {
  if (conversationReport.careLevel === 'emergency') {
    return 'Emergency';
  }

  if (conversationReport.careLevel === 'doctor') {
    return 'Doctor Review';
  }

  return conversationReport.status === 'ready' ? 'Ready' : 'Draft';
}

function getReportStatusPillStyle(level: CareLevel) {
  switch (level) {
    case 'emergency':
      return styles.reportStatusEmergencyPill;
    case 'doctor':
      return styles.reportStatusDoctorPill;
    default:
      return styles.reportStatusDraftPill;
  }
}

function getReportStatusTextStyle(level: CareLevel) {
  switch (level) {
    case 'emergency':
      return styles.reportStatusEmergencyText;
    case 'doctor':
      return styles.reportStatusDoctorText;
    default:
      return styles.reportStatusDraftText;
  }
}

const shadow = Platform.select({
  android: {
    elevation: 3,
  },
  default: {
    shadowColor: '#141938',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
});

const styles = StyleSheet.create({
  activeTab: {
    borderBottomColor: '#4c7cf0',
    borderBottomWidth: 2,
  },
  activeTabText: {
    color: '#4c7cf0',
  },
  alertBanner: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    rowGap: 6,
  },
  alertBannerDoctor: {
    backgroundColor: '#fff4de',
    borderColor: '#f0cf7f',
    borderWidth: 1,
  },
  alertBannerEmergency: {
    backgroundColor: '#ffe8e8',
    borderColor: '#f2aaaa',
    borderWidth: 1,
  },
  alertBannerReason: {
    color: '#5d3140',
    fontSize: 14,
    lineHeight: 20,
  },
  alertBannerText: {
    color: '#4a3140',
    fontSize: 15,
    lineHeight: 22,
  },
  alertBannerTitle: {
    color: '#2a3042',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 8,
  },
  assistantMessageText: {
    color: '#2a3042',
  },
  backButton: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    minHeight: 36,
    width: 36,
  },
  backButtonText: {
    color: '#4c7cf0',
    fontSize: 28,
    lineHeight: 28,
  },
  brandIcon: {
    alignItems: 'center',
    backgroundColor: '#7d4cf2',
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    width: 40,
    ...shadow,
  },
  brandIconText: {
    color: '#ffffff',
    fontSize: 20,
    lineHeight: 20,
  },
  brandRow: {
    alignItems: 'center',
    columnGap: 12,
    flexDirection: 'row',
    marginBottom: 28,
  },
  brandSubtitle: {
    color: '#8f95a9',
    fontSize: 16,
    lineHeight: 20,
  },
  brandTitle: {
    color: '#202637',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  chatContent: {
    flexGrow: 1,
    padding: 16,
    rowGap: 12,
  },
  chatScrollView: {
    backgroundColor: '#f4f5fb',
    flex: 1,
  },
  chevron: {
    color: '#b5bbca',
    fontSize: 24,
    lineHeight: 24,
  },
  composerInput: {
    color: '#2a3042',
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  composerRow: {
    alignItems: 'center',
    backgroundColor: '#f1f3fb',
    borderRadius: 24,
    columnGap: 10,
    flexDirection: 'row',
    paddingLeft: 6,
    paddingRight: 6,
  },
  composerShell: {
    backgroundColor: '#ffffff',
    borderTopColor: '#e6e8f1',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  conversationHeader: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#e6e8f1',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  headerAccessorySpacer: {
    width: 36,
  },
  headerTitle: {
    color: '#22293b',
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  homeBodyFill: {
    backgroundColor: '#f4f5fb',
    flex: 1,
  },
  homeFooter: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderTopColor: '#e6e8f1',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 18,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  homeFooterText: {
    color: '#7f8799',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 18,
  },
  homeTopSection: {
    backgroundColor: '#ffffff',
    paddingBottom: 28,
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  keyboardContainer: {
    flex: 1,
  },
  languageButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#d8dcec',
    borderRadius: 12,
    borderWidth: 1,
    columnGap: 6,
    flexDirection: 'row',
    minHeight: 36,
    paddingHorizontal: 10,
  },
  languageButtonCaret: {
    color: '#737b8f',
    fontSize: 14,
    lineHeight: 16,
  },
  languageButtonText: {
    color: '#4c5468',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 16,
  },
  messageBubble: {
    borderRadius: 20,
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...shadow,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
  },
  modelActionButton: {
    alignItems: 'center',
    borderRadius: 14,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 12,
  },
  modelActionDisabled: {
    opacity: 0.45,
  },
  modelActionPrimary: {
    backgroundColor: '#4c7cf0',
  },
  modelActionPrimaryText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  modelActionsRow: {
    columnGap: 10,
    flexDirection: 'row',
  },
  modelActionSecondary: {
    backgroundColor: '#eef3ff',
  },
  modelActionSecondaryText: {
    color: '#4c7cf0',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  modelCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e8eaf2',
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
    rowGap: 14,
    ...shadow,
  },
  modelHeaderCopy: {
    flex: 1,
    rowGap: 4,
  },
  modelHeaderRow: {
    alignItems: 'flex-start',
    columnGap: 12,
    flexDirection: 'row',
  },
  modelImportButton: {
    alignItems: 'center',
    backgroundColor: '#eef3ff',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 14,
  },
  modelImportButtonText: {
    color: '#4c7cf0',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  modelImportHint: {
    color: '#7f8799',
    fontSize: 14,
    lineHeight: 18,
  },
  modelInput: {
    backgroundColor: '#f6f7fc',
    borderColor: '#dfe3ef',
    borderRadius: 14,
    borderWidth: 1,
    color: '#22293b',
    fontSize: 15,
    lineHeight: 20,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modelMessage: {
    color: '#4f5669',
    fontSize: 15,
    lineHeight: 22,
  },
  modelToolsBody: {
    padding: 16,
  },
  modelToolsHeader: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomColor: '#e6e8f1',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  modelToolsHeaderTitle: {
    color: '#22293b',
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
  },
  modelMetaBlock: {
    rowGap: 4,
  },
  modelMetaLabel: {
    color: '#7f8799',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  modelMetaValue: {
    color: '#252c3d',
    fontSize: 14,
    lineHeight: 20,
  },
  modelProgressText: {
    color: '#4c7cf0',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  modelStatusErrorPill: {
    backgroundColor: '#ffe8e8',
  },
  modelStatusErrorText: {
    color: '#b33a3a',
  },
  modelStatusLoadingPill: {
    backgroundColor: '#eef4ff',
  },
  modelStatusLoadingText: {
    color: '#4c7cf0',
  },
  modelStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  modelStatusReadyPill: {
    backgroundColor: '#e8f7e9',
  },
  modelStatusReadyText: {
    color: '#246f3b',
  },
  modelStatusRulesPill: {
    backgroundColor: '#f1f3fb',
  },
  modelStatusRulesText: {
    color: '#586075',
  },
  modelStatusText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  modelSubtitle: {
    color: '#7f8799',
    fontSize: 14,
    lineHeight: 18,
  },
  modelTitle: {
    color: '#262d3e',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#4c7cf0',
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 18,
    minHeight: 48,
    ...shadow,
  },
  primaryButtonIcon: {
    color: '#ffffff',
    fontSize: 28,
    lineHeight: 28,
    marginRight: 10,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  recentCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e8eaf2',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadow,
  },
  recentDate: {
    color: '#7f8799',
    fontSize: 15,
    lineHeight: 20,
    marginTop: 4,
  },
  recentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  recentRowDivider: {
    borderBottomColor: '#ebedf4',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recentTextBlock: {
    flex: 1,
  },
  recentTitle: {
    color: '#272d3d',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  reportCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    rowGap: 18,
    ...shadow,
  },
  reportContent: {
    flexGrow: 1,
    padding: 16,
    rowGap: 16,
  },
  reportDate: {
    color: '#8b92a5',
    fontSize: 14,
    lineHeight: 18,
  },
  reportFootnote: {
    color: '#7f8799',
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
  },
  reportLabel: {
    color: '#7b8396',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  reportSection: {
    borderTopColor: '#eef0f6',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 18,
  },
  reportStatusDraftPill: {
    backgroundColor: '#eef4ff',
  },
  reportStatusDraftText: {
    color: '#4c7cf0',
  },
  reportStatusDoctorPill: {
    backgroundColor: '#fff4de',
  },
  reportStatusDoctorText: {
    color: '#9c6b0a',
  },
  reportStatusEmergencyPill: {
    backgroundColor: '#ffe8e8',
  },
  reportStatusEmergencyText: {
    color: '#b33a3a',
  },
  reportStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  reportStatusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reportStatusText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  reportSummaryBlock: {
    backgroundColor: '#f6f7fb',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  reportSummaryLabel: {
    color: '#687086',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  reportSummaryText: {
    color: '#252c3d',
    fontSize: 16,
    lineHeight: 24,
  },
  reportValue: {
    color: '#252c3d',
    fontSize: 16,
    lineHeight: 24,
  },
  safeArea: {
    backgroundColor: '#f4f5fb',
    flex: 1,
  },
  sectionLabel: {
    color: '#8d94a7',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 8,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#7aa2ff',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  sendButtonDisabled: {
    opacity: 0.55,
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 18,
    lineHeight: 18,
  },
  tabButton: {
    alignItems: 'center',
    borderBottomColor: 'transparent',
    borderBottomWidth: 2,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  tabText: {
    color: '#6e7588',
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 24,
  },
  tabsRow: {
    flexDirection: 'row',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#4c7cf0',
    borderTopRightRadius: 8,
  },
  userMessageText: {
    color: '#ffffff',
  },
});

export default AppShell;
