/**
 * Git REST API 契约类型（请求/响应）
 * 供后端实现校验 & 前端调用时使用
 */
import type {
  GitRepoEntity, GitBranchEntity, GitCommitEntity, GitTagEntity,
  PullRequestEntity, PRReviewEntity, PRCommentEntity, PRActivityEntity,
  GitStashEntity, GitReflogEntry, RepoCollaboratorEntity,
  MergeStrategy, RepoVisibility, ProtectionLevel, PullRequestStatus,
  TreeDiffSummary, DiffFileResult,
} from './types'

// ============ 通用 ============

export interface Paged<T> {
  list: T[]
  total: number
}

export interface CommitsList {
  commits: GitCommitEntity[]
  total: number
}

// ============ Repos ============

export interface CreateRepoRequest {
  name: string
  description?: string
  visibility?: RepoVisibility
  initialContent?: Array<{ path: string; content: string }>
  conversationId?: number
}

export interface CreateRepoResponse {
  repo: GitRepoEntity
  defaultBranch: GitBranchEntity
  initCommitId: number
  initCommitSha: string
}

export interface ListReposRequest {
  ownerId?: number
  visibility?: RepoVisibility
  search?: string
  limit?: number
  offset?: number
}

export interface ListReposResponse {
  repos: GitRepoEntity[]
  total: number
}

export interface CreateConvRepoResponse {
  created: boolean
  repo: GitRepoEntity
  defaultBranch: GitBranchEntity
  initCommitId?: number
  initCommitSha?: string
}

// ============ Branches ============

export interface CreateBranchRequest {
  name: string
  fromBranchName?: string
  fromCommitSha?: string
}

export interface ProtectBranchRequest {
  level: ProtectionLevel
  requiredApprovals?: number
  requireStatusChecks?: boolean
}

export interface ListBranchesResponse {
  branches: GitBranchEntity[]
}

// ============ Tags ============

export interface CreateTagRequest {
  name: string
  targetCommitSha?: string
  annotated?: boolean
  message?: string
  semver?: { major: number; minor: number; patch: number; prerelease?: string }
}

export interface ListTagsResponse {
  tags: GitTagEntity[]
}

// ============ Commits / Compare ============

export interface GetCommitDetailResponse {
  commit: GitCommitEntity
  diff: TreeDiffSummary
}

export interface CompareResponse {
  base: string
  head: string
  diff: TreeDiffSummary
  unified: string
}

export interface ReadFileResponse {
  path: string
  blob: {
    id: number
    sha: string
    sizeBytes: number
    mimeType: string | null
    encoding: string
    content: string
  }
  messageId?: number
}

export interface ListTreeResponse {
  treeId: number
  files: Array<{
    path: string
    mode: string
    blobId: number
    sha: string
    sizeBytes: number
    mimeType?: string
    messageId?: number
  }>
}

// ============ Merge / Cherry-pick / Revert ============

export interface MergeRequest {
  sourceBranchName: string
  targetBranchName: string
  strategy: MergeStrategy
  message?: string
}

export interface ServiceMergeResult {
  commit?: GitCommitEntity
  strategy: string
  hasConflicts: boolean
  conflicts?: Array<{ path: string; conflictCount?: number; reason?: string }>
  mergedFiles?: number
  additions?: number
  deletions?: number
}

export interface CherryPickRequest {
  targetCommitSha: string
  branchId: number
  message?: string
}
export interface CherryPickResponse {
  commit?: GitCommitEntity
  conflicts?: any[]
}
export type RevertRequest = CherryPickRequest
export type RevertResponse = CherryPickResponse

// ============ Reset / Stash / Reflog ============

export interface ResetRequest {
  branchId: number
  targetSha: string
  mode?: 'soft' | 'mixed' | 'hard'
}
export interface ResetResponse {
  ok: boolean
  targetSha: string
  mode: string
}

export interface StashRequest {
  branchId: number
  name?: string
  message?: string
  stagedEntries: Array<{ path: string; content: string }>
  workingEntries: Array<{ path: string; content: string }>
  untrackedEntries?: Array<{ path: string; content: string }>
}
export interface StashResponse {
  stash: GitStashEntity
}
export interface StashPopRequest { index?: number }
export interface StashPopResponse {
  commit?: GitCommitEntity
  stash: GitStashEntity
}

export interface ReflogResponse {
  entries: GitReflogEntry[]
}

// ============ Pull Request ============

export interface CreatePullRequestRequest {
  title: string
  description?: string
  headBranchName: string
  baseBranchName: string
  headRepoId?: number
  isDraft?: boolean
  mergeStrategy?: MergeStrategy
}
export type UpdatePullRequestRequest = Partial<{
  title: string
  description: string
  isDraft: boolean
  status: PullRequestStatus
  mergeStrategy: MergeStrategy
  baseBranchName: string
  labels: string[]
}>

export interface ListPRResponse extends Paged<PullRequestEntity> {}

export interface PRReviewRequest {
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED'
  body?: string
}

export interface PRCommentRequest {
  body: string
  isInline?: boolean
  filePath?: string
  oldLineNo?: number
  newLineNo?: number
  side?: 'LEFT' | 'RIGHT'
  blobSha?: string
  lineContent?: string
  replyToId?: number
  threadId?: number
}

export interface ListCommentsResponse {
  comments: PRCommentEntity[]
}

export interface ListActivitiesResponse {
  activities: PRActivityEntity[]
}

export interface MergePRRequest {
  strategy?: MergeStrategy
  message?: string
}

// ============ Collaborators ============

export interface AddCollaboratorRequest {
  userId: number
  permission: 'OWNER' | 'MAINTAINER' | 'WRITE' | 'READ' | 'TRIAGE'
}
export interface ListCollaboratorsResponse {
  collaborators: RepoCollaboratorEntity[]
}
