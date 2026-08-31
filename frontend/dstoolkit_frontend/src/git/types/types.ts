/**
 * @dstoolkit/git-core — 共享Git数据模型定义
 *  与 Prisma schema 一一对应（但用 POJO 类型，不依赖 Prisma）
 *  后端、前端、Flutter(Dart自由翻译)共用同一份数据契约
 */

// ══════════════════════════════════════════════
// 枚举
// ══════════════════════════════════════════════

export type GitObjectType = 'COMMIT' | 'TREE' | 'BLOB' | 'TAG'

export type ProtectionLevel = 'NONE' | 'REVIEW' | 'APPROVAL' | 'LOCKED'

export type PullRequestStatus = 'OPEN' | 'DRAFT' | 'REVIEWING' | 'APPROVED' | 'MERGED' | 'REJECTED' | 'CLOSED'

export type MergeStrategy = 'MERGE_COMMIT' | 'SQUASH' | 'REBASE' | 'FAST_FORWARD'

export type RepoVisibility = 'PRIVATE' | 'INTERNAL' | 'PUBLIC'

export type ChangeType =
  | 'INIT'
  | 'NEW_TURN'
  | 'EDIT_TURN'
  | 'DELETE_TURN'
  | 'MERGE'
  | 'REBASE'
  | 'REVERT'
  | 'CHERRY_PICK'
  | 'TAG'
  | 'EDIT'

export type RepoPermission = 'OWNER' | 'MAINTAINER' | 'WRITE' | 'READ' | 'TRIAGE'

// ══════════════════════════════════════════════
// 数据模型 POJO
// ══════════════════════════════════════════════

export interface GitRepoEntity {
  id: number
  name: string
  description: string | null
  visibility: RepoVisibility
  defaultBranch: string
  conversationId: number | null
  ownerId: number
  commitCount: number
  branchCount: number
  tagCount: number
  blobCount: number
  forkedFromId: number | null
  isFork: boolean
  starCount: number
  sizeBytes: string // BigInt wire as string
  lastActivityAt: string // ISO date
  createdAt: string
  updatedAt: string
  owner?: { id: number; username: string }
  branches?: GitBranchEntity[]
  counts?: { commits: number; branches: number; tags: number; pullRequests: number; collaborators: number }
}

export interface RepoCollaboratorEntity {
  id: number
  repoId: number
  userId: number
  permission: RepoPermission
  invitedBy: number | null
  joinedAt: string
  user?: { id: number; username: string }
}

export interface GitBranchEntity {
  id: number
  repoId: number
  name: string
  isDefault: boolean
  headCommitId: number | null
  parentBranchId: number | null
  protection: ProtectionLevel
  requiredApprovals: number
  requireStatusChecks: boolean
  createdById: number
  lastCommitAt: string
  createdAt: string
  updatedAt: string
  headCommit?: {
    id: number
    sha256: string
    subject: string
    committedAt: string
    authorName: string
    parentLinks?: { parentId: number; parent: { id: number; sha256: string } }[]
  } | null
  createdBy?: { id: number; username: string }
  // ahead/behind relative to default
  aheadOfDefault?: number
  behindDefault?: number
}

export interface GitBlobEntity {
  id: number
  repoId: number
  sha256: string
  sizeBytes: number
  mimeType: string | null
  encoding: 'utf8' | 'base64'
  content: string
  createdAt: string
}

export interface GitTreeEntity {
  id: number
  repoId: number
  sha256: string
  entryCount: number
  entries?: GitTreeEntryEntity[]
  createdAt: string
}

export interface GitTreeEntryEntity {
  id: number
  treeId: number
  mode: string
  name: string
  type: GitObjectType
  blobId: number | null
  subtreeId: number | null
  messageId: number | null
  sortKey: string
  blob?: GitBlobEntity | null
  subtree?: GitTreeEntity | null
}

export interface GitCommitEntity {
  id: number
  repoId: number
  sha256: string
  treeId: number
  parentCount: number
  authorName: string
  authorEmail: string
  authorUserId: number | null
  authoredAt: string
  committerName: string
  committerEmail: string
  committerUserId: number | null
  committedAt: string
  subject: string
  body: string | null
  additions: number
  deletions: number
  changedFiles: number
  changeType: ChangeType | null
  turnIndex: number | null
  nodeId: string | null
  isSigned: boolean
  signatureType: string | null
  isVerified: boolean
  createdAt: string
  tree?: GitTreeEntity & { entries: Array<GitTreeEntryEntity & { blob: GitBlobEntity | null; subtree: GitTreeEntity | null }> }
  parentLinks?: { commitId: number; parentId: number; parentOrder: number; parent: GitCommitSummary }[]
  childLinks?: any[]
}

export interface GitCommitSummary {
  id: number
  sha256: string
  subject: string
  authorName: string
  committedAt: string
}

export interface GitTagEntity {
  id: number
  repoId: number
  name: string
  isAnnotated: boolean
  type: GitObjectType
  commitId: number | null
  targetSha: string
  taggerName: string | null
  taggerEmail: string | null
  taggerUserId: number | null
  taggedAt: string | null
  message: string | null
  isSigned: boolean
  isVerified: boolean
  semverMajor: number | null
  semverMinor: number | null
  semverPatch: number | null
  semverPrerelease: string | null
  createdAt: string
  commit?: GitCommitSummary & { parentLinks?: { parentOrder: number }[] }
}

export interface GitStashEntity {
  id: number
  repoId: number
  branchId: number
  index: number
  name: string | null
  message: string | null
  baseCommitId: number
  stagedTreeId: number
  workingTreeId: number
  untrackedTreeId: number | null
  createdById: number
  createdAt: string
  branch?: GitBranchEntity
}

export interface GitReflogEntry {
  id: number
  repoId: number
  refName: string
  oldSha: string | null
  newSha: string
  action: string
  actorName: string
  actorEmail: string
  actorUserId: number | null
  reason: string | null
  timestamp: string
}

export interface PullRequestEntity {
  id: number
  number: number
  repoId: number
  title: string
  description: string | null
  headBranchId: number
  headRepoId: number
  headCommitSha: string
  baseBranchId: number
  baseCommitSha: string
  authorId: number
  status: PullRequestStatus
  isDraft: boolean
  mergeStrategy: MergeStrategy
  mergeCommitId: number | null
  approvalCount: number
  requestedApprovals: number
  ciStatus: string | null
  checksPassed: boolean | null
  hasConflicts: boolean
  mergeable: boolean | null
  commentCount: number
  commitCount: number
  additions: number
  deletions: number
  changedFiles: number
  createdAt: string
  updatedAt: string
  closedAt: string | null
  mergedAt: string | null
  mergedById: number | null
  // loaded relations
  headBranch?: GitBranchEntity
  baseBranch?: GitBranchEntity
  headRepo?: { id: number; owner: { id: number; username: string } }
  author?: { id: number; username: string }
  labels?: PRLabelEntity[]
  reviews?: PRReviewEntity[]
  activities?: PRActivityEntity[]
}

export interface PRLabelEntity {
  id: number
  name: string
  color: string | null
  repoId: number
}

export interface PRReviewEntity {
  id: number
  prId: number
  reviewerId: number
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING'
  body: string | null
  commitSha: string | null
  submittedAt: string | null
  createdAt: string
  reviewer?: { user: { id: number; username: string } }
}

export interface PRCommentEntity {
  id: number
  prId: number
  authorId: number
  body: string
  isInline: boolean
  filePath: string | null
  oldLineNo: number | null
  newLineNo: number | null
  blobSha: string | null
  side: 'LEFT' | 'RIGHT' | null
  lineContent: string | null
  threadId: number | null
  parentId: number | null
  replyToId: number | null
  isResolved: boolean
  resolvedById: number | null
  resolvedAt: string | null
  reactions: Record<string, number[]> | null
  createdAt: string
  updatedAt: string
  editedAt: string | null
  author?: { id: number; username: string }
}

export interface PRActivityEntity {
  id: number
  prId: number
  actorId: number | null
  actorName: string
  action: string
  detail: any | null
  createdAt: string
}

export interface RepoIssueEntity {
  id: number
  number: number
  repoId: number
  title: string
  description: string | null
  state: string
  authorId: number
  assignees: number[]
  labels: string[] | null
  milestone: string | null
  linkedPRId: number | null
  commentCount: number
  createdAt: string
  updatedAt: string
  closedAt: string | null
  closedById: number | null
}

// ══════════════════════════════════════════════
// Diff 相关（来自 gitDiff 工具层的输出）
// ══════════════════════════════════════════════

export type DiffOp = 'EQUAL' | 'INSERT' | 'DELETE' | 'REPLACE'

export interface DiffToken {
  op: DiffOp
  text: string
}

export interface DiffLine {
  op: DiffOp
  content: string
  oldLineNo?: number
  newLineNo?: number
  tokens?: DiffToken[]
}

export interface DiffHunk {
  oldStart: number
  oldCount: number
  newStart: number
  newCount: number
  sectionHeader?: string
  lines: DiffLine[]
}

export type DiffFileStatus = 'added' | 'deleted' | 'modified' | 'renamed' | 'copied' | 'unchanged'

export interface DiffFileResult {
  oldPath?: string
  newPath?: string
  oldSha?: string
  newSha?: string
  status: DiffFileStatus
  similarity?: number
  binary?: boolean
  hunks: DiffHunk[]
  additions: number
  deletions: number
  oldLineCount: number
  newLineCount: number
}

export interface TreeDiffSummary {
  files: DiffFileResult[]
  totalAdditions: number
  totalDeletions: number
  changedFiles: number
}

export type MergeLineKind = 'context' | 'ours' | 'theirs' | 'conflict'

export interface MergeLine {
  kind: MergeLineKind
  content?: string
  ours?: string[]
  theirs?: string[]
  ancestor?: string[]
}

export interface MergeResult {
  lines: MergeLine[]
  hasConflicts: boolean
  conflictCount: number
  merged: string
  oursLabel?: string
  theirsLabel?: string
  ancestorLabel?: string
}
