import {
  HARMONY_IMPORT_RECEIPT_SCHEMA,
  HARMONY_READER_VIEW_SCHEMA,
  HarmonyImportReceipt,
  HarmonyReaderView,
  MIRROR_BUNDLE_SCHEMA,
  WORKSPACE_SCHEMA
} from '../model/workspace';
import { createEmptyReaderView } from '../model/harmonyReaderView';

export interface HarmonyImportResult {
  ok: boolean;
  view?: HarmonyReaderView;
  receipt: HarmonyImportReceipt;
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
  if (schema !== WORKSPACE_SCHEMA && schema !== MIRROR_BUNDLE_SCHEMA) {
    return failedImportReceipt(classifySource(schema), schema, 'UNSUPPORTED_PORTABLE_DATA', 'Only workspace or mirror bundle JSON can be opened by the reader.', nowIso);
  }

  const view = createEmptyReaderView(nowIso);
  view.mode = 'native-scaffold';
  view.workspace.schema = schema;
  view.limitations = [
    'Parsed by scaffold placeholder; full workspace-to-reader mapping is ported from apps/companion-harmony/src/schema-reader.mjs.',
    'No device storage or document picker has been verified yet.',
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
