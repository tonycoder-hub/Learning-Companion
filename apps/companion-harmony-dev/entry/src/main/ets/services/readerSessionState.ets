import { HarmonyImportReceipt, HarmonyReaderView } from '../model/workspace';

export type ReaderSessionStatus = 'empty' | 'accepted-pending-persist' | 'ready' | 'rejected-kept-current' | 'rejected-empty';
export type ReaderStorageStatus = 'empty' | 'pending-device-persistence' | 'persisted-by-device-adapter';

export interface ReaderImportStatus {
  state: ReaderSessionStatus;
  message: string;
  changedView: boolean;
}

export interface ReaderStorageState {
  status: ReaderStorageStatus;
  adapter: string;
  savedAt: string;
  key: string;
}

export interface ReaderSessionState {
  updatedAt: string;
  currentView?: HarmonyReaderView;
  lastImportReceipt?: HarmonyImportReceipt;
  importStatus: ReaderImportStatus;
  storage: ReaderStorageState;
  limitations: string[];
}

export function createReaderSessionState(view?: HarmonyReaderView, receipt?: HarmonyImportReceipt, nowIso: string = ''): ReaderSessionState {
  return {
    updatedAt: nowIso || receipt?.importedAt || view?.generatedAt || '',
    currentView: view,
    lastImportReceipt: receipt,
    importStatus: {
      state: view ? 'ready' : 'empty',
      message: view ? 'Reader view is ready.' : 'No workspace or mirror bundle has been imported.',
      changedView: !!view
    },
    storage: {
      status: view ? 'pending-device-persistence' : 'empty',
      adapter: 'device-storage-not-wired',
      savedAt: '',
      key: ''
    },
    limitations: [
      'Session state is a scaffold contract; no HarmonyOS storage adapter has executed it.',
      'Accepted imports replace the current reader view only after schema parsing succeeds.',
      'Rejected imports keep the previous reader view visible.',
      'lastImportReceipt is a single-slot receipt for the most recent import attempt.'
    ]
  };
}

export function acceptReaderImport(state: ReaderSessionState, view: HarmonyReaderView, receipt: HarmonyImportReceipt): ReaderSessionState {
  return {
    ...state,
    updatedAt: receipt.importedAt || view.generatedAt,
    currentView: view,
    lastImportReceipt: receipt,
    importStatus: {
      state: 'accepted-pending-persist',
      message: `Imported ${receipt.sourceKind}: ${receipt.topicCount || view.topics.length} topics and ${receipt.dueReviewCount || view.dueReview.length} due review cards.`,
      changedView: true
    },
    storage: {
      status: 'pending-device-persistence',
      adapter: 'device-storage-not-wired',
      savedAt: '',
      key: ''
    }
  };
}

export function rejectReaderImport(state: ReaderSessionState, receipt: HarmonyImportReceipt): ReaderSessionState {
  return {
    ...state,
    updatedAt: receipt.importedAt,
    lastImportReceipt: receipt,
    importStatus: {
      state: state.currentView ? 'rejected-kept-current' : 'rejected-empty',
      message: `${receipt.errorCode || 'UNKNOWN_IMPORT_ERROR'}: ${receipt.message || 'The selected file could not be imported.'}`,
      changedView: false
    }
  };
}

export function markReaderSessionPersisted(state: ReaderSessionState, savedAt: string, key: string): ReaderSessionState {
  if (!state.currentView) return state;
  return {
    ...state,
    updatedAt: savedAt,
    importStatus: {
      ...state.importStatus,
      state: 'ready',
      message: 'Reader view is ready from the last accepted import.'
    },
    storage: {
      status: 'persisted-by-device-adapter',
      adapter: 'device-storage-not-wired',
      savedAt,
      key
    }
  };
}

export function summarizeReaderSessionState(state: ReaderSessionState): string {
  const view = state.currentView;
  if (!view) return state.importStatus.message;
  return `${view.topics.length} topics · ${view.dueReview.length} due · ${view.workspace.openQuestionCount} active questions · ${view.workspace.answerCaptureCountToday} answers today · ${state.storage.status}`;
}
