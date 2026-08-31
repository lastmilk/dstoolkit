/**
 * Git 体系前端 API 客户端
 * 封装所有 /api/git/* 请求
 */
import { request } from '@/utils/request'
import type * as API from '../types/apiContract'
import type * as T from '../types/types'

// ========== 对话绑定仓库 ==========

export function createOrGetConvRepo(convId: number) {
  return request<any, API.CreateConvRepoResponse>(
    `git/conversations/${convId}/repo`,
    { method: 'POST' },
  )
}

// ========== Repos ==========

export function listRepos(params: API.ListReposRequest = {}) {
  const qs = new URLSearchParams()
  if (params.ownerId) qs.set('ownerId', String(params.ownerId))
  if (params.visibility) qs.set('visibility', params.visibility)
  if (params.search) qs.set('search', params.search)
  if (params.limit) qs.set('limit', String(params.limit))
  if (params.offset) qs.set('offset', String(params.offset))
  const q = qs.toString()
  return request<any, API.ListReposResponse>(`git/repos${q ? `?${q}` : ''}`)
}

export function createRepo(data: API.CreateRepoRequest) {
  return request<any, API.CreateRepoResponse>('git/repos', { method: 'POST', data })
}

export function getRepo(id: number) {
  return request<any, { repo: T.GitRepoEntity }>(`git/repos/${id}`)
}

// ========== Branches ==========

export function listBranches(repoId: number) {
  return request<any, API.ListBranchesResponse>(`git/repos/${repoId}/branches`)
}

export function createBranch(repoId: number, data: API.CreateBranchRequest) {
  return request<any, { branch: T.GitBranchEntity }>(`git/repos/${repoId}/branches`, { method: 'POST', data })
}

export function deleteBranch(repoId: number, name: string, force = false) {
  return request<any, { ok: true }>(`git/repos/${repoId}/branches/${encodeURIComponent(name)}?force=${force}`, { method: 'DELETE' })
}

export function protectBranch(repoId: number, name: string, data: API.ProtectBranchRequest) {
  return request<any, { branch: T.GitBranchEntity }>(
    `git/repos/${repoId}/branches/${encodeURIComponent(name)}/protect`,
    { method: 'POST', data },
  )
}

// ========== Tags ==========

export function listTags(repoId: number) {
  return request<any, API.ListTagsResponse>(`git/repos/${repoId}/tags`)
}

export function createTag(repoId: number, data: API.CreateTagRequest) {
  return request<any, { tag: T.GitTagEntity }>(`git/repos/${repoId}/tags`, { method: 'POST', data })
}

export function deleteTag(repoId: number, name: string) {
  return request<any, { ok: true }>(`git/repos/${repoId}/tags/${encodeURIComponent(name)}`, { method: 'DELETE' })
}

// ========== Commits ==========

export function listCommits(repoId: number, params: {
  branchName?: string
  branchId?: number
  authorUserId?: number
  grep?: string
  changeType?: string
  limit?: number
  offset?: number
} = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v != null) qs.set(k, String(v)) })
  const q = qs.toString()
  return request<any, API.CommitsList>(`git/repos/${repoId}/commits${q ? `?${q}` : ''}`)
}

export function getCommitDetail(repoId: number, sha: string) {
  return request<any, API.GetCommitDetailResponse>(`git/repos/${repoId}/commits/${sha}`)
}

// ========== Tree / Compare ==========

export function readRepoTree(repoId: number, ref: string, path?: string) {
  const q = path ? `?path=${encodeURIComponent(path)}` : ''
  return request<any, API.ListTreeResponse | API.ReadFileResponse>(
    `git/repos/${repoId}/tree/${encodeURIComponent(ref)}${q}`,
  )
}

export function compareRefs(repoId: number, base: string, head: string) {
  const qs = `?base=${encodeURIComponent(base)}&head=${encodeURIComponent(head)}`
  return request<any, API.CompareResponse>(`git/repos/${repoId}/compare${qs}`)
}

// ========== Merge / Reset / Cherry-pick / Revert ==========

export function mergeBranches(repoId: number, data: API.MergeRequest) {
  return request<any, API.ServiceMergeResult>(`git/repos/${repoId}/merge`, { method: 'POST', data })
}

export function cherryPickCommit(repoId: number, data: API.CherryPickRequest) {
  return request<any, API.CherryPickResponse>(`git/repos/${repoId}/cherry-pick`, { method: 'POST', data })
}

export function revertCommit(repoId: number, data: API.RevertRequest) {
  return request<any, API.RevertResponse>(`git/repos/${repoId}/revert`, { method: 'POST', data })
}

export function resetBranch(repoId: number, data: API.ResetRequest) {
  return request<any, API.ResetResponse>(`git/repos/${repoId}/reset`, { method: 'POST', data })
}

// ========== Stash / Reflog ==========

export function stash(repoId: number, data: API.StashRequest) {
  return request<any, API.StashResponse>(`git/repos/${repoId}/stash`, { method: 'POST', data })
}

export function stashPop(repoId: number, index?: number) {
  return request<any, API.StashPopResponse>(`git/repos/${repoId}/stash/pop`, { method: 'POST', data: { index } })
}

export function getReflog(repoId: number, branchName?: string, limit = 100) {
  const qs = new URLSearchParams()
  if (branchName) qs.set('branchName', branchName)
  qs.set('limit', String(limit))
  return request<any, API.ReflogResponse>(`git/repos/${repoId}/reflog?${qs}`)
}

// ========== Pull Requests ==========

export function listPRs(repoId: number, params: Partial<{
  status: T.PullRequestStatus
  authorId: number
  headBranchName: string
  baseBranchName: string
  search: string
  limit: number
  offset: number
  sort: 'created' | 'updated' | 'popularity'
}> = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v != null) qs.set(k, String(v)) })
  const q = qs.toString()
  return request<any, API.ListPRResponse>(`git/repos/${repoId}/prs${q ? `?${q}` : ''}`)
}

export function createPR(repoId: number, data: API.CreatePullRequestRequest) {
  return request<any, { pr: T.PullRequestEntity }>(`git/repos/${repoId}/prs`, { method: 'POST', data })
}

export function getPR(repoId: number, number: number) {
  return request<any, { pr: T.PullRequestEntity }>(`git/repos/${repoId}/prs/${number}`)
}

export function updatePR(repoId: number, number: number, data: API.UpdatePullRequestRequest) {
  return request<any, { pr: T.PullRequestEntity }>(`git/repos/${repoId}/prs/${number}`, { method: 'PATCH', data })
}

export function closePR(repoId: number, number: number) {
  return request<any, { pr: T.PullRequestEntity }>(`git/repos/${repoId}/prs/${number}/close`, { method: 'POST' })
}

export function reopenPR(repoId: number, number: number) {
  return request<any, { pr: T.PullRequestEntity }>(`git/repos/${repoId}/prs/${number}/reopen`, { method: 'POST' })
}

export function mergePR(repoId: number, number: number, data: API.MergePRRequest = {}) {
  return request<any, API.ServiceMergeResult>(`git/repos/${repoId}/prs/${number}/merge`, { method: 'POST', data })
}

export function submitPRReview(repoId: number, number: number, data: API.PRReviewRequest) {
  return request<any, { review: T.PRReviewEntity }>(`git/repos/${repoId}/prs/${number}/reviews`, { method: 'POST', data })
}

export function listPRComments(repoId: number, number: number, filePath?: string) {
  const q = filePath ? `?filePath=${encodeURIComponent(filePath)}` : ''
  return request<any, API.ListCommentsResponse>(`git/repos/${repoId}/prs/${number}/comments${q}`)
}

export function addPRComment(repoId: number, number: number, data: API.PRCommentRequest) {
  return request<any, { comment: T.PRCommentEntity }>(`git/repos/${repoId}/prs/${number}/comments`, { method: 'POST', data })
}

export function resolvePRComment(repoId: number, number: number, commentId: number) {
  return request<any, { comment: T.PRCommentEntity }>(
    `git/repos/${repoId}/prs/${number}/comments/${commentId}/resolve`,
    { method: 'POST' },
  )
}

export function listPRActivities(repoId: number, number: number) {
  return request<any, API.ListActivitiesResponse>(`git/repos/${repoId}/prs/${number}/activities`)
}
