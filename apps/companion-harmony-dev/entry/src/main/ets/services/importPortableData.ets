import {
  HARMONY_IMPORT_RECEIPT_SCHEMA,
  HARMONY_READER_VIEW_SCHEMA,
  HarmonyImportReceipt,
  HarmonyReaderView,
  MIRROR_BUNDLE_SCHEMA,
  WORKSPACE_SCHEMA
} from '../model/workspace';
import { createEmptyReaderView, harmonyScaffoldText } from '../model/harmonyReaderView';

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
    harmonyScaffoldText('Use a foreground document picker or app sandbox picker; do not read background storage.', '使用前台文档选择器或应用沙盒选择器；不要读取后台存储。'),
    harmonyScaffoldText('Accept JSON <= 5 MB with schema learning-companion.workspace.v1 or learning-companion.mirror-bundle.staging.v1.', '只接受不超过 5 MB，且 schema 为 learning-companion.workspace.v1 或 learning-companion.mirror-bundle.staging.v1 的 JSON。'),
    harmonyScaffoldText('Read the selected file as text, call importPortableJsonText, and render ImportReceipt for both success and rejection.', '把所选文件作为文本读取，调用 importPortableJsonText，并为成功和拒绝都渲染 ImportReceipt。'),
    harmonyScaffoldText('Mobile inbox and review progress patches are exported from this app, not imported into the read-only phone reader.', '移动收件箱和复习进度 patch 从此应用导出，不导入只读手机 reader。')
  ];
}

export function validatePortableFileCandidate(candidate: PortableFileCandidate): PortableFileCandidateReceipt {
  const fileName = String(candidate.fileName || '').toLowerCase();
  const byteLength = Number(candidate.byteLength || 0);
  if (!fileName.endsWith('.json')) {
    return {
      ok: false,
      errorCode: 'UNSUPPORTED_FILE_TYPE',
      message: harmonyScaffoldText('Select a .json workspace or mirror bundle file.', '请选择 .json 工作区或镜像包文件。'),
      maxBytes: HARMONY_IMPORT_MAX_BYTES,
      acceptedExtensions: HARMONY_IMPORT_ACCEPTED_EXTENSIONS
    };
  }
  if (!Number.isFinite(byteLength) || byteLength <= 0) {
    return {
      ok: false,
      errorCode: 'INVALID_FILE_SIZE',
      message: harmonyScaffoldText('Selected file size is unavailable or empty.', '所选文件大小不可用或为空。'),
      maxBytes: HARMONY_IMPORT_MAX_BYTES,
      acceptedExtensions: HARMONY_IMPORT_ACCEPTED_EXTENSIONS
    };
  }
  if (byteLength > HARMONY_IMPORT_MAX_BYTES) {
    return {
      ok: false,
      errorCode: 'PORTABLE_FILE_TOO_LARGE',
      message: harmonyScaffoldText('Selected file is larger than the Harmony reader import limit.', '所选文件超过 Harmony reader 导入限制。'),
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
      harmonyScaffoldText(
        'Return patch files must be brought back to Mac via Today > Return Files; the phone reader does not import them.',
        '返回 patch 文件必须通过 Mac 的 Today > Return Files 带回；手机 reader 不导入它们。'
      ),
      nowIso
    );
  }
  if (schema !== WORKSPACE_SCHEMA && schema !== MIRROR_BUNDLE_SCHEMA) {
    return failedImportReceipt(
      classifySource(schema),
      schema,
      'UNSUPPORTED_PORTABLE_DATA',
      harmonyScaffoldText('Only workspace or mirror bundle JSON can be opened by the reader.', 'reader 只能打开工作区或镜像包 JSON。'),
      nowIso
    );
  }

  const view = createEmptyReaderView(nowIso);
  view.mode = 'native-scaffold';
  view.workspace.schema = schema;
  view.limitations = [
    harmonyScaffoldText('Parsed by scaffold placeholder; full workspace-to-reader mapping is ported from apps/companion-harmony/src/schema-reader.mjs.', '由脚手架占位解析；完整工作区到 reader 的映射来自 apps/companion-harmony/src/schema-reader.mjs。'),
    harmonyScaffoldText('Document picker contract is scaffolded, but no device storage or picker runtime has been verified yet.', '文档选择器契约已脚手架化，但尚未验证设备存储或 picker 运行时。'),
    harmonyScaffoldText('Exported patches must be imported on Mac before they affect source workspace state.', '导出的 patch 必须先在 Mac 导入，才会影响源工作区状态。')
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
