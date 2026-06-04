import {
  HARMONY_IMPORT_RECEIPT_SCHEMA,
  HARMONY_READER_VIEW_SCHEMA,
  HarmonyImportReceipt,
  HarmonyReaderView,
  MIRROR_BUNDLE_SCHEMA,
  WORKSPACE_SCHEMA
} from '../model/workspace';
import { createEmptyReaderView } from '../model/harmonyReaderView';

export const HARMONY_IMPORT_MAX_BYTES: number = 5 * 1024 * 1024;
export const HARMONY_IMPORT_ACCEPTED_EXTENSIONS: string[] = ['.json'];

export interface HarmonyImportResult {
  ok: boolean;
  view?: HarmonyReaderView;
  receipt: HarmonyImportReceipt;
}

export interface PortableFileCandidate {
  fileName: string;
  byteLength: number;
  mimeType: string;
  uri: string;
}

export interface PortableFileCandidateReceipt {
  ok: boolean;
  errorCode?: string;
  message?: string;
  maxBytes: number;
  acceptedExtensions: string[];
}

export function describeImportPickerContract(): string[] {
  return [
    'Use a foreground document picker or app sandbox picker; do not read background storage.',
    'Accept JSON <= 5 MB with schema learning-companion.workspace.v1 or learning-companion.mirror-bundle.staging.v1.',
    'Read the selected file as text, call importPortableJsonText, and render ImportReceipt for both success and rejection.',
    'Mobile inbox and review progress patches are exported from this app, not imported into the read-only phone reader.'
  ];
}

export function validatePortableFileCandidate(candidate: PortableFileCandidate): PortableFileCandidateReceipt {
  const fileName = String(candidate.fileName || '').toLowerCase();
  const byteLength = Number(candidate.byteLength || 0);
  if (!fileName.endsWith('.json')) {
    return {
      ok: false,
      errorCode: 'UNSUPPORTED_FILE_TYPE',
      message: 'Select a .json workspace or mirror bundle file.',
      maxBytes: HARMONY_IMPORT_MAX_BYTES,
      acceptedExtensions: HARMONY_IMPORT_ACCEPTED_EXTENSIONS
    };
  }
  if (!Number.isFinite(byteLength) || byteLength <= 0) {
    return {
      ok: false,
      errorCode: 'INVALID_FILE_SIZE',
      message: 'Selected file size is unavailable or empty.',
      maxBytes: HARMONY_IMPORT_MAX_BYTES,
      acceptedExtensions: HARMONY_IMPORT_ACCEPTED_EXTENSIONS
    };
  }
  if (byteLength > HARMONY_IMPORT_MAX_BYTES) {
    return {
      ok: false,
      errorCode: 'PORTABLE_FILE_TOO_LARGE',
      message: 'Selected file is larger than the Harmony reader import limit.',
      maxBytes: HARMONY_IMPORT_MAX_BYTES,
      acceptedExtensions: HARMONY_IMPORT_ACCEPTED_EXTENSIONS
    };
  }
  return {
    ok: true,
    maxBytes: HARMONY_IMPORT_MAX_BYTES,
    acceptedExtensions: HARMONY_IMPORT_ACCEPTED_EXTENSIONS
  };
}

export function importPortableJsonText(text: string, nowIso: string): HarmonyImportResult {
  try {
    const parsed = JSON.parse(text) as Record<string, Object>;
    return importPortableObject(parsed, nowIso);
  } catch (error) {
    return failedImportReceipt('unsupported', '', 'INVALID_JSON', 'The selected file is not valid JSON.', nowIso);
  }
}

export function importPortableObject(portable: Record<string, Object>, nowIso: string): HarmonyImportResult {
  const schema = String(portable?.schema || '');
  if (schema.includes('mobile-inbox-patch') || schema.includes('review-progress-patch')) {
    return failedImportReceipt(
      classifySource(schema),
      schema,
      'PATCH_IMPORT_NOT_SUPPORTED_ON_READER',
      'Return patch files must be brought back to Mac via Today > Return Files; the phone reader does not import them.',
      nowIso
    );
  }
  if (schema !== WORKSPACE_SCHEMA && schema !== MIRROR_BUNDLE_SCHEMA) {
    return failedImportReceipt(classifySource(schema), schema, 'UNSUPPORTED_PORTABLE_DATA', 'Only workspace or mirror bundle JSON can be opened by the reader.', nowIso);
  }

  const view = createEmptyReaderView(nowIso);
  view.mode = 'native-scaffold';
  view.workspace.schema = schema;
  view.limitations = [
    'Parsed by scaffold placeholder; full workspace-to-reader mapping is ported from apps/companion-harmony/src/schema-reader.mjs.',
    'Document picker contract is scaffolded, but no device storage or picker runtime has been verified yet.',
    'Exported patches must be imported on Mac before they affect source workspace state.'
  ];

  return {
    ok: true,
    view,
    receipt: {
      schema: HARMONY_IMPORT_RECEIPT_SCHEMA,
      ok: true,
      importedAt: nowIso,
      sourceKind: schema === MIRROR_BUNDLE_SCHEMA ? 'mirror-bundle' : 'workspace',
      sourceSchema: schema,
      readerViewSchema: HARMONY_READER_VIEW_SCHEMA,
      topicCount: view.topics.length,
      dueReviewCount: view.dueReview.length,
      mode: view.mode
    }
  };
}

function failedImportReceipt(sourceKind: string, sourceSchema: string, errorCode: string, message: string, nowIso: string): HarmonyImportResult {
  return {
    ok: false,
    receipt: {
      schema: HARMONY_IMPORT_RECEIPT_SCHEMA,
      ok: false,
      importedAt: nowIso,
      sourceKind,
      sourceSchema,
      errorCode,
      message
    }
  };
}

function classifySource(schema: string): string {
  if (schema.includes('mobile-inbox-patch')) return 'mobile-inbox-patch';
  if (schema.includes('review-progress-patch')) return 'review-progress-patch';
  return 'unsupported';
}
